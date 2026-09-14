---
title: Contrato del Makefile
description: Especificación de la interfaz de ejecución de tareas de Synergia basada en Makefiles nativos de GNU.
---

Una de las decisiones de diseño más robustas y flexibles de Synergia es el desacoplamiento tecnológico del código de la tarea mediante la interfaz estándar de **GNU Make**.

La plataforma es **agnóstica respecto al lenguaje de programación** empleado en la tarea (Python, C++, Rust, Node.js, Bash...). En lugar de obligar al desarrollador a importar librerías o empaquetar ejecutables siguiendo arquitecturas específicas de Synergia, el sistema impone un **contrato de Makefile**. Si la tarea es capaz de compilarse y ejecutarse mediante comandos de consola locales, funcionará en la red distributiva sin alteraciones.

---

## Los Tres Targets Obligatorios

El orquestador del worker invoca los comandos de compilación y ejecución dentro de la carpeta compartida `/repo` del contenedor con la directiva:
`cd /repo && make <target>`

El desarrollador debe definir de forma explícita estos tres targets en su archivo `Makefile`:

| Target | Cuándo se invoca | Variables de Entorno que Recibe | Responsabilidad |
| :--- | :--- | :--- | :--- |
| **`setup`** | Una sola vez, antes de iniciar el primer chunk de trabajo. El entorno se cachea localmente. | Ninguna. | Instalar dependencias locales en el contenedor, compilar ejecutables en C/C++, descargar repositorios de Python (`pip install`) o configurar variables de entorno locales. |
| **`run`** | Por cada bloque (chunk) de trabajo asignado al worker por WebSocket. | Dinámicas (ver variables abajo). | Realizar el procesamiento lógico del bloque y escribir los resultados finales en el directorio configurado en `[outputs].dir` de `config.toml`. |
| **`clean`** | Antes de cada invocación de `run` y al finalizar el empaquetado. | Ninguna. | Depurar y borrar cualquier residuo, fichero temporal o salida de ejecuciones previas para evitar falsos positivos y asegurar la integridad determinista del empaquetado final. |

---

## Variables de Entorno Inyectadas en `make run`

El worker inyecta los parámetros del bloque de trabajo directamente como variables de entorno de la shell en el momento de invocar el comando `make run`. 

El Makefile debe interceptar estas variables según el tipo de entradas configurado en `config.toml`:

### `START` y `END`
Se inyectan en tareas basadas en rangos (`range_continuous`, `range_discrete`), directorios (`directory`) o arrays de ficheros (`file_multi`). Definen el intervalo cerrado de índices a procesar en el chunk actual.
```bash
# Invocación real del worker
cd /repo && make run START=100 END=199
```

### `WORD`
Se inyecta exclusivamente en tareas de tipo dinámico (`dynamic`). Contiene el string único del ítem asignado.
```bash
# Invocación real del worker (sanitizado con shlex.quote)
cd /repo && make run WORD='mi_prompt_de_entrada'
```

### `WORDS`
Se inyecta en tareas que procesan un único archivo remoto fraccionado por líneas (`file_single`). Contiene una lista de valores separados por espacios correspondiente a las líneas del bloque actual extraídas por `awk`.
```bash
# Invocación real del worker
cd /repo && make run WORDS='lineaA lineaB lineaC'
```

---

## Ejemplos de Implementación Reales

### Ejemplo 1: Tarea en C/C++ (Criptografía)
Este Makefile compila un binario de fuerza bruta en C durante la fase de `setup` y lo ejecuta pasando los límites de rangos en `run`:

```makefile
# Variables inyectadas por el worker: START, END
CC = gcc
CFLAGS = -O3 -Wall
TARGET = cracker
OUTPUT_DIR = outputs

.PHONY: setup run clean

setup:
	$(CC) $(CFLAGS) src/main.c -o $(TARGET) -lcrypto

run:
	@mkdir -p $(OUTPUT_DIR)
	./$(TARGET) --start $(START) --end $(END) --output $(OUTPUT_DIR)/result_$(START)_$(END).txt

clean:
	rm -f $(TARGET)
	rm -rf $(OUTPUT_DIR)
```

### Ejemplo 2: Tarea en Python (Inferencia de IA)
Este Makefile instala las dependencias de Python requeridas (`setup`) y ejecuta la inferencia pasando un prompt dinámico en `WORD`:

```makefile
# Variable inyectada por el worker: WORD
VENV = .venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip
OUTPUT_DIR = outputs

.PHONY: setup run clean

setup:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

run:
	@mkdir -p $(OUTPUT_DIR)
	$(PYTHON) src/inference.py --prompt "$(WORD)" --out $(OUTPUT_DIR)/response.json

clean:
	rm -rf $(OUTPUT_DIR)
	# Nota: No borramos $(VENV) para aprovechar la caché de setup entre chunks
```
