# Imágenes que espera la landing

Coloca aquí (en `public/images/`) tus capturas reales con **estos nombres exactos**.
Mientras no existan, la sección de tareas muestra un panel "SEÑAL_NO_ENCONTRADA" en su lugar,
así que puedes publicar la web antes de tener todas las imágenes y añadirlas después sin tocar código.

| Archivo | Dónde se usa | Sugerencia de contenido |
|---|---|---|
| `task-blender.png` | Tarjeta "blender-render-task" | Fotograma renderizado o panel de la escena Blender 4.1 splash |
| `task-cracker.png` | Tarjeta "yescrypt_task_cracker" | Terminal mostrando contraseñas crackeadas / verificación del resultado |
| `task-llm.png` | Tarjeta "ollama-llm-task" | Captura de una consulta al LLM ejecutándose en un worker |
| `task-foldingathome.png` | Tarjeta "foldingathomesynergia" | Panel de administración de clientes de Folding@Home o puntos obtenidos |

Formato recomendado: `.png` o `.jpg`, orientación horizontal (16:10 aprox.), menos de 500 KB
para no penalizar el tiempo de carga en GitHub Pages.

Si quieres añadir más capturas (dashboard de Grafana, CLI, diagrama de arquitectura...),
usa el componente `<ImagePanel src="tu-archivo.png" alt="..." />` en cualquier sección —
está en `src/components/ImagePanel.jsx`.
