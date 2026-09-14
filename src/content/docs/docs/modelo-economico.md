---
title: Modelo Económico y Reputación
description: Especificación formal del sistema monetario de Synergia, fórmulas de coste, liquidación por consenso y reputación ponderada.
---

Synergia incorpora una economía cerrada de intercambio directo de recursos de hardware basada en un token virtual denominado **crédito**. El sistema no se apoya en una blockchain de propósito general lenta y costosa; en su lugar, implementa un **ledger relacional criptográficamente enlazado** (tablas blockchain) gestionado por el motor de base de datos Oracle Database, garantizando atomicidad transaccional (ACID) e inmutabilidad absoluta.

---

## El Arranque en Frío y la Tarea Génesis

Uno de los principales problemas presentes en sistemas distribuidos basados en incentivos es el denominado **cold start**, el cual produce un **credit deadlock**: los nuevos usuarios de la plataforma no poseen suficientes créditos para realizar publicaciones y, como consecuencia, no se podrían generar las primeras tareas. Nadie puede procesar tareas por la inexistencia de las mismas, pero tampoco se pueden publicar por la falta de créditos.

Para resolver este problema se decidió crear una **tarea génesis**. Este paradigma es adoptado fielmente por todo tipo de redes distribuidas, entre las cuales se puede citar Bitcoin (que cuenta con un bloque génesis, conocido como el bloque 0). De este modo, todos los usuarios nuevos quedan automáticamente suscritos a esta tarea, facilitando y propiciando su integración inicial y la adopción del sistema.

Dado que gran parte de los créditos que se generan en la plataforma provienen de esta tarea principal, se buscó además una forma de ayudar de forma real a avances científicos. Para ello se encontró un proyecto conocido como **Folding@Home**, que otorga un cliente propio para aportar potencia de cómputo a la simulación del plegado de proteínas, con el fin de contribuir a la búsqueda de curas para enfermedades como el cáncer, Alzheimer, COVID-19, diabetes, Huntington, influenza y Parkinson.

### Integración de Folding@Home

El cliente oficial de Folding@Home trae consigo varias limitaciones: no puede gestionar cuántos Work Units (equivalentes a los bloques de Synergia) procesar de cada vez, ni indicarle que se detenga entre cada Work Unit (WU) procesado. Esto supone que el proceso no termina nunca, lo cual choca directamente con la naturaleza de Synergia — si el cliente nunca finaliza la ejecución, no puede ser recompensado, porque el sistema entiende que no ha terminado de procesar los bloques correspondientes.

Para resolverlo, se utiliza la API WebSocket que expone el propio cliente de Folding@Home para mirar de forma periódica el progreso del procesamiento del WU. En el momento en que ese progreso se ve decrementado, se da por finalizado el proceso correspondiente y se asume que terminó de procesar un WU — la única forma de que el progreso decrezca es que haya empezado a procesar otro WU distinto.

Esta tarea, además, carece de entradas propias: los WU los suministran los schedulers del propio Folding@Home, lo que demuestra la capacidad de adaptación de Synergia a tareas externas que gestionan su propio flujo de trabajo. Como consecuencia de la subida de resultados, se recompensa a los workers con créditos, permitiéndoles a partir de ahí realizar intercambios dentro de la plataforma.

---

## Fórmulas de Cálculo de Coste de Ejecución

Cuando un worker procesa y sube con éxito un bloque de trabajo, el servidor calcula el coste computacional real acumulado basándose en las telemetrías de hardware enviadas por el nodo.

El coste total en créditos de una ejecución se modela como la suma de las contribuciones de CPU, RAM y, si aplica, GPU:

<pre class="math-formula-box">
Coste Total = Coste_CPU + Coste_RAM + Coste_GPU
</pre>

### Constantes de Tarificación del Sistema
Estas constantes relacionan el consumo físico de hardware con la economía de créditos interna de la plataforma, modeladas en `api.py` del servidor:

* **`CPU_COST_PER_CYCLE = 1e-9`:** Tarifa fija de 1 crédito por cada 1.000.000.000 (10⁹) de ciclos de CPU ejecutados (obtenidos de `perf stat`).
* **`RAM_COST_PER_GB_SEC = 0.001 * (887 / 1.985)`:** Tarifa de memoria RAM, ponderada por la relación de coste en la nube (0,44685 créditos por GB-segundo).
* **`GPU_COST_PER_WATT_SEC = 0.0001 * (887 / 4.3)`:** Tarifa de vídeo GPU (0,02062 créditos por vatio-segundo consumido).

### Ecuación de Costes Detallada
Para un proceso que duró t segundos:

<pre class="math-formula-box">
1. Cálculo de CPU:
   Coste_CPU = ciclos_CPU × 10^-9

2. Cálculo de RAM:
   RAM_GB    = RAM_media_bytes / 1024^3
   Coste_RAM = RAM_GB × t × RAM_COST_PER_GB_SEC

3. Cálculo de GPU:
   VRAM_GB   = VRAM_media_MB / 1024
   Coste_GPU = VRAM_GB × TDP_w × t × GPU_COST_PER_WATT_SEC
</pre>

---

## Liquidación de Pagos

El servidor distribuye los créditos según las políticas de verificación configuradas en `config.toml`:

### Tareas No Deterministas
No admiten verificación cruzada (p. ej. renderizados estocásticos o simulaciones físicas con semilla aleatoria variable).
* El primer worker que sube un resultado con estado `SUCCESS` cobra el **100% del coste total calculado** de forma directa e inmediata.
* Los créditos se transfieren directamente desde la cuenta del **Publisher** a la cuenta del **Worker**.

### Tareas Deterministas (Verificación Cruzada)
Exigen coincidencia binaria de resultados para evitar que nodos fraudulentos falsifiquen cómputo.

El servidor evalúa el **resultado canónico**: el identificador del fichero de resultado (`result_file_id`) que cuenta con la mayoría de votos (ejecuciones correctas con hash idéntico). Ante empates, prevalece la ejecución más antigua.

Al subir un resultado:
1. **Divergencia del Consenso:** Si el worker envía un resultado que no coincide con el canónico actual, **no recibe créditos** por el trabajo y su reputación disminuye drásticamente.
2. **Consenso Consistente:** Si el worker coincide con el canónico y no es el creador original del mismo, actúa como validador. Recibe una **recompensa de verificación** pagada desde la cuenta del sistema `SYSTEM_FEES` (financiada por las tasas de publicación).
3. **Cambio de Canónico:** Si el nuevo resultado de verificación altera el consenso mayoritario (p. ej. se demuestra que el primer worker era fraudulento):
   * Se **revierte la transferencia de créditos** realizada al worker fraudulento (pasa a deuda contable).
   * Se realiza la transferencia completa al nuevo worker canónico legítimo desde el balance del Publisher.
   * Se reparte un bono de incentivo entre los validadores honestos que forzaron el cambio (financiado por `SYSTEM_FEES`).

![Flujo de transacciones ante un cambio de canónico](/images/tfg/transacciones-cambio-canonico.png)

---

## Algoritmo de Reputación Ponderada

La reputación es el indicador de confiabilidad de cada cuenta en la plataforma. Mide la proporción de ejecuciones honestas en las que el nodo ha participado.

### Fórmula Matemática
Para evitar fraudes sencillos (como ejecutar miles de tareas baratas correctas para subir reputación y luego meter un fraude en una tarea de alto coste), la reputación de un usuario u se calcula como un **porcentaje ponderado por el importe (créditos) de los procesos**:

<pre class="math-formula-box">
                  Σ [ e ∈ E_u ]  w(e)
Reputación_u = ─────────────────────────── × 100
                Σ [ e ∈ E_u ]  amount(e)

Donde w(e) = amount(e)  si e.result == canon(e),
      w(e) = 0          en caso contrario
</pre>

Donde:
* E_u es el conjunto de ejecuciones del usuario u en procesos que cuentan con un resultado canónico verificado y donde el canónico actual **no pertenece** al propio usuario u.
* amount(e) es el coste en créditos liquidado al canónico en dicho proceso.
* w(e) es el peso ponderado de la ejecución.

### Propiedades de Seguridad de la Reputación
* **Ponderación por Coste:** Los fraudes cometidos en tareas pesadas (mucha CPU/GPU) destruyen la reputación de forma inmediata, invalidando el nodo.
* **Control de Publicación:** El servidor impone un umbral mínimo de reputación (p. ej. 80%). Si la reputación de un usuario cae por debajo, **se le revoca temporalmente el derecho a publicar nuevas tareas**, obligándole a recuperar su reputación aportando cómputo honesto como worker.

---

## Control de Deuda y Auto-Pausa (Welford)

Synergia admite deudas controladas en las cuentas de los publicadores para no colgar ejecuciones masivas a mitad de cálculo. No obstante, para proteger a los workers de impagos permanentes, el servidor implementa un filtro de detención automática.

Tras cada proceso i finalizado en una tarea, el servidor actualiza la **media** y la **varianza** (mediante la suma de cuadrados SS) del coste por ítem de forma incremental en tiempo constante O(1) usando el algoritmo de **Welford**:

<pre class="math-formula-box">
SS_i  = SS_{i-1} + (x_i - media_{i-1}) × (x_i - media_i)
media_i = media_{i-1} + (x_i - media_{i-1}) / i
sigma_i = sqrt( SS_i / i )

Coste Estimado = (media_i + sigma_i) × k
</pre>

![Evolución del coste estimado con Welford](/images/tfg/welford-evolution.png)

Si el saldo libre del Publisher cae por debajo de este umbral de seguridad, **todas sus tareas se pausan automáticamente** y las colas de RabbitMQ se depuran, impidiendo que los workers sigan procesando trabajo que el publicador no podrá cubrir financieramente.
