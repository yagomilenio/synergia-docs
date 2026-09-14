---
title: Glosario
description: Conceptos y terminología clave de Synergia — tarea, entrada, bloque, proceso, resultado canónico, crédito y reputación.
---

Esta página reúne los términos que se usan a lo largo de toda la documentación. Si algo no queda claro en otra página, es buena idea empezar por aquí.

---

### Tarea

Unidad de trabajo publicada por un usuario en la plataforma. Para la definición de cada tarea es necesario tener un repositorio de GitHub que contenga todo el código necesario para ejecutar el proceso computacionalmente costoso. Este repositorio ha de tener una estructura previamente definida, que consta principalmente de dos ficheros: un `config.toml`, en el cual se especifican las características y requerimientos de la tarea, y un `Makefile`, encargado de la ejecución directa del código y punto de entrada del procesamiento.

No todas las tareas son iguales; hay dos tipos principales (dato que ha de especificarse en el `config.toml`):

* **Estática:** el número total de entradas se conoce en el momento de la publicación y no varía a menos que se vuelvan a sincronizar los cambios de GitHub con la plataforma. La plataforma particiona todas las entradas en bloques de forma automática al crear la tarea.
* **Dinámica:** el número de entradas no está predefinido y pueden añadirse nuevas entradas en tiempo real. Útil en flujos de trabajo continuos — un ejemplo claro es la ejecución de un LLM, donde el caso típico es poder hacer consultas en tiempo real.

Las tareas pueden encontrarse en cinco estados a lo largo de su ciclo de vida: **ACTIVE** (activa, se permite procesarla), **PAUSED** (suspendida temporalmente, generalmente por saldo insuficiente del publicador o por decisión propia), **CANCELLED** (cancelada por el publicador) y **COMPLETE** (cerrada de forma manual en tareas dinámicas, o de forma automática en tareas estáticas cuando se completa el total de entradas especificado).

### Entrada

Dato o subconjunto de datos que necesita potencia de cómputo para ser procesado. Cuando se suministran diversas entradas que no están directamente relacionadas, se permite la distribución de las mismas para su paralelización — esto es lo que se simboliza en Synergia.

### Bloque

Unidad mínima de procesamiento y de publicación. Corresponde a la agrupación de entradas de una tarea. El número de entradas por bloque depende directamente del número total de entradas: si este excede cierto umbral, el tamaño de bloque aumenta, con el objetivo de ahorrar memoria en los servidores. Los nodos que procesen una tarea pueden combinar varios bloques y procesarlos a la vez — son unidades indivisibles, pero acoplables a nivel de publicación de resultados: se puede subir un solo resultado conjunto producido por la unión de varios bloques de una misma tarea. Esta es una consideración de diseño implementada directamente para minimizar el ancho de banda requerido para las comunicaciones. Tanto las tareas estáticas con pocas entradas como las tareas dinámicas reciben el tamaño mínimo de bloque, equivalente a una entrada por bloque.

### Proceso

Registro que representa la asignación de uno o más bloques a un worker para su procesamiento. Un proceso existe desde el momento en que un primer nodo procesa uno o varios bloques y publica sus resultados. A partir de ahí, los nodos que quieran volver a procesar alguno de los bloques contenidos en este proceso tendrán que procesar todos los bloques contenidos en dicho proceso.

Cada proceso contiene información sobre el rango de entradas que abarca (agrupadas en bloques), el hash del repositorio en el momento de la creación de la tarea y la ejecución que actualmente se considera canónica. El proceso es la entidad central del mecanismo de verificación cruzada, ya que permite comparar los resultados de distintos nodos sobre los mismos bloques de datos.

### Resultado canónico

Resultado verificado y aceptado para un proceso concreto, establecido por consenso entre las ejecuciones de distintos nodos. Cuando dos nodos independientes procesan los mismos bloques con el mismo entorno de ejecución y producen el mismo fichero de resultado (verificado mediante su hash SHA-256), ese resultado se establece como canónico. Todos los nodos cuya ejecución sea igual al resultado canónico actual reciben un pago en forma de créditos y reputación, derivado del número de confirmaciones y del pago inicial generado por el procesamiento de ese proceso.

Una ejecución se considera canónica cuando fue la primera ejecución del proceso que dio el resultado que actualmente se considera válido — es decir, el que tuvo mayor número de **confirmaciones** (una confirmación ocurre cuando, en un proceso ya completado, se vuelve a ejecutar para comparar los resultados). Si un resultado no coincide con el canónico actual, se comprueba si hay posibilidad de cambio de canónico; si se mantiene como estaba, se añade una penalización en la reputación del nodo discrepante y no recibe créditos.

### Crédito

Unidad de intercambio interna de la plataforma. Los créditos no tienen valor monetario externo (no son criptomonedas ni se pueden canjear por dinero real): representan capacidad de cómputo. Los usuarios obtienen créditos contribuyendo con su hardware como workers, y los consumen al publicar tareas (los pagos se realizan tanto en el proceso de publicación como cuando otros nodos procesan sus tareas).

### Reputación

Valor numérico asociado a cada cuenta que refleja su historial de comportamiento en la plataforma. Se recalcula automáticamente tras cada cambio de canónico, penalizando a los workers cuyos resultados son sustituidos por los de otros y recompensando a los que consistentemente producen resultados correctos.

La reputación se utiliza para mitigar a posibles atacantes, forzando a que tengan que recuperarla antes de procesar nuevos bloques de tareas de otros usuarios. Tampoco podrán publicar nuevas tareas, y las que tienen actualmente quedan pausadas. Para recuperar su reputación, un usuario debe realizar un número determinado de confirmaciones válidas. Ver la fórmula completa en [Modelo Económico](/docs/modelo-economico/#algoritmo-de-reputación-ponderada).

---

## Tabla resumen

| Término | Definición corta |
|---|---|
| Tarea | Unidad de trabajo publicada, definida por un repositorio de GitHub con `config.toml` + `Makefile`. |
| Entrada | Dato individual a procesar dentro de una tarea. |
| Bloque | Agrupación mínima de entradas que se publica y procesa. |
| Proceso | Asignación de uno o más bloques a un worker, unidad central de la verificación cruzada. |
| Ejecución | Intento concreto de procesamiento de un proceso realizado por un worker. |
| Resultado canónico | Resultado aceptado por consenso entre ejecuciones de distintos nodos. |
| Crédito | Unidad de intercambio interna sin valor monetario externo. |
| Reputación | Indicador de confiabilidad histórica de una cuenta. |
