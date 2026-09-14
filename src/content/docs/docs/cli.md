---
title: Referencia del CLI (synergia)
description: Catálogo completo de los 23 comandos disponibles en el cliente de línea de comandos de Synergia.
---

El comando `synergia` es la interfaz unificada de interacción para los usuarios de la plataforma. Permite gestionar cuentas, configurar recursos físicos del host, publicar tareas como publisher, controlar las suscripciones como worker y planificar ejecuciones en segundo plano.

---

## Comandos de Autenticación y Cuentas

### `sign-up-user`
Registra una cuenta de usuario local nueva en la red de Synergia.
```bash
synergia sign-up-user --username <usuario> --email <correo> --passwd <contraseña>
```
* **Parámetros:**
  * `--username` (obligatorio): Nombre de cuenta único.
  * `--email` (obligatorio): Email de contacto (debe pertenecer a un dominio permitido).
  * `--passwd` (obligatorio): Contraseña de acceso local (se hasheará con Argon2 en el servidor).

### `login-user`
Inicia sesión local por contraseña. Almacena el token JWT obtenido en `~/.cn_profile.json`.
```bash
synergia login-user --username <usuario> --passwd <contraseña>
# o alternativamente por email:
synergia login-user --email <correo> --passwd <contraseña>
```

### `login-google`
Inicia el flujo seguro de autenticación OAuth 2.0 utilizando tu cuenta de Google.
```bash
synergia login-google
```
*Abre una ventana del navegador para completar el inicio de sesión. Si el usuario no existía, crea la cuenta de forma automática.*

### `login-github`
Inicia el flujo seguro de autenticación OAuth 2.0 utilizando tu cuenta de GitHub.
```bash
synergia login-github
```

### `logout-user`
Cierra la sesión activa borrando localmente el archivo `~/.cn_profile.json` que contiene el JWT.
```bash
synergia logout-user
```

### `get-user-details`
Muestra el balance actual de créditos, la reputación ponderada y el historial público de transferencias financieras de un usuario.
```bash
synergia get-user-details --username <usuario>
```

---

## Comandos de Configuración de Dispositivo

### `configure-device`
Permite declarar y configurar qué recursos de hardware del host voluntario se expondrán para ejecutar tareas.
* **Autodetección:** Si se invoca sin argumentos, lee la CPU, RAM y GPU física del equipo:
  ```bash
  synergia configure-device
  ```
* **Manual:** Permite limitar de forma manual los recursos a compartir, guardando la estructura en `~/.cn_device.json`:
  ```bash
  synergia configure-device --cpu-threads 4 --gpu-device 0 --ram 4096
  ```

---

## Comandos de Publicación y Control (Publisher)

### `create-task`
Publica una tarea apuntando a un repositorio público de GitHub.
```bash
synergia create-task --name <nombre> --github-url <url> [--description <desc>] [--resources cpu,ram] [--requirements min_ram_mb=2048]
```
* **Parámetros:**
  * `--name` (obligatorio): Nombre identificativo de la tarea.
  * `--github-url` (obligatorio): Enlace al repositorio público Git.
  * `--description` (opcional): Descripción larga del propósito de la tarea.
  * `--resources` (opcional): Recursos consumidos por el Makefile (valores: `cpu`, `gpu`, `ram`).
  * `--requirements` (opcional): Requisitos mínimos para el worker (p. ej. `min_ram_mb=4096`).

### `find-task`
Busca y lista tareas disponibles en la red de Synergia.
```bash
synergia find-task [--name <query>] [--status ACTIVE|PAUSED|COMPLETED] [--subscribed] [--global-search]
```
* **Parámetros:**
  * `--subscribed`: Filtra mostrando solo las tareas a las que tu worker está suscrito.
  * `--global-search`: Fuerza una consulta al índice de base de datos general omitiendo caches de sesión locales.

### `task-info`
Muestra el detalle extendido de una tarea específica, su estado, el snapshot hash esperado y el progreso de ítems.
```bash
synergia task-info --task-id <id>
```

### `add-inputs`
Inyecta nuevas entradas a una tarea de tipo dinámico (`dynamic`) que ya está publicada y en estado activo.
```bash
synergia add-inputs --task-id <id> --file <ruta_fichero> [--delimiter <char>]
# o pasando un texto directo:
synergia add-inputs --task-id <id> --text "prompt_de_ejemplo"
```

### `sync-task`
Sincroniza y actualiza en el servidor el snapshot hash de integridad (`repo_snapshot_hash`) y el commit Git del repositorio tras haber realizado modificaciones legítimas en el código de la tarea.
```bash
synergia sync-task --task-id <id>
```

### `output-task`
Descarga o consulta los resultados de procesamiento válidos de una tarea.
```bash
synergia output-task --task-id <id> [--download] [--canonical-only] [--process-id <pid>]
```
* **Parámetros:**
  * `--download`: Descarga en tu directorio local un ZIP conteniendo todos los ficheros de salida.
  * `--canonical-only`: Filtra para descargar únicamente los ficheros aceptados por consenso.

### `pause-task` / `active-task` / `cancel-task` / `close-task`
Modifican el estado de ciclo de vida de una tarea de la que eres publisher.
```bash
synergia pause-task --task-id <id>
synergia active-task --task-id <id>
synergia cancel-task --task-id <id>
synergia close-task --task-id <id>  # Solo aplicable para cerrar tareas dinámicas
```

---

## Comandos de Suscripción y Verificación (Worker)

### `subscribe-task`
Suscribe al worker a una tarea para que el nodo comience a recibir, procesar y subir bloques de trabajo de forma continua.
```bash
synergia subscribe-task --task-id <id> [--no-cache] [--yes]
```
* **Parámetros:**
  * `--no-cache`: Fuerza al worker a recrear el contenedor Docker y ejecutar `make setup` desde cero omitiendo caches previas.

### `unsubscribe-task`
Cancela de forma permanente tu suscripción a una tarea.
```bash
synergia unsubscribe-task --task-id <id>
```

### `process-info`
Devuelve el detalle operativo de un proceso (chunk), su rango de ítems asignado, su hash de salida y el listado de ejecuciones de validadores asociados.
```bash
synergia process-info --task-id <id> --process-id <pid>
```

### `confirm-process`
Fuerza al worker a realizar manualmente una ejecución de verificación cruzada sobre un proceso pendiente procesado por otro nodo.
```bash
synergia confirm-process --task-id <id> --process-id <pid> [--no-cache]
```

---

## Comandos del Planificador (Scheduler)

### `start-scheduler`
Arranca el planificador automatizado para coordinar las suscripciones de tu nodo.
* **Modo Round-Robin (Por Turnos):** Rota por las colas de tareas activas de forma cíclica procesando un máximo de `rotation` bloques en cada una:
  ```bash
  synergia start-scheduler --mode round-robin [--rotation 5] [--on-idle]
  ```
* **Modo Split (División de Recursos):** Divide tus hilos de CPU entre todas las tareas activas suscritas y las procesa concurrentemente en segundo plano:
  ```bash
  synergia start-scheduler --mode split
  ```

---

## Comandos de Pruebas (Testing Local)

Permiten validar que un repositorio de tarea cumple con el contrato del `Makefile` y funciona de forma aislada de forma local antes de gastar créditos publicándola en la red.

### `test-task`
Prueba el repositorio localmente simulando un entorno idéntico al contenedor del worker:
```bash
# Probar con un rango numérico continuo
synergia test-task --github-url <url> --range 0 99

# Probar con una entrada dinámica única
synergia test-task --github-url <url> --word "mi_entrada_de_test"
```
