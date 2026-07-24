import { StudioProject } from "../project-types";
import { serializeProject, deserializeProject } from "./project-file";

/**
 * Descarga un texto como archivo.
 */
function downloadText(
  fileName: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], {
    type: mimeType,
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;

  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Guarda un proyecto SonCeibe Studio.
 */
export function saveProject(project: StudioProject): void {
  const json = serializeProject(project);

  downloadText(
    `${project.info.name}.scs`,
    json,
    "application/json"
  );
}
/**
 * Permite al usuario seleccionar un archivo de texto.
 */
async function readTextFile(
  accept: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = accept;

    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        resolve(null);
        return;
      }

      const text = await file.text();

      resolve(text);
    };

    input.click();
  });
}
/**
 * Abre un proyecto SonCeibe Studio.
 */
export async function openProject(): Promise<StudioProject | null> {
  const json = await readTextFile(".scs");

  if (!json) {
    return null;
  }

  return deserializeProject(json);
}