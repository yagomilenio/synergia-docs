---
title: Tareas de Ejemplo Publicadas
description: Análisis técnico detallado y código fuente de los repositorios demostrativos oficiales de Synergia.
---

Para validar las capacidades de la plataforma y facilitar la curva de aprendizaje a nuevos desarrolladores, Synergia dispone de **seis repositorios demostrativos oficiales**. Estos ejemplos cubren campos heterogéneos como la criptografía, la biomedicina, la inteligencia artificial (LLMs/Visión) y el renderizado 3D.

Cada uno de estos repositorios ha sido probado y ejecutado de forma distribuida en la red cumpliendo estrictamente con el contrato del [Makefile](../contrato-makefile/) y el formato del manifiesto [config.toml](../config-toml/).

---

## yescrypt_task_cracker (Criptografía)

Este repositorio realiza un ataque de diccionario distribuido para realizar auditorías de seguridad sobre hashes de contraseñas de tipo **yescrypt** (el esquema de contraseñas por defecto en distribuciones modernas como Debian y Fedora).

### Fichero `config.toml` de la Tarea
Utiliza una entrada optimizada de tipo `file_single`. El gran archivo de contraseñas de referencia `rockyou_1k.txt` reside en GitHub, y el worker descarga únicamente las líneas del rango que le corresponde vía `awk` en la shell del contenedor, minimizando el consumo de red y RAM.

```toml
# yescrypt_task_cracker/config.toml (Código real)
[task]
  deterministic = true

[requirements]
  packages = ["build-essential", "libssl-dev", "john"]  

[inputs]
  type = "file_single"

[inputs.file_single]
  path = "rockyou_1k.txt"
  format = "text"
  delimiter = "\n"

[outputs]
  dir              = "~/.john"
  filename_pattern = "john.pot"
```

### Fichero `Makefile` de la Tarea
El Makefile delega la fuerza bruta en la suite de seguridad **John the Ripper** (`john`). El target `run` recibe el parámetro inyectado `WORDS` (la porción del diccionario extraída) y realiza el cracking por tuberías sobre el archivo de hashes:

```makefile
# yescrypt_task_cracker/Makefile (Código real)
.PHONY: help setup run clean

help:
	@echo ""
	@echo "  make setup                    instala john"
	@echo "  make run WORDS='1234 holamunod passwd'"
	@echo "  make clean                    borra outputs"
	@echo ""

setup:
	@echo "Nada que instalar"

run:
	echo $$WORDS | tr ' ' '\n' |  john hashes.txt --stdin --format=crypt

clean:
	rm -rf ~/.john
```

---

## foldingathomesynergia (Biomedicina)

Este repositorio se integra con el cliente oficial de computación voluntaria de la Universidad de Stanford **Folding@home** para contribuir en investigaciones científicas sobre el plegado de proteínas y el diseño terapéutico contra enfermedades moleculares.

### Fichero `config.toml` de la Tarea
Dado que las simulaciones estocásticas pueden divergir por la semilla aleatoria, se define `deterministic = false` para deshabilitar la verificación por consenso y pagar directamente al worker por el tiempo aportado. El manifiesto declara una extensa lista blanca de hosts permitidos (`allowed_hosts`) para que el cortafuegos `iptables` autorice al cliente de Stanford a conectarse con los servidores de asignación científica.

```toml
# foldingathomesynergia/config.toml (Código real)
[requirements]
packages = ["coreutils", "jq"]
	
[[download.files]]
	url = "https://github.com/vi/websocat/releases/latest/download/websocat.x86_64-unknown-linux-musl"
	dest = "websocat"
	post = "chmod +x websocat"
	
[network]
	allowed_hosts = [
	    "foldingathome.org",
	    "v8-5.foldingathome.org",
	    "app.foldingathome.org",
	    "master.foldingathome.org",
	    "api.foldingathome.org",
	    "api2.foldingathome.org",
	    "api3.foldingathome.org",
	    "api4.foldingathome.org",
	    "api5.foldingathome.org",
	    "assign1.foldingathome.org",
	    "assign2.foldingathome.org",
	    "assign3.foldingathome.org",
	    "assign4.foldingathome.org",
	    "assign5.foldingathome.org",
	    "assign6.foldingathome.org",
	    "cores.foldingathome.org",
	    "cores2.foldingathome.org",
	    "node1.foldingathome.org",
	    "vav17.fah.temple.edu",
	    "vav18.fah.temple.edu",
	    "vav19.fah.temple.edu",
	    "vav20.fah.temple.edu",
	    "vav21.fah.temple.edu",
	    "vav22.fah.temple.edu",
	    "vav23.fah.temple.edu",
	    "vav24.fah.temple.edu",
	    "highland1.seas.upenn.edu",
	    "highland2.seas.upenn.edu",
	    "highland3.seas.upenn.edu",
	    "highland4.seas.upenn.edu",
	    "highland5.seas.upenn.edu",
	]

[outputs]
	dir = "work"

[hash]
    exclude = ["fah", "client.db"]
```

### Fichero `Makefile` de la Tarea
El Makefile de Folding@home implementa una orquestación muy avanzada utilizando la utilidad de sockets `websocat`:
1. Genera un ID de máquina voluntaria aleatoria utilizando `/proc/sys/kernel/random/uuid`.
2. Lanza el daemon `fah-client` en segundo plano asignándole los hilos autodetectados del host (`nproc`).
3. Envía comandos JSON por WebSocket local al panel de control de Folding (`ws://127.0.0.1:7396`) para despausar el cálculo (`unpause`) y marcar la simulación para detenerse de forma limpia al terminar la unidad de trabajo actual (`finish`).
4. Duerme durante 5 minutos (`sleep 300`) mientras se realiza el plegado molecular, y finalmente llama a `control_upload.sh` para empaquetar las métricas científicas generadas en el directorio de outputs.

```makefile
# foldingathomesynergia/Makefile (Código real)
.PHONY: setup run clean

setup:
	@echo "=== Setup Folding@home ==="
	sh setup_fah.sh

run:
	@echo "=== Ejecutando Folding@home ==="
	$(eval UUID := $(shell cat /proc/sys/kernel/random/uuid | tr -d '-' | head -c 8))
	fah/usr/bin/fah-client --user=worker --team=1067987 --account-token=E-qC3E-qZgQvAZgeQhxp-QhmGIGNGGIDtDKLztDDt4E --machine-name=synergia-worker-$(UUID) --cpus=$(shell nproc) &
	sleep 10
	echo '{"cmd":"unpause"}' | ./websocat ws://127.0.0.1:7396/api/websocket
	echo '{"cmd":"finish"}' | ./websocat ws://127.0.0.1:7396/api/websocket
	sleep 300
	./control_upload.sh

 clean:
	rm -f gpus.json log.txt
	rm -rf cores work
```

![Panel de administración de los clientes de Folding@home](../../../../public/images/tfg/foldingathome-dashboard.png)

---

## blender-render-task (Renderizado 3D)

Este repositorio permite distribuir el renderizado de animaciones 3D pesadas (como la escena oficial de Blender 4.1 Splash) fotograma a fotograma entre múltiples workers concurrentes de la red.

### Fichero `config.toml` de la Tarea
Se configura como determinista (`deterministic = true`). Cada bloque recibe un rango numérico `range_continuous` que define el fotograma inicial y final a renderizar. El contenedor descarga automáticamente el fichero `.blend` de la escena y el motor binario de Blender optimizado para Linux de forma desatendida desde sus releases oficiales.

```toml
# blender-render-task/config.toml (Código real)
[requirements]
packages = ["curl", "xz-utils", "libsm6", "libxext6", "libxrender1", "libxi6", "libxkbcommon0", "libgl1", "libegl1", "libxcursor1", "libxfixes3", "libxinerama1", "libxrandr2", "libegl-mesa0"]

[inputs]
type = "range_continuous"

[[download.files]]
url  = "https://github.com/yagomilenio/blender-render-task/releases/download/1.0/blender-4.1-splash.blend"
dest = "blender-4.1-splash.blend"

[[download.files]]
url  = "https://github.com/yagomilenio/blender-render-task/releases/download/1.0/blender-5.1.0-linux-x64.tar.xz"
dest = "blender-5.1.0-linux-x64.tar.xz"
 
[inputs.range_continuous]
start = 1
end   = 250   
step  = 1
 
[outputs]
dir              = "outputs"
filename_pattern = "frames_{start}_{end}.tar.gz"
```

### Fichero `Makefile` de la Tarea
El Makefile de Blender extrae el tarball de Blender en la fase de `setup` y delega la ejecución de renderizado al script interno `render.sh` pasando los parámetros `START` y `END`:

```makefile
# blender-render-task/Makefile (Código real)
START  ?= 1
END    ?= 10
BLEND  ?= $(shell ls *.blend 2>/dev/null | head -1)
OUTPUT ?= outputs/frames_$(START)_$(END).tar.gz

.PHONY: help setup run test clean

help:
	@echo ""
	@echo "  make setup                    instala Blender"
	@echo "  make run START=1 END=50       renderiza frames 1-50"
	@echo "  make test                     prueba rápida (frames 1-3)"
	@echo "  make clean                    borra outputs"
	@echo ""

setup:
	tar -xf blender-5.1.0-linux-x64.tar.xz

run:
	bash render.sh --start $(START) --end $(END) --output $(OUTPUT)

test:
	bash render.sh --start 1 --end 3 --output outputs/test

clean:
	rm -rf outputs
```

![Métricas y descripción del renderizado en Blender](../../../../public/images/tfg/blender-metrics.png)

---

## testRepositoryForParallel (Referencia Mínima)

* **Propósito:** Repositorio minimalista de referencia diseñado para comprobar la correcta inicialización de contenedores, la inyección de rangos, la verificación cruzada y el empaquetado del worker.
* **Estructura Clave:**
  * `config.toml` configurado como determinista con entrada de tipo `range_continuous` (0 a 100, step 10).
  * `Makefile` que genera simples outputs de texto concatenando las variables `START` y `END`.

---

## ollama-llm-task (Inferencia LLM / Dinámica)

* **Propósito:** Inferencia local distribuida a gran escala utilizando modelos ligeros de IA en lenguaje natural (como `llama3`, `gemma` o `phi3`) mediante llamadas asíncronas a la suite local de **Ollama**.
* **Mecánica Operativa:**
  * Configurado como tipo de entrada `dynamic`. No tiene límites predefinidos; recibe los prompts en caliente desde la base de datos inyectados por el publisher y los procesa uno a uno inyectando la cadena en la variable de entorno `WORD` en `make run`.

---

## qwen2-vl-7b-parallel-test (Inferencia de Visión)

* **Propósito:** Inferencia paralela distribuida de visión artificial y transcripción multimodal utilizando el modelo de frontera de Deep Learning **Qwen2-VL 7B** sobre un conjunto de imágenes de entrada.
* **Mecánica Operativa:**
  * El target `setup` configura el entorno virtual, instala librerías pesadas (`torch`, `transformers`, `accelerate`) y descarga los pesos del modelo de IA.
  * El target `run` ejecuta el script de inferencia `run_vision.py`, aprovechando de forma exclusiva la aceleración de hardware GPU (`--gpus`) e hilos CPU bloqueados (`--cpuset-cpus`) declarados en tu nodo.
