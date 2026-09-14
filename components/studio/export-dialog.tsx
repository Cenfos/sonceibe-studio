'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { exportToTxt, exportToLrc, downloadTextFile } from '@/lib/lyrics-utils';
import { preloadBackgroundImage, renderFrame } from './preview/canvas-renderer';
import { preloadVisualBranding } from '@/lib/visual-branding';
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
  MessageCircle,
  Instagram,
  Gauge,
  Sparkles,
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

type ExportPresetId = 'whatsapp' | 'instagram' | 'balanced' | 'quality' | 'custom';

type ExportPreset = {
  id: Exclude<ExportPresetId, 'custom'>;
  label: string;
  description: string;
  resolution: ExportResolution;
  fps: ExportFps;
  orientation: VideoOrientation;
  videoBitrate: number;
  audioBitrate: number;
  icon: React.ComponentType<{ className?: string }>;
};

const exportPresets: ExportPreset[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp móvil',
    description: '720×1280 · 9:16 · poco peso',
    resolution: '720p',
    fps: 30,
    orientation: 'portrait',
    videoBitrate: 1_500_000,
    audioBitrate: 96_000,
    icon: MessageCircle,
  },
  {
    id: 'instagram',
    label: 'Instagram / Reels',
    description: '1080×1920 · 9:16 · 30 FPS',
    resolution: '1080p',
    fps: 30,
    orientation: 'portrait',
    videoBitrate: 4_000_000,
    audioBitrate: 128_000,
    icon: Instagram,
  },
  {
    id: 'balanced',
    label: 'PC / TV equilibrado',
    description: '1920×1080 · 16:9 · 30 FPS',
    resolution: '1080p',
    fps: 30,
    orientation: 'landscape',
    videoBitrate: 5_500_000,
    audioBitrate: 160_000,
    icon: Gauge,
  },
  {
    id: 'quality',
    label: 'PC / TV alta calidad',
    description: '1920×1080 · 16:9 · 60 FPS',
    resolution: '1080p',
    fps: 60,
    orientation: 'landscape',
    videoBitrate: 9_000_000,
    audioBitrate: 192_000,
    icon: Sparkles,
  },
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

  // Level 3.0 was previously requested here. That profile is too restrictive
  // for a real 1080×1920 mobile frame and some players could display the video
  // as a reduced image surrounded by black. Prefer H.264 levels suitable for
  // Full HD portrait, matching the mobile exporter.
  const candidates = [
    'video/mp4;codecs=avc1.42E02A,mp4a.40.2',
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

function formatMegabytes(bytes: number): string {
  const mb = bytes / 1_000_000;
  if (mb < 1) return `${Math.max(1, Math.round(mb * 1000))} KB`;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function estimatedVideoSizeBytes(
  durationSeconds: number,
  videoBitrate: number,
  audioBitrate: number,
  includeAudio: boolean
): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  const totalBitrate = videoBitrate + (includeAudio ? audioBitrate : 0);
  return (durationSeconds * totalBitrate / 8) * 1.03;
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
      reject(new Error('No se pudo comprobar la resolución del MP4 generado'));
    };
    video.src = url;
  });
}

function dimensionsMatch(
  actual: { width: number; height: number },
  expected: { width: number; height: number }
): boolean {
  return actual.width === expected.width && actual.height === expected.height;
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
  const [doneFileSize, setDoneFileSize] = useState(0);
  const [doneDimensions, setDoneDimensions] = useState('');
  const [exportType, setExportType] = useState<'video' | 'txt' | 'lrc'>('video');
  const [presetId, setPresetId] = useState<ExportPresetId>('custom');
  const [videoBitrate, setVideoBitrate] = useState(5_500_000);
  const [audioBitrate, setAudioBitrate] = useState(160_000);

  if (!currentProject) return null;

  const cfg = currentProject.settings.exportConfig;
  const orientation: VideoOrientation = cfg.orientation ?? 'landscape';
  const lyrics = currentProject.settings.lyrics;
  const title = currentProject.settings.title || 'SonCeibe';
  const durationForEstimate = audio.duration || currentProject.settings.audioDuration || 0;
  const estimatedBytes = useMemo(
    () => estimatedVideoSizeBytes(durationForEstimate, videoBitrate, audioBitrate, cfg.includeAudio),
    [durationForEstimate, videoBitrate, audioBitrate, cfg.includeAudio]
  );

  const applyPreset = (preset: ExportPreset) => {
    setPresetId(preset.id);
    setVideoBitrate(preset.videoBitrate);
    setAudioBitrate(preset.audioBitrate);
    updateExport({
      resolution: preset.resolution,
      fps: preset.fps,
      orientation: preset.orientation,
    });
  };

  const setCustomResolution = (resolution: ExportResolution) => {
    setPresetId('custom');
    updateExport({ resolution });
    const minimumUsefulBitrate = resolution === '4k'
      ? 12_000_000
      : resolution === '1080p'
        ? 4_000_000
        : 1_500_000;
    setVideoBitrate((current) => Math.max(current, minimumUsefulBitrate));
  };

  const setOrientation = (nextOrientation: VideoOrientation) => {
    setPresetId('custom');
    if (nextOrientation === 'portrait') {
      updateExport({ orientation: 'portrait', resolution: '1080p', fps: 30 });
      setVideoBitrate((current) => Math.max(current, 4_000_000));
    } else {
      updateExport({ orientation: 'landscape' });
    }
  };

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
    setDoneFileSize(0);
    setDoneDimensions('');

    const previousTime = audioEl.currentTime;
    const wasPlaying = !audioEl.paused;
    let recorder: MediaRecorder | null = null;
    let frameId = 0;
    let outputStream: MediaStream | null = null;
    let capturedAudioStream: MediaStream | null = null;

    try {
      audioEl.pause();
      audioEl.currentTime = 0;

      const exportSettings = orientation === 'portrait'
        ? {
            ...currentProject.settings,
            background: {
              ...currentProject.settings.background,
              // A vertical mobile export must fill the complete 9:16 frame.
              // Photos are cropped when necessary instead of introducing bars.
              imageFit: 'cover' as const,
            },
            exportConfig: {
              ...currentProject.settings.exportConfig,
              orientation: 'portrait' as const,
            },
          }
        : currentProject.settings;

      const sources = new Set<string>();
      const bg = exportSettings.background;
      if (bg.imageUrl) sources.add(bg.imageUrl);
      for (const src of bg.images ?? []) if (src) sources.add(src);
      for (const clip of bg.imageClips ?? []) if (clip.url) sources.add(clip.url);
      await Promise.all(Array.from(sources).map((src) => preloadBackgroundImage(src)));
      await preloadVisualBranding(exportSettings.visualStyle, exportSettings.showSonCeibeBranding);

      const expectedDimensions = getDimensions(cfg.resolution, orientation);
      const { width, height } = expectedDimensions;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('No se pudo preparar el lienzo de exportación');

      renderFrame(ctx, width, height, exportSettings, 0);
      outputStream = canvas.captureStream(cfg.fps);
      const videoTrack = outputStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('No se pudo crear la pista de vídeo');
      videoTrack.contentHint = 'detail';

      if (cfg.includeAudio && captureAudio) {
        capturedAudioStream = captureAudio.call(audioEl);
        const audioTracks = capturedAudioStream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error('El navegador no ha proporcionado una pista de audio');
        }
        audioTracks.forEach((track) => outputStream?.addTrack(track));
      }

      const chunks: BlobPart[] = [];
      recorder = new MediaRecorder(outputStream, {
        mimeType,
        videoBitsPerSecond: videoBitrate,
        ...(cfg.includeAudio ? { audioBitsPerSecond: audioBitrate } : {}),
      });

      const recordingFinished = new Promise<Blob>((resolve, reject) => {
        if (!recorder) return reject(new Error('No se pudo iniciar el grabador'));
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error('Error durante la creación del MP4'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      const frameInterval = 1 / cfg.fps;
      let lastRenderedTime = -frameInterval;
      let lastProgress = -1;

      const renderLoop = () => {
        try {
          const t = Math.min(duration, Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0);
          if (t - lastRenderedTime >= frameInterval * 0.9 || t >= duration) {
            renderFrame(ctx, width, height, exportSettings, t);
            lastRenderedTime = t;
          }
          const nextProgress = Math.min(99, Math.round((t / duration) * 100));
          if (nextProgress !== lastProgress) {
            lastProgress = nextProgress;
            setProgress(nextProgress);
          }
        } finally {
          frameId = requestAnimationFrame(renderLoop);
        }
      };

      const onEnded = () => {
        cancelAnimationFrame(frameId);
        renderFrame(ctx, width, height, exportSettings, duration);
        setProgress(100);
        if (recorder?.state !== 'inactive') recorder.stop();
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

      const actualDimensions = await readVideoDimensions(blob);
      if (!dimensionsMatch(actualDimensions, expectedDimensions)) {
        throw new Error(
          `El MP4 final quedó en ${actualDimensions.width}×${actualDimensions.height}, pero debía ser ${expectedDimensions.width}×${expectedDimensions.height}. No se ha descargado para evitar bordes negros en el móvil.`
        );
      }

      const suffix = orientation === 'portrait'
        ? presetId === 'instagram'
          ? '-instagram-9x16'
          : '-movil-9x16'
        : presetId === 'whatsapp'
          ? '-whatsapp'
          : '';
      const filename = `${safeFilename(title)}${suffix}.mp4`;
      downloadBlob(filename, blob);
      markSaved();
      setDoneFileName(filename);
      setDoneFileSize(blob.size);
      setDoneDimensions(`${actualDimensions.width}×${actualDimensions.height}`);
      setDone(true);
      toast.success(
        orientation === 'portrait'
          ? `MP4 móvil 9:16 comprobado · ${actualDimensions.width}×${actualDimensions.height} · ${formatMegabytes(blob.size)}`
          : `Vídeo MP4 guardado · ${actualDimensions.width}×${actualDimensions.height} · ${formatMegabytes(blob.size)}`
      );
    } catch (error) {
      console.error('Video export failed:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el vídeo MP4');
    } finally {
      cancelAnimationFrame(frameId);
      if (recorder?.state !== 'inactive') recorder.stop();
      outputStream?.getVideoTracks().forEach((track) => track.stop());
      audioEl.pause();
      audioEl.currentTime = Math.min(previousTime, duration);
      if (wasPlaying) audioEl.play().catch(() => {});
      setExporting(false);
    }
  };

  const reset = () => {
    setDone(false);
    setDoneFileName('');
    setDoneFileSize(0);
    setDoneDimensions('');
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Guardar / Exportar
          </DialogTitle>
          <DialogDescription>
            Para móvil usa Móvil 9:16, WhatsApp móvil o Instagram / Reels. Studio comprobará la resolución final antes de descargar el MP4.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Vídeo guardado</h3>
            <p className="text-sm text-muted-foreground mb-1">{doneFileName}</p>
            {doneDimensions && <p className="text-sm font-medium">{doneDimensions} · {orientation === 'portrait' ? '9:16' : '16:9'}</p>}
            {doneFileSize > 0 && <p className="text-sm text-muted-foreground mb-4">{formatMegabytes(doneFileSize)}</p>}
            <Button onClick={reset}>Cerrar</Button>
          </div>
        ) : exporting ? (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="text-center text-sm text-muted-foreground">Creando MP4... {progress}%</div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary transition-all duration-150" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-xs text-center text-muted-foreground">
              {getResolutionDescription(cfg.resolution, orientation)} · {cfg.fps} FPS · {orientation === 'portrait' ? '9:16 pantalla completa' : '16:9'} · {(videoBitrate / 1_000_000).toFixed(1)} Mbps
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Formato de salida</Label>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setExportType('video')} className={cn('flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all', exportType === 'video' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40')}>
                  <Film className="h-5 w-5" />
                  <span className="text-xs font-medium">Vídeo MP4</span>
                  <span className="text-[9px] text-muted-foreground">Recomendado</span>
                </button>
                <button onClick={() => setExportType('txt')} className={cn('flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all', exportType === 'txt' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40')}>
                  <FileText className="h-5 w-5" />
                  <span className="text-xs font-medium">Letra TXT</span>
                </button>
                <button onClick={() => setExportType('lrc')} className={cn('flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all', exportType === 'lrc' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40')}>
                  <FileText className="h-5 w-5" />
                  <span className="text-xs font-medium">Letra LRC</span>
                </button>
              </div>
            </div>

            {exportType === 'video' ? (
              <>
                <div className="space-y-2">
                  <Label>Perfil rápido</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {exportPresets.map((preset) => {
                      const Icon = preset.icon;
                      const active = presetId === preset.id;
                      return (
                        <button key={preset.id} onClick={() => applyPreset(preset)} className={cn('flex items-center gap-2 rounded-lg border p-3 text-left transition-all', active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40')}>
                          <Icon className="h-5 w-5 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{preset.label}</div>
                            <div className="text-[10px] text-muted-foreground">{preset.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={cn('rounded-lg border p-3', orientation === 'portrait' ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/40')}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Salida actual</div>
                      <div className="text-[11px] text-muted-foreground">
                        {getResolutionDescription(cfg.resolution, orientation)} · {orientation === 'portrait' ? '9:16 móvil' : '16:9 PC/TV'} · {cfg.fps} FPS
                      </div>
                    </div>
                    <div className="text-lg font-semibold tabular-nums">{estimatedBytes > 0 ? `~${formatMegabytes(estimatedBytes)}` : '—'}</div>
                  </div>
                  {orientation === 'portrait' && (
                    <div className="mt-2 text-[11px] font-medium text-primary">
                      Pantalla completa móvil: las fotos se recortarán automáticamente para rellenar todo el 9:16 sin bandas negras.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Compresión / peso</Label>
                    <span className="text-xs font-mono text-muted-foreground">{(videoBitrate / 1_000_000).toFixed(1)} Mbps</span>
                  </div>
                  <input type="range" min="1" max="20" step="0.5" value={videoBitrate / 1_000_000} onChange={(e) => { setPresetId('custom'); setVideoBitrate(Number(e.target.value) * 1_000_000); }} className="w-full accent-primary" />
                  <div className="flex justify-between text-[10px] text-muted-foreground"><span>Más ligero</span><span>Más calidad</span></div>
                </div>

                <div className="space-y-2">
                  <Label>Pantalla</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setOrientation('landscape')} className={cn('flex items-center justify-center gap-2 p-3 rounded-lg border transition-all', orientation === 'landscape' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40')}>
                      <Monitor className="h-5 w-5" />
                      <div className="text-left"><div className="text-sm font-medium">PC / TV</div><div className="text-[10px] text-muted-foreground">Horizontal 16:9</div></div>
                    </button>
                    <button onClick={() => setOrientation('portrait')} className={cn('flex items-center justify-center gap-2 p-3 rounded-lg border transition-all', orientation === 'portrait' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40')}>
                      <Smartphone className="h-5 w-5" />
                      <div className="text-left"><div className="text-sm font-medium">Móvil 9:16</div><div className="text-[10px] text-muted-foreground">1080×1920 pantalla completa</div></div>
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
                        <button key={resolution.v} onClick={() => setCustomResolution(resolution.v)} className={cn('flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all', active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40')}>
                          <Icon className="h-5 w-5" />
                          <span className="text-xs font-medium">{resolution.label}</span>
                          <span className="text-[10px] text-muted-foreground">{getResolutionDescription(resolution.v, orientation)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Fotogramas por segundo</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {fpsOptions.map((fps) => (
                      <button key={fps.v} onClick={() => { setPresetId('custom'); updateExport({ fps: fps.v }); }} className={cn('p-3 rounded-lg border text-sm font-medium transition-all', cfg.fps === fps.v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40')}>
                        {fps.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Incluir música</span>
                  <input type="checkbox" checked={cfg.includeAudio} onChange={(e) => updateExport({ includeAudio: e.target.checked })} className="h-4 w-4 accent-primary" />
                </label>
              </>
            ) : (
              <div className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground">{exportType === 'txt' ? 'Guarda la letra como texto plano.' : 'Guarda la letra con sus marcas de tiempo para reproductores compatibles.'}</p>
                <div className="text-xs text-muted-foreground">{lyrics.length} líneas · {lyrics.filter((line) => line.start > 0).length} sincronizadas</div>
              </div>
            )}
          </div>
        )}

        {!exporting && !done && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Cancelar</Button>
            {exportType === 'video' ? (
              <Button onClick={startVideoExport} className="gap-2">
                <Download className="h-4 w-4" />
                Crear MP4 {orientation === 'portrait' ? '9:16' : '16:9'} {estimatedBytes > 0 ? `(~${formatMegabytes(estimatedBytes)})` : ''}
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
