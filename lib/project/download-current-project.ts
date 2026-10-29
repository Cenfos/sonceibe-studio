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

export async function createPortableProjectBlob(
  project: Project,
  audioSrc?: string,
  audioBlob?: Blob | null
): Promise<Blob> {
  const audioDataUrl = await getAudioDataUrl(audioSrc ?? project.settings.audioUrl, audioBlob);
  if ((project.settings.audioName || project.settings.audioUrl) && !audioDataUrl) {
    throw new Error('No se pudo incluir el audio. Vuelve a cargarlo antes de descargar una copia del proyecto.');
  }

  const resources = new Map<string, Promise<string>>();
  const embedImage = (url: string): Promise<string> => {
    if (!url || url.startsWith('data:image/')) return Promise.resolve(url);
    if (!resources.has(url)) resources.set(url, (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('No se pudo incluir una foto en el proyecto. Vuelve a cargarla antes de guardar la copia.');
      const image = await response.blob();
      if (!image.type.startsWith('image/')) throw new Error('Uno de los recursos del proyecto no es una imagen válida');
      return blobToDataUrl(image);
    })());
    return resources.get(url)!;
  };
  const background = project.settings.background;
  const [imageUrl, images, imageClips, photoClips, coverUrl] = await Promise.all([
    embedImage(background.imageUrl), Promise.all(background.images.map(embedImage)),
    Promise.all(background.imageClips.map(async clip => ({ ...clip, url: await embedImage(clip.url) }))),
    Promise.all((background.photoClips ?? []).map(async clip => ({ ...clip, url: await embedImage(clip.url) }))),
    embedImage(project.settings.reel?.coverUrl ?? ''),
  ]);
  const projectCopy: Project = {
    ...project,
    settings: {
      ...project.settings,
      background: { ...background, imageUrl, images, imageClips, photoClips },
      ...(project.settings.reel ? { reel: { ...project.settings.reel, coverUrl } } : {}),
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

  return new Blob([JSON.stringify(payload)], {
    type: 'application/json;charset=utf-8',
  });
}

function downloadProjectBlob(project: Project, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(project.settings.title)}.scs`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadCurrentProject(project: Project, audioSrc?: string, audioBlob?: Blob | null): Promise<void> {
  downloadProjectBlob(project, await createPortableProjectBlob(project, audioSrc, audioBlob));
}

interface SaveHandle {
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>;
}

/** Open the picker immediately, while the click still carries user activation. */
export async function saveProjectToDevice(project: Project, loadAudio: () => Promise<Blob | null>): Promise<'file' | 'download'> {
  const picker = (window as Window & { showSaveFilePicker?: (options: unknown) => Promise<SaveHandle> }).showSaveFilePicker;
  let handle: SaveHandle | null = null;
  if (picker) {
    try { handle = await picker.call(window, {
      suggestedName: `${safeFileName(project.settings.title)}.scs`,
      types: [{ description: 'Proyecto SonCeibe Studio', accept: { 'application/json': ['.scs'] } }],
    }); }
    catch (error) { if (!(error instanceof DOMException && ['SecurityError', 'NotSupportedError'].includes(error.name))) throw error; }
  }
  const blob = await createPortableProjectBlob(project, undefined, await loadAudio());
  if (!handle) { downloadProjectBlob(project, blob); return 'download'; }
  const writable = await handle.createWritable();
  try { await writable.write(blob); await writable.close(); }
  catch (error) { await writable.abort?.().catch(() => {}); throw error; }
  return 'file';
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
