import { StudioProject } from "./project-types";

let currentProject: StudioProject | null = null;

let dirty = false;

/**
 * Devuelve el proyecto abierto.
 */
export function getCurrentProject(): StudioProject | null {
  return currentProject;
}

/**
 * Establece el proyecto actual.
 */
export function setCurrentProject(
  project: StudioProject | null
): void {
  currentProject = project;
  dirty = false;
}

/**
 * Marca el proyecto como modificado.
 */
export function markProjectDirty(): void {
  dirty = true;
}

/**
 * Marca el proyecto como guardado.
 */
export function markProjectSaved(): void {
  dirty = false;
}

/**
 * Indica si existen cambios sin guardar.
 */
export function hasUnsavedChanges(): boolean {
  return dirty;
}