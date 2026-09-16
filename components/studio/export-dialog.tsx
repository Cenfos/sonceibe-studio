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
  Check,
  Download,
  FileText,
  Film,
  Gauge,
  Instagram,
  Loader2,
  MessageCircle,
  Monitor,
  Smartphone,
} from 'lucide-react';
import type { ExportFps, ExportResolution, VideoOrientation } from '@/lib/types';

type ExportType = 'video' | 'txt' | 'lrc';
type PresetId = 'whatsapp' | 'instagram' | 'pc' | 'custom';

type CapturableAudioElement = HTMLAudioElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

type CanvasCaptureTrack = MediaStreamTrack & {
  requestFrame?: () => void;
};

const PRESETS = [
  {
    id: 'whatsapp' as const,
    label: 'WhatsApp móvil',
    description: '720×1280 · 9:16 · ligero',
    resolution: '720p' as ExportResolution,
    orientation: 'portrait' as VideoOrientation,
    fps: 30 as ExportFps,
    videoBitrate: 1_500_000,
    audioBitrate: 96_000,
    icon: MessageCircle,
  },
  {
    id: 'instagram' as const,
    label: 'Instagram / Reels',
    description: '1080×1920 · 9:16',
    resolution: '1080p' as ExportResolution,
    orientation: 'portrait' as VideoOrientation,
    fps: 30 as ExportFps,
    videoBitrate: 4_000_000,
    audioBitrate: 128_000,
    icon: Instagram,
  },
  {
    id: 'pc' as const,
    label: 'PC / TV',
    description: '1920×1080 · 16:9',
    resolution: '1080p' as ExportResolution,
    orientation: 'landscape' as VideoOrientation,
    fps: 30 as ExportFps,
    videoBitrate: 5_500_000,
    audioBitrate: 160_000,
    icon: Gauge,
  },
];

function dimensionsFor(resolution: ExportResolution, orientation: VideoOrientation) {
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

function dimensionLabel(resolution: ExportResolution, orientation: VideoOrientation) {
  const { width, height } = dimensionsFor(resolution, orientation);
  return `${width}×${height}`;
}

function safeFilename(value: string) {
  return (value || 'sonceibe-video')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'sonceibe-video';
}

function formatMb(bytes: number) {
  const mb = bytes / 1_000_000;
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

function estimateBytes(duration: number, videoBitrate: number, audioBitrate: number, includeAudio: boolean) {
  if (duration <= 0) return 0;
  return duration * (videoBitrate + (includeAudio ? audioBitrate : 0)) / 8 * 1.03;
}

function supportedMp4MimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    // Level 4.x is required for reliable Full-HD portrait playback. The old
    // desktop exporter asked for Level 3.0, which can produce a nominally
    // vertical MP4 that mobile players render reduced inside black borders.
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
    } catch {}
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
      const result = { width: video.videoWidth, height: video.videoHeight };
      cleanup();
      resolve(result);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('No se pudo comprobar la resolución del MP4'));
    };
    video.src = url;
  });
}

export function ExportDialog() {
  const { isExportOpen, setExportOpen, currentProject, updateExport, markSaved } = useStore();
  const audio = useAudioEngineContext();
  const [exportType, setExportType] = useState<ExportType>('video');
  const [presetId, setPresetId] = useState<PresetId>('custom');
  const [videoBitrate, setVideoBitrate] = useState(5_500_000);
  const [audioBitrate, setAudioBitrate] = useState(160_000);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [doneText, setDoneText] = useState('');

  if (!currentProject) return null;

  const cfg = currentProject.settings.exportConfig;
  const orientation: VideoOrientation = cfg.orientation ?? 'landscape';
  const duration = audio.duration || currentProject.settings.audioDuration || 0;
  const title = currentProject.settings.title || 'SonCeibe';
  const estimatedBytes = useMemo(
    () => estimateBytes(duration, videoBitrate, audioBitrate, cfg.includeAudio),
    [duration, videoBitrate, audioBitrate, cfg.includeAudio]
  );

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setPresetId(preset.id);
    setVideoBitrate(preset.videoBitrate);
    setAudioBitrate(preset.audioBitrate);
    updateExport({
      resolution: preset.resolution,
      orientation: preset.orientation,
      fps: preset.fps,
    });
  };

  const setOrientation = (next: VideoOrientation) => {
    setPresetId('custom');
    if (next === 'portrait') {
      updateExport({ orientation: 'portrait', resolution: '1080p', fps: 30 });
      setVideoBitrate((value) => Math.max(value, 4_000_000));
    } else {
      updateExport({ orientation: 'landscape' });
    }
  };

  const exportText = (kind: 'txt' | 'lrc') => {
    if (kind === 'txt') {
      downloadTextFile(`${safeFilename(title)}.txt`, exportToTxt(currentProject.settings.lyrics));
    } else {
      downloadTextFile(
        `${safeFilename(title)}.lrc`,
        exportToLrc(currentProject.settings.lyrics, title, currentProject.settings.artist),
        'application/octet-stream'
      );
    }
    markSaved();
    toast.success(`Letra ${kind.toUpperCase()} guardada`);
  };

  const exportVideo = async () => {
    if (exporting) return;

    const audioEl = audio.audioEl as CapturableAudioElement | null;
    const mimeType = supportedMp4MimeType();
    if (!audioEl || duration <= 0) {
      toast.error('Carga primero el MP3');
      return;
    }
    if (!mimeType) {
      toast.error('Este navegador no puede crear MP4 directamente');
      return;
    }

    const captureAudio = audioEl.captureStream ?? audioEl.mozCaptureStream;
    if (cfg.includeAudio && !captureAudio) {
      toast.error('Este navegador no permite capturar el audio para el MP4');
      return;
    }

    const previousTime = audioEl.currentTime;
    const wasPlaying = !audioEl.paused;
    let frameTimer: ReturnType<typeof setInterval> | null = null;
    let recorder: MediaRecorder | null = null;
    let outputStream: MediaStream | null = null;
    let captureCanvas: HTMLCanvasElement | null = null;
    let capturedVideoTrack: CanvasCaptureTrack | null = null;
    let renderErrors = 0;

    setExporting(true);
    setProgress(0);
    setDone(false);
    setDoneText('');

    try {
      audioEl.pause();
      audioEl.currentTime = 0;

      const renderSettings = orientation === 'portrait'
        ? {
            ...currentProject.settings,
            background: {
              ...currentProject.settings.background,
              // A mobile export always fills the full 9:16 frame. Landscape
              // photos are cropped rather than surrounded by black bars.
              imageFit: 'cover' as const,
            },
            exportConfig: {
              ...currentProject.settings.exportConfig,
              orientation: 'portrait' as const,
            },
          }
        : currentProject.settings;

      const backgroundSources = new Set<string>();
      const bg = renderSettings.background;
      if (bg.imageUrl) backgroundSources.add(bg.imageUrl);
      for (const src of bg.images ?? []) if (src) backgroundSources.add(src);
      for (const clip of bg.imageClips ?? []) if (clip.url) backgroundSources.add(clip.url);
      await Promise.all(Array.from(backgroundSources).map(preloadBackgroundImage));
      await preloadVisualBranding(renderSettings.visualStyle, renderSettings.showSonCeibeBranding);

      const expected = dimensionsFor(cfg.resolution, orientation);
      const canvas = document.createElement('canvas');
      canvas.width = expected.width;
      canvas.height = expected.height;
      canvas.style.position = 'fixed';
      canvas.style.left = '-10000px';
      canvas.style.top = '0';
      canvas.style.width = '1px';
      canvas.style.height = '1px';
      canvas.style.pointerEvents = 'none';
      document.body.appendChild(canvas);
      captureCanvas = canvas;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('No se pudo preparar el vídeo');

      const renderExportFrame = (time: number): boolean => {
        try {
          renderFrame(ctx, expected.width, expected.height, renderSettings, time);
          capturedVideoTrack?.requestFrame?.();
          return true;
        } catch (error) {
          renderErrors += 1;
          if (renderErrors <= 3) console.error('Desktop export frame render failed:', error);
          return false;
        }
      };

      if (!renderExportFrame(0)) throw new Error('No se pudo crear el primer fotograma del vídeo');
      outputStream = canvas.captureStream(cfg.fps);
      const videoTrack = outputStream.getVideoTracks()[0] as CanvasCaptureTrack | undefined;
      if (!videoTrack) throw new Error('No se pudo crear la pista de vídeo');
      capturedVideoTrack = videoTrack;
      videoTrack.contentHint = 'detail';
      videoTrack.requestFrame?.();

      if (cfg.includeAudio && captureAudio) {
        const captured = captureAudio.call(audioEl);
        const audioTracks = captured.getAudioTracks();
        if (!audioTracks.length) throw new Error('No se pudo capturar la música');
        audioTracks.forEach((track) => outputStream?.addTrack(track));
      }

      const chunks: BlobPart[] = [];
      const activeRecorder = new MediaRecorder(outputStream, {
        mimeType,
        videoBitsPerSecond: videoBitrate,
        ...(cfg.includeAudio ? { audioBitsPerSecond: audioBitrate } : {}),
      });
      recorder = activeRecorder;

      const finished = new Promise<Blob>((resolve, reject) => {
        activeRecorder.ondataavailable = (event) => {
          if (event.data?.size) chunks.push(event.data);
        };
        activeRecorder.onerror = () => reject(new Error('Error durante la creación del MP4'));
        activeRecorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      const interval = 1 / cfg.fps;
      let lastRendered = -interval;
      let lastProgress = -1;
      const renderTick = () => {
        try {
          if (!capturedVideoTrack || capturedVideoTrack.readyState === 'ended') return;
          const rawTime = Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
          const t = Math.min(duration, Math.max(0, rawTime));
          if (t - lastRendered >= interval * 0.82 || t >= duration) {
            if (renderExportFrame(t)) lastRendered = t;
          } else {
            // Explicitly keep the capture track producing frames. On Chromium,
            // a detached/high-resolution canvas can otherwise stop advancing
            // while the captured audio continues normally.
            capturedVideoTrack.requestFrame?.();
          }
          const nextProgress = Math.min(99, Math.round((t / duration) * 100));
          if (nextProgress !== lastProgress) {
            lastProgress = nextProgress;
            setProgress(nextProgress);
          }
        } catch (error) {
          renderErrors += 1;
          if (renderErrors <= 3) console.error('Desktop export render loop failed:', error);
        }
      };

      const onEnded = () => {
        if (frameTimer) {
          clearInterval(frameTimer);
          frameTimer = null;
        }
        renderExportFrame(duration);
        capturedVideoTrack?.requestFrame?.();
        setProgress(100);
        if (activeRecorder.state !== 'inactive') activeRecorder.stop();
      };

      audioEl.addEventListener('ended', onEnded, { once: true });
      activeRecorder.start(1000);
      frameTimer = setInterval(renderTick, Math.max(10, Math.round(1000 / cfg.fps)));
      renderTick();
      await audioEl.play();

      const blob = await finished;
      if (!blob.size) throw new Error('El MP4 generado está vacío');

      const actual = await readVideoDimensions(blob);
      if (actual.width !== expected.width || actual.height !== expected.height) {
        throw new Error(
          `El MP4 quedó en ${actual.width}×${actual.height}; debía ser ${expected.width}×${expected.height}. No se ha descargado para evitar bordes negros.`
        );
      }

      const suffix = orientation === 'portrait'
        ? presetId === 'instagram' ? '-instagram-9x16' : '-movil-9x16'
        : '';
      const filename = `${safeFilename(title)}${suffix}.mp4`;
      downloadBlob(filename, blob);
      markSaved();
      setDoneText(`${filename} · ${actual.width}×${actual.height} · ${formatMb(blob.size)}`);
      setDone(true);
      toast.success(
        orientation === 'portrait'
          ? `MP4 9:16 comprobado · ${actual.width}×${actual.height}`
          : `MP4 comprobado · ${actual.width}×${actual.height}`
      );
    } catch (error) {
      console.error('Video export failed:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el MP4');
    } finally {
      if (frameTimer) clearInterval(frameTimer);
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      outputStream?.getVideoTracks().forEach((track) => track.stop());
      captureCanvas?.remove();
      audioEl.pause();
      audioEl.currentTime = Math.min(previousTime, duration);
      if (wasPlaying) audioEl.play().catch(() => {});
      setExporting(false);
    }
  };

  const closeDialog = () => {
    if (exporting) return;
    setDone(false);
    setDoneText('');
    setProgress(0);
    setExportOpen(false);
  };

  return (
    <Dialog open={isExportOpen} onOpenChange={(open) => open ? setExportOpen(true) : closeDialog()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Guardar / Exportar</DialogTitle>
          <DialogDescription>
            Para teléfono elige Móvil 9:16, WhatsApp móvil o Instagram / Reels. Studio comprueba la resolución real antes de guardar.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center space-y-3">
            <Check className="mx-auto h-10 w-10 text-green-500" />
            <div className="font-semibold">Vídeo guardado correctamente</div>
            <div className="text-sm text-muted-foreground">{doneText}</div>
            <Button onClick={closeDialog}>Cerrar</Button>
          </div>
        ) : exporting ? (
          <div className="py-8 space-y-4">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <div className="text-center text-sm">Creando MP4… {progress}%</div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-center text-xs text-muted-foreground">
              {dimensionLabel(cfg.resolution, orientation)} · {orientation === 'portrait' ? '9:16 pantalla completa' : '16:9'} · {cfg.fps} FPS
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              {(['video', 'txt', 'lrc'] as ExportType[]).map((kind) => (
                <button
                  key={kind}
                  onClick={() => setExportType(kind)}
                  className={cn('rounded-lg border p-3 text-center text-sm', exportType === kind ? 'border-primary bg-primary/10 text-primary' : 'border-border')}
                >
                  {kind === 'video' ? <Film className="mx-auto mb-1 h-5 w-5" /> : <FileText className="mx-auto mb-1 h-5 w-5" />}
                  {kind === 'video' ? 'Vídeo MP4' : `Letra ${kind.toUpperCase()}`}
                </button>
              ))}
            </div>

            {exportType === 'video' ? (
              <>
                <div className="space-y-2">
                  <Label>Perfiles preparados</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {PRESETS.map((preset) => {
                      const Icon = preset.icon;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => applyPreset(preset)}
                          className={cn('rounded-lg border p-3 text-left', presetId === preset.id ? 'border-primary bg-primary/10 text-primary' : 'border-border')}
                        >
                          <Icon className="mb-1 h-5 w-5" />
                          <div className="text-sm font-medium">{preset.label}</div>
                          <div className="text-[10px] text-muted-foreground">{preset.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Pantalla</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setOrientation('landscape')} className={cn('rounded-lg border p-3 text-left', orientation === 'landscape' ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>
                      <Monitor className="mb-1 h-5 w-5" />
                      <div className="text-sm font-medium">PC / TV</div>
                      <div className="text-[10px] text-muted-foreground">Horizontal 16:9</div>
                    </button>
                    <button onClick={() => setOrientation('portrait')} className={cn('rounded-lg border p-3 text-left', orientation === 'portrait' ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>
                      <Smartphone className="mb-1 h-5 w-5" />
                      <div className="text-sm font-medium">Móvil 9:16</div>
                      <div className="text-[10px] text-muted-foreground">1080×1920 pantalla completa</div>
                    </button>
                  </div>
                  {orientation === 'portrait' && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-[11px] text-primary">
                      Las fotos rellenarán todo el fotograma vertical. Studio recortará los laterales cuando haga falta, sin bandas negras.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Resolución</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['720p', '1080p', '4k'] as ExportResolution[]).map((resolution) => (
                      <button
                        key={resolution}
                        onClick={() => { setPresetId('custom'); updateExport({ resolution }); }}
                        className={cn('rounded-lg border p-2 text-xs', cfg.resolution === resolution ? 'border-primary bg-primary/10 text-primary' : 'border-border')}
                      >
                        <div className="font-medium">{resolution === '4k' ? '4K' : resolution}</div>
                        <div className="text-[9px] text-muted-foreground">{dimensionLabel(resolution, orientation)}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>FPS</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([30, 60] as ExportFps[]).map((fps) => (
                      <button key={fps} onClick={() => { setPresetId('custom'); updateExport({ fps }); }} className={cn('rounded-lg border p-2 text-sm', cfg.fps === fps ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{fps} FPS</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><Label>Compresión</Label><span>{(videoBitrate / 1_000_000).toFixed(1)} Mbps</span></div>
                  <input type="range" min="1" max="20" step="0.5" value={videoBitrate / 1_000_000} onChange={(e) => { setPresetId('custom'); setVideoBitrate(Number(e.target.value) * 1_000_000); }} className="w-full accent-primary" />
                </div>

                <label className="flex items-center justify-between text-sm">
                  <span>Incluir música</span>
                  <input type="checkbox" checked={cfg.includeAudio} onChange={(e) => updateExport({ includeAudio: e.target.checked })} className="h-4 w-4 accent-primary" />
                </label>

                <div className="rounded-lg bg-secondary/40 p-3 text-sm">
                  <div className="flex justify-between"><span>Salida</span><strong>{dimensionLabel(cfg.resolution, orientation)} · {orientation === 'portrait' ? '9:16' : '16:9'}</strong></div>
                  <div className="mt-1 flex justify-between"><span>Tamaño estimado</span><strong>{estimatedBytes ? `~${formatMb(estimatedBytes)}` : '—'}</strong></div>
                </div>
              </>
            ) : (
              <div className="py-4 text-sm text-muted-foreground">Se guardará la letra actual del proyecto en formato {exportType.toUpperCase()}.</div>
            )}
          </div>
        )}

        {!exporting && !done && (
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            {exportType === 'video' ? (
              <Button onClick={exportVideo} className="gap-2"><Download className="h-4 w-4" /> Crear MP4 {orientation === 'portrait' ? '9:16' : '16:9'}</Button>
            ) : (
              <Button onClick={() => exportText(exportType)} className="gap-2"><Download className="h-4 w-4" /> Guardar {exportType.toUpperCase()}</Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
