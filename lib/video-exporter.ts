'use client';

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
  duration: number;
  settings: ProjectSettings;
  target: VideoTarget;
  includeAudio?: boolean;
  videoBitrate?: number;
  audioBitrate?: number;
  internalWidth?: number;
  internalHeight?: number;
  onProgress?: (progress: number) => void;
}

export interface Mp4ExportResult {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
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

function readVideoDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };

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
  onProgress?: (progress: number) => void
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
  if (!conversion.isValid) {
    throw new Error('No se pudo finalizar el MP4 en un formato compatible');
  }

  conversion.onProgress = (progress) => {
    onProgress?.(95 + Math.round(progress * 5));
  };

  await conversion.execute();
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

  await Promise.all(Array.from(sources).map(preloadBackgroundImage));
  await preloadVisualBranding(settings.visualStyle, settings.showSonCeibeBranding);
}

export async function createProjectMp4(options: Mp4ExportOptions): Promise<Mp4ExportResult> {
  const {
    audioEl,
    duration,
    settings,
    target,
    includeAudio = true,
    onProgress,
  } = options;

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('La canción no tiene una duración válida');
  }

  const mimeType = supportedMp4MimeType();
  if (!mimeType) {
    throw new Error('Este navegador no puede crear MP4 H.264 directamente');
  }

  const captureAudio = audioEl.captureStream ?? audioEl.mozCaptureStream;
  if (includeAudio && !captureAudio) {
    throw new Error('Este navegador no permite capturar el audio para el MP4');
  }

  const profile = VIDEO_PROFILES[target];
  const renderSettings = settingsForVideoTarget(settings, target);
  const renderWidth = options.internalWidth ?? profile.width;
  const renderHeight = options.internalHeight ?? profile.height;
  const videoBitrate = options.videoBitrate ?? profile.videoBitrate;
  const audioBitrate = options.audioBitrate ?? profile.audioBitrate;

  await preloadProjectVisuals(renderSettings);

  const previousTime = audioEl.currentTime;
  const wasPlaying = !audioEl.paused;

  let timer: ReturnType<typeof setInterval> | null = null;
  let recorder: MediaRecorder | null = null;
  let outputStream: MediaStream | null = null;
  let outputCanvas: HTMLCanvasElement | null = null;
  let videoTrack: CanvasCaptureTrack | null = null;
  let endedHandler: (() => void) | null = null;
  let renderFailures = 0;

  try {
    audioEl.pause();
    audioEl.currentTime = 0;

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
        renderFrame(renderCtx, renderWidth, renderHeight, renderSettings, time);
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

    if (includeAudio && captureAudio) {
      const capturedAudio = captureAudio.call(audioEl);
      const tracks = capturedAudio.getAudioTracks();
      if (!tracks.length) throw new Error('No se pudo capturar la música');
      tracks.forEach((track) => outputStream?.addTrack(track));
    }

    const chunks: BlobPart[] = [];
    const activeRecorder = new MediaRecorder(outputStream, {
      mimeType,
      videoBitsPerSecond: videoBitrate,
      ...(includeAudio ? { audioBitsPerSecond: audioBitrate } : {}),
    });
    recorder = activeRecorder;

    const finished = new Promise<Blob>((resolve, reject) => {
      activeRecorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      activeRecorder.onerror = () => reject(new Error('Error durante la creación del MP4'));
      activeRecorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    const frameInterval = 1 / profile.fps;
    let lastRendered = -frameInterval;
    let lastProgress = -1;

    const renderTick = () => {
      if (!videoTrack || videoTrack.readyState === 'ended') return;

      const rawTime = Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
      const time = Math.min(duration, Math.max(0, rawTime));

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

    audioEl.addEventListener('ended', endedHandler, { once: true });
    activeRecorder.start(1000);
    timer = setInterval(renderTick, Math.max(10, Math.round(1000 / profile.fps)));
    renderTick();
    await audioEl.play();

    const recordedBlob = await finished;
    if (!recordedBlob.size) throw new Error('El MP4 generado está vacío');

    const blob = await makeStandardSeekableMp4(recordedBlob, onProgress);
    const dimensions = await readVideoDimensions(blob);
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
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    outputStream?.getVideoTracks().forEach((track) => track.stop());
    outputCanvas?.remove();

    audioEl.pause();
    audioEl.currentTime = Math.min(previousTime, duration);
    if (wasPlaying) audioEl.play().catch(() => {});
  }
}
