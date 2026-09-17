---
title: WebSocket Protocol
description: Technical specification of the real-time communication protocol for work chunk assignment and consumption.
---

Assigning work blocks (*chunks*) to workers requires a persistent, bidirectional, and ultra-low latency connection to avoid recurrent HTTP polling requests.

In Synergia, this flow is handled by an independent **WebSocket API** implemented in FastAPI on top of the asynchronous library `aio-pika`. By default, this service is exposed on port **`8001`**.

---

## Connection and Initial Handshake

The worker opens a WebSocket connection pointing to a task's dedicated queue:

```http
ws://<HOST>:8001/ws/task/{task_id}?token={jwt}&n_consumes={n}
```

### URL Parameters
* **`task_id` (numeric, path):** Unique ID of the task from which to consume chunks.
* **`token` (string, query):** Active session JWT token of the worker. The server validates token integrity and signature **before accepting the handshake**. If invalid, incomplete, or expired, the server rejects the connection with standard WebSocket close code **`1008` (Policy Violation)**.
* **`n_consumes` (integer, query):** Initial prefetch value. Defines how many chunks the worker may have concurrently in flight.

---

## Messages Sent by the Worker

Communication is structured in plain JSON format. The worker can send the following actions across the WebSocket channel:

### Chunk Request (`action: next`)
Requests the server to assign and dispatch new work blocks:
```json
{
  "action": "next",
  "n": 4
}
```
* **Behavior:** The `n` parameter indicates how many chunks the worker is ready to process (adaptive backpressure). The server updates the asynchronous AMQP channel's `prefetch_count` to dispatch at most that amount of messages.

### Audit Confirmation (`action: confirmation_done`)
Informs the orchestrator that the worker has successfully completed the cross-verification task required of it:
```json
{
  "action": "confirmation_done"
}
```

---

## Messages Received from the Server

The server responds to the worker by sending JSON status messages or direct lists of chunks:

### Empty Queue (`status: empty`)
Sent when the RabbitMQ queue has no work blocks ready to process at that moment:
```json
{
  "status": "empty"
}
```
*The worker must apply a wait delay (e.g., 5 seconds) before requesting more work again with a `next` message.*

### Paused Task (`status: paused`)
Sent when the task has been paused by the publisher or auto-paused due to insufficient balance:
```json
{
  "status": "paused"
}
```

### Completed Task (`status: completed`)
Informs that all items in the task have been processed and validated. Upon sending this message, the server **gracefully closes the WebSocket connection** with status code `1000`:
```json
{
  "status": "completed"
}
```

### Mandatory Audit Block (`status: verification_required`)
To prevent a worker from acting selfishly by processing only their own blocks and avoiding auditing results from other nodes, the server maintains a `chunks_since_last_verification` counter for each subscription.

If this counter exceeds the threshold limit (by default 10 chunks), the server blocks delivery of further work and sends this message:
```json
{
  "status": "verification_required"
}
```
*The worker is forced to pause its daemon, query the REST API for a pending verification process (`GET /task/{id}/confirm`), execute `confirm-process`, and send the `confirmation_done` message before the WebSocket will serve new blocks again.*

### Block Dispatch (Chunk Payload)
If the queue has messages and the worker is clear of audit obligations, the server consumes messages from RabbitMQ, associates corresponding processes in the database with status `PENDING`, and dispatches the payload of assigned blocks:
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

## Robust Reconciliation on Disconnections

WebSocket connections can drop abruptly due to network fluctuations, electrical failure on the volunteer node, or because the user interrupts the CLI with `Ctrl+C`.

To prevent consistency loss in the orchestrator and ensure no work block remains stuck in indefinite limbo, the server runs an **automatic reconciliation algorithm** upon detecting socket loss:

1. **Database State Inspection:** For each block assigned "in flight" to the disconnected worker, the server checks its state in the relational tables.
2. **Definitive Confirmation (`ack`):** If the worker finished and successfully uploaded the result just prior to disconnecting (a `SUCCESS` record exists in the database), the WebSocket server sends the `ack` command to RabbitMQ to safely acknowledge removal of the message from the queue.
3. **Re-queuing and Cleanup (`nack`):** If no successful execution is recorded, the server issues a **`nack(requeue=True)`** in RabbitMQ. This returns the block immediately to the pending queue so another worker can process it. Additionally, incomplete orphan processes and attempts are cleaned up in the Oracle database to keep history healthy.
