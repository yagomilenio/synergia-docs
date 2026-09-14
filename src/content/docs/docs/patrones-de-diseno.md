---
title: Patrones de Diseño
description: Patrones de diseño aplicados en la implementación de Synergia y decisiones de arquitectura tomadas a lo largo del desarrollo.
---

Durante el diseño de esta plataforma se aplicaron diversos patrones de diseño, tanto para la estructuración de las comunicaciones entre componentes como para el acceso a los datos y el registro de métricas. Además, a lo largo del desarrollo se tuvieron que tomar decisiones importantes de diseño orientadas a garantizar la escalabilidad, la tolerancia a fallos y la flexibilidad del sistema.

---

## Productor-Consumidor

El patrón central del sistema es el **patrón productor-consumidor**, utilizado en las APIs centrales de la plataforma: la API REST actúa como productor de bloques en las colas de RabbitMQ, mientras que la API WebSocket (a la que los workers se conectan) actúa como consumidor. De este modo se permite la correcta distribución de los bloques, evitando duplicados, además de evitar la pérdida de bloques y mejorando así la escalabilidad del sistema.

![Patrón Productor-Consumidor de Synergia](/images/tfg/patron-productor-consumidor.png)

## Fachada

Otro de los patrones presentes es el **patrón fachada**. Este patrón permite reducir el acoplamiento entre componentes, además de ocultar la lógica interna de subsistemas subyacentes. Se aplicó en el método de acceso a los datos: todos los componentes que requieren acceder a la base de datos de la plataforma pasan por una capa intermedia encargada de gestionar el pool de conexiones, las *queries* y los cursores.

![Patrón Fachada en la Capa de Datos](/images/tfg/patron-fachada.png)

## Estrategia (retirado)

Cabe destacar que uno de los patrones planteados a mediados del desarrollo del proyecto fue el **patrón estrategia**, aplicado en la capa de acceso a datos. Esta capa estaba compuesta por una interfaz con todos los métodos con los que se podía consultar la base de datos, y se proporcionaban dos implementaciones distintas: una para bases de datos MySQL y otra para Oracle. Esto permitía cambiar entre cada una de estas implementaciones modificando un fichero de configuración, evitando tener que cambiar líneas de código y pudiendo modificarlo en tiempo de ejecución.

![Patrón Estrategia (Múltiples DB Engines)](/images/tfg/patron-estrategia.png)

:::note[Por qué se eliminó]
Por consideraciones realizadas a posteriori, este componente fue eliminado una vez se realizó la migración a Oracle de forma exitosa. Al consolidarse Oracle como único motor de base de datos (necesario para aprovechar sus *Blockchain Tables*, ver [Modelo de Datos](/docs/modelo-de-datos/)), mantener una capa de abstracción para un motor alternativo que ya no se iba a usar añadía complejidad sin aportar valor real.
:::

## Singleton

Se utiliza el **patrón singleton** para la instanciación de componentes compartidos, como la consola de renderizado proporcionada por la librería Rich, reutilizando una única instancia global.

![Patrón Singleton en Componentes Compartidos](/images/tfg/patron-singleton.png)

## Middleware

Para tener información sobre la latencia entre las peticiones a la API REST principal y sus respuestas, se implementó el **patrón middleware**, que permite interceptar las peticiones HTTP durante su procesamiento para medir el tiempo transcurrido entre la recepción de la solicitud y el envío de la respuesta, centralizando así la lógica de monitorización sin modificar la implementación de los distintos endpoints del sistema.

:::note[¿Y el patrón Observador?]
Para la obtención de métricas mediante el *exporter* de Prometheus no se emplea el patrón Observador, ya que ninguna de las APIs del sistema notifica automáticamente los cambios o eventos producidos. En su lugar, se optó por un mecanismo de *polling*, realizando peticiones periódicas cada cierto intervalo de tiempo para recopilar y actualizar las métricas del sistema.
:::

---

## Modelado de datos

La plataforma utiliza una base de datos relacional orientada a almacenar información relacionada con usuarios, tareas, ejecuciones de las mismas, recursos de hardware y resultados generados. El modelo fue diseñado siguiendo criterios de desacoplamiento y escalabilidad, permitiendo añadir nuevos tipos de tareas sin modificar la estructura principal del sistema.

Las entidades más relevantes son las siguientes:

* **`account`** — cuenta de los usuarios registrados dentro de la plataforma.
* **`task`** — definición general de una tarea distribuida.
* **`taskstatus`** — contiene todos los estados por los que una tarea puede transitar.
* **`process`** — subdivisión concreta de trabajo asociada a una tarea, conocida como *proceso* (ver [Glosario](/docs/glosario/)).
* **`execution`** — ejecución de un proceso dado, realizada por un worker.
* **`executionstatus`** — contiene todos los estados por los que una ejecución puede transitar.
* **`file`** — archivos generados durante las ejecuciones.
* **`resource_metric`** — unidad de características hardware asociadas a las tareas a modo de prerrequisitos de ejecución.
* **`resource`** — recursos hardware que se pueden exigir como prerrequisito.
* **`authprovider`** — contiene todos los proveedores para autenticación OAuth.
* **`authlocalcredentials`** — contiene todas las credenciales de los usuarios que no utilizan OAuth.
* **`transfer`** — contiene todas las transacciones del sistema.

La separación entre tareas, procesos y ejecuciones permite distribuir el trabajo de manera independiente entre múltiples workers y facilita la implementación de mecanismos de validación y tolerancia a fallos. El esquema entidad-relación completo se detalla en [Modelo de Datos](/docs/modelo-de-datos/).
