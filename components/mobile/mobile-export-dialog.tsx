'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Film, FolderOpen, Loader2, RefreshCw, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { useStudioUserId } from '@/lib/studio-user-context';
import { getProjectVideo, saveProjectVideo } from '@/lib/local-media-storage';
import { preloadBackgroundImage, renderFrame } from '@/components/studio/preview/canvas-renderer';
import { preloadVisualBranding } from '@/lib/visual-branding';
import { toast } from 'sonner';

// The final MP4 remains real Full HD 9:16 so WhatsApp/Instagram display it
// full-screen. The scene itself is rendered on a lighter 720x1280 canvas and
// then scaled into the 1080x1920 capture canvas. This greatly reduces the work
// done for every lyric frame on mobile without changing the MP4 dimensions.
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const RENDER_WIDTH = 720;
const RENDER_HEIGHT = 1280;
const FPS = 30;
const AUDIO_BITRATE = 96_000;
const TARGET_SIZE_BYTES = 34_000_000;
const MIN_VIDEO_BITRATE = 650_000;
const MAX_VIDEO_BITRATE = 1_800_000;

type CapturableAudioElement = HTMLAudioElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

function safeFilename(value: string): string {
  return (value || 'sonceibe-video')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'sonceibe-video';
}

function getMp4MimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;

  const candidates = [
    'video/mp4;codecs=avc1.42E028,mp4a.40.2',
    'video/mp4;codecs=avc1.4D4028,mp4a.40.2',
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=avc1.42E028',
    'video/mp4',
  ];

  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // Continue with the next candidate.
    }
  }
  return null;
}

function formatMb(bytes: number): string {
  const mb = bytes / 1_000_000;
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function mobileVideoBitrate(duration: number): number {
  if (duration <= 0) return 1_100_000;
  const desiredTotalBitrate = (TARGET_SIZE_BYTES * 8) / (duration * 1.03);
  const desiredVideoBitrate = desiredTotalBitrate - AUDIO_BITRATE;
  return Math.round(Math.min(MAX_VIDEO_BITRATE, Math.max(MIN_VIDEO_BITRATE, desiredVideoBitrate)));
}

function estimatedSizeBytes(duration: number, videoBitrate: number): number {
  if (duration <= 0) return 0;
  return duration * (videoBitrate + AUDIO_BITRATE) / 8 * 1.03;
}

function isNineSixteen(width: number, height: number): boolean {
  if (width <= 0 || height <= 0 || height <= width) return false;
  return Math.abs(width / height - 9 / 16) <= 0.025;
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
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanup();
      resolve({ width, height });
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('No se pudo comprobar el formato final del MP4'));
    };
    video.src = url;
  });
}

export function MobileExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentProject, markSaved } = useStore();
  const audio = useAudioEngineContext();
  const userId = useStudioUserId();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState('');
  const [loadingSaved, setLoadingSaved] = useState(false);
  const existingVideoInputRef = useRef<HTMLInputElement>(null);

  const duration = audio.duration || currentProject?.settings.audioDuration || 0;
  const videoBitrate = useMemo(() => mobileVideoBitrate(duration), [duration]);
  const estimatedSize = useMemo(
    () => estimatedSizeBytes(duration, videoBitrate),
    [duration, videoBitrate]
  );

  useEffect(() => {
    if (!open || !currentProject) {
      setProgress(0);
      setBlob(null);
      setFilename('');
      setLoadingSaved(false);
      return;
    }

    let cancelled = false;
    setLoadingSaved(true);
    getProjectVideo(userId, currentProject.id)
      .then((stored) => {
        if (cancelled || !stored) return;
        setBlob(stored.file);
        setFilename(stored.file.name);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, currentProject?.id, userId]);

  if (!open || !currentProject) return null;

  const attachExistingVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const isMp4 = file.name.toLowerCase().endsWith('.mp4') || file.type === 'video/mp4';
    if (!isMp4) {
      toast.error('Selecciona el MP4 de este proyecto');
      return;
    }

    try {
      await saveProjectVideo(userId, currentProject.id, file, currentProject.settings.updatedAt);
      setBlob(file);
      setFilename(file.name);
      toast.success('MP4 asociado al proyecto. Ya puedes compartirlo o descargarlo sin volver a crearlo.');
    } catch (error) {
      console.error('Failed to attach existing mobile video:', error);
      toast.error('No se pudo guardar este MP4 dentro del proyecto');
    }
  };

  const exportVideo = async () => {
    if (exporting) return;

    const audioEl = audio.audioEl as CapturableAudioElement | null;
    const mimeType = getMp4MimeType();
    if (!audioEl || duration <= 0) {
      toast.error('Añade primero una canción');
      return;
    }
    if (!mimeType) {
      toast.error('Este navegador no puede crear MP4 directamente. Prueba con Chrome actualizado.');
      return;
    }

    const captureAudio = audioEl.captureStream ?? audioEl.mozCaptureStream;
    if (!captureAudio) {
      toast.error('Este navegador no permite capturar el audio para el MP4');
      return;
    }

    setExporting(true);
    setProgress(0);
    setBlob(null);
    setFilename('');

    const previousTime = audioEl.currentTime;
    const wasPlaying = !audioEl.paused;
    let recorder: MediaRecorder | null = null;
    let frameId = 0;
    let outputStream: MediaStream | null = null;
    let renderErrors = 0;

    try {
      audioEl.pause();
      audioEl.currentTime = 0;

      const settings = {
        ...currentProject.settings,
        background: {
          ...currentProject.settings.background,
          imageFit: 'cover' as const,
        },
        exportConfig: {
          ...currentProject.settings.exportConfig,
          orientation: 'portrait' as const,
          resolution: '1080p' as const,
          fps: 30 as const,
          includeAudio: true,
        },
      };

      const sources = new Set<string>();
      const bg = settings.background;
      if (bg.imageUrl) sources.add(bg.imageUrl);
      for (const src of bg.images ?? []) if (src) sources.add(src);
      for (const clip of bg.imageClips ?? []) if (clip.url) sources.add(clip.url);
      await Promise.all(Array.from(sources).map((src) => preloadBackgroundImage(src)));
      await preloadVisualBranding(settings.visualStyle);

      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = RENDER_WIDTH;
      renderCanvas.height = RENDER_HEIGHT;
      const renderCtx = renderCanvas.getContext('2d', { alpha: false });
      if (!renderCtx) throw new Error('No se pudo preparar el renderizado del vídeo');

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = OUTPUT_WIDTH;
      outputCanvas.height = OUTPUT_HEIGHT;
      const outputCtx = outputCanvas.getContext('2d', { alpha: false });
      if (!outputCtx) throw new Error('No se pudo preparar el vídeo');
      outputCtx.imageSmoothingEnabled = true;
      outputCtx.imageSmoothingQuality = 'high';

      const renderMobileFrame = (time: number): boolean => {
        try {
          renderFrame(renderCtx, RENDER_WIDTH, RENDER_HEIGHT, settings, time);
          outputCtx.setTransform(1, 0, 0, 1, 0, 0);
          outputCtx.globalAlpha = 1;
          outputCtx.filter = 'none';
          outputCtx.drawImage(renderCanvas, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
          return true;
        } catch (error) {
          renderErrors += 1;
          if (renderErrors <= 3) console.error('Mobile frame render failed:', error);
          return false;
        }
      };

      if (!renderMobileFrame(0)) throw new Error('No se pudo crear el primer fotograma del vídeo');
      outputStream = outputCanvas.captureStream(FPS);

      const videoTrack = outputStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('No se pudo crear la pista de vídeo');
      videoTrack.contentHint = 'detail';

      const trackSettings = videoTrack.getSettings?.();
      const trackWidth = Number(trackSettings?.width || OUTPUT_WIDTH);
      const trackHeight = Number(trackSettings?.height || OUTPUT_HEIGHT);
      if (!isNineSixteen(trackWidth, trackHeight)) {
        throw new Error(`El navegador no ha creado una pista vertical 9:16 (${trackWidth}×${trackHeight})`);
      }

      const capturedAudioStream = captureAudio.call(audioEl);
      const audioTracks = capturedAudioStream.getAudioTracks();
      if (audioTracks.length === 0) throw new Error('No se pudo capturar la música');
      audioTracks.forEach((track) => outputStream?.addTrack(track));

      const chunks: BlobPart[] = [];
      recorder = new MediaRecorder(outputStream, {
        mimeType,
        videoBitsPerSecond: videoBitrate,
        audioBitsPerSecond: AUDIO_BITRATE,
      });

      const finished = new Promise<Blob>((resolve, reject) => {
        if (!recorder) return reject(new Error('No se pudo iniciar la exportación'));
        recorder.ondataavailable = (event) => {
          if (event.data?.size) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error('Error durante la creación del MP4'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      const frameInterval = 1 / FPS;
      let lastRendered = -frameInterval;
      let lastProgress = -1;
      const renderLoop = () => {
        // Schedule the next iteration before drawing. If a particular frame
        // ever throws, the visual track cannot become permanently frozen while
        // the audio continues playing.
        frameId = requestAnimationFrame(renderLoop);

        try {
          const rawTime = Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
          const t = Math.min(duration, Math.max(0, rawTime));
          if (t - lastRendered >= frameInterval * 0.9 || t >= duration) {
            if (renderMobileFrame(t)) lastRendered = t;
          }
          const nextProgress = Math.min(99, Math.round((t / duration) * 100));
          if (nextProgress !== lastProgress) {
            lastProgress = nextProgress;
            setProgress(nextProgress);
          }
        } catch (error) {
          renderErrors += 1;
          if (renderErrors <= 3) console.error('Mobile render loop failed:', error);
        }
      };

      const onEnded = () => {
        cancelAnimationFrame(frameId);
        renderMobileFrame(duration);
        setProgress(100);
        if (recorder?.state !== 'inactive') recorder?.stop();
      };

      audioEl.addEventListener('ended', onEnded, { once: true });
      recorder.start(1000);
      frameId = requestAnimationFrame(renderLoop);
      await audioEl.play();

      const result = await finished;
      if (result.size === 0) throw new Error('El vídeo generado está vacío');

      const dimensions = await readVideoDimensions(result);
      if (!isNineSixteen(dimensions.width, dimensions.height)) {
        throw new Error(
          `El MP4 final no quedó en 9:16 (${dimensions.width}×${dimensions.height}). No se ha guardado para evitar un vídeo con bordes negros.`
        );
      }

      const nextFilename = `${safeFilename(currentProject.settings.title)}-movil-9x16.mp4`;
      const resultFile = new File([result], nextFilename, { type: result.type || mimeType });
      setBlob(resultFile);
      setFilename(nextFilename);
      await saveProjectVideo(userId, currentProject.id, resultFile, currentProject.settings.updatedAt);
      markSaved();
      toast.success(
        `MP4 9:16 comprobado · ${dimensions.width}×${dimensions.height} · ${formatMb(result.size)}`
      );
    } catch (error) {
      console.error('Mobile video export failed:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el MP4');
    } finally {
      cancelAnimationFrame(frameId);
      if (recorder?.state !== 'inactive') recorder?.stop();
      outputStream?.getVideoTracks().forEach((track) => track.stop());
      audioEl.pause();
      audioEl.currentTime = Math.min(previousTime, duration);
      if (wasPlaying) audioEl.play().catch(() => {});
      setExporting(false);
    }
  };

  const shareVideo = async () => {
    if (!blob || !filename) return;
    const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
    if (navigator.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      try {
        await navigator.share({ files: [file], title: currentProject.settings.title });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    downloadBlob(filename, blob);
    toast.info('Vídeo guardado. Ya puedes compartirlo desde Descargas.');
  };

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-background/95 p-4 backdrop-blur">
      <div className="mx-auto flex min-h-full max-w-md items-center justify-center py-4">
        <Card className="w-full p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Vídeo MP4 del proyecto</h2>
              <p className="mt-1 text-xs text-muted-foreground">Vertical real 9:16 · 1080×1920 · pantalla completa · 30 FPS</p>
            </div>
            {!exporting && (
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {loadingSaved ? (
            <div className="space-y-3 py-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Buscando el último MP4 guardado…</p>
            </div>
          ) : blob ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
                <Check className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <div className="font-medium">MP4 guardado en este proyecto</div>
                <div className="mt-1 text-sm text-muted-foreground">{formatMb(blob.size)}</div>
              </div>
              <Button className="w-full h-12 gap-2" onClick={shareVideo}>
                <Share2 className="h-5 w-5" />
                Compartir vídeo
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => downloadBlob(filename, blob)}>
                <Download className="h-4 w-4" />
                Descargar MP4 otra vez
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={exportVideo}>
                <RefreshCw className="h-4 w-4" />
                Volver a crear MP4 en 9:16
              </Button>
              <Button variant="ghost" className="w-full" onClick={onClose}>Cerrar</Button>
            </div>
          ) : exporting ? (
            <div className="space-y-4 py-6">
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-primary" />
              <div className="text-center text-sm">Creando vídeo 9:16… {progress}%</div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-center text-xs text-muted-foreground">Deja SonCeibe Studio abierto hasta que termine la canción. Al acabar se comprobará el formato 9:16 del archivo.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/40 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Formato</span><span>1080×1920 · 9:16</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Duración</span><span>{Math.round(duration)} s</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Tamaño estimado</span><span>~{estimatedSize ? formatMb(estimatedSize) : '—'}</span></div>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                El archivo final sigue siendo Full HD 9:16, pero Studio renderiza internamente de forma optimizada para evitar que la imagen o la letra se congelen durante la exportación en móvil.
              </p>
              <Button className="w-full h-12 gap-2" onClick={exportVideo}>
                <Film className="h-5 w-5" />
                Crear MP4 9:16
              </Button>
              <input
                ref={existingVideoInputRef}
                type="file"
                accept="video/mp4,.mp4"
                className="hidden"
                onChange={attachExistingVideo}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => existingVideoInputRef.current?.click()}
              >
                <FolderOpen className="h-4 w-4" />
                Usar MP4 ya creado
              </Button>
              <p className="text-[11px] leading-4 text-muted-foreground">
                Úsalo para asociar una exportación antigua que ya tengas en Descargas. Solo tendrás que seleccionarla una vez.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
