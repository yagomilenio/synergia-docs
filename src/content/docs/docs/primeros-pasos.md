---
title: Primeros Pasos
description: Guía de inicio rápido para desplegar el servidor de Synergia y conectar un nodo cliente.
---

Esta guía te guiará para poner en marcha una instancia local completa de Synergia, incluyendo el servidor orquestador y un nodo cliente (worker) configurado para procesar tareas y recibir créditos, en menos de 5 minutos.

:::tip[¿Vas a desplegar en serio?]
Esta guía cubre lo mínimo para tener Synergia funcionando en local. Para la referencia completa de variables de entorno, puertos, servicios de `docker-compose.yml` y solución de problemas, consulta [Configuración del Servidor](/docs/configuracion-servidor/) y [Configuración del Cliente](/docs/configuracion-cliente/).
:::

---

## Despliegue del Servidor

El backend de Synergia se despliega mediante Docker Compose, empaquetando la API REST, la API WebSocket, la cola RabbitMQ, la base de datos Oracle Database y la pila de monitorización.

### Requisitos previos
* Docker y Docker Compose instalados.
* Un puerto `8000`, `8001`, `5672`, `1521` y `3000` libres en tu máquina host.

### Instrucciones de inicio
Clona el repositorio de `synergia-server` y accede a la carpeta de infraestructura:

```bash
git clone https://github.com/yagomilenio/synergia-server.git
cd synergia-server/infra/docker
```

Copia el fichero de ejemplo de variables de entorno y configura las contraseñas necesarias (JWT keys, contraseñas de Oracle, etc.):

```bash
cp .env.example .env
# Abre .env con tu editor y rellena las variables obligatorias
```

Levanta la pila de servicios en segundo plano:

```bash
docker compose up -d
```

:::note[Iniciación de Oracle]
La base de datos Oracle tarda aproximadamente entre **1 y 2 minutos** en arrancar por primera vez y ejecutar los scripts de creación de tablas. El servicio de la API REST (`rest_api`) tiene un healthcheck que espera a que Oracle esté completamente listo antes de iniciar.
:::

Puedes comprobar que el servidor responde correctamente consultando el endpoint de métricas:

```bash
curl http://localhost:8000/metrics
```

---

## Instalación del Cliente CLI

El cliente está implementado en Python y requiere **Python 3.10+** y **Docker** instalado en la máquina que funcionará como worker.

### Instalación de dependencias
Clona el repositorio de `synergia-client` e instala el CLI en modo editable:

```bash
git clone https://github.com/yagomilenio/synergia-client.git
cd synergia-client
pip install -e .
```

Una vez instalado, comprueba que el comando `synergia` está disponible en tu terminal:

```bash
synergia --help
```

---

## Configuración del Nodo y Primeras Operaciones

Sigue estos pasos secuenciales para registrar una cuenta en la red local y poner a trabajar tu hardware:

### Paso 1: Crear una cuenta de usuario
Regístrate en la red proporcionando un nombre de usuario, un email y una contraseña. El email debe pertenecer a un dominio permitido por el servidor:

```bash
synergia sign-up-user --username tu_usuario --email tu@mail.com --passwd tu_secreto
```

:::tip[Verificación de Email]
Si el servidor SMTP está configurado en el backend, recibirás un enlace de confirmación por correo. En entornos de desarrollo, puedes simular la confirmación activando el enlace que se muestra en los logs del contenedor de la API REST.
:::

### Paso 2: Iniciar sesión
Inicia sesión localmente para obtener tu token JWT, el cual se almacenará de forma segura en `~/.cn_profile.json`:

```bash
synergia login-user --username tu_usuario --passwd tu_secreto
```

### Paso 3: Declarar los recursos de hardware
El cliente puede autodetectar la CPU, la RAM y la GPU disponibles para asignar a las tareas:

```bash
synergia configure-device
```
*Este comando creará el fichero `~/.cn_device.json` detallando los hilos, MB de RAM y el ID de dispositivo GPU asignado.*

### Paso 4: Encontrar y suscribirse a una tarea
Busca tareas activas en la red:

```bash
synergia find-task --status ACTIVE
```

Suscríbete a la tarea indicando su ID (por ejemplo, la tarea `1`):

```bash
synergia subscribe-task --task-id 1
```

### Paso 5: Ejecutar el worker
Arranca el daemon del worker para que empiece a consumir chunks de la cola de WebSocket, ejecutar el Makefile correspondiente dentro de un contenedor Docker aislado y subir los resultados válidos:

```bash
synergia start-scheduler --mode round-robin
```

¡Felicidades! Tu máquina está procesando su primer bloque de cómputo distribuido y ganando créditos por el trabajo aportado.
