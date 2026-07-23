import { StudioProject } from "../project-types";

/**
 * Convierte un proyecto a texto JSON.
 */
export function serializeProject(project: StudioProject): string {
  return JSON.stringify(project, null, 2);
}

/**
 * Convierte un JSON en un proyecto.
 */
export function deserializeProject(json: string): StudioProject {
  return JSON.parse(json) as StudioProject;
}