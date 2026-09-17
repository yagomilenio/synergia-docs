---
title: config.toml Reference
description: Complete specification of the sections recognized by the actual Synergia parser in the task configuration file.
---

The `config.toml` file must reside at the root of the task repository. It is the manifest that describes the hardware requirements, input partitioning, network permissions, and task validation behavior.

It is interpreted in the worker by the `ConfigurationInterpreter` class (`worker/utils/configuration_interpreter.py`) using the Python standard library `tomllib`.

---

## General Structure and Recognized Sections

The actual parser strictly recognizes the following sections and fields. Any section not specified here (such as `[runner]`, which was discarded in favor of the native Makefile contract) will be ignored by the orchestrator.

```toml
# Example of a complete config.toml manifest
[task]
deterministic = true

[requirements]
packages = ["build-essential", "libssl-dev"]

[[download.files]]
url  = "https://domain.com/large_resource.bin"
dest = "resources/data.bin"
post = "chmod 644 resources/data.bin"

[hash]
exclude = ["build/", "logs/", "outputs/"]

[network]
allowed_hosts = ["api.external.org", "repository.com"]

[outputs]
dir              = "outputs"
filename_pattern = "results_{start}_{end}.tar.gz"
mode             = "file"
```

---

## Configuration Field Details

### Section `[task]`
* **`deterministic` (bool, default `true`):** Determines whether the task outcome is reproducible given identical inputs. If `true`, the server will enable mandatory cross-verification via majority consensus of output hashes.

### Section `[requirements]`
* **`packages` (array of strings, optional):** List of packages from the `apt` manager that the worker will install in the Docker container via an automated command before invoking the setup phase of the Makefile.

### Section `[[download.files]]`
Allows declaring bulky external files that should not be saved directly in the Git repository but are necessary for the task. It is an array of tables:
* **`url` (string, required):** Direct HTTP/HTTPS download URL of the file.
* **`dest` (string, required):** Relative destination path where the file will be written inside the `/repo` working directory.
* **`post` (string, optional):** Optional shell command to run in the container after the download completes (e.g., decompression with `tar -xf` or permissions with `chmod`).

### Section `[hash]`
* **`exclude` (array of strings, optional):** Paths of files or folders that the worker must ignore when calculating the repository snapshot integrity hash. Useful for preventing snapshot failures caused by dynamically generated subdirectories during local compilation or execution (`.o` files, log folders, etc.).

### Section `[network]`
* **`allowed_hosts` (array of strings, optional):** Whitelist of DNS domain names to which the container's `iptables` firewall will allow outbound connections. Name resolution is performed dynamically when starting up the environment.

### Section `[outputs]`
Describes how the worker should capture outputs:
* **`dir` (string, default `"."`):** Relative directory where the Makefile is expected to write the final result files.
* **`filename_pattern` (string, default `"*"`):** Wildcard pattern to identify the files to package. Supports dynamic markers `{start}`, `{end}`, and `{worker_id}`.
* **`mode` (string, `"file"` | `"stdout"`, default `"file"`):** If defined as `"stdout"`, the worker will not search for physical files; it will directly capture the standard output (stdout) stream of the `make run` execution and upload it as a result to the server.

---

## `[inputs]` Section Specification (6 Input Types)

The `type` field acts as the section discriminator and tells the server producer how to subdivide the work. Synergia implements **six real input types**:

### directory
Lists files contained in a subdirectory of the Git repository during the publishing phase (`GithubUtil.list_dir`) and assigns them continuous numerical indexes from 0 to N-1:
```toml
[inputs]
type = "directory"

[inputs.directory]
path       = "inputs/images"
recursive  = false
extensions = [".png", ".jpg"]
sort_order = "filename"
```

### file_multi
Selects multiple files distributed across the repository using a glob-type wildcard pattern (`GithubUtil.list_glob`):
```toml
[inputs]
type = "file_multi"

[inputs.file_multi]
glob   = "datasets/**/*.csv"
format = "text"   # binary | text | image | video
```

### file_single (Optimized for Large Files)
Partitions a single large file into chunks. It offers two highly engineered advanced operating modes:

#### Text Lines Mode (Indexless)
The worker does not download the entire data file. It uses an optimized `awk` command with the `delimiter` configured as the record separator (`RS`) to extract and download to the container **exclusively** the block of lines corresponding to the assigned input index range:
```toml
[inputs]
type = "file_single"

[inputs.file_single]
path        = "inputs/dictionary.txt"
format      = "text"
delimiter   = "\n"
encoding    = "utf-8"
skip_header = false
```

#### Indexed Binary Mode
Designed for large-volume binary datasets where reading line-by-line is infeasible. It requires a complementary `.bin` index file that specifies the offsets and lengths in bytes of each record. The worker reads this lightweight index using `dd` and performs a direct random access by offsets on the source file to extract exclusively the corresponding binary range:
```toml
[inputs.file_single]
path        = "inputs/corpus.bin"
format      = "binary"
index_file  = "inputs/corpus_indices.bin"
index_len   = 16  # byte width per index record
```

### range_continuous
Defines a numerical range of continuous linear progression. The producer represents it internally analytically using a Python `range()` object, avoiding instantiating arrays of millions of integers in RAM:
```toml
[inputs]
type = "range_continuous"

[inputs.range_continuous]
start = 0
end   = 9999999
step  = 1
```

### range_discrete
Explicit list of non-contiguous numerical or literal values. Useful for launching selective reprocessing of specific blocks that failed in previous executions:
```toml
[inputs]
type = "range_discrete"

[inputs.range_discrete]
values = [14, 55, 921, 1044, 88201]
```

### dynamic
Indicates that the task is **dynamic**. It does not have a fixed number of items at publishing time. Inputs are injected on the fly via HTTP POST calls to the REST API, and the orchestrator distributes them to workers as individual strings (`input_value`) which the Makefile receives via the `WORD` environment variable. Designed for continuous streams of prompts to LLMs.
```toml
[inputs]
type = "dynamic"
# Does not require an additional configuration subsection
```