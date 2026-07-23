# SonCeibe Studio - Modelo de Datos

## Filosofía

El formato de proyecto de SonCeibe Studio debe estar diseñado para crecer durante años sin romper la compatibilidad entre versiones.

Cada proyecto representa una canción completa, incluyendo todos los recursos necesarios para editarla y exportarla.

---

# StudioProject

StudioProject
│
├── ProjectInfo
├── Audio
├── Lyrics
├── Timeline
├── Background
├── Effects
├── Export
├── Assets
└── Metadata

---

## ProjectInfo

Información básica del proyecto.

Campos previstos:

- id
- name
- artist
- album
- description
- genre
- createdAt
- updatedAt
- version

---

## Audio

Gestiona todos los archivos de audio.

Inicialmente:

- Audio original

En futuras versiones:

- Voz
- Instrumental
- Coros
- Stems IA
- Forma de onda
- BPM
- Tonalidad

---

## Lyrics

Información relacionada con la letra.

Actualmente:

- líneas
- tiempos

En el futuro:

- idioma
- traducciones
- sincronización
- estilos
- karaoke
- efectos

---

## Timeline

Organización temporal del proyecto.

Incluirá:

- pistas
- clips
- marcadores
- zoom
- selección
- reproducción

---

## Background

Fondos del vídeo.

Podrá contener:

- color sólido
- gradientes
- imágenes
- vídeo
- fondos animados

---

## Effects

Efectos visuales.

Ejemplos:

- Glow
- Blur
- Partículas
- Ken Burns
- Fade
- Zoom
- Bounce

---

## Export

Configuración de exportación.

Ejemplos:

- resolución
- FPS
- formato
- códec de vídeo
- códec de audio
- bitrate

---

## Assets

Repositorio interno de recursos.

Podrá almacenar:

- audios
- imágenes
- vídeos
- fuentes
- iconos

Cada recurso tendrá:

- id
- nombre
- ruta
- tipo
- fecha de creación

---

## Metadata

Información adicional del proyecto.

Ejemplos:

- autor
- notas
- etiquetas
- historial de versiones
- comentarios

---

# Objetivo

El modelo de datos debe permitir añadir nuevas funcionalidades sin modificar la estructura principal del proyecto.