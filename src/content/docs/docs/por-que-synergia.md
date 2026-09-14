---
title: ¿Por qué Synergia?
description: Comparativa de Synergia frente a BOINC, Folding@Home, SETI, Golem Network y otras plataformas de cómputo distribuido.
---

Teniendo en cuenta el propósito general de la plataforma y el cometido para el que está diseñada, existen varias plataformas con similitudes relevantes. A continuación se repasan las más significativas y se compara a Synergia frente a ellas.

---

## Plataformas de referencia

### BOINC

Una de las más conocidas y referentes por su gran prestigio es **Berkeley Open Infrastructure for Network Computing (BOINC)**, creada por la Universidad de Berkeley en el año 2002. Esta herramienta está orientada principalmente a la publicación de proyectos científicos desarrollados en C++. Si bien admite el uso de otros lenguajes de programación, su integración requiere la implementación de componentes adicionales denominados *wrappers*. Esta dependencia incrementa la complejidad de desarrollo, despliegue y mantenimiento de los proyectos, constituyendo una limitación relevante de la plataforma. Además, su sistema de incentivos es totalmente cosmético y únicamente sirve como acreditación; estos créditos se suministran una vez se ha confirmado que el resultado es correcto.

Una de sus mayores limitaciones aparece a la hora de publicar proyectos, donde es necesario desplegar un servidor propio alojando un nodo de esta herramienta, o bien tener un acuerdo directamente con la Universidad de Berkeley. Algunos de los proyectos publicados especialmente relevantes son *Search for Extraterrestrial Intelligence* (SETI) y Rosetta@home. Asimismo, el cliente de BOINC no implementa de forma nativa un mecanismo de aislamiento para la ejecución de las tareas; en su lugar, recurre a la creación de un usuario y un grupo con privilegios reducidos en el sistema anfitrión.

### Folding@Home

Desarrollada por la Universidad de Stanford, se centra directamente en la simulación del plegado de proteínas para poder ayudar a proyectos científicos centrados en el ámbito de la biomedicina en busca de curas a enfermedades. Implementa un sistema de incentivos que acredita créditos conocidos como *FAH Points*, los cuales son puramente cosméticos; además, en este caso se desconoce que exista algún sistema que verifique los resultados. Según la información publicada en la propia web de la plataforma se puede estimar que cuentan con algún sistema de verificación, pero no queda determinado con claridad.

Además, esta plataforma solo habilita la publicación de proyectos internos de la universidad, con un sistema rígido basado en diversos motores de procesamiento; la mayor parte del código ejecutado en los clientes está escrito en C++, dada la ejecución periódica de GROMACS.

### SETI

Cabe destacar también **SETI**, un proyecto de computación distribuida de temática astronómica que buscaba señales de vida extraterrestre, ejecutándose mediante su propio cliente. Debido a su éxito masivo, fue la motivación por la que se diseñaría años después la plataforma BOINC, y posteriormente SETI se migró como un proyecto más dentro de BOINC.

### Golem Network

Una de las últimas plataformas lanzadas fue **Golem Network**, basada en la tecnología blockchain de Ethereum, lo que la convierte en una opción descentralizada sin un punto central de control. Requiere configuraciones más complejas para la ejecución del cliente y, además, su naturaleza *peer-to-peer* añade latencias adicionales. No obstante, cuenta con un sistema de verificación cruzada y sí presenta un sistema de incentivos reales: los créditos proporcionados son tokens, en concreto **GLM**.

Esta plataforma no tiene un propósito específico como las anteriores — las tareas que se ejecutan son de carácter general — y permite la creación de tareas en múltiples lenguajes, siendo los más comunes JavaScript y Python. Golem Network proporciona imágenes de contenedores Docker para poder ejecutar las tareas de forma aislada, aunque su configuración nativa suele instalarse de forma local sin ningún tipo de aislamiento.

### MPI, Hadoop, Spark y sistemas de CI

Desde otra perspectiva, existen herramientas orientadas a la computación paralela y distribuida. **Message Passing Interface (MPI)**, considerado uno de los estándares en *High Performance Computing* (HPC), permite la comunicación entre procesos distribuidos en clústeres. Sin embargo, requiere que las tareas estén escritas específicamente para su API, además de la necesidad de operar en entornos controlados con una infraestructura de red adecuada.

**Apache Hadoop** y **Apache Spark** son frameworks de procesamiento distribuido de datos orientados principalmente al análisis de grandes volúmenes de información. Aunque permiten distribuir carga de trabajo entre nodos, están diseñados para paradigmas concretos, carecen de cualquier sistema de incentivos y requieren una infraestructura propia gestionada, no siendo accesibles para usuarios externos.

Por último, herramientas como **GitHub Actions** o **GitLab CI** permiten la ejecución automatizada de tareas definidas en repositorios, de forma similar al comportamiento de Synergia. Sin embargo, están orientadas exclusivamente a flujos de integración y despliegue continuo, no permiten la participación de nodos externos, y todo el cómputo recae sobre la infraestructura del proveedor.

---

## Comparativa de plataformas

| Plataforma | Incentivos | Tareas arbitrarias | Aislamiento | Verificación | Participación abierta | Orientación |
|---|---|---|---|---|---|---|
| BOINC | Cosmético | Parcial | Parcial | Sí | No | Científica |
| Folding@Home | Cosmético | No | Parcial | - | No | Científica biomédica |
| SETI | Cosmético | No | Parcial | Sí | No | Científica astronómica |
| Golem Network | Sí | Sí | Sí | Sí | Sí | General |
| **Synergia** | **Sí** | **Sí** | **Sí** | **Sí** | **Sí** | **General** |

*La evaluación se basa en una escala cualitativa: **Sí** (cumple completamente el criterio), **No** (no lo soporta), **Parcial** (lo soporta solo en determinados casos o con limitaciones funcionales relevantes) y **-** (información no disponible o no compartida públicamente).*

Golem Network presenta una arquitectura que, en ciertos aspectos, resulta comparable a la propuesta de Synergia, siendo una de las soluciones más actuales del ecosistema. Entre los principales factores diferenciadores destaca la mayor dificultad de configuración de Golem Network, asociada al uso de tecnología blockchain; Synergia, en cambio, se caracteriza por una puesta en marcha relativamente sencilla del sistema.

---

## Qué diferencia a Synergia

* **Publicación accesible.** Cualquier usuario que pueda autenticarse ha de poder publicar tareas (si dispone de créditos suficientes) de forma sencilla, sin configuraciones o instalaciones complejas. El coste inicial de publicación es estático por tarea; el publicador pagará de forma dinámica a los nodos que la procesen, a modo de intercambio de potencia computacional.

* **Incentivos reales sin blockchain.** Synergia implementa un sistema de incentivos económicos sin recurrir a tecnología blockchain, eliminando la complejidad operacional y la barrera de entrada que supone la gestión de *wallets* y comisiones de red.

* **Verificación cruzada de resultados.** Permite detectar nodos que reportan resultados fraudulentos, garantizando la integridad del cómputo distribuido sin necesidad de una autoridad central de confianza.

* **Tareas arbitrarias.** Las tareas no han de escribirse en lenguajes específicos; simplemente deben seguir una cierta estructura con configuraciones básicas (ver [Contrato del Makefile](/docs/contrato-makefile/) y [config.toml](/docs/config-toml/)), lo que garantiza la ejecución de tareas arbitrarias.

* **Aislamiento real desde el diseño.** Synergia permite la ejecución aislada de tareas mediante contenedores, reduciendo significativamente los riesgos de seguridad e imposibilitando de forma directa la ejecución de las tareas en el sistema operativo anfitrión. La mayoría de plataformas del ecosistema implementan su versión local sin un aislamiento adecuado y posteriormente la encapsulan en contenedores; Synergia parte de la premisa de que únicamente es posible ejecutar tareas si existe una capacidad efectiva de virtualización (ver [Aislamiento del Worker](/docs/worker-aislamiento/)).

* **Modo autoalojado.** A diferencia de Golem Network, que por su naturaleza descentralizada carece de un punto de control centralizado, Synergia puede desplegarse en modo autoalojado, permitiendo su utilización en entornos controlados con un número reducido de máquinas e, incluso, la eliminación de costes asociados a la ejecución de tareas cuando así se requiera.

* **Sin vinculación con el valor monetario real.** Synergia no mantiene ninguna vinculación con el valor monetario del mundo real, por lo que no se permiten intercambios de naturaleza económica externa. Esta separación explícita busca evitar cualquier incentivo financiero externo y reducir de forma significativa la aparición de actores malintencionados, centrando el sistema en el intercambio justo, transparente y directo de potencia computacional entre participantes.
