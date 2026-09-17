---
title: Why Synergia?
description: Comparative of Synergia against BOINC, Folding@Home, SETI, Golem Network, and other distributed computing platforms.
---

Considering the general purpose of the platform and the objective for which it is designed, there are several platforms with relevant similarities. The most significant ones are reviewed below, comparing Synergia against them.

---

## Reference Platforms

### BOINC

One of the most well-known and prestigious references is **Berkeley Open Infrastructure for Network Computing (BOINC)**, created by the University of Berkeley in 2002. This tool is primarily oriented towards publishing scientific projects developed in C++. Although it supports other programming languages, their integration requires implementing additional components called *wrappers*. This dependency increases the complexity of project development, deployment, and maintenance, constituting a significant limitation of the platform. Furthermore, its incentive system is entirely cosmetic and only serves as an accreditation; these credits are granted once it has been confirmed that the result is correct.

One of its biggest limitations appears when publishing projects, where it is necessary to deploy a proprietary server hosting a node of this tool, or to have an agreement directly with the University of Berkeley. Some of the particularly relevant published projects are *Search for Extraterrestrial Intelligence* (SETI) and Rosetta@home. Additionally, the BOINC client does not natively implement an isolation mechanism for task execution; instead, it resorts to creating a user and a group with reduced privileges on the host system.

### Folding@Home

Developed by Stanford University, it focuses directly on simulating protein folding to help scientific projects in the field of biomedicine searching for cures to diseases. It implements an incentive system that awards credits known as *FAH Points*, which are purely cosmetic; moreover, in this case, there is no known system that verifies the results. According to information published on the platform's website, it can be estimated that they have some verification system, but it is not clearly determined.

Furthermore, this platform only enables the publication of Stanford internal projects, with a rigid system based on various processing engines; most of the code executed on clients is written in C++, given the periodic execution of GROMACS.

### SETI

It is also worth noting **SETI**, an astronomical-themed distributed computing project that searched for signals of extraterrestrial life, running on its own client. Due to its massive success, it motivated the design of the BOINC platform years later, and SETI was subsequently migrated as just another project within BOINC.

### Golem Network

One of the latest platforms launched was **Golem Network**, based on Ethereum blockchain technology, making it a decentralized option without a central point of control. It requires more complex configurations for client execution, and its *peer-to-peer* nature adds additional latencies. However, it features a cross-verification system and does present a real incentive system: the credits provided are tokens, specifically **GLM**.

This platform does not have a specific purpose like the previous ones — the tasks executed are general-purpose — and allows creating tasks in multiple languages, with JavaScript and Python being the most common. Golem Network provides Docker container images to execute tasks in isolation, although its native configuration is often installed locally without any form of isolation.

### MPI, Hadoop, Spark, and CI Systems

From another perspective, there are tools oriented towards parallel and distributed computing. **Message Passing Interface (MPI)**, considered one of the standards in *High Performance Computing* (HPC), allows communication between distributed processes in clusters. However, it requires tasks to be written specifically for its API, along with the need to operate in controlled environments with an adequate network infrastructure.

**Apache Hadoop** and **Apache Spark** are distributed data processing frameworks primarily oriented towards analyzing large volumes of information. Although they allow distributing workload among nodes, they are designed for specific paradigms, lack any incentive system, and require managed proprietary infrastructure, making them inaccessible to external users.

Finally, tools like **GitHub Actions** or **GitLab CI** allow automated execution of tasks defined in repositories, similarly to Synergia's behavior. However, they are exclusively oriented towards continuous integration and deployment workflows, do not allow the participation of external nodes, and all computation relies on the provider's infrastructure.

---

## Platform Comparison

| Platform | Incentives | Arbitrary Tasks | Isolation | Verification | Open Participation | Self-Hostable | Orientation |
|---|---|---|---|---|---|---|---|
| BOINC | Cosmetic | Partial | Partial | Yes | No | Yes | Scientific |
| Folding@Home | Cosmetic | No | Partial | — | No | No | Biomedical Scientific |
| SETI | Cosmetic | No | Partial | Yes | No | No | Astronomical Scientific |
| Golem Network | Yes | Yes | Yes | Yes | Yes | No | General |
| **Synergia** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **General** |

*The evaluation is based on a qualitative scale: **Yes** (fully meets the criterion), **No** (does not support it), **Partial** (supports it only in certain cases or with significant functional limitations), and **-** (information not available or not shared publicly).*

Golem Network features an architecture that, in certain aspects, is comparable to Synergia's proposal, being one of the most modern solutions in the ecosystem. Among the main differentiating factors is the higher configuration difficulty of Golem Network, associated with the use of blockchain technology; Synergia, on the other hand, is characterized by a relatively simple setup of the system.

---

## What Differentiates Synergia

* **Accessible Publishing.** Any user who can authenticate must be able to publish tasks easily (if they have enough credits), without complex configurations or installations. The initial publishing cost is static per task; the publisher will dynamically pay the nodes that process it as an exchange of computational power.

* **Real Incentives without Blockchain.** Synergia implements an economic incentive system without relying on blockchain technology, eliminating the operational complexity and entry barrier associated with managing *wallets* and network fees.

* **Cross-Verification of Results.** It detects nodes reporting fraudulent results, guaranteeing the integrity of the distributed computation without requiring a trusted central authority.

* **Arbitrary Tasks.** Tasks do not have to be written in specific languages; they simply must follow a certain structure with basic configurations (see [Makefile Contract](../contrato-makefile/) and [config.toml](../config-toml/)), which guarantees the execution of arbitrary tasks.

* **Real Isolation by Design.** Synergia allows isolated task execution via containers, significantly reducing security risks and directly preventing task execution on the host operating system. Most platforms in the ecosystem implement their local version without adequate isolation and then encapsulate it in containers; Synergia starts from the premise that it is only possible to run tasks if there is an effective virtualization capacity (see [Worker Isolation](../worker-aislamiento/)).

* **Self-Hosted Mode.** Unlike Golem Network, which due to its decentralized nature lacks a centralized control point, Synergia can be deployed in self-hosted mode, allowing its use in controlled environments with a small number of machines and even eliminating costs associated with task execution when required.

* **No Link to Real Monetary Value.** Synergia maintains no link to real-world monetary value, meaning external economic exchanges are not permitted. This explicit separation aims to avoid any external financial incentives and significantly reduce the appearance of malicious actors, focusing the system on the fair, transparent, and direct exchange of computational power among participants.
