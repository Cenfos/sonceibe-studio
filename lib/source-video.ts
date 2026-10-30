import type { BackgroundConfig } from './types';
import { sliceAudioWav } from './reel';

export const MAX_SOURCE_VIDEO_BYTES = 100 * 1024 * 1024;
export const sourceVideoUrls = new Map<string, string>();
export function videoRange(bg: BackgroundConfig) {
  const total = Number.isFinite(bg.videoDuration) ? Math.max(0, bg.videoDuration!) : 0;
  const start = Math.min(Math.max(0, bg.videoStart || 0), Math.max(0, total - 0.2));
  const end = Math.min(total, Math.max(start + 0.2, bg.videoEnd || total));
  return { start, end, duration: end - start };
}
export function videoFrameRect(width: number, height: number, sourceWidth: number, sourceHeight: number, placement = { scale: 100, x: 50, y: 50, fit: 'cover' as 'cover' | 'contain' }) {
  const scale = Math.max(0.2, Math.min(3, placement.scale / 100));
  const ratio = (placement.fit === 'contain' ? Math.min : Math.max)(width / sourceWidth, height / sourceHeight) * scale;
  const w = sourceWidth * ratio, h = sourceHeight * ratio;
  return { x: (width - w) * Math.max(0, Math.min(1, placement.x / 100)), y: (height - h) * Math.max(0, Math.min(1, placement.y / 100)), width: w, height: h };
}
export async function openSourceVideo(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video'); video.preload = 'auto'; video.muted = true; video.playsInline = true;
  if (/^https?:/.test(url)) video.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('El vídeo tarda demasiado en cargar')); }, 20000);
    const cleanup = () => { clearTimeout(timer); video.onloadeddata = null; video.onerror = null; };
    video.onloadeddata = () => { cleanup(); resolve(); };
    video.onerror = () => { cleanup(); reject(new Error('Este navegador no puede leer el vídeo. Prueba un MP4 H.264 con audio AAC.')); };
    video.src = url;
  });
  // Some WebM recordings omit duration metadata. Let the browser discover the end.
  if (!Number.isFinite(video.duration)) {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); video.removeEventListener('durationchange', check); video.removeEventListener('seeked', check); };
      const check = () => { if (Number.isFinite(video.duration)) { cleanup(); resolve(); } };
      const timer = setTimeout(() => { cleanup(); reject(new Error('No se pudo determinar la duración del vídeo. Conviértelo a MP4.')); }, 10000);
      video.addEventListener('durationchange', check); video.addEventListener('seeked', check); video.currentTime = 1e10;
    });
    await seekSourceVideo(video, 0);
  }
  if (!Number.isFinite(video.duration) || video.duration < 0.2 || !video.videoWidth) { video.removeAttribute('src'); video.load(); throw new Error('El vídeo no tiene una duración o imagen válida'); }
  return video;
}
export function releaseVideo(video: HTMLVideoElement) { video.pause(); video.removeAttribute('src'); video.load(); }
export async function seekSourceVideo(video: HTMLVideoElement, time: number) {
  const target = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.001));
  if (Math.abs(video.currentTime - target) < 0.001 && video.readyState >= 2) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', done); video.removeEventListener('error', failed); };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('No se pudo buscar el fotograma del vídeo')); };
    const timer = setTimeout(failed, 10000);
    video.addEventListener('seeked', done, { once: true }); video.addEventListener('error', failed, { once: true }); video.currentTime = target;
  });
}
/** Decode only the selected part of the original video's soundtrack. No audio track means silence. */
export async function sourceSoundtrack(file: File, start: number, end: number, signal?: AbortSignal): Promise<AudioBuffer | null> {
  const { Input, BlobSource, ALL_FORMATS, AudioBufferSink } = await import('mediabunny');
  signal?.throwIfAborted();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return null;
    if (!await track.canDecode()) throw new Error('No se puede leer el sonido de este vídeo. Silencia el original o conviértelo a MP4 con audio AAC.');
    const sampleRate = 44100;
    const context = new OfflineAudioContext(2, Math.max(1, Math.ceil((end - start) * sampleRate)), sampleRate);
    for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers(start, end)) {
      signal?.throwIfAborted();
      const from = Math.max(start, timestamp), to = Math.min(end, timestamp + buffer.duration);
      if (to <= from) continue;
      const node = context.createBufferSource(); node.buffer = buffer; node.connect(context.destination);
      node.start(from - start, from - timestamp, to - from);
    }
    return await context.startRendering();
  } finally { input.dispose(); }
}
export async function mixVideoAudio(bg: BackgroundConfig, video: File, song: File | null, signal?: AbortSignal): Promise<File> {
  signal?.throwIfAborted();
  const range = videoRange(bg);
  if (range.duration < 0.2 || range.duration > 600) throw new Error('El fragmento de vídeo debe durar entre 0,2 segundos y 10 minutos');
  const rate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(range.duration * rate), rate);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.003; limiter.release.value = 0.1; limiter.connect(ctx.destination);
  const add = (buffer: AudioBuffer, offset: number, volume: number) => {
    if (offset >= buffer.duration || volume <= 0) return;
    const node = ctx.createBufferSource(), gain = ctx.createGain(); node.buffer = buffer; gain.gain.value = volume;
    node.connect(gain).connect(limiter); node.start(0, offset, Math.min(range.duration, buffer.duration - offset));
  };
  if (!bg.videoMuted && (bg.videoVolume ?? 1) > 0) {
    const original = await sourceSoundtrack(video, range.start, range.end, signal);
    if (original) add(original, 0, bg.videoVolume ?? 1);
  }
  if (song && (bg.songVolume ?? 1) > 0) {
    const buffer = await ctx.decodeAudioData(await song.arrayBuffer());
    if ((bg.songOffset || 0) >= buffer.duration) throw new Error('El inicio de la canción está fuera de su duración. Elige un segundo anterior.');
    add(buffer, Math.max(0, bg.songOffset || 0), bg.songVolume ?? 1);
  }
  signal?.throwIfAborted();
  const buffer = await ctx.startRendering();
  signal?.throwIfAborted();
  return new File([sliceAudioWav(buffer, 0, buffer.duration)], 'mezcla-video.wav', { type: 'audio/wav' });
}
