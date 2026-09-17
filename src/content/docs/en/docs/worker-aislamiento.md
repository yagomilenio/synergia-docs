---
title: Worker Internals and Isolation
description: Security architecture, Docker sandboxing, C wrappers code, iptables network policies, and performance monitoring on the Synergia worker node.
---

The **Synergia Worker** is the daemon responsible for receiving distributed tasks, downloading their corresponding repositories, preparing an isolated execution environment, and safely processing each work block on the volunteer's host machine.

Since the network processes arbitrary code provided by third parties in public repositories, the worker implements a rigorous multi-layer security scheme to prevent data exfiltration, network abuse, and host manipulation.

---

## Local Configuration Files

The worker's execution environment is parameterized through three key local configuration files:

* **`~/.config/synergia/config.ini`:**
  * Defines communication parameters with the central orchestrator (base addresses and ports for REST and WebSocket APIs).
  * This file is mounted as a read-only volume inside execution containers so that internal utilities within the container (such as result upload scripts) can locate the API.
* **`~/.cn_profile.json`:**
  * Persistently stores the JWT session token obtained after a successful login with `synergia login-user` or OAuth credentials. It is used to digitally sign each request.
* **`~/.cn_device.json`:**
  * Contains the declaration of hardware resources available on the node (maximum CPU threads to allocate, dedicated MB of RAM, and the unique identifier of the GPU to be used). It is populated automatically via `synergia configure-device` or manually.

---

## Physical and Privilege Isolation: `start_docker`

Task execution (Makefile `setup` and `run` targets) is performed strictly inside a Docker container based on `python:3.12-slim` or similar. The orchestration and startup of these containers are managed by the `start_docker` utility (`worker/docker_util.py`).

To neutralize threats and ensure consistent resource measurements, the following low-level isolation directives are enforced:

### CPU Core Isolation with Thread-Locking (`--cpuset-cpus`)
If the worker used Docker's standard CPU limitation (`--cpus`), Docker's cgroups database would allocate a fraction of processing time distributed randomly among all available cores. This would cause two major problems:
1. The multitasking or multithreaded software of the task (e.g., rendering with Cycles in Blender or cracking) would attempt to spawn threads on all cores of the machine, collapsing performance and causing kernel scheduling wait times.
2. Concurrent background processes on the volunteer host would contaminate physical performance counters.

To prevent this, Synergia performs a **strict locking of CPU cores** using the `--cpuset-cpus` parameter:
```python
# worker/docker_util.py (Lines 78-79)
if cpu_threads:
    cmd += ["--cpuset-cpus", f"0-{int(cpu_threads)-1}"]
```
This flag rigidly associates and locks the container to cores from `0` to `N-1`. No other external thread can intrude on these dedicated cores, isolating the physical CPU cycle counters so that the `perf stat` metric is mathematically exact.

### Restricted Linux Capabilities and Security Mounts
By default, the container drops all privileged Linux capabilities, explicitly adding only two:
* **`CAP_PERFMON`:** Required to allow the `perf` utility to access the CPU hardware PMU (Performance Monitoring Unit) registers and record consumed CPU cycles without being root.
* **`CAP_NET_ADMIN`:** Required solely to enable the injection of `iptables` firewall rules within the container's network namespace before downgrading user privileges to `worker`.
* **Configuration File Mount (`-v ...:ro`):**
  ```python
  cmd += ["-v", f"{CONFIG_PATH.resolve()}:/scripts/config.ini:ro"]
  ```
  Mounts the local session file restrictively (read-only). This way, the task code can never edit local credentials or network data.

---

## Source Code of the Secure Download Wrappers in C

During the `make setup` phase, a malicious repository could attempt to download hot-swapped dynamic dependencies from undeclared external servers. To neutralize this vulnerability, Synergia replaces standard download binaries (`curl` and `wget`) with wrappers compiled in **C** with the **`setuid`** bit set, owned by the system user `net_user` (who has network access authorized by the firewall).

### Full Source Code of `curl_wrapper.c`
This low-level binary intercepts and audits download requests made with `curl`:

```c
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <sys/wait.h>
#include <pwd.h>
#include <sys/stat.h>
#include <openssl/sha.h>
#include <limits.h>

#define LOG_FILE "/home/net_user/external_deps.log"

// Safely calculates the SHA-256 hash of the downloaded file using OpenSSL
void calc_sha256_file(const char *filename, char *output_hex) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    unsigned char buf[4096];
    size_t n;

    FILE *f = fopen(filename, "rb");
    if (!f) {
        strcpy(output_hex, "no-output-file");
        return;
    }

    SHA256_CTX sha256;
    SHA256_Init(&sha256);
    while ((n = fread(buf, 1, sizeof(buf), f)) > 0) {
        SHA256_Update(&sha256, buf, n);
    }
    SHA256_Final(hash, &sha256);
    fclose(f);

    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        sprintf(output_hex + (i * 2), "%02x", hash[i]);
    }
    output_hex[64] = '\0';
}

int main(int argc, char *argv[]) {
    // If invoked by root, downgrade privileges to net_user for secure logging
    if (getuid() == 0) {
        struct passwd *pw = getpwnam("net_user");
        if (pw) {
            setgid(pw->pw_gid);
            setuid(pw->pw_uid);
        }
    }

    // CLI parameter analysis to extract the output file
    char *output_file = NULL;
    for (int i = 1; i < argc - 1; i++) {
        if (strcmp(argv[i], "-o") == 0 || strcmp(argv[i], "--output") == 0) {
            output_file = argv[i + 1];
            break;
        }
    }

    int capital_O = 0;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-O") == 0) {
            capital_O = 1;
            break;
        }
    }

    // Find URL in arguments
    char *url = NULL;
    for (int i = 1; i < argc; i++) {
        if (strncmp(argv[i], "http://", 7) == 0 || strncmp(argv[i], "https://", 8) == 0) {
            url = argv[i];
            break;
        }
    }

    // Infer file if using -O
    static char inferred_path[PATH_MAX];
    if (!output_file && capital_O && url) {
        char *last_slash = strrchr(url, '/');
        if (last_slash && *(last_slash + 1) != '\0') {
            char filename[PATH_MAX];
            strncpy(filename, last_slash + 1, sizeof(filename) - 1);
            filename[sizeof(filename) - 1] = '\0';
            char *q = strchr(filename, '?');
            if (q) *q = '\0';
            char cwd[PATH_MAX];
            if (getcwd(cwd, sizeof(cwd))) {
                snprintf(inferred_path, sizeof(inferred_path), "%s/%s", cwd, filename);
                output_file = inferred_path;
            }
        }
    }

    // Process fork
    pid_t pid = fork();
    if (pid == 0) {
        // CHILD PROCESS: Executes the real non-wrapper curl that has network access
        execv("/usr/bin/curl.real", argv);
        perror("execv curl.real failed");
        exit(1);
    }

    // PARENT PROCESS: Waits for download to finish and calculates hash
    int status;
    waitpid(pid, &status, 0);
    int exit_code = WIFEXITED(status) ? WEXITSTATUS(status) : 1;

    if (exit_code == 0) {
        char hash[65];
        if (output_file && access(output_file, F_OK) == 0) {
            calc_sha256_file(output_file, hash);
        } else {
            strcpy(hash, "no-output-file");
        }

        // Record download immutably in the shared log
        FILE *log = fopen(LOG_FILE, "a");
        if (log) {
            fprintf(log, "%s %s\n", hash, url ? url : "no-url");
            fclose(log);
        }
    }

    return exit_code;
}
```

### Full Source Code of `wget_wrapper.c`
Analogously to curl, the `wget` wrapper captures downloaded dependencies:

```c
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <sys/wait.h>
#include <pwd.h>
#include <sys/stat.h>
#include <openssl/sha.h>
#include <limits.h>

#define LOG_FILE "/home/net_user/external_deps.log"

void calc_sha256_file(const char *filename, char *output_hex) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    unsigned char buf[4096];
    size_t n;
    FILE *f = fopen(filename, "rb");
    if (!f) {
        strcpy(output_hex, "no-output-file");
        return;
    }
    SHA256_CTX sha256;
    SHA256_Init(&sha256);
    while ((n = fread(buf, 1, sizeof(buf), f)) > 0)
        SHA256_Update(&sha256, buf, n);
    SHA256_Final(hash, &sha256);
    fclose(f);
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++)
        sprintf(output_hex + (i * 2), "%02x", hash[i]);
    output_hex[64] = '\0';
}

int main(int argc, char *argv[]) {
    if (getuid() == 0) {
        struct passwd *pw = getpwnam("net_user");
        if (pw) {
            setgid(pw->pw_gid);
            setuid(pw->pw_uid);
        }
    }

    char *output_file = NULL;
    for (int i = 1; i < argc - 1; i++) {
        if (strcmp(argv[i], "-O") == 0 || strcmp(argv[i], "--output-document") == 0) {
            output_file = argv[i + 1];
            break;
        }
    }

    char *prefix_dir = NULL;
    for (int i = 1; i < argc - 1; i++) {
        if (strcmp(argv[i], "-P") == 0 || strcmp(argv[i], "--directory-prefix") == 0) {
            prefix_dir = argv[i + 1];
            break;
        }
    }

    char *url = NULL;
    for (int i = 1; i < argc; i++) {
        if (strncmp(argv[i], "http://", 7) == 0 || strncmp(argv[i], "https://", 8) == 0) {
            url = argv[i];
            break;
        }
    }

    static char inferred_path[PATH_MAX];
    if (!output_file && url) {
        char *last_slash = strrchr(url, '/');
        char filename[PATH_MAX];
        if (last_slash && *(last_slash + 1) != '\0') {
            strncpy(filename, last_slash + 1, sizeof(filename) - 1);
            filename[sizeof(filename) - 1] = '\0';
            char *q = strchr(filename, '?');
            if (q) *q = '\0';

            char base_dir[PATH_MAX];
            if (prefix_dir) {
                strncpy(base_dir, prefix_dir, sizeof(base_dir) - 1);
                base_dir[sizeof(base_dir) - 1] = '\0';
            } else {
                if (!getcwd(base_dir, sizeof(base_dir)))
                    base_dir[0] = '\0';
            }

            if (base_dir[0] != '\0') {
                snprintf(inferred_path, sizeof(inferred_path), "%s/%s", base_dir, filename);
                output_file = inferred_path;
            }
        }
    }

    pid_t pid = fork();
    if (pid == 0) {
        execv("/usr/bin/wget.real", argv);
        perror("execv wget.real failed");
        exit(1);
    }

    int status;
    waitpid(pid, &status, 0);
    int exit_code = WIFEXITED(status) ? WEXITSTATUS(status) : 1;

    if (exit_code == 0) {
        char hash[65];
        if (output_file && access(output_file, F_OK) == 0) {
            calc_sha256_file(output_file, hash);
        } else {
            strcpy(hash, "no-output-file");
        }
        FILE *log = fopen(LOG_FILE, "a");
        if (log) {
            fprintf(log, "%s %s\n", hash, url ? url : "no-url");
            fclose(log);
        }
    }

    return exit_code;
}
```

### Combined Integrity Validation Flow
Once the `make setup` phase is complete, the worker daemon performs the following verification check:
1. The worker recursively traverses files in the `/repo` repository (excluding what is indicated in `exclude`), calculates the SHA-256 of each of them, and generates a combined hash of the repository.
2. It reads the `/home/net_user/external_deps.log` log, which was immutably written by the C wrappers (the `worker` user does not have write permissions to this log).
3. It concatenates the combined repository hash with the download hash from `external_deps.log`.
4. The final hash is sent to the REST server at `POST /process` for validation. If it matches the original snapshot (`repo_snapshot_hash`) stored in Oracle upon publication, the server authorizes execution. Otherwise, it is immediately rejected due to suspicion of local dependency tampering.

---

## Network Firewall with `iptables`

Network isolation is the most critical mechanism from a security standpoint. It prevents data exfiltration from the host, malicious relaying connections, or DDoS attacks against third parties.

The `[network].allowed_hosts` directive in `config.toml` forces the publisher to declare beforehand which domains are required for the task. Before starting `make run`, the worker automatically injects rules into the container:

```bash
# worker/container/iptables.sh (Actual applied scheme)
# 1. Set default DROP policy for output
iptables -P OUTPUT DROP
iptables -P INPUT DROP

# 2. Allow loopback (lo) traffic and established connections
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 3. Explicitly allow DNS resolutions (Port 53)
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# 4. Allow output for authorized internal users (net_user and root)
iptables -A OUTPUT -m owner --uid-owner root -j ACCEPT
iptables -A OUTPUT -m owner --uid-owner net_user -j ACCEPT
iptables -A OUTPUT -m owner --uid-owner 42 -j ACCEPT

# 5. Resolve and insert ACCEPT exceptions for authorized domains in config.toml
# The worker resolves the domain (e.g., foldingathome.org) and adds the rule:
# iptables -A OUTPUT -d <RESOLVED_IP> -j ACCEPT
```

---

## Performance Telemetry Capture

To justify credit payments to workers, the worker daemon transparently monitors actual computational cost using low-level utilities:

* **CPU Cycles:** The `run` target is executed encapsulated under the `perf stat` utility:
  ```bash
  perf stat -e cycles --pid=<PROCESS_PID> 2>&1
  ```
  This returns the exact amount of CPU cycles consumed directly by threads assigned to the task, abstracting temporal fluctuations caused by other background processes on the host.
* **GPU Consumption:** If the task requires graphics acceleration (GPU) and the device has the corresponding hardware, the worker periodically queries the NVIDIA management API via commands such as `nvidia-smi` to extract instant power consumed (watts, TDP) and VRAM video memory in use.
* **RAM Memory:** The `/sys/fs/cgroup/memory` file is periodically read to calculate average memory consumed throughout execution.

---

## Dynamic Block Tuning Algorithm

The Synergia worker attempts to have each processing batch complete its work and upload results approximately every **60 seconds** (feedback interval determined by the `UPLOAD_INTERVAL` constant in `worker.py`).

To do this, the scheduler intelligently evaluates how long the previous block took to complete and adaptively adjusts the size of the next block to request (`n_consumes`) in its next WebSocket message `{"action": "next", "n": N}`:
* If the block was processed very quickly (e.g., in 10 seconds), it adaptively doubles the value of N to reduce network negotiation overhead.
* If processing exceeded the target interval (e.g., it took 3 minutes), it reduces the N value proportionally to ensure more frequent and smoother uploads.
