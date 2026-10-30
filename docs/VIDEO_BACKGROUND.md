# Vídeo de fondo

En el primer paso de la guía o en Formato, cargar un vídeo de móvil. Se admiten los formatos que pueda reproducir el navegador (recomendado MP4 H.264/AAC; MOV y WebM según códecs). Límite inicial: 100 MB y 10 minutos. Un formato no compatible muestra un error sin sustituir el vídeo anterior.

El inicio y el final del recorte determinan la duración del montaje. La línea de tiempo, las letras y las fotos puntuales usan tiempos relativos a ese recorte. Si cambias el inicio, revisa la sincronización de las letras ya preparadas. No se repite el vídeo ni la canción.

El sonido original se puede mantener, silenciar o ajustar de volumen. La canción es independiente y opcional si ya hay vídeo: puedes añadirla, quitarla, cambiar su volumen y elegir desde qué segundo empieza. Si termina antes que el vídeo, el resto conserva solo el sonido original habilitado, o silencio. La mezcla se prepara como una única pista para que la vista previa, las letras, los Reels y el MP4 compartan reloj y sonido. Un limitador reduce la saturación al sumar dos pistas.

El encuadre admite ver completo, llenar recortando, posición horizontal y vertical y zoom hasta 300%. No modifica el archivo original. Las fotos puntuales y los estilos siguen disponibles sobre el vídeo.

El material original se guarda en IndexedDB con claves inmutables, separado de los MP4 exportados. Esto permite deshacer cambios de vídeo y recuperar versiones anteriores. Se incluye dentro de la copia .scs y se copia al duplicar el proyecto; en la carpeta local se guarda junto a project.json. El .scs mantiene el límite total de 256 MB para poder reabrirse.

Los proyectos antiguos con solo audio conservan su funcionamiento. La app Windows de Tauri carga la web actualizada y recibe esta función al reabrirla; no requiere otro instalador.
