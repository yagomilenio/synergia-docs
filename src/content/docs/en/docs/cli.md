---
title: CLI Reference (synergia)
description: Complete catalog of the 23 commands available in the Synergia command-line client.
---

The `synergia` command is the unified interaction interface for platform users. It allows managing accounts, configuring host physical resources, publishing tasks as a publisher, controlling subscriptions as a worker, and scheduling background executions.

---

## Authentication and Account Commands

### `sign-up-user`
Registers a new local user account on the Synergia network.
```bash
synergia sign-up-user --username <username> --email <email> --passwd <password>
```
* **Parameters:**
  * `--username` (required): Unique account name.
  * `--email` (required): Contact email (must belong to an allowed domain).
  * `--passwd` (required): Local access password (will be hashed with Argon2 on the server).

### `login-user`
Logs in locally using a password. Stores the obtained JWT token in `~/.cn_profile.json`.
```bash
synergia login-user --username <username> --passwd <password>
# or alternatively via email:
synergia login-user --email <email> --passwd <password>
```

### `login-google`
Initiates the secure OAuth 2.0 authentication flow using your Google account.
```bash
synergia login-google
```
*Opens a browser window to complete the login. If the user did not exist, it creates the account automatically.*

### `login-github`
Initiates the secure OAuth 2.0 authentication flow using your GitHub account.
```bash
synergia login-github
```

### `logout-user`
Closes the active session by locally deleting the `~/.cn_profile.json` file containing the JWT.
```bash
synergia logout-user
```

### `get-user-details`
Displays the current credit balance, weighted reputation, and public financial transfer history of a user.
```bash
synergia get-user-details --username <username>
```

---

## Device Configuration Commands

### `configure-device`
Allows declaring and configuring which hardware resources of the volunteer host will be exposed to execute tasks.
* **Auto-detection:** If invoked without arguments, it reads the physical CPU, RAM, and GPU of the machine:
  ```bash
  synergia configure-device
  ```
* **Manual:** Allows manually limiting the resources to share, saving the structure in `~/.cn_device.json`:
  ```bash
  synergia configure-device --cpu-threads 4 --gpu-device 0 --ram 4096
  ```

---

## Publishing and Control Commands (Publisher)

### `create-task`
Publishes a task pointing to a public GitHub repository.
```bash
synergia create-task --name <name> --github-url <url> [--description <desc>] [--resources cpu,ram] [--requirements min_ram_mb=2048]
```
* **Parameters:**
  * `--name` (required): Identifying name of the task.
  * `--github-url` (required): Link to the public Git repository.
  * `--description` (optional): Long description of the task's purpose.
  * `--resources` (optional): Resources consumed by the Makefile (values: `cpu`, `gpu`, `ram`).
  * `--requirements` (optional): Minimum requirements for the worker (e.g., `min_ram_mb=4096`).

### `find-task`
Searches and lists available tasks on the Synergia network.
```bash
synergia find-task [--name <query>] [--status ACTIVE|PAUSED|COMPLETED] [--subscribed] [--global-search]
```
* **Parameters:**
  * `--subscribed`: Filters by showing only the tasks to which your worker is subscribed.
  * `--global-search`: Forces a query against the general database index, bypassing local session caches.

### `task-info`
Displays extended details of a specific task, its status, the expected snapshot hash, and item progress.
```bash
synergia task-info --task-id <id>
```

### `add-inputs`
Injects new inputs into a dynamic task (`dynamic`) that is already published and in active state.
```bash
synergia add-inputs --task-id <id> --file <file_path> [--delimiter <char>]
# or passing direct text:
synergia add-inputs --task-id <id> --text "sample_prompt"
```

### `sync-task`
Synchronizes and updates the integrity snapshot hash (`repo_snapshot_hash`) and the Git commit of the repository on the server after having made legitimate modifications to the task code.
```bash
synergia sync-task --task-id <id>
```

### `output-task`
Downloads or queries the valid processing results of a task.
```bash
synergia output-task --task-id <id> [--download] [--canonical-only] [--process-id <pid>]
```
* **Parameters:**
  * `--download`: Downloads a ZIP containing all output files into your local directory.
  * `--canonical-only`: Filters to download only files accepted by consensus.

### `pause-task` / `active-task` / `cancel-task` / `close-task`
Modify the lifecycle state of a task of which you are the publisher.
```bash
synergia pause-task --task-id <id>
synergia active-task --task-id <id>
synergia cancel-task --task-id <id>
synergia close-task --task-id <id>  # Only applicable for closing dynamic tasks
```

---

## Subscription and Verification Commands (Worker)

### `subscribe-task`
Subscribes the worker to a task so that the node starts receiving, processing, and uploading work chunks continuously.
```bash
synergia subscribe-task --task-id <id> [--no-cache] [--yes]
```
* **Parameters:**
  * `--no-cache`: Forces the worker to recreate the Docker container and run `make setup` from scratch, bypassing previous caches.

### `unsubscribe-task`
Permanently cancels your subscription to a task.
```bash
synergia unsubscribe-task --task-id <id>
```

### `process-info`
Returns the operational details of a process (chunk), its assigned item range, its output hash, and the list of associated validator executions.
```bash
synergia process-info --task-id <id> --process-id <pid>
```

### `confirm-process`
Forces the worker to manually perform a cross-verification run on a pending process processed by another node.
```bash
synergia confirm-process --task-id <id> --process-id <pid> [--no-cache]
```

---

## Scheduler Commands

### `start-scheduler`
Starts the automated scheduler to coordinate your node's subscriptions.
* **Round-Robin Mode (Turn-Based):** Cycles through the queues of active tasks, processing a maximum of `rotation` chunks in each:
  ```bash
  synergia start-scheduler --mode round-robin [--rotation 5] [--on-idle]
  ```
* **Split Mode (Resource Sharing):** Divides your CPU threads among all subscribed active tasks and processes them concurrently in the background:
  ```bash
  synergia start-scheduler --mode split
  ```

---

## Testing Commands (Local Testing)

Allow validating that a task repository complies with the `Makefile` contract and runs in isolation locally before spending credits publishing it to the network.

### `test-task`
Tests the repository locally, simulating an environment identical to the worker container:
```bash
# Test with a continuous numerical range
synergia test-task --github-url <url> --range 0 99

# Test with a single dynamic input
synergia test-task --github-url <url> --word "my_test_input"
```