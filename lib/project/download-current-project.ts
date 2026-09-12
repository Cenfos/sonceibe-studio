import type { Project } from '@/lib/types';

interface DownloadableProjectFile {
  format: 'sonceibe-studio';
  version: 1;
  exportedAt: string;
  project: Project;
  audioDataUrl: string | null;
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

async function getAudioDataUrl(audioSrc?: string): Promise<string | null> {
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

export async function downloadCurrentProject(project: Project, audioSrc?: string): Promise<void> {
  const audioDataUrl = await getAudioDataUrl(audioSrc);

  // Object URLs only work in the current browser session, so never save one as
  // the project's persistent audio URL. The audio itself is embedded separately.
  const projectCopy: Project = {
    ...project,
    settings: {
      ...project.settings,
      audioUrl: project.settings.audioUrl.startsWith('blob:') ? '' : project.settings.audioUrl,
    },
  };

  const payload: DownloadableProjectFile = {
    format: 'sonceibe-studio',
    version: 1,
    exportedAt: new Date().toISOString(),
    project: projectCopy,
    audioDataUrl,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(project.settings.title)}.scs`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
