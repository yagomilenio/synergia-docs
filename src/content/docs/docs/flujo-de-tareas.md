---
title: Flujo Completo de una Tarea
description: El ciclo de vida de procesamiento en Synergia, desde la publicación en GitHub hasta la verificación cruzada y liquidación de créditos.
---

El ciclo operativo de una tarea en Synergia comprende cinco fases secuenciales desacopladas: **Publicación**, **Segmentación (Chunking)**, **Distribución**, **Ejecución Local** y **Verificación con Liquidación**.

---

## Diagrama de Flujo de Trabajo

El siguiente diagrama detalla el ciclo de vida completo de un bloque de trabajo (chunk) y las interacciones entre los componentes:

```mermaid
sequenceDiagram
    autonumber
    actor P as Publisher
    participant S as Servidor (REST/WS)
    participant Q as RabbitMQ (Cola)
    participant W as Worker (Cliente)
    participant C as Contenedor Docker
    participant DB as Oracle DB

    P->>S: "POST /task (Git URL, commit, snapshot hash)"
    Note over S: Valida saldo y contrasta hash de integridad
    S->>S: "Calcula b (Tamaño bloque) con presupuesto menor a 512 KB"
    S->>Q: "Publica mensajes de chunking con index y count"
    S-->>P: "Confirmación (Tarea ACTIVE)"

    W->>S: "Handshake WebSocket (Conexión persistente)"
    W->>S: "Mensaje de petición next con n = N"
    S->>Q: "Consume N mensajes de la cola"
    Q-->>S: "Mensajes de chunks"
    S-->>W: "Envía lista de chunks"

    Note over W: Primera vez: levanta contenedor y ejecuta setup
    W->>C: "cd /repo y ejecuta make clean; make run"
    Note over C: Ejecución restringida (iptables + sin privilegios)
    C-->>W: "Ficheros de salida y telemetrías (perf, nvidia-smi)"
    W->>W: "Empaqueta salida en tar determinista"

    W->>S: "POST /task/id/process/pid/execution/eid/result (Upload tar + métricas)"
    
    alt Tarea Determinista (Consenso de Mayoría)
        S->>S: "Recalcula resultado canónico por hash SHA-256"
        S->>DB: "Ledger (transfer): Paga créditos al canónico y validadores honestos"
    else Tarea No Determinista (Pago Inmediato)
        S->>DB: "Transfiere créditos del Publisher al Worker directamente"
    end
```

---

## Fase de Publicación

El proceso se inicia cuando un **Publisher** invoca el comando `synergia create-task`. El cliente CLI realiza los siguientes pasos preparatorios locales:
1. Aplica las exclusiones definidas en la sección `[hash].exclude` de `config.toml`.
2. Calcula el hash SHA-256 de integridad del repositorio local en su estado actual (`repo_snapshot_hash`).
3. Envía los metadatos de la tarea, la URL pública de GitHub, el commit actual y el snapshot hash al servidor (`POST /task`).

En el servidor:
1. Se clona temporalmente el repositorio y se ejecuta `load_config()`. El parser extrae la configuración y las propiedades de entradas definidas en `config.toml` (número total de ítems).
2. Se verifica que el Publisher tiene saldo en su cuenta para cubrir el coste fijo de publicación `TASK_COST` (definido en `config.json`).
3. Se realiza una transferencia inmutable de créditos de la cuenta del publicador a la cuenta de tasas del sistema (`SYSTEM_FEES`).
4. Se inicializan las estadísticas de coste de la tarea en la base de datos (media y varianza a cero).
5. Se crean los bloques de trabajo (*chunks*) y se publican en RabbitMQ.

---

## Segmentación Avanzada (Chunking en el Productor)

Para tareas con millones de entradas (como un diccionario criptográfico de miles de millones de palabras), rellenar las colas de RabbitMQ con un mensaje individual por ítem saturaría la memoria RAM de los servidores. Para solucionarlo, el servidor agrupa las entradas en bloques (chunks) de tamaño b.

El productor de Synergia busca **minimizar el tamaño de bloque b** (para permitir que el trabajo se distribuya en trozos lo más pequeños posible entre los workers) asegurando que **el tamaño acumulado de toda la cola en memoria RAM no supere los 512 KB** (`maxima_memoria = 512 * 1024` bytes).

### El overhead del protocolo AMQP y el JSON payload
Cada mensaje JSON tiene la estructura `{"index": X, "count": b}`. El coste en bytes del mensaje k-ésimo con índice de inicio k × b es:

<pre class="math-formula-box">
s(k) = K + d(k × b) + d( min(b, N - k × b) )

Donde:
* K  = 25 bytes (overhead AMQP + JSON)
* d(n) es el número de dígitos de un entero n en base 10:
  d(0) = 1
  d(n) = trunc( log10(n) ) + 1    (si n >= 1)
</pre>

### Algoritmo de Estimación en Tiempo Constante: O(log10 N)
La solución ingenua consiste en un bucle que sume los tamaños de todos los mensajes, lo que provocaría un bloqueo por timeout de la CPU del servidor para tareas masivas.

Para solucionar esto, Synergia implementa un **algoritmo matemático de estimación en tiempo O(log10 N)** que divide el espacio de índices por tramos de dígitos. A continuación se presenta el código real de `publisher.py` que calcula de forma recursiva la memoria requerida de la cola sin iterar elemento por elemento:

```python
# src/publisher.py (Código real de estimación de memoria)
import math

def memoria_total(start, end, step):
    OVERHEAD_AMQP = 3   # AMQP añade 3 bytes extra de overhead en el payload
    base = len('{"index":,"count":}') + OVERHEAD_AMQP
    n = math.ceil((end - start) / step)
    
    # Suma de dígitos de todos los start_index y end_index sin iterar
    suma_start = suma_digitos_secuencia(start, end, step)
    suma_end   = suma_digitos_secuencia(start + step, end + step, step)
    
    return n * base + suma_start + suma_end

def suma_digitos_secuencia(start, end, step):
    """Suma los len(str(x)) para x en range(start, end, step) sin realizar iteraciones secuenciales"""
    total = 0
    # Los números de d dígitos van de 10^(d-1) a 10^d - 1
    for digitos in range(1, len(str(end)) + 2):
        tramo_ini = max(start, 10**(digitos-1))
        tramo_fin = min(end,   10**digitos)
        if tramo_ini >= tramo_fin:
            continue
        # Cuántos valores del step caen en este tramo
        count = math.ceil((tramo_fin - tramo_ini) / step)
        total += count * digitos
    return total
```

### Optimización del Tamaño de Bloque
El productor inicializa la segmentación con un tamaño de bloque de $b=1$. Si la estimación de `memoria_total` excede el presupuesto límite de **512 KB**, el servidor recalcula de forma proporcional el tamaño óptimo de bloque aplicando una regla de tres analítica:

```python
# src/publisher.py (Código real de optimización de tamaño de bloque)
def generate_chunks(self, task_id, n_inputs: int):
    chunks = []
    start_index = 0
    chunk_size = 1
    maxima_memoria = 512*1024  # Límite de 512KB de RAM en RabbitMQ
    
    memoria_requerida = memoria_total(start_index, n_inputs-1, chunk_size)
    
    # Bucle de optimización: converge de inmediato
    while memoria_requerida > maxima_memoria:
        # Regla de tres analítica de memoria requerida vs máxima
        nuevo_chunk_size = int(chunk_size * memoria_requerida / maxima_memoria)
        chunk_size = max(chunk_size + 1, nuevo_chunk_size)  # Evitar bucles infinitos
        memoria_requerida = memoria_total(start_index, n_inputs-1, chunk_size)

    # Rellenar la cola con la distribución optimizada de chunks
    while start_index < n_inputs:
        count = min(chunk_size, n_inputs - start_index)
        chunks.append({
            "index": start_index,
            "count": count
        })
        start_index += count

    return chunks
```
Este algoritmo converge en un promedio de **2 a 3 iteraciones** incluso para conjuntos de 10⁹ ítems, garantizando una publicación ultrarrápida y segura para el servidor de RabbitMQ.

---

## Fase de Suscripción y Consumo (WebSocket)

El worker abre una conexión bidireccional persistente contra `/ws/task/{task_id}`.
* Envía un mensaje `{"action": "next", "n": N}` para indicar su disponibilidad para procesar hasta N bloques en paralelo.
* El servidor WebSocket, comunicándose con RabbitMQ de manera asíncrona vía `aio-pika`, consume dichos mensajes.
* El sistema aplica un mecanismo de **Backpressure** acoplando el parámetro de prebúsqueda AMQP (`prefetch_count`) al valor `n` especificado por el cliente. Esto evita saturar de buffers de red locales al worker.
* Los mensajes consumidos quedan en estado "unacknowledged" en RabbitMQ. Si el worker finaliza con éxito en la base de datos, el servidor envía un `ack` definitivo para borrar el chunk. Si el worker se cae, la desconexión del socket dispara un `nack` automático, reencolando el chunk para otros nodos.

---

## Fase de Ejecución Local (Worker)

El worker corre un bucle continuo de procesamiento local automatizado:
1. **Sincronización:** Comprueba si el snapshot hash local coincide con el del servidor.
2. **Entorno Aislado:** Si es el primer bloque, levanta el contenedor Docker e invoca el target `make setup` en el directorio compartido `/repo` (ver [Seguridad](/docs/seguridad)).
3. **Descarga de Recursos:** Descarga ficheros de datos externos especificados en la directiva `[download]` de `config.toml`.
4. **Tráfico de Red:** Aplica restricciones de firewall bloqueando todo tráfico excepto hacia los dominios autorizados de `[network].allowed_hosts`.
5. **Ejecución del Chunk:** Limpia restos de ejecuciones anteriores con `make clean` e invoca `make run` inyectando las variables de entorno asociadas (p. ej. `START=... END=...`).
6. **Métricas Físicas:** Durante la ejecución, se monitoriza el proceso con `perf stat` para capturar ciclos de CPU, y mediante `nvidia-smi` para telemetrías GPU (vatios consumed, memoria VRAM).
7. **Empaquetado Determinista:** Al finalizar, el directorio especificado en `[outputs]` se empaqueta de forma determinista para evitar diferencias binarias por metadatos de ficheros:
   ```bash
   tar --sort=name --mtime="1970-01-01 00:00:00Z" --owner=0 --group=0 --numeric-owner -czf resultado.tar.gz -C outputs/ .
   ```
8. **Subida:** Realiza un POST con el empaquetado binario y los consumos a `/task/{id}/process/{pid}/execution/{eid}/result`.

---

## Fase de Verificación y Pago (Consenso)

Al subir un resultado, el servidor determina la validez del trabajo:

### Tareas Deterministas
Activan la verificación cruzada por consenso.
1. Se calcula el **resultado canónico**: el hash de fichero de resultado (`result_file_id`) que cuenta con la mayoría de ejecuciones `SUCCESS` coincidentes. En caso de empate, prevalece la ejecución más antigua.
2. **Cambio de Canónico:** Si el nuevo resultado altera el consenso canónico que existía previamente, el servidor **revierte el pago** al antiguo worker sospechoso de fraude (reclamando créditos a su cuenta y reduciendo su reputación), transfiere el pago completo al nuevo worker canónico legítimo desde el balance del Publisher.
3. **Confirmación de Canónico:** Si el nuevo resultado coincide con el canónico existente, el worker validador recibe una fracción de incentivo por confirmación desde `SYSTEM_FEES`.

![Diagrama de flujo de subida de resultados en tareas deterministas con resolución de disputas](/images/tfg/flujo-determinista-disputas.png)

### Tareas No Deterministas
No admiten disputa matemática (p. ej. simulaciones estocásticas). El primer resultado correcto que se suba es aceptado automáticamente y el worker cobra el 100% de los créditos directamente desde el balance del Publisher.

![Diagrama de flujo de subida de resultados en tareas no deterministas](/images/tfg/flujo-no-determinista.png)

---

## Cierre y Control de Deudas (Algoritmo de Welford)

Synergia admite balances de créditos negativos controlados (deudas contables) para evitar que la red se bloquee a media ejecución de un bloque pesado. No obstante, para evitar fraudes sistemáticos y acumulación de impagos, el servidor calcula de forma dinámica el coste estimado del siguiente chunk para cada tarea.

### Estimación de Coste con Complejidad O(1)
El coste por ítem de cada proceso i con coste total c_i e ítems procesados k_i se define como x_i = c_i / k_i. El servidor calcula incrementalmente la **media acumulada** y la **varianza/desviación típica** del coste por ítem utilizando el **algoritmo de Welford**.

Este algoritmo es numéricamente estable y permite realizar las actualizaciones tras cada proceso en complejidad temporal de **O(1)** sin necesidad de almacenar el historial completo ni realizar pesados re-escaneos de base de datos de complejidad O(n):

<pre class="math-formula-box">
SS_i  = SS_{i-1} + (x_i - media_{i-1}) × (x_i - media_i)
media_i = media_{i-1} + (x_i - media_{i-1}) / i
sigma_i = sqrt( SS_i / i )

Coste Estimado = (media_i + sigma_i) × k
</pre>

Si el saldo libre del Publisher cae **por debajo del Coste Estimado del siguiente bloque**, el servidor **pausa de forma automática todas sus tareas activas** y vacía sus colas de RabbitMQ, impidiendo la inyección de nuevas deudas a los workers de la red.
