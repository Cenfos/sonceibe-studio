import { reelLyricsIssue, reelSettings, sliceAudioWav } from './reel';
import { createProjectMp4 } from './video-exporter';
import type { ProjectSettings } from './types';

/** Export the saved Reel using the same cut and design from every entry point. */
export async function createReelMp4({ settings, audioBuffer, signal, onProgress }: {
  settings: ProjectSettings;
  audioBuffer: AudioBuffer;
  signal: AbortSignal;
  onProgress?: (progress: number) => void;
}) {
  const reel = settings.reel;
  if (!reel) throw new Error('Selecciona primero un fragmento para el Reel.');
  const issue = reelLyricsIssue(reel);
  if (issue) throw new Error(issue);
  signal.throwIfAborted();
  const wav = sliceAudioWav(audioBuffer, reel.start, reel.end);
  const url = URL.createObjectURL(wav);
  const clip = new Audio();
  clip.preload = 'auto';
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error('No se pudo cargar el fragmento de audio.')); }, 15000);
      const abort = () => { cleanup(); reject(new DOMException('Creación cancelada', 'AbortError')); };
      const cleanup = () => { clearTimeout(timeout); clip.oncanplay = null; clip.onerror = null; signal.removeEventListener('abort', abort); };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) { abort(); return; }
      clip.oncanplay = () => { cleanup(); resolve(); };
      clip.onerror = () => { cleanup(); reject(new Error('No se pudo leer el fragmento de audio.')); };
      clip.src = url;
      clip.load();
    });
    const trimmed = reelSettings({ ...settings, audioDuration: audioBuffer.duration }, reel.start, reel.end, reel.coverUrl, reel.showLyrics, reel.showTitle);
    return await createProjectMp4({ audioEl: clip, duration: reel.end - reel.start, settings: trimmed, target: 'mobile', onProgress, signal });
  } finally {
    clip.pause();
    clip.removeAttribute('src');
    clip.load();
    URL.revokeObjectURL(url);
  }
}
