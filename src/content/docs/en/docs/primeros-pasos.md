---
title: Getting Started
description: Quick start guide to deploy the Synergia server and connect a client node.
---

This guide will walk you through setting up a complete local instance of Synergia, including the orchestrator server and a client node (worker) configured to process tasks and receive credits, in less than 5 minutes.

:::tip[Are you deploying for production?]
This guide covers the bare minimum to get Synergia running locally. For the full reference of environment variables, ports, `docker-compose.yml` services, and troubleshooting, refer to [Server Configuration](../configuracion-servidor/) and [Client Configuration](../configuracion-cliente/).
:::

---

## Server Deployment

The Synergia backend is deployed using Docker Compose, packaging the REST API, WebSocket API, RabbitMQ queue, Oracle Database, and the monitoring stack.

### Prerequisites
* Docker and Docker Compose installed.
* Ports `8000`, `8001`, `5672`, `1521`, and `3000` must be free on your host machine.

### Start Instructions
Clone the `synergia-server` repository and navigate to the infrastructure folder:

```bash
git clone https://github.com/yagomilenio/synergia-server.git
cd synergia-server/infra/docker
```

Copy the example environment variables file and configure the necessary passwords (JWT keys, Oracle passwords, etc.):

```bash
cp .env.example .env
# Open .env with your editor and fill in the required variables
```

Bring up the service stack in the background:

```bash
docker compose up -d
```

:::note[Oracle Initialization]
The Oracle database takes approximately **1 to 2 minutes** to start up for the first time and execute the table creation scripts. The REST API service (`rest_api`) has a health check that waits for Oracle to be completely ready before starting.
:::

You can check that the server is responding correctly by querying the metrics endpoint:

```bash
curl http://localhost:8000/metrics
```

---

## Installing the CLI Client

The client is implemented in Python and requires **Python 3.10+** and **Docker** installed on the machine that will act as a worker.

### Package Installation

Since it is published on PyPI, you can install the CLI directly in the fastest and simplest way:

```bash
pip install synergia
```

Alternatively, if you want to perform development or install from source code, you can clone the `synergia-client` repository and install it in editable mode:

```bash
git clone https://github.com/yagomilenio/synergia-client.git
cd synergia-client
pip install -e .
```

Once installed, verify that the `synergia` command is available in your terminal:

```bash
synergia --help
```

---

## Node Configuration and First Operations

Follow these sequential steps to register an account on the local network and set your hardware to work:

### Step 1: Create a user account
Register on the network by providing a username, an email, and a password. The email must belong to a domain permitted by the server:

```bash
synergia sign-up-user --username your_user --email you@mail.com --passwd your_secret
```

:::tip[Email Verification]
If the SMTP server is configured on the backend, you will receive a confirmation link by email. In development environments, you can simulate confirmation by visiting the link shown in the logs of the REST API container.
:::

### Step 2: Log in
Log in locally to obtain your JWT token, which will be securely stored in `~/.cn_profile.json`:

```bash
synergia login-user --username your_user --passwd your_secret
```

### Step 3: Declare hardware resources
The client can auto-detect the available CPU, RAM, and GPU to allocate to tasks:

```bash
synergia configure-device
```
*This command will create the `~/.cn_device.json` file detailing the threads, MB of RAM, and the allocated GPU device ID.*

### Step 4: Find and subscribe to a task
Search for active tasks on the network:

```bash
synergia find-task --status ACTIVE
```

Subscribe to the task by specifying its ID (for example, task `1`):

```bash
synergia subscribe-task --task-id 1
```

### Step 5: Run the worker
Start the worker daemon to begin consuming chunks from the WebSocket queue, executing the corresponding Makefile inside an isolated Docker container, and uploading valid results:

```bash
synergia start-scheduler --mode round-robin
```

Congratulations! Your machine is processing its first block of distributed computing and earning credits for the contributed work.
