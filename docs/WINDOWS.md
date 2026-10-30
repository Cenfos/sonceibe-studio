# Studio para Windows

La aplicación Tauri 2 abre la web de Studio en WebView2. Necesita conexión; no incluye un servidor Next.js local. No concede comandos nativos a la web. La sesión de escritorio se conserva dentro de WebView2 y es independiente de la del navegador. Para mover proyectos existentes, guardar e importar el archivo .scs.

## Compilar

Instalar Rust estable MSVC, herramientas C++ de Visual Studio y WebView2. Instalar CLI con `cargo install tauri-cli --version "^2" --locked`.

En PowerShell, definir `$env:STUDIO_DESKTOP_URL="https://URL-REAL-DE-STUDIO"` y ejecutar `npm run desktop:build`. El comando rechaza una URL vacía o sin HTTPS. El instalador se genera en `src-tauri/target/release/bundle/nsis/`.

Para desarrollar, ejecutar `npm run dev` y, en otra terminal, `npm run desktop:dev`.

Alternativamente, ejecutar el workflow manual **Windows installer**. Descargar su artefacto; el workflow no publica un enlace público. La primera compilación todavía debe validarse en Windows, incluyendo importación de .scs, audio, fotografías, exportación MP4, cierre y reapertura.

## Descarga web

La ruta `/download/windows` comprueba la sesión de Studio antes de leer el instalador desde Vercel Blob privado. Sin sesión, pide acceso y continúa automáticamente al entrar. Con sesión, descarga directamente sin otra pregunta. El middleware conserva el destino y solo admite esta ruta como retorno.

Almacén conectado: `studio-windows-installers` (privado, Frankfurt). El token `BLOB_READ_WRITE_TOKEN` se inyecta en el servidor desde la conexión de Vercel. El objeto es `windows/SonCeibe-Studio-Setup.exe`. No usar variables NEXT_PUBLIC ni alojar el instalador en public/.

Al publicar una nueva versión, compilar con el workflow **Windows installer**, validar el resultado y sustituir ese objeto privado. El workflow se ejecuta manualmente o al actualizar los archivos de escritorio en `codex/windows-desktop`. Los artefactos de Actions caducan a los 14 días; el objeto de Blob conserva la descarga publicada.

Las respuestas de descarga son privadas y sin caché. Sin instalador, la ruta devuelve 503; ante un fallo de almacenamiento, devuelve 502 sin revelar credenciales. La aplicación de escritorio utiliza https://sonceibe-studio.vercel.app.

El instalador no está firmado hasta configurar un certificado de firma de Windows en el proceso de publicación. No se ha añadido actualización automática.

Referencia: https://v2.tauri.app/distribute/windows-installer/
