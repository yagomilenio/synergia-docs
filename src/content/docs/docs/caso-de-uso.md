---
title: Caso de Uso Completo
description: Recorrido completo por el flujo de publicación y procesamiento distribuido de una tarea real, de principio a fin.
---

Este escenario documenta el flujo más representativo de la plataforma: un usuario publica una tarea y otro usuario la procesa como worker, obteniendo créditos a cambio. Se utiliza la tarea de ejemplo `yescrypt_task_cracker`, que intenta crackear un listado de contraseñas mediante el uso de un diccionario con John the Ripper (ver [Tareas de Ejemplo](../tareas-ejemplo/)).

El escenario cuenta con dos actores: el usuario **Pepe** actúa como publicador y el usuario **Ana** actúa como worker. Ambas cuentas tienen saldo suficiente para operar. Al final del flujo se comprueba que los balances de ambas cuentas reflejan correctamente las transferencias realizadas y que los resultados son descargables.

---

## Paso 1 — Publicación de la tarea por parte de Pepe

El publicador ejecuta el comando de publicación indicando la URL del repositorio de GitHub y el nombre que será visible dentro de la plataforma:

```bash
synergia login-user --username pepe --passwd ********
synergia create-task --name "Crackeo yescrypt" --github-url https://github.com/yagomilenio/yescrypt_task_cracker
```

![Publicación de la tarea por Pepe en el CLI](../../../../public/images/tfg/cli-pepe-publicacion.png)

El sistema interpreta el fichero `config.toml` del repositorio para conocer el número de entradas, calcula el tamaño de bloque correspondiente y crea la cola en RabbitMQ. El balance de Pepe decrece en el coste fijo de publicación. Como resultado del comando de creación de la tarea, se obtiene el identificador asignado a la misma.

## Paso 2 — Consulta del listado de tareas disponibles

Desde la cuenta de Ana, se consulta el listado de tareas activas en la plataforma. La tarea recién publicada por Pepe debe aparecer con estado `ACTIVE` y la información básica del repositorio asociado:

```bash
synergia find-task --status ACTIVE
synergia task-info --task-id 1
```

![Listado de tareas activas visto desde la cuenta de Ana](../../../../public/images/tfg/cli-ana-find-task.png)

`task-info` muestra más detalle sobre la tarea: estado, progreso e información del repositorio:

![Detalle de la tarea y estado del repositorio](../../../../public/images/tfg/cli-ana-task-detail.png)

## Paso 3 — Suscripción de Ana como worker

El worker Ana se suscribe a la tarea. El sistema le muestra el `Makefile` del repositorio antes de confirmar la suscripción, para que pueda revisarlo y verificar que el código es legítimo:

```bash
synergia subscribe-task --task-id 1
```

![Inspección del Makefile en el CLI antes de suscribirse](../../../../public/images/tfg/cli-makefile-inspection.png)

Tras confirmar, el cliente descarga el bloque asignado desde la cola, ejecuta el contenedor Docker y procesa las entradas asociadas — pudiendo observarse en la salida del cliente tanto el proceso `SETUP` como el proceso `RUN` definidos en el `Makefile` (ver [Contrato del Makefile](../contrato-makefile/)):

![Ejecución de bloques asignados en el worker de Ana](../../../../public/images/tfg/cli-ana-worker-exec.png)

## Paso 4 — Verificación de balances tras el procesamiento

Una vez subidos los resultados, se consultan los balances de ambas cuentas para comprobar que la transferencia se realizó correctamente:

```bash
synergia get-user-details --username pepe
synergia get-user-details --username ana
```

![Actualización de balances de Pepe y Ana tras el procesamiento](../../../../public/images/tfg/cli-balances-update.png)

El balance de Pepe se habrá decrementado en el importe calculado por la fórmula de créditos, y el de Ana habrá incrementado en ese mismo valor (ver [Fórmulas de Cálculo de Coste](../modelo-economico/#fórmulas-de-cálculo-de-coste-de-ejecución)).

## Paso 5 — Descarga de resultados

El servidor empaqueta los ficheros de salida en un archivo `zip` comprimido con `gzip` y lo sirve como respuesta:

```bash
synergia output-task --task-id 1 --download
```

![Descarga y verificación del archivo de resultados de la tarea](../../../../public/images/tfg/cli-results-verification.png)

:::tip[Los resultados son públicos]
La obtención de resultados se puede realizar desde cualquier cuenta autenticada en la plataforma, no solo desde la de Ana — cualquier usuario puede acceder a los resultados de cualquier tarea publicada. De este modo se fomenta la transparencia.
:::

Consultando de nuevo el estado de la tarea se puede ver el total de entradas procesadas y los procesos generados durante su ejecución. Por ejemplo, pueden haberse creado dos procesos: uno que procesó una única entrada y otro que procesó varias — lo que evidencia el ajuste dinámico del tamaño de los procesos. Conviene no confundir este concepto con el tamaño de los bloques, que se gestiona a nivel de colas de RabbitMQ (ver [Glosario](../glosario/)).

Cuando un proceso agrupa varias entradas, los datos resultantes se concatenan en un único fichero de salida.

## Paso 6 — Confirmación del proceso asignado

Dado que no se han realizado actualizaciones entre el procesamiento de la tarea y su confirmación, no se muestra ninguna advertencia relativa a un cambio de commit del repositorio con respecto al actualmente importado:

```bash
synergia confirm-process --task-id 1 --process-id 1
synergia process-info --task-id 1 --process-id 1
```

![Confirmación del proceso y resultado canónico](../../../../public/images/tfg/cli-block-confirmation.png)

Al finalizar, se pueden consultar los detalles del proceso una vez confirmado: el valor canónico, el hash del resultado, y la información de los usuarios que lo han procesado y confirmado:

![Estado del proceso tras la confirmación canónica](../../../../public/images/tfg/cli-process-canonical.png)

---

## Validar una tarea antes de publicarla

Antes de publicar una tarea propia conviene validar que está correctamente definida. El sistema de validación comprueba la estructura, la configuración y la coherencia de los parámetros definidos, además de ejecutar la tarea con un elemento de entrada de ejemplo si lo requiere:

```bash
synergia test-task --github-url https://github.com/user/mi-tarea --word "entrada de prueba"
synergia test-task --github-url https://github.com/user/mi-tarea --range 0 10
```

![Ejecución aislada de prueba mediante test-task](../../../../public/images/tfg/cli-container-isolation-test.png)

:::note[Limitación]
Para validar el flujo completo de ejecución es necesario que el usuario que publica la tarea tenga capacidad de ejecutarla localmente — solo así se puede comprobar el comportamiento en tiempo de ejecución. En caso contrario, únicamente es posible validar aspectos estáticos de la configuración, sin poder detectar posibles errores en tiempo de ejecución. Esto permite a los desarrolladores validar la lógica de ejecución y el procesamiento de entradas de manera independiente antes de exponer la tarea a la red.
:::
