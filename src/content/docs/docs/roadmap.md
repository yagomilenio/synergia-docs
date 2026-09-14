---
title: Roadmap
description: Líneas de trabajo futuro planteadas para Synergia, ordenadas por impacto esperado.
---

Estas son las líneas de trabajo futuro más prometedoras para Synergia, ordenadas por impacto esperado.

---

## 1. Proxy transparente para captura de tráfico

La implementación de un proxy HTTP/HTTPS transparente en los contenedores permitiría interceptar todo el tráfico de descarga independientemente de la herramienta utilizada, eliminando la dependencia actual en los *wrappers* de `curl` y `wget` (ver [Aislamiento del Worker](/docs/worker-aislamiento/)).

## 2. Clasificación de tareas verificables en `config.toml`

Se propone añadir un parámetro configurable en el fichero `config.toml` que permita indicar si una tarea es fácilmente verificable de forma directa. Este sería el caso de problemas como el crackeo de contraseñas, donde la validez del resultado puede comprobarse sin necesidad de verificación cruzada. Esto permitiría optimizar el sistema de validación, reduciendo la replicación de cómputo en escenarios donde no es necesaria y mejorando la eficiencia global de la plataforma.

## 3. Soporte para GPUs AMD mediante ROCm

La fórmula de créditos actual está limitada a GPUs NVIDIA. La integración con herramientas como `rocm-smi` permitiría extender el soporte a GPUs AMD, ampliando el ecosistema de workers disponibles y reduciendo la dependencia de un único fabricante.

## 4. Compatibilidad con entornos Windows

Actualmente, la ejecución en sistemas Windows presenta limitaciones debido al uso de WSL, que no permite acceder a los contadores internos de CPU necesarios para la medición precisa del coste computacional. Como línea futura, se plantea la adaptación del sistema a entornos Windows nativos, explorando alternativas como APIs específicas del sistema operativo o mecanismos de medición compatibles que permitan mantener la precisión en el cálculo de créditos.

## 5. Soporte para tareas colaborativas sin coste económico

Se propone habilitar la posibilidad de definir tareas gratuitas orientadas a la colaboración comunitaria. Estas tareas no requerirían el pago de créditos por parte del publicador, y su ejecución dependería del interés colectivo de los usuarios. Se plantea un mecanismo de gobernanza mediante el cual estas tareas se publiquen únicamente si alcanzan un cierto nivel de apoyo, o mediante procesos de selección periódicos entre varias propuestas presentadas a los usuarios de la plataforma.

## 6. Exposición de una API autohospedada para el cliente

Se plantea habilitar el despliegue de una API que se inicie conjuntamente con el cliente de la plataforma, permitiendo su uso de forma programática desde el mismo entorno. Esto facilitaría la integración con herramientas externas, especialmente en el desarrollo de interfaces web autohospedadas, mejorando la accesibilidad del sistema.

## 7. Integración con agentes mediante Model Context Protocol (MCP)

Como evolución de la API mencionada en el punto anterior, se propone el desarrollo de un adaptador basado en MCP que permita la interacción con la plataforma a través de agentes inteligentes.

---

:::note[¿Tienes una idea para Synergia?]
Estas líneas de trabajo son puntos de partida, no un compromiso cerrado de entrega. Si quieres proponer o discutir alguna de ellas, o plantear una nueva, abre un *issue* en [synergia-server](https://github.com/yagomilenio/synergia-server) o [synergia-client](https://github.com/yagomilenio/synergia-client).
:::
