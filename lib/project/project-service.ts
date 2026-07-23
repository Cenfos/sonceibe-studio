import { PROJECT_VERSION, StudioProject } from "./project-types";

/**
 * Servicio principal para gestionar proyectos de SonCeibe Studio.
 */
export class ProjectService {
/**
   * Crea un proyecto nuevo con valores por defecto.
   */
static createNewProject(name: string): StudioProject {
    const now = new Date().toISOString();

    return {
    version: PROJECT_VERSION,

    info: {
        id: crypto.randomUUID(),
        name,
        artist: "",
        createdAt: now,
        updatedAt: now,
    },

    audio: null,

    lyrics: [],

    export: {
        resolution: "1080p",
        fps: 30,
        format: "mp4",
    },
    };
}
}