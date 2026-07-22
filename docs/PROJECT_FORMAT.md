# SonCeibe Studio

## Project Format (.scs)

Versión: 1.0

---

# Filosofía

Un proyecto de SonCeibe Studio es completamente autocontenido.

Debe poder copiarse a cualquier ordenador y seguir funcionando sin perder recursos.

Nunca dependerá de rutas absolutas del sistema operativo.

---

# Estructura

```text
NombreDelProyecto.scs/

│
├── project.json
│
├── audio/
│
├── lyrics/
│
├── backgrounds/
│
├── fonts/
│
├── thumbnails/
│
├── cache/
│
└── exports/
```

---

# project.json

Contendrá únicamente información del proyecto.

Nunca almacenará los recursos binarios.

---

# audio/

Contendrá el archivo MP3 original importado.

Nunca será modificado.

---

# lyrics/

Contendrá:

- TXT
- LRC

si existen.

---

# backgrounds/

Imágenes y vídeos utilizados.

---

# cache/

Archivos temporales generados por SonCeibe Studio.

Podrán eliminarse en cualquier momento.

---

# exports/

Vídeos generados.

Nunca formarán parte del proyecto lógico.

Son únicamente resultados.

---

# Principios

- El proyecto debe ser portable.
- Nunca depender de rutas absolutas.
- Nunca modificar los archivos originales.
- Compatible con futuras versiones.
- Versionado mediante "project.json".

# Filosofía de desarrollo

SonCeibe Studio se desarrolla siguiendo estos principios:

## 1. Nunca perder el trabajo del usuario

La seguridad del proyecto está por encima de cualquier otra característica.

## 2. Los proyectos son autocontenidos

Todos los recursos necesarios para abrir un proyecto viajarán junto al propio proyecto.

## 3. Nunca modificar los archivos originales

SonCeibe Studio trabajará siempre sobre copias internas del proyecto.

## 4. Todo debe poder deshacerse

Cualquier operación importante deberá poder revertirse.

## 5. Compatibilidad hacia atrás

Las nuevas versiones deberán abrir proyectos creados con versiones anteriores.

## 6. Modularidad

Cada módulo debe tener una única responsabilidad y ser reutilizable.

## 7. Rendimiento

La aplicación debe seguir siendo fluida incluso con proyectos grandes.

## 8. Simplicidad para el usuario

La potencia nunca debe hacer que la aplicación resulte complicada de utilizar.