---
title: Referencia de config.toml
description: Especificación completa de las secciones reconocidas por el parser real de Synergia en el archivo de configuración de tareas.
---

El archivo `config.toml` debe residir en la raíz del repositorio de la tarea. Es el manifiesto que describe los requisitos de hardware, el particionado de entradas, los permisos de red y el comportamiento de validación de la tarea. 

Es interpretado en el worker por la clase `ConfigurationInterpreter` (`worker/utils/configuration_interpreter.py`) utilizando la librería estándar de Python `tomllib`.

---

## Estructura General y Secciones Reconocidas

El parser real reconoce de forma estricta las siguientes secciones y campos. Cualquier sección no especificada aquí (como `[runner]`, la cual fue descartada en favor del contrato nativo del Makefile) será ignorada por el orquestador.

```toml
# Ejemplo de manifiesto config.toml completo
[task]
deterministic = true

[requirements]
packages = ["build-essential", "libssl-dev"]

[[download.files]]
url  = "https://dominio.com/recurso_grande.bin"
dest = "resources/datos.bin"
post = "chmod 644 resources/datos.bin"

[hash]
exclude = ["build/", "logs/", "outputs/"]

[network]
allowed_hosts = ["api.externa.org", "repositorio.com"]

[outputs]
dir              = "outputs"
filename_pattern = "results_{start}_{end}.tar.gz"
mode             = "file"
```

---

## Detalle de los Campos de Configuración

### Seccion `[task]`
* **`deterministic` (bool, por defecto `true`):** Determina si el resultado de la tarea es reproducible ante idénticas entradas. Si es `true`, el servidor activará la verificación cruzada obligatoria mediante consenso mayoritario de hashes de salida.

### Sección `[requirements]`
* **`packages` (array de strings, opcional):** Lista de paquetes del gestor `apt` que el worker instalará en el contenedor Docker mediante un comando automatizado antes de invocar la fase de setup del Makefile.

### Sección `[[download.files]]`
Permite declarar ficheros externos voluminosos que no deben guardarse directamente en el repositorio Git pero son necesarios para la tarea. Es un array de tablas:
* **`url` (string, obligatorio):** Dirección HTTP/HTTPS de descarga directa del fichero.
* **`dest` (string, obligatorio):** Ruta de destino relativa donde se escribirá el fichero dentro del directorio de trabajo `/repo`.
* **`post` (string, opcional):** Comando shell opcional a ejecutar en el contenedor tras completar la descarga (p. ej. descompresiones con `tar -xf` o permisos con `chmod`).

### Sección `[hash]`
* **`exclude` (array de strings, opcional):** Rutas de ficheros o carpetas que el worker debe ignorar al calcular el hash de integridad snapshot del repositorio. Útil para evitar fallos de snapshot causados por subdirectorios generados dinámicamente durante la compilación o ejecución local (ficheros `.o`, carpetas de logs, etc.).

### Sección `[network]`
* **`allowed_hosts` (array de strings, opcional):** Lista blanca de nombres de dominio DNS a los que el cortafuegos `iptables` del contenedor permitirá conexiones de salida. La resolución de nombres se realiza dinámicamente al levantar el entorno.

### Sección `[outputs]`
Describe cómo el worker debe capturar las salidas:
* **`dir` (string, por defecto `"."`):** Directorio relativo donde se espera que el Makefile escriba los ficheros finales de resultado.
* **`filename_pattern` (string, por defecto `"*"`):** Patrón wildcard para identificar los ficheros a empaquetar. Admite los marcadores dinámicos `{start}`, `{end}` y `{worker_id}`.
* **`mode` (string, `"file"` | `"stdout"`, por defecto `"file"`):** Si se define como `"stdout"`, el worker no buscará ficheros físicos; capturará directamente el flujo de salida estándar (stdout) de la ejecución de `make run` y lo subirá como resultado al servidor.

---

## Especificación de la Sección `[inputs]` (6 Tipos de Entrada)

El campo `type` actúa como discriminador de la sección e indica al productor del servidor cómo subdividir el trabajo. Synergia implementa **seis tipos reales de entrada**:

### directory
Enumera ficheros contenidos en un subdirectorio del repositorio Git en la fase de publicación (`GithubUtil.list_dir`) y les asigna índices numéricos continuos de 0 a N-1:
```toml
[inputs]
type = "directory"

[inputs.directory]
path       = "inputs/imagenes"
recursive  = false
extensions = [".png", ".jpg"]
sort_order = "filename"
```

### file_multi
Selecciona múltiples ficheros distribuidos en el repositorio empleando un patrón wildcard de tipo glob (`GithubUtil.list_glob`):
```toml
[inputs]
type = "file_multi"

[inputs.file_multi]
glob   = "datasets/**/*.csv"
format = "text"   # binary | text | image | video
```

### file_single (Optimizado para Grandes Archivos)
Particiona un único fichero grande en bloques. Ofrece dos modos de operación avanzados de alta ingeniería:

#### Modo Líneas de Texto (Sin índice)
El worker no descarga el fichero de datos completo. Utiliza un comando optimizado de `awk` con el `delimiter` configurado como separador de registros (`RS`) para extraer y descargar al contenedor **exclusivamente** el bloque de líneas correspondientes al rango de índices de entrada asignados:
```toml
[inputs]
type = "file_single"

[inputs.file_single]
path        = "inputs/diccionario.txt"
format      = "text"
delimiter   = "\n"
encoding    = "utf-8"
skip_header = false
```

#### Modo Binario Indexado
Diseñado para datasets binarios de gran volumen donde es inviable leer línea a línea. Requiere un fichero de índices complementario `.bin` que especifica los offsets y longitudes en bytes de cada registro. El worker lee este índice ligero con `dd` y realiza un acceso aleatorio directo (*random access*) por offsets sobre el fichero fuente para extraer exclusivamente el rango binario correspondiente:
```toml
[inputs.file_single]
path        = "inputs/corpus.bin"
format      = "binary"
index_file  = "inputs/corpus_indices.bin"
index_len   = 16  # bytes de ancho por registro de índice
```

### range_continuous
Define un rango numérico de progresión lineal continua. El productor lo representa internamente mediante un objeto `range()` de Python de forma analítica, evitando instanciar arrays de millones de enteros en la memoria RAM:
```toml
[inputs]
type = "range_continuous"

[inputs.range_continuous]
start = 0
end   = 9999999
step  = 1
```

### range_discrete
Lista explícita de valores numéricos o literales no contiguos. Útil para lanzar reprocesamientos selectivos de bloques específicos que fallaron en ejecuciones previas:
```toml
[inputs]
type = "range_discrete"

[inputs.range_discrete]
values = [14, 55, 921, 1044, 88201]
```

### dynamic
Indica que la tarea es **dinámica**. No tiene un número de ítems prefijado al publicar. Las entradas se inyectan en caliente mediante llamadas HTTP POST a la API REST, y el orquestador las distribuye a los workers en forma de strings individuales (`input_value`) que el Makefile recibe a través de la variable de entorno `WORD`. Pensado para flujos continuos de prompts a LLMs.
```toml
[inputs]
type = "dynamic"
# No requiere subsección de configuración adicional
```
