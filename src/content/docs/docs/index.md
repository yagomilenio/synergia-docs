---
title: Centro de Documentación Técnica de Synergia
description: Documentación oficial completa para desarrolladores, publicadores de tareas y operadores de nodos.
hero:
  tagline: Explora el funcionamiento interno, esquemas relacionales, referencias de comandos y guías de seguridad de Synergia.
  actions:
    - text: Introducción y Visión General
      link: /docs/introduccion/
      icon: right-arrow
      variant: primary
    - text: Guía de Despliegue Rápido
      link: /docs/primeros-pasos/
      icon: rocket
---

Bienvenido al centro oficial de documentación técnica de **Synergia**. Este espacio compila todos los detalles de diseño, implementaciones físicas, referencias de comandos y fórmulas de negocio que componen la red.

---

## Estructura de la Documentación

### Visión General
* **[Introducción y Roles](/docs/introduccion/):** Qué es Synergia, la motivación detrás del proyecto y cómo se organizan sus repositorios.
* **[¿Por qué Synergia?](/docs/por-que-synergia/):** Comparativa frente a BOINC, Folding@Home, SETI y Golem Network.
* **[Primeros Pasos](/docs/primeros-pasos/):** Levanta el servidor con Docker Compose y conecta tu primer worker en menos de 5 minutos.
* **[Configuración del Servidor](/docs/configuracion-servidor/):** Referencia completa de variables de entorno, servicios Docker y troubleshooting.
* **[Configuración del Cliente](/docs/configuracion-cliente/):** Requisitos del sistema (`perf`), ficheros de configuración local y flujos de uso.
* **[Caso de Uso Completo](/docs/caso-de-uso/):** Recorrido de principio a fin: publicación, procesamiento, verificación y cobro.

### Arquitectura de Sistemas y Seguridad
* **[Arquitectura General](/docs/arquitectura/):** Detalle operativo de las APIs REST/WebSocket, RabbitMQ, base de datos Oracle y túneles.
* **[Patrones de Diseño](/docs/patrones-de-diseno/):** Productor-consumidor, fachada, singleton, middleware y el modelado de datos.
* **[Seguridad y Autenticación](/docs/seguridad/):** Criptografía Argon2, tokens JWT, verificación por email y flujos OAuth 2.0.
* **[Aislamiento del Worker (Sandboxing)](/docs/worker-aislamiento/):** Reducción de privilegios, capacidades Linux y cortafuegos de red con `iptables`.

### Modelo Económico y Consenso
* **[Modelo Económico e Incentivos](/docs/modelo-economico/):** Fórmulas exactas de coste (CPU, RAM, GPU), la tarea génesis, penalización por reputación y control de deuda (algoritmo incremental de Welford).
* **[Modelo de Datos y Ledger](/docs/modelo-de-datos/):** Esquema relacional completo de la base de datos Oracle y transacciones inmutables mediante Blockchain Tables.
* **[Flujo de Tareas](/docs/flujo-de-tareas/):** Publicación, *chunking*, suscripción, ejecución, verificación y cierre.

### Referencias Técnicas para Desarrolladores
* **[Estructura del config.toml](/docs/config-toml/):** Descripción de los 6 tipos reales de particionado de entradas.
* **[Contrato del Makefile](/docs/contrato-makefile/):** Cómo empaquetar código agnóstico al lenguaje (targets `setup`, `run`, `clean`).
* **[Referencia del CLI](/docs/cli/):** Listado y flags de los comandos de la utilidad de terminal `synergia`.
* **[API REST (25 endpoints)](/docs/api-rest/):** Especificación de rutas HTTP, métodos, cabeceras y payloads.
* **[Protocolo WebSocket](/docs/api-websocket/):** Mensajes en tiempo real, backpressure y reconciliación automática ante caídas.
* **[Métricas Prometheus](/docs/metricas/):** Catálogo de métricas y configuración del dashboard de Grafana.

### Tareas de Ejemplo
* **[Repositorios Demostrativos](/docs/tareas-ejemplo/):** Criptografía, biomedicina, renderizado 3D e inferencia LLM, con su `config.toml` y `Makefile` reales.

### Recursos
* **[Glosario](/docs/glosario/):** Tarea, entrada, bloque, proceso, resultado canónico, crédito y reputación, explicados en una sola página.
* **[Roadmap](/docs/roadmap/):** Líneas de trabajo futuro, ordenadas por impacto esperado.

---

## Repositorios del Proyecto

* **[synergia-server](https://github.com/yagomilenio/synergia-server):** Repositorio de la API, WebSocket, Oracle y despliegue Docker.
* **[synergia-client](https://github.com/yagomilenio/synergia-client):** Repositorio del CLI, scheduler y demonio del worker.
