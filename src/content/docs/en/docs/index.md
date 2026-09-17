---
title: Synergia Technical Documentation Center
description: Comprehensive official documentation for developers, task publishers, and node operators.
hero:
  tagline: Explore Synergia's inner workings, relational schemas, command references, and security guides.
  actions:
    - text: Introduction and Overview
      link: ./introduccion/
      icon: right-arrow
      variant: primary
    - text: Quick Deployment Guide
      link: ./primeros-pasos/
      icon: rocket
---

Welcome to the official technical documentation center for **Synergia**. This space compiles all the design details, physical implementations, command references, and business formulas that make up the network.

---

## Documentation Structure

### Overview
* **[Introduction and Roles](./introduccion/):** What Synergia is, the motivation behind the project, and how its repositories are organized.
* **[Why Synergia?](./por-que-synergia/):** Comparison against BOINC, Folding@Home, SETI, and Golem Network.
* **[Getting Started](./primeros-pasos/):** Spin up the server with Docker Compose and connect your first worker in under 5 minutes.
* **[Server Configuration](./configuracion-servidor/):** Full reference for environment variables, Docker services, and troubleshooting.
* **[Client Configuration](./configuracion-cliente/):** System requirements (`perf`), local configuration files, and usage flows.
* **[Complete Use Case](./caso-de-uso/):** End-to-end walkthrough: publishing, processing, verification, and payout.

### Systems Architecture and Security
* **[General Architecture](./arquitectura/):** Operational breakdown of REST/WebSocket APIs, RabbitMQ, Oracle database, and tunnels.
* **[Design Patterns](./patrones-de-diseno/):** Producer-consumer, facade, singleton, middleware, and data modeling.
* **[Security and Authentication](./seguridad/):** Argon2 cryptography, JWT tokens, email verification, and OAuth 2.0 flows.
* **[Worker Isolation (Sandboxing)](./worker-aislamiento/):** Privilege reduction, Linux capabilities, and network firewalls with `iptables`.

### Economic Model and Consensus
* **[Economic Model and Incentives](./modelo-economico/):** Exact cost formulas (CPU, RAM, GPU), the genesis task, reputation penalties, and debt control (Welford's incremental algorithm).
* **[Data Model and Ledger](./modelo-de-datos/):** Full relational schema of the Oracle database and immutable transactions using Blockchain Tables.
* **[Task Flow](./flujo-de-tareas/):** Publishing, chunking, subscription, execution, verification, and closure.

### Developer Technical References
* **[config.toml Structure](./config-toml/):** Description of the 6 real input partitioning types.
* **[Makefile Contract](./contrato-makefile/):** How to package language-agnostic code (`setup`, `run`, `clean` targets).
* **[CLI Reference](./cli/):** Commands and flags list for the `synergia` terminal utility.
* **[REST API (25 endpoints)](./api-rest/):** Specification of HTTP routes, methods, headers, and payloads.
* **[WebSocket Protocol](./api-websocket/):** Real-time messaging, backpressure, and automatic reconnection upon disconnection.
* **[Prometheus Metrics](./metricas/):** Metrics catalog and Grafana dashboard setup.

### Example Tasks
* **[Demonstration Repositories](./tareas-ejemplo/):** Cryptography, biomedicine, 3D rendering, and LLM inference, with their real `config.toml` and `Makefile`.

### Resources
* **[Glossary](./glosario/):** Task, input, block, process, canonical result, credit, and reputation, explained on a single page.
* **[Roadmap](./roadmap/):** Future work items, sorted by expected impact.

---

## Project Repositories

* **[synergia-server](https://github.com/yagomilenio/synergia-server):** API, WebSocket, Oracle, and Docker deployment repository.
* **[synergia-client](https://github.com/yagomilenio/synergia-client):** CLI tool, scheduler, and worker daemon repository.
