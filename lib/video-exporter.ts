'use client';

import { openSourceVideo, releaseVideo, seekSourceVideo, sourceVideoUrls } from './source-video';
import type { ProjectSettings } from './types';
import {
  VIDEO_PROFILES,
  matchesVideoProfile,
  settingsForVideoTarget,
  type VideoTarget,
} from './video-profiles';
import { preloadBackgroundImage, renderFrame } from '@/components/studio/preview/canvas-renderer';
import { preloadVisualBranding } from './visual-branding';
import {
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
} from 'mediabunny';

export type CapturableAudioElement = HTMLAudioElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

type CanvasCaptureTrack = MediaStreamTrack & {
  requestFrame?: () => void;
};

export interface Mp4ExportOptions {
  audioEl: CapturableAudioElement;
  audioBuffer?: AudioBuffer | null;
  backgroundVideoUrl?: string;
  duration: number;
  settings: ProjectSettings;
  target: VideoTarget;
  includeAudio?: boolean;
  videoBitrate?: number;
  audioBitrate?: number;
  internalWidth?: number;
  internalHeight?: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export interface Mp4ExportResult {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
}

function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Creación cancelada', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}

function supportedMp4MimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;

  const candidates = [
    'video/mp4;codecs=avc1.42E02A,mp4a.40.2',
    'video/mp4;codecs=avc1.4D402A,mp4a.40.2',
    'video/mp4;codecs=avc1.64002A,mp4a.40.2',
    'video/mp4;codecs=avc1.42E028,mp4a.40.2',
    'video/mp4;codecs=avc1.42E02A',
    'video/mp4',
  ];

  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // Try the next codec declaration.
    }
  }
  return null;
}

function readVideoDimensions(blob: Blob, signal?: AbortSignal): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      signal?.removeEventListener('abort', abort);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
    const abort = () => { cleanup(); reject(new DOMException('Creación cancelada', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }

    video.onloadedmetadata = () => {
      const dimensions = { width: video.videoWidth, height: video.videoHeight };
      cleanup();
      resolve(dimensions);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('No se pudo comprobar la resolución del MP4 final'));
    };
    video.src = url;
  });
}

async function makeStandardSeekableMp4(
  blob: Blob,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  // MediaRecorder writes fragmented MP4 (moof/mdat fragments). That is valid
  // for streaming but Windows Media Player and some social apps handle it
  // poorly: seeking can stay at 0 and uploads may be interpreted strangely.
  // Remux the exact H.264/AAC packets into a conventional indexed MP4. This
  // does not re-encode the picture or audio, so there is no quality loss.
  const input = new Input({
    formats: [MP4],
    source: new BlobSource(blob),
  });
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  });

  const conversion = await Conversion.init({ input, output });
  if (signal?.aborted) { await conversion.cancel(); input.dispose(); signal.throwIfAborted(); }
  if (!conversion.isValid) {
    throw new Error('No se pudo finalizar el MP4 en un formato compatible');
  }

  conversion.onProgress = (progress) => {
    onProgress?.(95 + Math.round(progress * 5));
  };

  const cancel = () => { void conversion.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await abortable(conversion.execute(), signal);
  } finally {
    signal?.removeEventListener('abort', cancel);
    input.dispose();
  }
  const buffer = target.buffer;
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('La finalización del MP4 produjo un archivo vacío');
  }

  return new Blob([buffer], { type: 'video/mp4' });
}

async function preloadProjectVisuals(settings: ProjectSettings): Promise<void> {
  const sources = new Set<string>();
  const bg = settings.background;

  if (bg.imageUrl) sources.add(bg.imageUrl);
  for (const src of bg.images ?? []) if (src) sources.add(src);
  for (const clip of bg.imageClips ?? []) if (clip.url) sources.add(clip.url);

  for (const clip of bg.photoClips ?? []) if (clip.url) sources.add(clip.url);
  await Promise.all(Array.from(sources).map(preloadBackgroundImage));
  await preloadVisualBranding(settings.visualStyle, settings.showSonCeibeBranding);
}

export async function createProjectMp4(options: Mp4ExportOptions): Promise<Mp4ExportResult> {
  options.signal?.throwIfAborted();
  const {
    audioEl,
    duration,
    settings,
    target,
    includeAudio = true,
    onProgress,
    signal,
  } = options;

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('La canción no tiene una duración válida');
  }

  const mimeType = supportedMp4MimeType();
  if (!mimeType) {
    throw new Error('Este navegador no puede crear MP4 H.264 directamente');
  }

  const captureAudio = audioEl.captureStream ?? audioEl.mozCaptureStream;

  const profile = VIDEO_PROFILES[target];
  const renderSettings = settingsForVideoTarget(settings, target);
  const renderWidth = options.internalWidth ?? profile.width;
  const renderHeight = options.internalHeight ?? profile.height;
  const videoBitrate = options.videoBitrate ?? profile.videoBitrate;
  const audioBitrate = options.audioBitrate ?? profile.audioBitrate;


  const previousTime = audioEl.currentTime;
  const wasPlaying = !audioEl.paused;

  let timer: ReturnType<typeof setInterval> | null = null;
  let recorder: MediaRecorder | null = null;
  let outputStream: MediaStream | null = null;
  let outputCanvas: HTMLCanvasElement | null = null;
  let videoTrack: CanvasCaptureTrack | null = null;
  let endedHandler: (() => void) | null = null;
  let renderFailures = 0;
  let backgroundVideo: HTMLVideoElement | null = null;
  let exportAudioContext: AudioContext | null = null;
  let exportAudioSource: AudioBufferSourceNode | null = null;
  let playbackErrorHandler: (() => void) | null = null;

  try {
    // Unlock Web Audio during the original click, before loading images or footage.
    if (includeAudio && !captureAudio) {
      exportAudioContext = new AudioContext();
      await abortable(exportAudioContext.resume(), signal);
    }
    await abortable(preloadProjectVisuals(renderSettings), signal);
    audioEl.pause();
    audioEl.currentTime = 0;

    if (renderSettings.background.type === 'video') {
      const url = options.backgroundVideoUrl || sourceVideoUrls.get(renderSettings.background.videoUrl);
      if (!url) throw new Error('El vídeo de fondo no está preparado. Vuelve a cargarlo antes de exportar.');
      backgroundVideo = await abortable(openSourceVideo(url), signal);
      await abortable(seekSourceVideo(backgroundVideo, renderSettings.background.videoStart || 0), signal);
    }

    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = renderWidth;
    renderCanvas.height = renderHeight;
    const renderCtx = renderCanvas.getContext('2d', { alpha: false });
    if (!renderCtx) throw new Error('No se pudo preparar el lienzo de renderizado');

    outputCanvas = document.createElement('canvas');
    outputCanvas.width = profile.width;
    outputCanvas.height = profile.height;
    outputCanvas.style.position = 'fixed';
    outputCanvas.style.left = '-10000px';
    outputCanvas.style.top = '0';
    outputCanvas.style.width = '1px';
    outputCanvas.style.height = '1px';
    outputCanvas.style.pointerEvents = 'none';
    document.body.appendChild(outputCanvas);

    const outputCtx = outputCanvas.getContext('2d', { alpha: false });
    if (!outputCtx) throw new Error('No se pudo preparar el lienzo final del vídeo');
    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = 'high';

    const drawFrame = (time: number): boolean => {
      try {
        renderFrame(renderCtx, renderWidth, renderHeight, renderSettings, time, backgroundVideo);
        outputCtx.setTransform(1, 0, 0, 1, 0, 0);
        outputCtx.globalAlpha = 1;
        outputCtx.filter = 'none';
        outputCtx.drawImage(renderCanvas, 0, 0, profile.width, profile.height);
        videoTrack?.requestFrame?.();
        return true;
      } catch (error) {
        renderFailures += 1;
        if (renderFailures <= 3) console.error('MP4 frame render failed:', error);
        return false;
      }
    };

    if (!drawFrame(0)) {
      throw new Error('No se pudo crear el primer fotograma del vídeo');
    }

    outputStream = outputCanvas.captureStream(profile.fps);
    const capturedTrack = outputStream.getVideoTracks()[0] as CanvasCaptureTrack | undefined;
    if (!capturedTrack) throw new Error('No se pudo crear la pista de vídeo');
    videoTrack = capturedTrack;
    videoTrack.contentHint = 'detail';
    videoTrack.requestFrame?.();

    const trackSettings = videoTrack.getSettings?.();
    const trackWidth = Number(trackSettings?.width || profile.width);
    const trackHeight = Number(trackSettings?.height || profile.height);
    if (
      trackWidth > 0 &&
      trackHeight > 0 &&
      !matchesVideoProfile(trackWidth, trackHeight, target)
    ) {
      throw new Error(
        `El navegador preparó una pista de ${trackWidth}×${trackHeight}; debía ser ${profile.width}×${profile.height}`
      );
    }

    if (includeAudio) {
      let tracks: MediaStreamTrack[] = [];
      if (captureAudio) {
        try { tracks = captureAudio.call(audioEl).getAudioTracks(); } catch { /* Use Web Audio below. */ }
      }
      if (!tracks.length) {
        exportAudioContext ??= new AudioContext();
        await abortable(exportAudioContext.resume(), signal);
        let buffer = options.audioBuffer;
        if (!buffer) {
          const response = await abortable(fetch(audioEl.currentSrc || audioEl.src, { signal }), signal);
          if (!response.ok) throw new Error('No se pudo leer el sonido del fragmento');
          buffer = await abortable(exportAudioContext.decodeAudioData(await response.arrayBuffer()), signal);
        }
        const destination = exportAudioContext.createMediaStreamDestination();
        exportAudioSource = exportAudioContext.createBufferSource(); exportAudioSource.buffer = buffer;
        exportAudioSource.connect(destination); tracks = destination.stream.getAudioTracks();
      }
      if (!tracks.length) throw new Error('No se pudo preparar el sonido del MP4');
      tracks.forEach(track => outputStream?.addTrack(track));
    }

    const chunks: BlobPart[] = [];
    const activeRecorder = new MediaRecorder(outputStream, {
      mimeType,
      videoBitsPerSecond: videoBitrate,
      ...(includeAudio ? { audioBitsPerSecond: audioBitrate } : {}),
    });
    recorder = activeRecorder;

    let rejectRecording: (error: Error) => void = () => {};
    const finished = new Promise<Blob>((resolve, reject) => {
      rejectRecording = reject;
      activeRecorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      activeRecorder.onerror = () => reject(new Error('Error durante la creación del MP4'));
      activeRecorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    const frameInterval = 1 / profile.fps;
    let lastRendered = -frameInterval;
    let lastProgress = -1;
    let lastClockTime = -1, lastAdvance = performance.now();

    const renderTick = () => {
      if (!videoTrack || videoTrack.readyState === 'ended') return;

      const rawTime = Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
      const time = Math.min(duration, Math.max(0, rawTime));
      if (rawTime > lastClockTime + 0.001) { lastClockTime = rawTime; lastAdvance = performance.now(); }
      if (audioEl.ended || rawTime >= duration - 0.5 / profile.fps) { endedHandler?.(); return; }
      if (performance.now() - lastAdvance > 15000) {
        rejectRecording(new Error('La reproducción se ha detenido durante la creación. Mantén Studio en primer plano y vuelve a intentarlo.')); return;
      }
      if (backgroundVideo && !backgroundVideo.seeking) {
        const expected = Math.min(backgroundVideo.duration - 0.001, (renderSettings.background.videoStart || 0) + time);
        if (Math.abs(backgroundVideo.currentTime - expected) > 0.15) backgroundVideo.currentTime = expected;
      }

      if (time - lastRendered >= frameInterval * 0.82 || time >= duration) {
        if (drawFrame(time)) lastRendered = time;
      } else {
        videoTrack.requestFrame?.();
      }

      const progress = Math.min(94, Math.round((time / duration) * 94));
      if (progress !== lastProgress) {
        lastProgress = progress;
        onProgress?.(progress);
      }
    };

    endedHandler = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      drawFrame(duration);
      videoTrack?.requestFrame?.();
      onProgress?.(95);
      if (activeRecorder.state !== 'inactive') activeRecorder.stop();
    };

    playbackErrorHandler = () => rejectRecording(new Error('No se pudo reproducir el sonido del fragmento. Vuelve a cargar el vídeo o la canción.'));
    audioEl.addEventListener('error', playbackErrorHandler, { once: true });
    audioEl.addEventListener('ended', endedHandler, { once: true });
    if (exportAudioSource) exportAudioSource.onended = endedHandler;
    activeRecorder.start(1000);
    timer = setInterval(renderTick, Math.max(10, Math.round(1000 / profile.fps)));
    renderTick();
    const playback = Promise.all([audioEl.play(), ...(backgroundVideo ? [backgroundVideo.play()] : [])]);
    await abortable(Promise.race([playback, finished.then(() => undefined)]), signal);
    if (exportAudioSource && exportAudioContext && activeRecorder.state !== 'inactive') {
      const offset = Math.min(audioEl.currentTime, exportAudioSource.buffer!.duration - 0.001);
      exportAudioSource.start(exportAudioContext.currentTime, offset, Math.min(duration - offset, exportAudioSource.buffer!.duration - offset));
    }

    const recordedBlob = await abortable(finished, signal);
    if (!recordedBlob.size) throw new Error('El MP4 generado está vacío');

    const blob = await makeStandardSeekableMp4(recordedBlob, onProgress, signal);
    const dimensions = await readVideoDimensions(blob, signal);
    if (!matchesVideoProfile(dimensions.width, dimensions.height, target)) {
      throw new Error(
        `El MP4 final quedó en ${dimensions.width}×${dimensions.height}; debía ser exactamente ${profile.width}×${profile.height}. No se ha guardado.`
      );
    }

    if (renderFailures > profile.fps * 2) {
      throw new Error('Se produjeron demasiados fallos de imagen durante el renderizado. No se ha guardado el vídeo.');
    }

    onProgress?.(100);
    return {
      blob,
      width: dimensions.width,
      height: dimensions.height,
      mimeType: 'video/mp4',
    };
  } finally {
    if (timer) clearInterval(timer);
    if (endedHandler) audioEl.removeEventListener('ended', endedHandler);
    if (playbackErrorHandler) audioEl.removeEventListener('error', playbackErrorHandler);
    if (exportAudioSource) { exportAudioSource.onended = null; try { exportAudioSource.stop(); } catch { /* Not started or already ended. */ } exportAudioSource.disconnect(); }
    if (exportAudioContext && exportAudioContext.state !== 'closed') await exportAudioContext.close();
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    outputStream?.getTracks().forEach((track) => track.stop());
    outputCanvas?.remove();
    if (backgroundVideo) releaseVideo(backgroundVideo);

    audioEl.pause();
    audioEl.currentTime = Math.min(previousTime, duration);
    if (wasPlaying && !signal?.aborted) audioEl.play().catch(() => {});
  }
}
