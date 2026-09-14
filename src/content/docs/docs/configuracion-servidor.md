---
title: Configuración del Servidor
description: Referencia completa de despliegue del backend de Synergia — variables de entorno, servicios de docker-compose, puertos y troubleshooting.
---

Esta página es la referencia exhaustiva para desplegar `synergia-server` en serio, más allá del arranque rápido de [Primeros Pasos](/docs/primeros-pasos/). Cubre cada variable de entorno, cada servicio de la pila Docker y los problemas más comunes al levantarla.

---

## Requisitos previos

* Docker y Docker Compose.
* Python 3.11+ (solo si se quiere lanzar la API fuera de Docker).

## Estructura de infraestructura del repositorio

```
synergia-server/
├── src/                               # API REST, API WebSocket, acceso a datos
├── infra/
│   ├── docker/
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   └── .env.example
│   ├── database/oracle-init/          # Scripts de inicialización Oracle
│   ├── monitoring/
│   │   ├── prometheus/prometheus.yml
│   │   └── dashboards/synergia_dashboard.json
│   └── ngrok/ngrok.yml
└── docs/
    ├── CONFIG_REFERENCE.md            # Referencia completa de config.toml
    ├── entidad-relacion-synergia.png
    └── modelado-datos-synergia.png
```

---

## Variables de entorno

Copia el fichero de ejemplo y rellénalo antes de levantar la pila:

```bash
cp infra/docker/.env.example infra/docker/.env
```

| Variable | Servicio | Descripción |
|---|---|---|
| `JWT_SECRET_KEY` | API REST / WS | Clave secreta usada para firmar y verificar los tokens JWT de sesión. |
| `SMTP_PASSWD` | API REST | Contraseña de la cuenta SMTP usada para enviar los correos de verificación de registro local. |
| `GOOGLE_CLIENT_SECRET` | API REST | Secreto de la aplicación OAuth de Google para `login-google`. |
| `GITHUB_CLIENT_SECRET` | API REST | Secreto de la aplicación OAuth de GitHub para `login-github`. |
| `NGROK_AUTHTOKEN` | ngrok | Token de autenticación de tu cuenta ngrok, necesario para exponer las APIs públicamente en desarrollo. |
| `MARIADB_ROOT_PASSWORD` / `MARIADB_PASSWORD` | mariadb | Variables heredadas de una versión anterior del motor de base de datos (ver nota). |
| `ORACLE_PASSWORD` | oracle | Contraseña del usuario `SYS`/administrador de la instancia Oracle Database Free. |
| `ORACLE_APP_PASSWORD` | oracle | Contraseña del usuario de aplicación `synergia` creado dentro de la base de datos. |
| `GRAFANA_ADMIN_PASSWORD` | grafana | Contraseña del usuario `admin` del panel de Grafana. |
| `RABBITMQ_PASSWORD` | rabbitmq | Contraseña de la cola de mensajería RabbitMQ. |

:::note[¿Por qué hay variables de MariaDB si la base de datos es Oracle?]
`MARIADB_ROOT_PASSWORD` y `MARIADB_PASSWORD` son variables heredadas de una etapa anterior del proyecto, en la que la capa de acceso a datos implementaba el [patrón estrategia](/docs/patrones-de-diseno/#estrategia-retirado) para soportar tanto MySQL/MariaDB como Oracle. Tras la migración definitiva a Oracle Database Free (necesaria para aprovechar sus *Blockchain Tables*), este componente se retiró, pero las variables se mantienen en `.env.example` por compatibilidad.
:::

---

## Servicios de `docker-compose.yml`

| Servicio | Imagen / build | Puerto(s) | Descripción |
|---|---|---|---|
| `oracle` | `container-registry.oracle.com/database/free:latest` | `1521` | Base de datos relacional. Monta los scripts de `infra/database/oracle-init/` y tarda **1-2 minutos** en estar lista la primera vez. |
| `rabbitmq` | `rabbitmq:3-management` | `5672`, `15672`, `15692` | Broker de mensajería. `15672` es la consola de administración, `15692` expone métricas Prometheus nativas. |
| `rest_api` | build desde `Dockerfile` | `8000` | API REST (FastAPI + Uvicorn), arrancada con `--reload` en modo desarrollo. Depende de que `rabbitmq` esté *healthy*. |
| `ws_api` | build desde `Dockerfile` | `8001` | API WebSocket (FastAPI + Uvicorn), consumidor de las colas de RabbitMQ. Depende de que `rabbitmq` esté *healthy*. |
| `prometheus` | `prom/prometheus` | `9090` | Scrapea las métricas expuestas por `rest_api`, `ws_api` y RabbitMQ. |
| `grafana` | `grafana/grafana` | `3000` | Dashboards de monitorización (ver [Métricas](/docs/metricas/)). |
| `test` | build local (`--profile test`) | — | Corre la suite de `pytest`. No se levanta salvo que se invoque el perfil `test` explícitamente. |
| `ngrok` | `ngrok/ngrok:latest` | `4040` | Túnel de desarrollo para exponer `rest_api`/`ws_api` públicamente sin IP fija. |

Todos los servicios están configurados con `restart: unless-stopped`, salvo `test`.

---

## Puesta en marcha

```bash
git clone https://github.com/yagomilenio/synergia-server.git
cd synergia-server/infra/docker

cp .env.example .env
# Rellena JWT_SECRET_KEY, ORACLE_PASSWORD, ORACLE_APP_PASSWORD, RABBITMQ_PASSWORD, etc.

docker compose up -d
```

Verifica que todo está en pie:

```bash
curl http://localhost:8000/metrics
curl http://localhost:8001/metrics
```

Si has configurado `NGROK_AUTHTOKEN`, en `http://localhost:4040` puedes ver los endpoints públicos expuestos de cada una de las APIs (REST y WebSocket).

### Ejecutar los tests

```bash
docker compose -f infra/docker/docker-compose.yml --profile test run test
```

---

## Puertos utilizados

| Puerto | Servicio |
|---|---|
| `8000` | API REST |
| `8001` | API WebSocket |
| `1521` | Oracle Database |
| `5672` | RabbitMQ (AMQP) |
| `15672` | RabbitMQ (consola de administración) |
| `15692` | RabbitMQ (métricas Prometheus) |
| `9090` | Prometheus |
| `3000` | Grafana |
| `4040` | ngrok (panel de túneles) |

---

## Troubleshooting

:::note[El healthcheck de Oracle no termina de arrancar]
Oracle Database Free tarda entre 1 y 2 minutos en estar lista la primera vez, ya que inicializa el *pluggable database* `FREEPDB1` y ejecuta los scripts de `oracle-init/`. El servicio `rest_api` tiene una condición `depends_on: rabbitmq: condition: service_healthy`, así que si `rest_api` no arranca, comprueba primero el estado de `rabbitmq`, no de `oracle`. Para ver el progreso real de Oracle: `docker compose logs -f oracle`.
:::

:::note[`rest_api` o `ws_api` no responden]
Ambos servicios se lanzan con `--reload` y `--log-level debug`, así que cualquier excepción de arranque (típicamente una variable de entorno vacía) aparece inmediatamente en `docker compose logs -f rest_api` o `... ws_api`. Revisa primero que `.env` tiene todas las variables de la tabla anterior rellenas — el fichero `.env.example` marca cada una con `change_me`.
:::

:::note[Necesito ver los logs de un servicio concreto]
```bash
docker compose -f infra/docker/docker-compose.yml logs -f <servicio>
```
Sustituye `<servicio>` por `oracle`, `rabbitmq`, `rest_api`, `ws_api`, `prometheus`, `grafana` o `ngrok`.
:::

---

## Referencias relacionadas

* [Arquitectura del Sistema](/docs/arquitectura/) — por qué se eligió cada una de estas piezas (FastAPI, RabbitMQ, Oracle).
* [Métricas Prometheus](/docs/metricas/) — catálogo completo de métricas expuestas y configuración del dashboard de Grafana.
* [API REST](/docs/api-rest/) y [API WebSocket](/docs/api-websocket/) — especificación de endpoints una vez el servidor está en pie.
