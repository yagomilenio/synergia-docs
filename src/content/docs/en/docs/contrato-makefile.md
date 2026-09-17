---
title: Makefile Contract
description: Specification of Synergia's task execution interface based on native GNU Makefiles.
---

One of the most robust and flexible design decisions in Synergia is the technological decoupling of task code using the standard **GNU Make** interface.

The platform is **language-agnostic** regarding the programming language used in the task (Python, C++, Rust, Node.js, Bash...). Instead of forcing the developer to import libraries or package executables following Synergia-specific architectures, the system enforces a **Makefile contract**. If the task can be compiled and executed using local console commands, it will run on the distributed network without alteration.

---

## The Three Mandatory Targets

The worker orchestrator invokes compilation and execution commands inside the shared `/repo` folder of the container with the directive:
`cd /repo && make <target>`

The developer must explicitly define these three targets in their `Makefile`:

| Target | When it is invoked | Environment Variables Received | Responsibility |
| :--- | :--- | :--- | :--- |
| **`setup`** | Once, before starting the first chunk of work. The environment is cached locally. | None. | Install local dependencies in the container, compile C/C++ executables, download Python packages (`pip install`), or configure local environment variables. |
| **`run`** | For each block (chunk) of work assigned to the worker over WebSocket. | Dynamic (see variables below). | Perform the logical processing of the chunk and write the final results to the directory configured in `[outputs].dir` in `config.toml`. |
| **`clean`** | Before each invocation of `run` and upon completion of packaging. | None. | Clean up and delete any residue, temporary files, or outputs from previous executions to avoid false positives and ensure the deterministic integrity of the final packaging. |

---

## Environment Variables Injected into `make run`

The worker injects the work chunk parameters directly as shell environment variables when invoking the `make run` command.

The Makefile must intercept these variables according to the input type configured in `config.toml`:

### `START` and `END`
Injected into tasks based on ranges (`range_continuous`, `range_discrete`), directories (`directory`), or file arrays (`file_multi`). They define the closed interval of indexes to process in the current chunk.
```bash
# Actual worker invocation
cd /repo && make run START=100 END=199
```

### `WORD`
Injected exclusively into dynamic tasks (`dynamic`). Contains the unique string of the assigned item.
```bash
# Actual worker invocation (sanitized with shlex.quote)
cd /repo && make run WORD='my_input_prompt'
```

### `WORDS`
Injected into tasks that process a single remote file split by lines (`file_single`). Contains a space-separated list of values corresponding to the lines of the current chunk extracted by `awk`.
```bash
# Actual worker invocation
cd /repo && make run WORDS='lineA lineB lineC'
```

---

## Real Implementation Examples

### Example 1: C/C++ Task (Cryptography)
This Makefile compiles a brute-force C binary during the `setup` phase and executes it by passing range boundaries into `run`:

```makefile
# Variables injected by worker: START, END
CC = gcc
CFLAGS = -O3 -Wall
TARGET = cracker
OUTPUT_DIR = outputs

.PHONY: setup run clean

setup:
	$(CC) $(CFLAGS) src/main.c -o $(TARGET) -lcrypto

run:
	@mkdir -p $(OUTPUT_DIR)
	./$(TARGET) --start $(START) --end $(END) --output $(OUTPUT_DIR)/result_$(START)_$(END).txt

clean:
	rm -f $(TARGET)
	rm -rf $(OUTPUT_DIR)
```

### Example 2: Python Task (AI Inference)
This Makefile installs the required Python dependencies (`setup`) and executes inference passing a dynamic prompt in `WORD`:

```makefile
# Variable injected by worker: WORD
VENV = .venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip
OUTPUT_DIR = outputs

.PHONY: setup run clean

setup:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

run:
	@mkdir -p $(OUTPUT_DIR)
	$(PYTHON) src/inference.py --prompt "$(WORD)" --out $(OUTPUT_DIR)/response.json

clean:
	rm -rf $(OUTPUT_DIR)
	# Note: We do not delete $(VENV) to take advantage of the setup cache between chunks
```