---
title: Protocolo WebSocket
description: Especificación técnica del protocolo de comunicación en tiempo real para la asignación y consumo de bloques de trabajo.
---

La asignación de bloques de trabajo (*chunks*) a los workers requiere una conexión persistente, bidireccional y de ultra-baja latencia para evitar peticiones HTTP recurrentes de tipo polling.

En Synergia, este flujo se resuelve mediante una **API WebSocket** independiente implementada en FastAPI sobre la biblioteca asíncrona `aio-pika`. Por defecto, este servicio se expone en el puerto **`8001`**.

---

## Conexión y Handshake Inicial

El worker abre una conexión WebSocket apuntando a la cola dedicada de una tarea:

```http
ws://<HOST>:8001/ws/task/{task_id}?token={jwt}&n_consumes={n}
```

### Parámetros de la URL
* **`task_id` (numérico, en la ruta):** ID único de la tarea de la cual se desean consumir chunks.
* **`token` (string, query):** Token JWT de sesión activa del worker. El servidor valida la integridad y firma del token **antes de aceptar el handshake**. Si es inválido, incompleto o está expirado, el servidor rechaza la conexión con el código de cierre estándar de WebSocket **`1008` (Policy Violation)**.
* **`n_consumes` (entero, query):** Valor inicial de prebúsqueda (*prefetch*). Define cuántos chunks puede tener asignados en vuelo el worker de forma concurrente.

---

## Mensajes Enviados por el Worker

La comunicación se estructurada en formato JSON plano. El worker puede enviar las siguientes acciones por el canal de WebSocket:

### Petición de Chunks (`action: next`)
Solicita que el servidor le asigne y despache nuevos bloques de trabajo:
```json
{
  "action": "next",
  "n": 4
}
```
* **Comportamiento:** El parámetro `n` indica cuántos chunks está listo para procesar el worker (backpressure adaptativo). El servidor actualiza el `prefetch_count` del canal AMQP asíncrono para despachar como máximo esa cantidad de mensajes.

### Confirmación de Auditoría (`action: confirmation_done`)
Informa al orquestador de que el worker ha finalizado con éxito la tarea de verificación cruzada que le había sido exigida como requisito:
```json
{
  "action": "confirmation_done"
}
```

---

## Mensajes Recibidos del Servidor

El servidor responde al worker enviando mensajes de estado JSON o listas de chunks directas:

### Cola Vacía (`status: empty`)
Enviado cuando la cola de RabbitMQ no dispone de bloques de trabajo listos para procesar en ese instante:
```json
{
  "status": "empty"
}
```
*El worker debe aplicar un retraso de espera (p. ej. 5 segundos) antes de volver a solicitar más trabajo con un mensaje `next`.*

### Tarea Pausada (`status: paused`)
Enviado cuando la tarea ha sido pausada por el publicador o auto-pausada por saldo insuficiente:
```json
{
  "status": "paused"
}
```

### Tarea Completada (`status: completed`)
Informa de que todos los ítems de la tarea han sido procesados y validados. Al enviar este mensaje, el servidor **cierra de forma ordenada la conexión WebSocket** con código de estado `1000`:
```json
{
  "status": "completed"
}
```

### Bloqueo de Auditoría Obligatoria (`status: verification_required`)
Para evitar que un worker actúe de forma egoísta procesando únicamente bloques propios y eluda auditar los resultados de otros nodos, el servidor mantiene un contador `chunks_since_last_verification` por cada suscripción.

Si este contador supera el umbral límite (por defecto 10 chunks), el servidor bloquea la entrega de más trabajo y envía este mensaje:
```json
{
  "status": "verification_required"
}
```
*El worker se ve obligado a pausar su daemon, consultar la API REST para obtener un proceso pendiente de verificación (`GET /task/{id}/confirm`), ejecutar `confirm-process` y enviar el mensaje `confirmation_done` antes de que el WebSocket vuelva a servirle nuevos bloques.*

### Despacho de Bloques (Payload de Chunks)
Si la cola tiene mensajes y el worker está libre de auditorías, el servidor consume los mensajes de RabbitMQ, asocia los procesos correspondientes en base de datos en estado `PENDING` y despacha el payload de bloques asignados:
```json
[
  {
    "index": 1200,
    "count": 100
  },
  {
    "index": 1300,
    "count": 100
  }
]
```

---

## Reconciliación Robusta ante Desconexiones

Las conexiones WebSocket pueden caerse de forma abrupta debido a fluctuaciones de red, fallos eléctricos en el nodo voluntario o porque el usuario interrumpe el CLI con `Ctrl+C`.

Para evitar la pérdida de consistencia en el orquestador y asegurar que ningún bloque de trabajo quede atascado en un "limbo" indefinido, el servidor ejecuta un **algoritmo de reconciliación automática** al detectar la pérdida del socket:

1. **Inspección del Estado de Base de Datos:** Para cada bloque que estaba asignado "en vuelo" al worker desconectado, el servidor comprueba su estado en las tablas relacionales.
2. **Confirmación definitiva (`ack`):** Si el worker finalizó y subió con éxito el resultado justo antes de caerse (existiendo un registro `SUCCESS` en base de datos), el servidor WebSocket envía el comando `ack` a RabbitMQ para confirmar la eliminación del mensaje en la cola de forma segura.
3. **Reencolado y limpieza (`nack`):** Si no existe una ejecución exitosa registrada, el servidor realiza un **`nack(requeue=True)`** en RabbitMQ. Esto devuelve el bloque inmediatamente a la cola de pendientes para que otro worker pueda procesarlo. Adicionalmente, se limpian los procesos e intentos huérfanos incompletos en la base de datos Oracle para mantener el histórico saneado.
