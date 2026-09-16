---
title: Configuración del Cliente
description: Referencia completa del cliente CLI de Synergia — requisitos del sistema, ficheros de configuración local y estructura del proyecto.
---

Esta página es la referencia exhaustiva de `synergia-client`: qué necesita tu máquina para funcionar como worker, y qué contiene cada fichero de configuración local. Para el flujo de comandos paso a paso, ver [Primeros Pasos](../primeros-pasos/) y [Referencia del CLI](../cli/).

---

## Requisitos

* Python >= 3.10 (probado con Python 3.14.4).
* Docker instalado y disponible en el `PATH`.
* `perf` instalado, con nivel de *paranoia* ≤ 2 (ver más abajo).
* Acceso a una instancia del servidor Synergia (API REST + API WebSocket).

## Instalación

Al estar el cliente publicado en PyPI, la opción más recomendada y directa es realizar una instalación limpia con `pip`:

```bash
pip install synergia
```

Si prefieres instalarlo desde el código fuente o vas a realizar desarrollos sobre el cliente, clona el repositorio de `synergia-client` e instálalo en modo editable:

```bash
git clone https://github.com/yagomilenio/synergia-client.git
cd synergia-client
pip install -e .
```

Cualquiera de los dos métodos registrará el comando `synergia` en el sistema (el archivo `pyproject.toml` lo declara bajo `[project.scripts] synergia = "client.client:main"`), instalando a su vez todas las dependencias requeridas.

---

## Configuración del sistema: `perf`

El cliente usa `perf` para medir los ciclos de CPU consumidos por cada tarea — es la base del [cálculo de coste en créditos](../modelo-economico/#fórmulas-de-cálculo-de-coste-de-ejecución). Por defecto, el kernel Linux restringe su uso a `root`. Es necesario bajar el nivel de *paranoia* a 2 o menos:

```bash
# Temporal (hasta el próximo reinicio)
sudo sysctl kernel.perf_event_paranoid=2

# Permanente
echo 'kernel.perf_event_paranoid=2' | sudo tee /etc/sysctl.d/99-perf.conf
sudo sysctl -p /etc/sysctl.d/99-perf.conf
```

Instalación de `perf` según distribución:

| Distro | Comando |
|---|---|
| Debian/Ubuntu | `apt install linux-perf` |
| Fedora/RHEL | `dnf install perf` |
| Arch | `pacman -S perf` |

:::note[Sin `perf`, el worker no puede medir su propio consumo]
Si `perf_event_paranoid` queda por encima de 2, el cliente no podrá leer los ciclos de CPU reales consumidos durante la ejecución de una tarea, lo que impide calcular correctamente el coste a liquidar. Verifica el valor actual con `cat /proc/sys/kernel/perf_event_paranoid`.
:::

---

## Ficheros de configuración local

El cliente mantiene tres ficheros de estado en el `home` del usuario. Solo uno de ellos se edita a mano.

### `~/.config/synergia/config.ini` — editable

Contiene las URLs de conexión al servidor Synergia. Debe modificarse para apuntar a la instancia del servidor que se quiera usar (ngrok, dominio propio, IP pública, etc.):

```ini
[rest]
base_url = https://tu-servidor.ngrok-free.app
base_port = 443

[ws]
base_url = wss://tu-servidor-ws.ngrok-free.app
base_port = 443
```

Este fichero se monta como volumen dentro del contenedor Docker del worker, por lo que puede modificarse en caliente sin reconstruir la imagen. No es necesario reiniciar el contenedor si ya estaba corriendo — el cambio se aplica en la siguiente ejecución.

### `~/.cn_profile.json` — autogenerado

Se genera automáticamente al hacer `login-user`, `login-google` o `login-github`. Contiene el token JWT de la sesión activa. No es necesario (ni recomendable) editarlo manualmente.

### `~/.cn_device.json` — autogenerado o manual

Se genera con `synergia configure-device`. Contiene los recursos hardware que el nodo ofrece a la red:

```json
{
    "cpu_threads": 8,
    "gpu_device": 0,
    "ram": 16384
}
```

Puede generarse por autodetección (`synergia configure-device`) o especificando los valores manualmente:

```bash
synergia configure-device --cpu-threads 8 --gpu-device 0 --ram 16384
```

---

## Estructura del proyecto

```
synergia-client/
├── client/
│   ├── client.py                  # CLI principal, definición de todos los comandos
│   ├── config.py                  # Carga de sesión, dispositivo y config.ini
│   └── scheduler.py               # Scheduler automático (round-robin / split)
├── worker/
│   ├── worker.py                  # Lógica de suscripción y ejecución de tareas
│   ├── docker_util.py             # Gestión del contenedor Docker del worker
│   ├── Dockerfile                 # Imagen del contenedor de ejecución
│   ├── container/
│   │   ├── config.ini             # URLs del servidor (montado como volumen)
│   │   ├── upload_results.py      # Script de subida de resultados al servidor
│   │   ├── hash_util.py           # Utilidades de hashing SHA256
│   │   ├── iptables.sh            # Reglas de red del contenedor (bloqueo de salida)
│   │   ├── curl_wrapper.c         # Wrapper de curl con registro de descargas
│   │   └── wget_wrapper.c         # Wrapper de wget con registro de descargas
│   └── utils/
│       ├── configuration_interpreter.py   # Intérprete del config.toml del repo de la tarea
│       ├── github_util.py                 # Utilidades para repos GitHub
│       └── logger.py                      # Logger con Rich
├── tests/
│   ├── test.sh                    # Test de integración del sistema de consenso
│   ├── create_tasks.sh            # Script de creación de tareas de prueba
│   └── tasks.txt                  # Lista de tareas de prueba
├── pyproject.toml
└── requirements.txt
```

---

## Flujo de uso típico

**Como publisher** (publicar una tarea):

```bash
synergia login-user --username miusuario --passwd mipassword
synergia create-task --name "Mi tarea" --github-url https://github.com/user/repo
synergia task-info --task-id 1
synergia output-task --task-id 1 --download
```

**Como worker** (ejecutar tareas de otros y ganar créditos):

```bash
synergia login-user --username miusuario --passwd mipassword
synergia configure-device
synergia find-task --status ACTIVE
synergia subscribe-task --task-id 1
```

**Modo automático con scheduler:**

```bash
# Ejecutar todas las tareas suscritas en round-robin
synergia start-scheduler --mode round-robin

# Ejecutar en paralelo usando todos los núcleos disponibles
synergia start-scheduler --mode split

# Solo usar CPU que el sistema no esté usando
synergia start-scheduler --mode round-robin --on-idle
```

---

## Referencias relacionadas

* [Referencia del CLI](../cli/) — listado completo de comandos y flags.
* [Aislamiento del Worker](../worker-aislamiento/) — cómo se sandboxa el contenedor que ejecuta cada tarea.
* [Caso de Uso Completo](../caso-de-uso/) — este mismo flujo aplicado a una tarea real, paso a paso.
