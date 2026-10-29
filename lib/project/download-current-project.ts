import type { Project } from '@/lib/types';
import { validateProject } from '@/lib/project-validation';

interface DownloadableProjectFile {
  format: 'sonceibe-studio';
  version: 1;
  exportedAt: string;
  project: Project;
  audioDataUrl: string | null;
}

export interface ImportedPortableProject {
  project: Project;
  audioFile: File | null;
}

function safeFileName(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'proyecto-sonceibe';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el audio'));
    reader.readAsDataURL(blob);
  });
}

async function getAudioDataUrl(audioSrc?: string, audioBlob?: Blob | null): Promise<string | null> {
  if (audioBlob) return blobToDataUrl(audioBlob);
  if (!audioSrc) return null;
  if (audioSrc.startsWith('data:')) return audioSrc;

  try {
    const response = await fetch(audioSrc);
    if (!response.ok) return null;
    return blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
}

export async function downloadCurrentProject(
  project: Project,
  audioSrc?: string,
  audioBlob?: Blob | null
): Promise<void> {
  const audioDataUrl = await getAudioDataUrl(audioSrc, audioBlob);
  if ((project.settings.audioName || project.settings.audioUrl) && !audioDataUrl) {
    throw new Error('No se pudo incluir el audio. Vuelve a cargarlo antes de descargar una copia del proyecto.');
  }

  const projectCopy: Project = {
    ...project,
    settings: {
      ...project.settings,
      audioUrl:
        project.settings.audioUrl.startsWith('blob:') || project.settings.audioUrl.startsWith('sonceibe-local://')
          ? ''
          : project.settings.audioUrl,
    },
  };

  const payload: DownloadableProjectFile = {
    format: 'sonceibe-studio',
    version: 1,
    exportedAt: new Date().toISOString(),
    project: projectCopy,
    audioDataUrl,
  };

  const blob = new Blob([JSON.stringify(payload)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(project.settings.title)}.scs`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readPortableProjectFile(file: File): Promise<ImportedPortableProject> {
  if (file.size > 256 * 1024 * 1024) throw new Error('El proyecto supera el límite de 256 MB. No se ha importado.');
  let payload: DownloadableProjectFile;
  try {
    payload = JSON.parse(await file.text()) as DownloadableProjectFile;
  } catch {
    throw new Error('El archivo no es un proyecto SonCeibe Studio válido');
  }

  if (payload?.format !== 'sonceibe-studio' || payload.version !== 1 || !payload.project?.settings) {
    throw new Error('El archivo no es un proyecto SonCeibe Studio compatible');
  }
  const project = validateProject(payload.project);
  if (payload.audioDataUrl !== null && payload.audioDataUrl !== undefined &&
      (typeof payload.audioDataUrl !== 'string' || !/^data:(audio\/[a-z0-9.+-]+|application\/octet-stream);base64,[a-z0-9+/=\r\n]+$/i.test(payload.audioDataUrl))) {
    throw new Error('El audio incrustado no es válido. No se ha importado el proyecto.');
  }

  let audioFile: File | null = null;
  if (payload.audioDataUrl?.startsWith('data:')) {
    try {
      const response = await fetch(payload.audioDataUrl);
      const blob = await response.blob();
      audioFile = new File(
        [blob],
        payload.project.settings.audioName || 'audio.mp3',
        { type: blob.type || 'audio/mpeg', lastModified: Date.now() }
      );
    } catch {
      throw new Error('El proyecto se ha leído, pero el audio incrustado está dañado');
    }
  }

  return { project, audioFile };
}
