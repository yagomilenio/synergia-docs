---
title: Server Configuration
description: Complete deployment reference for the Synergia backend — environment variables, docker-compose services, ports, and troubleshooting.
---

This page is the comprehensive reference for deploying `synergia-server` in a production-ready environment, going beyond the quick start in [Getting Started](../primeros-pasos/). It covers every environment variable, every service in the Docker stack, and the most common troubleshooting issues when spinning it up.

---

## Prerequisites

* Docker and Docker Compose.
* Python 3.11+ (only needed if running the API outside of Docker).

## Repository Infrastructure Structure

```
synergia-server/
├── src/                               # REST API, WebSocket API, data access
├── infra/
│   ├── docker/
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   └── .env.example
│   ├── database/oracle-init/          # Oracle initialization scripts
│   ├── monitoring/
│   │   ├── prometheus/prometheus.yml
│   │   └── dashboards/synergia_dashboard.json
│   └── ngrok/ngrok.yml
└── docs/
    ├── CONFIG_REFERENCE.md            # Complete config.toml reference
    ├── entidad-relacion-synergia.png
    └── modelado-datos-synergia.png
```

---

## Environment Variables

Copy the example file and fill it in before spinning up the stack:

```bash
cp infra/docker/.env.example infra/docker/.env
```

| Variable | Service | Description |
|---|---|---|
| `JWT_SECRET_KEY` | REST / WS API | Secret key used to sign and verify session JWT tokens. |
| `SMTP_PASSWD` | REST API | Password of the SMTP account used to send local registration verification emails. |
| `GOOGLE_CLIENT_SECRET` | REST API | Google OAuth application secret for `login-google`. |
| `GITHUB_CLIENT_SECRET` | REST API | GitHub OAuth application secret for `login-github`. |
| `NGROK_AUTHTOKEN` | ngrok | Authentication token for your ngrok account, required to expose the APIs publicly during development. |
| `MARIADB_ROOT_PASSWORD` / `MARIADB_PASSWORD` | mariadb | Variables inherited from a previous version of the database engine (see note). |
| `ORACLE_PASSWORD` | oracle | Password of the `SYS`/administrator user for the Oracle Database Free instance. |
| `ORACLE_APP_PASSWORD` | oracle | Password of the `synergia` application user created within the database. |
| `GRAFANA_ADMIN_PASSWORD` | grafana | Password of the `admin` user for the Grafana dashboard. |
| `RABBITMQ_PASSWORD` | rabbitmq | Password for the RabbitMQ message queue. |

:::note[Why are there MariaDB variables if the database is Oracle?]
`MARIADB_ROOT_PASSWORD` and `MARIADB_PASSWORD` are variables inherited from a previous stage of the project, where the data access layer implemented the [strategy pattern](../patrones-de-diseno/#estrategia-retirado) to support both MySQL/MariaDB and Oracle. After the final migration to Oracle Database Free (necessary to leverage its *Blockchain Tables*), this component was removed, but the variables are kept in `.env.example` for backward compatibility.
:::

---

## Services in `docker-compose.yml`

| Service | Image / build | Port(s) | Description |
|---|---|---|---|
| `oracle` | `container-registry.oracle.com/database/free:latest` | `1521` | Relational database. Mounts the scripts from `infra/database/oracle-init/` and takes **1-2 minutes** to be ready the first time. |
| `rabbitmq` | `rabbitmq:3-management` | `5672`, `15672`, `15692` | Message broker. `15672` is the management console, `15692` exposes native Prometheus metrics. |
| `rest_api` | build from `Dockerfile` | `8000` | REST API (FastAPI + Uvicorn), started with `--reload` in development mode. Depends on `rabbitmq` being *healthy*. |
| `ws_api` | build from `Dockerfile` | `8001` | WebSocket API (FastAPI + Uvicorn), consumer of RabbitMQ queues. Depends on `rabbitmq` being *healthy*. |
| `prometheus` | `prom/prometheus` | `9090` | Scrapes the metrics exposed by `rest_api`, `ws_api`, and RabbitMQ. |
| `grafana` | `grafana/grafana` | `3000` | Monitoring dashboards (see [Metrics](../metricas/)). |
| `test` | local build (`--profile test`) | — | Runs the `pytest` suite. Not spun up unless the `test` profile is explicitly invoked. |
| `ngrok` | `ngrok/ngrok:latest` | `4040` | Development tunnel to expose `rest_api`/`ws_api` publicly without a fixed IP. |

All services are configured with `restart: unless-stopped`, except for `test`.

---

## Getting Started

```bash
git clone https://github.com/yagomilenio/synergia-server.git
cd synergia-server/infra/docker

cp .env.example .env
# Fill in JWT_SECRET_KEY, ORACLE_PASSWORD, ORACLE_APP_PASSWORD, RABBITMQ_PASSWORD, etc.

docker compose up -d
```

Verify that everything is running:

```bash
curl http://localhost:8000/metrics
curl http://localhost:8001/metrics
```

If you have configured `NGROK_AUTHTOKEN`, you can see the exposed public endpoints for each of the APIs (REST and WebSocket) at `http://localhost:4040`.

### Running the Tests

```bash
docker compose -f infra/docker/docker-compose.yml --profile test run test
```

---

## Used Ports

| Port | Service |
|---|---|
| `8000` | REST API |
| `8001` | WebSocket API |
| `1521` | Oracle Database |
| `5672` | RabbitMQ (AMQP) |
| `15672` | RabbitMQ (management console) |
| `15692` | RabbitMQ (Prometheus metrics) |
| `9090` | Prometheus |
| `3000` | Grafana |
| `4040` | ngrok (tunnels dashboard) |

---

## Troubleshooting

:::note[The Oracle healthcheck does not finish starting]
Oracle Database Free takes between 1 and 2 minutes to be ready the first time, as it initializes the pluggable database `FREEPDB1` and executes the scripts in `oracle-init/`. The `rest_api` service has a `depends_on: rabbitmq: condition: service_healthy` condition, so if `rest_api` does not start, check the status of `rabbitmq` first, not `oracle`. To view the actual progress of Oracle: `docker compose logs -f oracle`.
:::

:::note[`rest_api` or `ws_api` is not responding]
Both services are launched with `--reload` and `--log-level debug`, so any startup exception (typically an empty environment variable) will appear immediately in `docker compose logs -f rest_api` or `... ws_api`. First, make sure that `.env` has all the variables from the table above filled in — the `.env.example` file marks each one with `change_me`.
:::

:::note[I need to view the logs of a specific service]
```bash
docker compose -f infra/docker/docker-compose.yml logs -f <service>
```
Replace `<service>` with `oracle`, `rabbitmq`, `rest_api`, `ws_api`, `prometheus`, `grafana`, or `ngrok`.
:::

---

## Related References

* [System Architecture](../arquitectura/) — why each of these components was chosen (FastAPI, RabbitMQ, Oracle).
* [Prometheus Metrics](../metricas/) — complete catalog of exposed metrics and Grafana dashboard configuration.
* [REST API](../api-rest/) and [WebSocket API](../api-websocket/) — endpoint specifications once the server is running.
