/**
 * SonCeibe Studio
 * Tipos principales del sistema de proyectos.
 */

export const PROJECT_VERSION = 1;

/**
 * Información general del proyecto.
 */
export interface ProjectInfo {
  id: string;
  name: string;
  artist: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Archivo de audio principal.
 */
export interface AudioFile {
  fileName: string;
  duration: number;
}

/**
 * Línea de letra sincronizada.
 */
export interface LyricLine {
  id: string;
  text: string;
  start: number;
  end: number;
}

/**
 * Configuración de exportación.
 */
export interface ExportSettings {
  resolution: "720p" | "1080p" | "4K";
  fps: 30 | 60;
  format: "mp4";
}

/**
 * Proyecto completo.
 */
export interface StudioProject {
  version: number;
  info: ProjectInfo;
  audio: AudioFile | null;
  lyrics: LyricLine[];
  export: ExportSettings;
}