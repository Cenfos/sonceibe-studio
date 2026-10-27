# Versiones, copias y timeline

- **Versiones locales** está en la barra del editor de PC y en la cabecera móvil. Guarda ajustes, letras, fotos y el audio local disponible antes de cambios importantes. Las ediciones continuas se agrupan; la resincronización conserva el estado previo al inicio. También permite guardar una versión manual.
- El historial se guarda en IndexedDB, separado por usuario y proyecto, y sobrevive a recargas. Conserva hasta 20 versiones y aproximadamente 128 MB por proyecto. No se incluye en el archivo portátil `.scs` ni en la carpeta física. Borrar los datos del navegador borra también este historial. Los errores se muestran en Versiones locales.
- Restaurar conserva primero una versión del estado actual y recarga el audio. **Duplicar proyecto**, en el menú de cada tarjeta de la portada, crea un identificador y una copia del audio independientes; conserva fotos, intervalos y encuadre, sin reutilizar el vídeo exportado.
- La timeline de PC permite zoom con la barra o Ctrl+rueda, Ver todo e Ir al cursor. El zoom conserva el punto de referencia. Arrastra centros o bordes; un arrastre produce un solo paso de deshacer. Escape cancela el arrastre.
- El ajuste atrae los bordes cercanos al cursor de reproducción (8 píxeles, máximo 0,25 s). Alt lo desactiva durante el arrastre. Con el bloque o borde enfocado, las flechas ajustan 0,1 s, Shift 0,5 s y Alt 0,01 s. Inicio/Final también se pueden escribir numéricamente.

## Verificación

```sh
npm ci
npx playwright install chromium
npm run check
```

`check` ejecuta typecheck, Vitest, build de Next y Playwright. CI repite estas comprobaciones en pushes y pull requests; no contiene credenciales ni publica despliegues.

Las pruebas de navegador empaquetan los componentes reales en un servidor local de pruebas independiente; no añaden rutas ni accesos especiales a producción. Comprueban duplicación con audio, borrado independiente, persistencia/restauración del historial, undo tras un arrastre, bordes de fotos y letras, zoom y cursor tras desplazamiento.

El exportador y el renderizador de producción se importan sin modificaciones. Las pruebas crean MP4 H.264/AAC reales de seis segundos para móvil 1080×1920 y PC 1920×1080, comprueban `moov` antes de `mdat`, ausencia de fragmentos `moof`, duración, avance y retroceso, letras en distintos momentos incluido el final y píxeles de las esquinas sin bandas negras con `imageFit: cover`. También comprueban intervalos de imágenes y que se conserve el encuadre explícito de las fotos.

Estas comprobaciones ejercitan Chromium. La compatibilidad final con aplicaciones externas como WhatsApp, Instagram y reproductores de Windows sigue dependiendo de esas aplicaciones; no se simulan en esta suite.
