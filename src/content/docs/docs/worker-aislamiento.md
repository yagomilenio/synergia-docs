---
title: Internals del Worker y Aislamiento
description: Arquitectura de seguridad, sandboxing con Docker, código de wrappers en C, políticas de red con iptables y medición de rendimiento en el nodo worker de Synergia.
---

El **Worker de Synergia** es el demonio encargado de recibir las tareas distribuidas, descargar sus repositorios correspondientes, preparar un entorno aislado de ejecución y procesar cada bloque de trabajo de forma segura en la máquina host del voluntario.

Dado que la red procesa código arbitrario proporcionado por terceros en repositorios públicos, el worker implementa un riguroso esquema de seguridad multicapa para evitar exfiltraciones de datos, abusos de red y manipulaciones del host.

---

## Archivos de Configuración Local

El entorno de ejecución del worker se parametriza a través de tres archivos locales clave de configuración:

* **`~/.config/synergia/config.ini`:**
  * Define los parámetros de comunicación con el orquestador central (direcciones base y puertos de las APIs REST y WebSocket).
  * Este fichero se monta como un volumen de solo lectura dentro de los contenedores de ejecución para que las utilidades internas del contenedor (como los scripts de subida de resultados) puedan localizar la API.
* **`~/.cn_profile.json`:**
  * Almacena de forma persistente el token de sesión JWT obtenido tras realizar un login correcto con `synergia login-user` o credenciales OAuth. Se utiliza para firmar digitalmente cada petición.
* **`~/.cn_device.json`:**
  * Contiene la declaración de recursos de hardware disponibles en el nodo (hilos de CPU máximos a asignar, MB de RAM dedicados e identificador único de la tarjeta GPU a emplear). Se rellena automáticamente con `synergia configure-device` o manualmente.

---

## Aislamiento Físico y de Privilegios: `start_docker`

La ejecución de las tareas (targets `setup` y `run` del Makefile) se realiza estrictamente dentro de un contenedor Docker basado en `python:3.12-slim` o similar. La orquestación y arranque de estos contenedores la gestiona la utilidad `start_docker` (`worker/docker_util.py`).

Para neutralizar amenazas y asegurar mediciones de recursos consistentes, se imponen las siguientes directivas de aislamiento de bajo nivel:

### Aislamiento de Núcleos de CPU con Thread-Locking (`--cpuset-cpus`)
Si el worker utilizara la limitación de CPU estándar de Docker (`--cpus`), la base de datos de cgroups de Docker asignaría una fracción de tiempo de procesamiento distribuida aleatoriamente entre todos los núcleos disponibles. Esto provocaría dos problemas graves:
1. El software multitarea o multihilo de la tarea (p. ej. renderizado con Cycles en Blender o cracking) intentaría desplegar hilos en todos los núcleos de la máquina, colapsando el rendimiento y provocando esperas por scheduling de kernel.
2. Procesos concurrentes en segundo plano del host voluntario contaminarían los contadores físicos de rendimiento.

Para evitarlo, Synergia realiza un **bloqueo estricto de núcleos de CPU** mediante el parámetro `--cpuset-cpus`:
```python
# worker/docker_util.py (Líneas 78-79)
if cpu_threads:
    cmd += ["--cpuset-cpus", f"0-{int(cpu_threads)-1}"]
```
Este flag asocia y bloquea de manera rígida el contenedor a los núcleos que van del `0` al `N-1`. Ningún otro hilo externo puede entrometerse en estos núcleos dedicados, aislando los contadores físicos de ciclos de la CPU para que la métrica de `perf stat` sea matemáticamente exacta.

### Capabilities de Linux Acotadas y Montajes de Seguridad
Por defecto, el contenedor descarta todas las capabilities privilegidas de Linux, agregando explícitamente solo dos:
* **`CAP_PERFMON`:** Necesaria para permitir que la utilidad `perf` acceda a los registros PMU (Performance Monitoring Unit) de hardware de la CPU y registre los ciclos de CPU consumidos sin ser root.
* **`CAP_NET_ADMIN`:** Necesaria únicamente para habilitar la inyección de reglas del cortafuegos `iptables` dentro del espacio de nombres de red (*network namespace*) del contenedor antes de degradar los privilegios del usuario a `worker`.
* **Montaje del Fichero de Configuración (`-v ...:ro`):**
  ```python
  cmd += ["-v", f"{CONFIG_PATH.resolve()}:/scripts/config.ini:ro"]
  ```
  Monta el archivo local de la sesión de forma restringida (lectura únicamente). De esta forma, el código de la tarea nunca podrá editar las credenciales locales ni los datos de la red.

---

## Código Fuente de los Wrappers de Descarga Segura en C

Durante la fase `make setup`, un repositorio malicioso podría intentar descargar dependencias dinámicas alteradas en caliente desde servidores externos no declarados. Para neutralizar esta vulnerabilidad, Synergia sustituye los binarios de descarga estándar (`curl` y `wget`) por wrappers compilados en **C** con el bit **`setuid`** activo, propiedad del usuario del sistema `net_user` (quien dispone de red autorizada por el firewall).

### Código Íntegro de `curl_wrapper.c`
Este binario de bajo nivel intercepta y audita las peticiones de descarga realizadas con `curl`:

```c
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <sys/wait.h>
#include <pwd.h>
#include <sys/stat.h>
#include <openssl/sha.h>
#include <limits.h>

#define LOG_FILE "/home/net_user/external_deps.log"

// Calcula de manera segura el hash SHA-256 del archivo descargado usando OpenSSL
void calc_sha256_file(const char *filename, char *output_hex) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    unsigned char buf[4096];
    size_t n;

    FILE *f = fopen(filename, "rb");
    if (!f) {
        strcpy(output_hex, "no-output-file");
        return;
    }

    SHA256_CTX sha256;
    SHA256_Init(&sha256);
    while ((n = fread(buf, 1, sizeof(buf), f)) > 0) {
        SHA256_Update(&sha256, buf, n);
    }
    SHA256_Final(hash, &sha256);
    fclose(f);

    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        sprintf(output_hex + (i * 2), "%02x", hash[i]);
    }
    output_hex[64] = '\0';
}

int main(int argc, char *argv[]) {
    // Si es invocado por root, degrada privilegios a net_user para logging seguro
    if (getuid() == 0) {
        struct passwd *pw = getpwnam("net_user");
        if (pw) {
            setgid(pw->pw_gid);
            setuid(pw->pw_uid);
        }
    }

    // Análisis de parámetros CLI para extraer el archivo de salida
    char *output_file = NULL;
    for (int i = 1; i < argc - 1; i++) {
        if (strcmp(argv[i], "-o") == 0 || strcmp(argv[i], "--output") == 0) {
            output_file = argv[i + 1];
            break;
        }
    }

    int capital_O = 0;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-O") == 0) {
            capital_O = 1;
            break;
        }
    }

    // Buscar URL en los argumentos
    char *url = NULL;
    for (int i = 1; i < argc; i++) {
        if (strncmp(argv[i], "http://", 7) == 0 || strncmp(argv[i], "https://", 8) == 0) {
            url = argv[i];
            break;
        }
    }

    // Inferir archivo si usa -O
    static char inferred_path[PATH_MAX];
    if (!output_file && capital_O && url) {
        char *last_slash = strrchr(url, '/');
        if (last_slash && *(last_slash + 1) != '\0') {
            char filename[PATH_MAX];
            strncpy(filename, last_slash + 1, sizeof(filename) - 1);
            filename[sizeof(filename) - 1] = '\0';
            char *q = strchr(filename, '?');
            if (q) *q = '\0';
            char cwd[PATH_MAX];
            if (getcwd(cwd, sizeof(cwd))) {
                snprintf(inferred_path, sizeof(inferred_path), "%s/%s", cwd, filename);
                output_file = inferred_path;
            }
        }
    }

    // Bifurcación del proceso
    pid_t pid = fork();
    if (pid == 0) {
        // PROCESO HIJO: Ejecuta el curl real no wrapper que dispone de red
        execv("/usr/bin/curl.real", argv);
        perror("execv curl.real failed");
        exit(1);
    }

    // PROCESO PADRE: Espera a que termine la descarga y calcula hash
    int status;
    waitpid(pid, &status, 0);
    int exit_code = WIFEXITED(status) ? WEXITSTATUS(status) : 1;

    if (exit_code == 0) {
        char hash[65];
        if (output_file && access(output_file, F_OK) == 0) {
            calc_sha256_file(output_file, hash);
        } else {
            strcpy(hash, "no-output-file");
        }

        // Registrar descarga de forma inmutable en el log compartido
        FILE *log = fopen(LOG_FILE, "a");
        if (log) {
            fprintf(log, "%s %s\n", hash, url ? url : "no-url");
            fclose(log);
        }
    }

    return exit_code;
}
```

### Código Íntegro de `wget_wrapper.c`
De forma análoga a curl, el wrapper de `wget` captura las dependencias descargadas:

```c
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <sys/wait.h>
#include <pwd.h>
#include <sys/stat.h>
#include <openssl/sha.h>
#include <limits.h>

#define LOG_FILE "/home/net_user/external_deps.log"

void calc_sha256_file(const char *filename, char *output_hex) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    unsigned char buf[4096];
    size_t n;
    FILE *f = fopen(filename, "rb");
    if (!f) {
        strcpy(output_hex, "no-output-file");
        return;
    }
    SHA256_CTX sha256;
    SHA256_Init(&sha256);
    while ((n = fread(buf, 1, sizeof(buf), f)) > 0)
        SHA256_Update(&sha256, buf, n);
    SHA256_Final(hash, &sha256);
    fclose(f);
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++)
        sprintf(output_hex + (i * 2), "%02x", hash[i]);
    output_hex[64] = '\0';
}

int main(int argc, char *argv[]) {
    if (getuid() == 0) {
        struct passwd *pw = getpwnam("net_user");
        if (pw) {
            setgid(pw->pw_gid);
            setuid(pw->pw_uid);
        }
    }

    char *output_file = NULL;
    for (int i = 1; i < argc - 1; i++) {
        if (strcmp(argv[i], "-O") == 0 || strcmp(argv[i], "--output-document") == 0) {
            output_file = argv[i + 1];
            break;
        }
    }

    char *prefix_dir = NULL;
    for (int i = 1; i < argc - 1; i++) {
        if (strcmp(argv[i], "-P") == 0 || strcmp(argv[i], "--directory-prefix") == 0) {
            prefix_dir = argv[i + 1];
            break;
        }
    }

    char *url = NULL;
    for (int i = 1; i < argc; i++) {
        if (strncmp(argv[i], "http://", 7) == 0 || strncmp(argv[i], "https://", 8) == 0) {
            url = argv[i];
            break;
        }
    }

    static char inferred_path[PATH_MAX];
    if (!output_file && url) {
        char *last_slash = strrchr(url, '/');
        char filename[PATH_MAX];
        if (last_slash && *(last_slash + 1) != '\0') {
            strncpy(filename, last_slash + 1, sizeof(filename) - 1);
            filename[sizeof(filename) - 1] = '\0';
            char *q = strchr(filename, '?');
            if (q) *q = '\0';

            char base_dir[PATH_MAX];
            if (prefix_dir) {
                strncpy(base_dir, prefix_dir, sizeof(base_dir) - 1);
                base_dir[sizeof(base_dir) - 1] = '\0';
            } else {
                if (!getcwd(base_dir, sizeof(base_dir)))
                    base_dir[0] = '\0';
            }

            if (base_dir[0] != '\0') {
                snprintf(inferred_path, sizeof(inferred_path), "%s/%s", base_dir, filename);
                output_file = inferred_path;
            }
        }
    }

    pid_t pid = fork();
    if (pid == 0) {
        execv("/usr/bin/wget.real", argv);
        perror("execv wget.real failed");
        exit(1);
    }

    int status;
    waitpid(pid, &status, 0);
    int exit_code = WIFEXITED(status) ? WEXITSTATUS(status) : 1;

    if (exit_code == 0) {
        char hash[65];
        if (output_file && access(output_file, F_OK) == 0) {
            calc_sha256_file(output_file, hash);
        } else {
            strcpy(hash, "no-output-file");
        }
        FILE *log = fopen(LOG_FILE, "a");
        if (log) {
            fprintf(log, "%s %s\n", hash, url ? url : "no-url");
            fclose(log);
        }
    }

    return exit_code;
}
```

### Flujo de Validación de Integridad Combinado
Una vez completada la fase `make setup`, el daemon del worker realiza la siguiente conjetura de comprobación:
1. El worker recorre de forma recursiva los archivos del repositorio `/repo` (excluyendo lo indicado en `exclude`), calcula el SHA-256 de cada uno de ellos y genera un hash combinado del repositorio.
2. Lee el log `/home/net_user/external_deps.log` que fue escrito por los wrappers en C de forma inmutable (el usuario `worker` no tiene permisos de escritura en ese log).
3. Concatena el hash combinado del repositorio con el hash de descargas de `external_deps.log`.
4. El hash final se envía al servidor REST en `POST /process` para validación. Si coincide con el snapshot original (`repo_snapshot_hash`) almacenado en Oracle al publicar, el servidor autoriza la ejecución. De lo contrario, se rechaza inmediatamente por sospecha de manipulación de dependencias locales.

---

## Cortafuegos de Red con `iptables`

El aislamiento de red es el mecanismo más crítico desde el punto de vista de la seguridad. Evita exfiltraciones de datos del host, conexiones de retransmisión maliciosa (*relaying*) o ataques DDoS contra terceros.

La directiva `[network].allowed_hosts` en `config.toml` obliga al publicador a declarar de antemano qué dominios requiere para la tarea. Antes de iniciar `make run`, el worker inyecta de forma automatizada las reglas en el contenedor:

```bash
# worker/container/iptables.sh (Esquema real aplicado)
# 1. Establece política DROP por defecto para salida
iptables -P OUTPUT DROP
iptables -P INPUT DROP

# 2. Permitir tráfico de loopback (lo) y conexiones ya establecidas
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 3. Permitir de forma explícita resoluciones de DNS (Puerto 53)
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# 4. Permitir salidas a usuarios internos autorizados (net_user y root)
iptables -A OUTPUT -m owner --uid-owner root -j ACCEPT
iptables -A OUTPUT -m owner --uid-owner net_user -j ACCEPT
iptables -A OUTPUT -m owner --uid-owner 42 -j ACCEPT

# 5. Resolver e insertar excepciones ACCEPT para los dominios autorizados de config.toml
# El worker resuelve el dominio (p. ej. foldingathome.org) y añade la regla:
# iptables -A OUTPUT -d <IP_RESUELTA> -j ACCEPT
```

---

## Captura de Telemetrías de Rendimiento

Para justificar el pago de créditos a los workers, el daemon del worker monitoriza de forma transparente el coste computacional real mediante utilidades de bajo nivel:

* **Ciclos de CPU:** Se ejecuta el target `run` encapsulado bajo la utilidad `perf stat`:
  ```bash
  perf stat -e cycles --pid=<PID_PROCESO> 2>&1
  ```
  Esto devuelve la cantidad exacta de ciclos de CPU consumidos directamente por los hilos asignados a la tarea, abstrayendo fluctuaciones temporales provocadas por otros procesos en segundo plano del host.
* **Consumo de GPU:** Si la tarea requiere aceleración gráfica (GPU) y el dispositivo tiene el hardware correspondiente, el worker consulta de forma periódica la API de administración de NVIDIA a través de comandos como `nvidia-smi` para extraer la potencia instantánea consumida (vatios, TDP) y la memoria de vídeo VRAM en uso.
* **Memoria RAM:** Se lee periódicamente el fichero `/sys/fs/cgroup/memory` para calcular la memoria media consumida a lo largo de la ejecución.

---

## Algoritmo de Ajuste Dinámico de Bloques

El worker de Synergia intenta que cada tanda de procesamiento complete su trabajo y suba resultados aproximadamente cada **60 segundos** (intervalo de feedback determinado por la constante `UPLOAD_INTERVAL` en `worker.py`).

Para ello, el scheduler de forma inteligente evalúa cuánto tiempo tardó en completarse el bloque anterior y ajusta de forma adaptativa el tamaño del siguiente bloque a pedir (`n_consumes`) en su siguiente mensaje de WebSocket `{"action": "next", "n": N}`:
* Si el bloque se procesó muy rápido (p. ej. en 10 segundos), duplica de forma adaptativa el valor de N para reducir el overhead de negociación por red.
* Si el procesamiento excedió el intervalo objetivo (p. ej. tardó 3 minutos), reduce el valor de N proporcionalmente para asegurar subidas más frecuentes y fluidas.
