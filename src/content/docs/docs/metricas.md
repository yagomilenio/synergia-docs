---
title: Monitorización y Métricas (Prometheus)
description: Guía de observabilidad de Synergia, catálogo de métricas Prometheus y configuración de Grafana para control operativo.
---

La observabilidad es un componente fundamental para supervisar la salud de la red, auditar las transferencias económicas internas, trackear la latencia de las APIs y diagnosticar la distribución de cargas de trabajo de los workers.

Synergia implementa telemetrías integradas de forma nativa en sus APIs REST y WebSocket exponiendo el endpoint `/metrics` en formato estructurado para ser raspado (*scraped*) de forma periódica por **Prometheus**.

---

## Catálogo de Métricas Prometheus

El servidor expone las siguientes variables de series temporales de negocio e infraestructura:

| Métrica | Tipo | Labels | Servicio | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **`p2pcn_active_workers`** | Gauge | `task_id` | REST + WS | Número en tiempo real de nodos worker con conexiones de WebSocket persistentes activas sobre cada tarea. |
| **`p2pcn_executions_created_total`** | Counter | `task_id` | REST | Contador acumulado de intentos de ejecución inicializados (nuevos bloques consumidos). |
| **`p2pcn_executions_completed_total`** | Counter | `task_id`, `result` | REST | Historial de ejecuciones completadas. El label `result` permite desglosar por `success`, `failed`, `cancelled` o `verification`. |
| **`p2pcn_payments_total_amount`** | Counter | `type` | REST | Volumen total de créditos distribuidos en la red, desglosado por label de flujo de pago (`canonical`, `canonical_change` o `confirmation`). |
| **`p2pcn_upload_size_bytes`** | Histogram | — | REST | Distribución del tamaño de los ficheros binarios de resultado subidos a la plataforma (buckets que abarcan de 1 KB a 10 MB). |
| **`p2pcn_request_duration_seconds`** | Histogram | `method`, `endpoint` | REST | Latencia de respuesta y perfil de rendimiento de los endpoints HTTP individuales (FastAPI). |
| **`p2pcn_task_status`** | Gauge | `task_id` | REST | Estado numérico actual de la tarea mapeado en base de datos (`ACTIVE=1`, `PAUSED=2`, `CANCELLED=3`, `COMPLETED=4`). |
| **`p2pcn_process_status`** | Gauge | `task_id`, `process_id`, `status` | REST | Estado individual de cada proceso en vuelo en la cola de RabbitMQ. |

---

## Configuración de Prometheus

El servicio de Prometheus se levanta bajo Docker Compose y se parametriza a través del fichero de configuración de la infraestructura `infra/monitoring/prometheus/prometheus.yml`. 

Prometheus se encarga de consultar periódicamente (por defecto cada 15 segundos) los endpoints de las APIs REST y WebSocket:

```yaml
# infra/monitoring/prometheus/prometheus.yml (Esquema real)
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'synergia-rest-api'
    static_configs:
      - targets: ['rest_api:8000']

  - job_name: 'synergia-ws-api'
    static_configs:
      - targets: ['ws_api:8001']

  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692'] # Métricas nativas de RabbitMQ
```

---

## Cuadro de Mando en Grafana

Para visualizar de forma unificada estas telemetrías y facilitar la supervisión del administrador de la red, Synergia incluye una plantilla de dashboard completa preconfigurada en Grafana, localizada en:

`infra/monitoring/dashboards/synergia_dashboard.json`

Una vez levantada la infraestructura con Docker Compose y tras acceder a Grafana (puerto `3000`), el administrador dispondrá de paneles interactivos que monitorizan de forma gráfica:

* **Workers Activos:** Gráficos de líneas con el volumen de conexiones concurrentes segmentadas por tarea.
* **Tasa de Completados:** Gráficos circulares de acierto (*success rate*) versus ejecuciones fallidas o canceladas, útil para identificar bugs o inestabilidad en el código de Makefiles específicos.
* **Distribución Económica:** Registro gráfico del volumen de créditos acumulado transferido entre publicadores y validadores.
* **Monitorización de Colas:** Longitud instantánea de mensajes en colas RabbitMQ, detectando cuellos de botella de procesamiento.
* **Tiempos de Inferencia/Cálculo:** Latencia media en segundos que toman los workers para resolver los chunks asignados.

:::tip[Dashboard Operativo]
A continuación se muestra una captura real del panel de monitorización unificado en Grafana, en el cual se observan los picos de consumo computacional, las tasas de éxito de procesamiento de bloques, los balances económicos de créditos globales y el estado de salud de RabbitMQ:

![Cuadro de mando unificado en Grafana de Synergia](../../../../public/images/tfg/grafana-dashboard.png)
:::
