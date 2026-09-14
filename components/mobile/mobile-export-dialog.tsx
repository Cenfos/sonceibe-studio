'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Film, Loader2, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { preloadBackgroundImage, renderFrame } from '@/components/studio/preview/canvas-renderer';
import { drawVisualBranding, preloadVisualBranding } from '@/lib/visual-branding';
import { toast } from 'sonner';

// 720×1280 keeps the same full-screen 9:16 format while allowing a much lower
// bitrate than 1080×1920. WhatsApp/Instagram will recompress it again anyway.
const WIDTH = 720;
const HEIGHT = 1280;
const FPS = 30;
const AUDIO_BITRATE = 96_000;
const TARGET_SIZE_BYTES = 34_000_000;
const MIN_VIDEO_BITRATE = 600_000;
const MAX_VIDEO_BITRATE = 1_400_000;

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
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
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
  if (duration <= 0) return 1_000_000;
  const desiredTotalBitrate = (TARGET_SIZE_BYTES * 8) / (duration * 1.03);
  const desiredVideoBitrate = desiredTotalBitrate - AUDIO_BITRATE;
  return Math.round(Math.min(MAX_VIDEO_BITRATE, Math.max(MIN_VIDEO_BITRATE, desiredVideoBitrate)));
}

function estimatedSizeBytes(duration: number, videoBitrate: number): number {
  if (duration <= 0) return 0;
  return duration * (videoBitrate + AUDIO_BITRATE) / 8 * 1.03;
}

export function MobileExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentProject, markSaved } = useStore();
  const audio = useAudioEngineContext();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState('');

  const duration = audio.duration || currentProject?.settings.audioDuration || 0;
  const videoBitrate = useMemo(() => mobileVideoBitrate(duration), [duration]);
  const estimatedSize = useMemo(
    () => estimatedSizeBytes(duration, videoBitrate),
    [duration, videoBitrate]
  );

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setBlob(null);
      setFilename('');
    }
  }, [open]);

  if (!open || !currentProject) return null;

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
    let capturedAudioStream: MediaStream | null = null;

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
          resolution: '720p' as const,
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

      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo preparar el vídeo');

      const renderMobileFrame = (time: number) => {
        renderFrame(ctx, WIDTH, HEIGHT, settings, time);
        drawVisualBranding(ctx, WIDTH, HEIGHT, settings.visualStyle, time);
      };

      renderMobileFrame(0);
      outputStream = canvas.captureStream(FPS);
      capturedAudioStream = captureAudio.call(audioEl);
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
        const t = Math.min(duration, audioEl.currentTime || 0);
        if (t - lastRendered >= frameInterval * 0.9 || t >= duration) {
          renderMobileFrame(t);
          lastRendered = t;
        }
        const nextProgress = Math.min(99, Math.round((t / duration) * 100));
        if (nextProgress !== lastProgress) {
          lastProgress = nextProgress;
          setProgress(nextProgress);
        }
        frameId = requestAnimationFrame(renderLoop);
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
      const nextFilename = `${safeFilename(currentProject.settings.title)}-movil.mp4`;
      setBlob(result);
      setFilename(nextFilename);
      markSaved();
      toast.success(`MP4 creado · ${formatMb(result.size)}`);
    } catch (error) {
      console.error('Mobile video export failed:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el MP4');
    } finally {
      cancelAnimationFrame(frameId);
      if (recorder?.state !== 'inactive') recorder?.stop();
      outputStream?.getTracks().forEach((track) => track.stop());
      capturedAudioStream?.getTracks().forEach((track) => track.stop());
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
              <h2 className="text-lg font-semibold">Crear MP4 para móvil</h2>
              <p className="mt-1 text-xs text-muted-foreground">Vertical 9:16 · 720×1280 · pantalla completa · 30 FPS</p>
            </div>
            {!exporting && (
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {blob ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
                <Check className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <div className="font-medium">Vídeo terminado</div>
                <div className="mt-1 text-sm text-muted-foreground">{formatMb(blob.size)}</div>
              </div>
              <Button className="w-full h-12 gap-2" onClick={shareVideo}>
                <Share2 className="h-5 w-5" />
                Compartir vídeo
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => downloadBlob(filename, blob)}>
                <Download className="h-4 w-4" />
                Guardar MP4
              </Button>
              <Button variant="ghost" className="w-full" onClick={onClose}>Cerrar</Button>
            </div>
          ) : exporting ? (
            <div className="space-y-4 py-6">
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-primary" />
              <div className="text-center text-sm">Creando vídeo… {progress}%</div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-center text-xs text-muted-foreground">Deja SonCeibe Studio abierto hasta que termine la canción.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/40 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Duración</span><span>{Math.round(duration)} s</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Tamaño estimado</span><span>~{estimatedSize ? formatMb(estimatedSize) : '—'}</span></div>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                El bitrate se adapta a la duración para intentar mantener una canción normal alrededor de 30–40 MB. Sigue siendo 9:16 a pantalla completa y está pensado para WhatsApp e Instagram.
              </p>
              <Button className="w-full h-12 gap-2" onClick={exportVideo}>
                <Film className="h-5 w-5" />
                Crear MP4
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
