---
title: Roadmap
description: Future lines of work planned for Synergia, ordered by expected impact.
---

These are the most promising future lines of work for Synergia, ordered by expected impact.

---

## 1. Transparent Proxy for Traffic Capture

The implementation of a transparent HTTP/HTTPS proxy in containers would allow intercepting all download traffic regardless of the tool used, eliminating the current dependency on `curl` and `wget` wrappers (see [Worker Isolation](../worker-aislamiento/)).

## 2. Classification of Verifiable Tasks in `config.toml`

It is proposed to add a configurable parameter in the `config.toml` file to indicate whether a task is easily verifiable directly. This would be the case for problems such as password cracking, where the validity of the result can be checked without requiring cross-verification. This would optimize the validation system, reducing computation replication in scenarios where it is unnecessary and improving overall platform efficiency.

## 3. Support for AMD GPUs via ROCm

The current credit formula is limited to NVIDIA GPUs. Integration with tools such as `rocm-smi` would extend support to AMD GPUs, expanding the ecosystem of available workers and reducing dependency on a single manufacturer.

## 4. Compatibility with Windows Environments

Currently, execution on Windows systems presents limitations due to the use of WSL, which does not allow access to internal CPU counters necessary for accurate measurement of computational cost. As a future line of work, the system could be adapted to native Windows environments, exploring alternatives such as OS-specific APIs or compatible measurement mechanisms that maintain precision in credit calculation.

## 5. Support for Non-Profit Collaborative Tasks

It is proposed to enable the possibility of defining free tasks aimed at community collaboration. These tasks would not require credit payments by the publisher, and their execution would depend on the collective interest of users. A governance mechanism could be introduced whereby these tasks are published only if they reach a certain level of support, or through periodic voting processes among several proposals presented to platform users.

## 6. Self-Hosted API for the Client

It is planned to enable deploying an API that launches alongside the platform client, allowing programmatic use from the same environment. This would facilitate integration with external tools, particularly in the development of self-hosted web interfaces, improving system accessibility.

## 7. Integration with Agents via Model Context Protocol (MCP)

As an evolution of the API mentioned in the previous point, the development of an MCP-based adapter is proposed to allow interaction with the platform through intelligent agents.

---

:::note[Do you have an idea for Synergia?]
These lines of work are starting points, not rigid delivery commitments. If you want to propose or discuss any of them, or suggest a new one, open an issue in [synergia-server](https://github.com/yagomilenio/synergia-server) or [synergia-client](https://github.com/yagomilenio/synergia-client).
:::
