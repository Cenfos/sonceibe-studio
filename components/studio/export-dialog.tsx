'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { exportToTxt, exportToLrc, downloadTextFile } from '@/lib/lyrics-utils';
import { preloadBackgroundImage, renderFrame } from './preview/canvas-renderer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Download,
  Film,
  Loader2,
  Check,
  Monitor,
  Smartphone,
  Tv,
  FileText,
} from 'lucide-react';
import type { ExportResolution, ExportFps, VideoOrientation } from '@/lib/types';

const resolutions: { v: ExportResolution; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { v: '720p', label: '720p HD', icon: Smartphone },
  { v: '1080p', label: '1080p Full HD', icon: Monitor },
  { v: '4k', label: '4K Ultra HD', icon: Tv },
];

const fpsOptions: { v: ExportFps; label: string }[] = [
  { v: 30, label: '30 FPS' },
  { v: 60, label: '60 FPS' },
];

function getResolutionDescription(resolution: ExportResolution, orientation: VideoOrientation): string {
  const landscape = {
    '720p': '1280×720',
    '1080p': '1920×1080',
    '4k': '3840×2160',
  } as const;
  const portrait = {
    '720p': '720×1280',
    '1080p': '1080×1920',
    '4k': '2160×3840',
  } as const;

  return orientation === 'portrait' ? portrait[resolution] : landscape[resolution];
}

function getDimensions(resolution: ExportResolution, orientation: VideoOrientation) {
  const landscape = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4k': { width: 3840, height: 2160 },
  } as const;

  const base = landscape[resolution];
  return orientation === 'portrait'
    ? { width: base.height, height: base.width }
    : base;
}

function safeFilename(value: string): string {
  return (value || 'sonceibe-video')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'sonceibe-video';
}

function getSupportedMp4MimeType(): string | null {
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
      // Try the next MIME type.
    }
  }

  return null;
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

type CapturableAudioElement = HTMLAudioElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

export function ExportDialog() {
  const {
    isExportOpen,
    setExportOpen,
    currentProject,
    updateExport,
    markSaved,
  } = useStore();
  const audio = useAudioEngineContext();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [doneFileName, setDoneFileName] = useState('');
  const [exportType, setExportType] = useState<'video' | 'txt' | 'lrc'>('video');

  if (!currentProject) return null;

  const cfg = currentProject.settings.exportConfig;
  const orientation: VideoOrientation = cfg.orientation ?? 'landscape';
  const lyrics = currentProject.settings.lyrics;
  const title = currentProject.settings.title || 'SonCeibe';

  const handleExportTxt = () => {
    const filename = `${safeFilename(title)}.txt`;
    downloadTextFile(filename, exportToTxt(lyrics));
    markSaved();
    toast.success(`Guardado: ${filename}`);
  };

  const handleExportLrc = () => {
    const filename = `${safeFilename(title)}.lrc`;
    const text = exportToLrc(lyrics, title, currentProject.settings.artist);
    downloadTextFile(filename, text, 'application/octet-stream');
    markSaved();
    toast.success(`Guardado: ${filename}`);
  };

  const startVideoExport = async () => {
    if (exporting) return;

    const audioEl = audio.audioEl as CapturableAudioElement | null;
    const duration = audio.duration || currentProject.settings.audioDuration || 0;
    const mimeType = getSupportedMp4MimeType();

    if (!audioEl || duration <= 0) {
      toast.error('Carga primero el MP3 antes de crear el vídeo');
      return;
    }

    if (!mimeType) {
      toast.error('Este navegador no puede crear MP4 directamente. Prueba con Chrome o Edge actualizado.');
      return;
    }

    const captureAudio = audioEl.captureStream ?? audioEl.mozCaptureStream;
    if (cfg.includeAudio && !captureAudio) {
      toast.error('Este navegador no permite capturar el audio del MP3 para el vídeo.');
      return;
    }

    setExporting(true);
    setProgress(0);
    setDone(false);
    setDoneFileName('');

    const previousTime = audioEl.currentTime;
    const wasPlaying = !audioEl.paused;
    let recorder: MediaRecorder | null = null;
    let frameId = 0;
    let outputStream: MediaStream | null = null;
    let capturedAudioStream: MediaStream | null = null;

    try {
      audioEl.pause();
      audioEl.currentTime = 0;

      const sources = new Set<string>();
      const bg = currentProject.settings.background;
      if (bg.imageUrl) sources.add(bg.imageUrl);
      for (const src of bg.images ?? []) if (src) sources.add(src);
      for (const clip of bg.imageClips ?? []) if (clip.url) sources.add(clip.url);
      await Promise.all(Array.from(sources).map((src) => preloadBackgroundImage(src)));

      const { width, height } = getDimensions(cfg.resolution, orientation);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo preparar el lienzo de exportación');

      renderFrame(ctx, width, height, currentProject.settings, 0);
      outputStream = canvas.captureStream(cfg.fps);

      if (cfg.includeAudio && captureAudio) {
        capturedAudioStream = captureAudio.call(audioEl);
        const audioTracks = capturedAudioStream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error('El navegador no ha proporcionado una pista de audio');
        }
        audioTracks.forEach((track) => outputStream?.addTrack(track));
      }

      const bitrate = cfg.resolution === '4k'
        ? 20_000_000
        : cfg.resolution === '1080p'
          ? 9_000_000
          : 5_000_000;

      const chunks: BlobPart[] = [];
      recorder = new MediaRecorder(outputStream, {
        mimeType,
        videoBitsPerSecond: bitrate,
      });

      const recordingFinished = new Promise<Blob>((resolve, reject) => {
        if (!recorder) return reject(new Error('No se pudo iniciar el grabador'));

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error('Error durante la creación del MP4'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      const renderLoop = () => {
        const t = Math.min(duration, audioEl.currentTime || 0);
        renderFrame(ctx, width, height, currentProject.settings, t);
        setProgress(Math.min(99, Math.round((t / duration) * 100)));
        frameId = requestAnimationFrame(renderLoop);
      };

      const onEnded = () => {
        cancelAnimationFrame(frameId);
        renderFrame(ctx, width, height, currentProject.settings, duration);
        setProgress(100);
        if (recorder?.state !== 'inactive') recorder?.stop();
      };

      audioEl.addEventListener('ended', onEnded, { once: true });
      recorder.start(1000);
      frameId = requestAnimationFrame(renderLoop);

      try {
        await audioEl.play();
      } catch (error) {
        audioEl.removeEventListener('ended', onEnded);
        cancelAnimationFrame(frameId);
        if (recorder.state !== 'inactive') recorder.stop();
        throw error;
      }

      const blob = await recordingFinished;
      if (blob.size === 0) throw new Error('El vídeo generado está vacío');

      const filename = `${safeFilename(title)}.mp4`;
      downloadBlob(filename, blob);
      markSaved();
      setDoneFileName(filename);
      setDone(true);
      toast.success(`Vídeo MP4 guardado: ${filename}`);
    } catch (error) {
      console.error('Video export failed:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el vídeo MP4');
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

  const reset = () => {
    setDone(false);
    setDoneFileName('');
    setProgress(0);
    setExportOpen(false);
  };

  return (
    <Dialog
      open={isExportOpen}
      onOpenChange={(open) => {
        if (!open && exporting) return;
        if (!open) reset();
        else setExportOpen(true);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Guardar / Exportar
          </DialogTitle>
          <DialogDescription>
            Elige el formato que quieres descargar. Para compartir por WhatsApp, Instagram o redes sociales, usa MP4.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Vídeo guardado</h3>
            <p className="text-sm text-muted-foreground mb-1">{doneFileName}</p>
            <p className="text-xs text-muted-foreground mb-4">
              El MP4 está listo para compartir desde tu carpeta de descargas.
            </p>
            <Button onClick={reset}>Cerrar</Button>
          </div>
        ) : exporting ? (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="text-center text-sm text-muted-foreground">
              Creando MP4... {progress}%
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-center text-muted-foreground">
              {getResolutionDescription(cfg.resolution, orientation)} · {cfg.fps} FPS · {orientation === 'portrait' ? '9:16' : '16:9'} · MP4
            </div>
            <p className="text-[11px] text-center text-muted-foreground">
              La creación se realiza en tiempo real para mantener sincronizados música, letra, imágenes y efectos.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Formato de salida</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setExportType('video')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                    exportType === 'video'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <Film className="h-5 w-5" />
                  <span className="text-xs font-medium">Vídeo MP4</span>
                  <span className="text-[9px] text-muted-foreground">Recomendado</span>
                </button>
                <button
                  onClick={() => setExportType('txt')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                    exportType === 'txt'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <FileText className="h-5 w-5" />
                  <span className="text-xs font-medium">Letra TXT</span>
                </button>
                <button
                  onClick={() => setExportType('lrc')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                    exportType === 'lrc'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <FileText className="h-5 w-5" />
                  <span className="text-xs font-medium">Letra LRC</span>
                </button>
              </div>
            </div>

            {exportType === 'video' ? (
              <>
                <div className="space-y-2">
                  <Label>Pantalla</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateExport({ orientation: 'landscape' })}
                      className={cn(
                        'flex items-center justify-center gap-2 p-3 rounded-lg border transition-all',
                        orientation === 'landscape'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      <Monitor className="h-5 w-5" />
                      <div className="text-left">
                        <div className="text-sm font-medium">PC / TV</div>
                        <div className="text-[10px] text-muted-foreground">Horizontal 16:9</div>
                      </div>
                    </button>
                    <button
                      onClick={() => updateExport({ orientation: 'portrait' })}
                      className={cn(
                        'flex items-center justify-center gap-2 p-3 rounded-lg border transition-all',
                        orientation === 'portrait'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      <Smartphone className="h-5 w-5" />
                      <div className="text-left">
                        <div className="text-sm font-medium">Móvil</div>
                        <div className="text-[10px] text-muted-foreground">Vertical 9:16</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Resolución</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {resolutions.map((resolution) => {
                      const Icon = resolution.icon;
                      const active = cfg.resolution === resolution.v;
                      return (
                        <button
                          key={resolution.v}
                          onClick={() => updateExport({ resolution: resolution.v })}
                          className={cn(
                            'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                            active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/40'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-xs font-medium">{resolution.label}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {getResolutionDescription(resolution.v, orientation)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Fotogramas por segundo</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {fpsOptions.map((fps) => (
                      <button
                        key={fps.v}
                        onClick={() => updateExport({ fps: fps.v })}
                        className={cn(
                          'p-3 rounded-lg border text-sm font-medium transition-all',
                          cfg.fps === fps.v
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/40'
                        )}
                      >
                        {fps.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Incluir música</span>
                  <input
                    type="checkbox"
                    checked={cfg.includeAudio}
                    onChange={(e) => updateExport({ includeAudio: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              </>
            ) : (
              <div className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground">
                  {exportType === 'txt'
                    ? 'Guarda la letra como texto plano.'
                    : 'Guarda la letra con sus marcas de tiempo para reproductores compatibles.'}
                </p>
                <div className="text-xs text-muted-foreground">
                  {lyrics.length} líneas · {lyrics.filter((line) => line.start > 0).length} sincronizadas
                </div>
              </div>
            )}
          </div>
        )}

        {!exporting && !done && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancelar
            </Button>
            {exportType === 'video' ? (
              <Button onClick={startVideoExport} className="gap-2">
                <Download className="h-4 w-4" />
                Crear MP4
              </Button>
            ) : (
              <Button onClick={exportType === 'txt' ? handleExportTxt : handleExportLrc} className="gap-2">
                <Download className="h-4 w-4" />
                Guardar {exportType.toUpperCase()}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
