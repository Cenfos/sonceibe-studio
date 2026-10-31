'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Download, FileText, Film, Loader2, Monitor, Smartphone, XCircle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { exportToTxt, exportToLrc, downloadTextFile } from '@/lib/lyrics-utils';
import { createProjectMp4, type CapturableAudioElement } from '@/lib/video-exporter';
import {
  VIDEO_PROFILES,
  videoTargetFromOrientation,
  type VideoTarget,
} from '@/lib/video-profiles';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ReelDialog } from './reel-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getExportPreflight, hasBlockingExportIssue } from '@/lib/export-preflight';

type ExportType = 'video' | 'txt' | 'lrc';

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

export function ExportDialog() {
  const {
    isExportOpen,
    setExportOpen,
    currentProject,
    updateExport,
    markSaved,
  } = useStore();
  const audio = useAudioEngineContext();

  const [exportType, setExportType] = useState<ExportType>('video');
  const [scope, setScope] = useState<'full' | 'reel'>('full');
  const [target, setTarget] = useState<VideoTarget>('mobile');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [doneText, setDoneText] = useState('');
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => () => exportController.current?.abort(), []);

  useEffect(() => {
    if (!isExportOpen || !currentProject) return;
    setTarget(videoTargetFromOrientation(currentProject.settings.exportConfig.orientation));
    setProgress(0);
    setDone(false);
    setDoneText('');
    setScope(currentProject.settings.reel && currentProject.settings.editingTarget !== 'full' ? 'reel' : 'full');
  }, [isExportOpen, currentProject?.id, currentProject?.settings.exportConfig.orientation]);

  if (!currentProject) return null;

  const profile = VIDEO_PROFILES[target];
  const duration = audio.duration || currentProject.settings.audioDuration || 0;
  const includeAudio = currentProject.settings.exportConfig.includeAudio;
  const title = currentProject.settings.title || 'SonCeibe';
  const estimatedBytes = estimateBytes(duration, profile.videoBitrate, profile.audioBitrate, includeAudio);
  const preflight = getExportPreflight(currentProject.settings, duration, target);
  const hasBlockingIssue = hasBlockingExportIssue(preflight);

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
    if (exporting || exportController.current) return;

    if (audio.mediaBusy || audio.mediaError) { toast.error(audio.mediaError || 'Espera a que termine de preparar el vídeo y sonido'); return; }
    const audioEl = audio.audioEl as CapturableAudioElement | null;
    if (!audioEl || duration <= 0) {
      toast.error('Carga primero el MP3');
      return;
    }

    setExporting(true);
    setProgress(0);
    setDone(false);
    setDoneText('');
    const controller = new AbortController();
    exportController.current = controller;

    try {
      const result = await createProjectMp4({
        audioEl,
        audioBuffer: audio.audioBuffer,
        duration,
        settings: currentProject.settings,
        target,
        includeAudio,
        onProgress: setProgress,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      const filename = `${safeFilename(title)}${profile.filenameSuffix}.mp4`;
      downloadBlob(filename, result.blob);
      markSaved();
      setDoneText(
        `${filename} · ${result.width}×${result.height} · ${formatMb(result.blob.size)}`
      );
      setDone(true);
      toast.success(
        `MP4 comprobado · ${result.width}×${result.height} · ${target === 'mobile' ? '9:16' : '16:9'}`
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Video export failed:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el MP4');
    } finally {
      exportController.current = null;
      setExporting(false);
    }
  };

  const chooseTarget = (next: VideoTarget) => {
    setTarget(next);
    // Keep the editor preview in the same format the user has explicitly chosen.
    updateExport({
      orientation: VIDEO_PROFILES[next].orientation,
      resolution: '1080p',
      fps: 30,
    });
  };

  const closeDialog = () => {
    exportController.current?.abort();
    setDone(false);
    setDoneText('');
    setProgress(0);
    setExportOpen(false);
  };

  return (
    <Dialog open={isExportOpen} onOpenChange={(open) => open ? setExportOpen(true) : closeDialog()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar contenido
          </DialogTitle>
          <DialogDescription>
            Elige el destino. Studio usa dos formatos fijos y comprobados para evitar proporciones incorrectas o bandas negras.
          </DialogDescription>
        </DialogHeader>

        {!exporting && !done && exportType === 'video' && <section aria-label="Contenido del MP4" className="rounded-lg border border-primary/40 p-3 space-y-3">
          <p className="font-medium">¿Qué quieres crear?</p>
          <div className="flex gap-2">
            <Button variant={scope === 'full' ? 'default' : 'outline'} aria-pressed={scope === 'full'} onClick={() => setScope('full')}>Canción completa</Button>
            {currentProject.settings.reel && <Button variant={scope === 'reel' ? 'default' : 'outline'} aria-pressed={scope === 'reel'} onClick={() => setScope('reel')}>Reel seleccionado</Button>}
          </div>
          <p role="status">{scope === 'reel' && currentProject.settings.reel
            ? `Vas a crear un Reel: ${currentProject.settings.reel.start.toFixed(1)}–${currentProject.settings.reel.end.toFixed(1)} s · ${(currentProject.settings.reel.end - currentProject.settings.reel.start).toFixed(1)} s · vertical 9:16.`
            : `Vas a crear el vídeo de la canción completa: 0.0–${duration.toFixed(1)} s · ${duration.toFixed(1)} s.`}</p>
          {scope === 'reel' && <ReelDialog label="Revisar y crear Reel" fromTimeline />}
        </section>}
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
            <div className="text-center text-sm">
              Creando {profile.label} · {profile.width}×{profile.height}… {progress}%
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-center text-xs text-muted-foreground">
              {target === 'mobile'
                ? '9:16 vertical · pantalla completa · 30 FPS'
                : '16:9 horizontal · pantalla completa · 30 FPS'}
            </div>
            <Button variant="outline" className="w-full" onClick={closeDialog}>Cancelar creación</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              {(['video', 'txt', 'lrc'] as ExportType[]).map((kind) => (
                <button
                  key={kind}
                  onClick={() => setExportType(kind)}
                  className={cn(
                    'rounded-lg border p-3 text-center text-sm',
                    exportType === kind
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border'
                  )}
                >
                  {kind === 'video'
                    ? <Film className="mx-auto mb-1 h-5 w-5" />
                    : <FileText className="mx-auto mb-1 h-5 w-5" />}
                  {kind === 'video' ? 'Vídeo MP4' : `Letra ${kind.toUpperCase()}`}
                </button>
              ))}
            </div>

            {exportType === 'video' && scope === 'reel' ? <p className="text-sm text-muted-foreground">Revisa el fragmento antes de crear el Reel. Su corte, portada y letra propia se conservan separados de la canción completa.</p> : exportType === 'video' ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => chooseTarget('mobile')}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-colors',
                      target === 'mobile'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-secondary/40'
                    )}
                  >
                    <Smartphone className="mb-2 h-6 w-6" />
                    <div className="font-semibold">Móvil</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      1080×1920 · 9:16 · vertical
                    </div>
                    <div className="mt-2 text-xs">
                      Llena toda la pantalla del teléfono. Las fotos se recortan lo necesario, sin franjas negras.
                    </div>
                  </button>

                  <button
                    onClick={() => chooseTarget('pc')}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-colors',
                      target === 'pc'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-secondary/40'
                    )}
                  >
                    <Monitor className="mb-2 h-6 w-6" />
                    <div className="font-semibold">PC / TV</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      1920×1080 · 16:9 · horizontal
                    </div>
                    <div className="mt-2 text-xs">
                      Llena toda la pantalla horizontal. Las fotos se recortan lo necesario, sin franjas negras.
                    </div>
                  </button>
                </div>

                <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <span>Incluir música</span>
                  <input
                    type="checkbox"
                    checked={includeAudio}
                    onChange={(event) => updateExport({ includeAudio: event.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                </label>

                <div className="rounded-lg bg-secondary/40 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>Duración completa</span><strong>{duration.toFixed(1)} s</strong>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span>Imagen</span><strong>Montaje del proyecto</strong>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span>Salida exacta</span>
                    <strong>{profile.width}×{profile.height}</strong>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span>Proporción</span>
                    <strong>{target === 'mobile' ? '9:16' : '16:9'}</strong>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span>Tamaño estimado</span>
                    <strong>{estimatedBytes ? `~${formatMb(estimatedBytes)}` : '—'}</strong>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-sm font-medium">Comprobación antes de exportar</div>
                  <div className="space-y-2">
                    {preflight.map((check) => (
                      <div key={check.id} className="flex items-start gap-2 text-xs">
                        {check.level === 'ok' ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        ) : check.level === 'warning' ? (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        )}
                        <div className="min-w-0">
                          <span className="font-medium">{check.label}: </span>
                          <span className="text-muted-foreground">{check.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-4 text-sm text-muted-foreground">
                Se guardará la letra actual del proyecto en formato {exportType.toUpperCase()}.
              </div>
            )}
          </div>
        )}

        {!exporting && !done && (
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            {exportType === 'video' ? scope === 'full' && (
              <Button onClick={exportVideo} className="gap-2" disabled={hasBlockingIssue}>
                <Download className="h-4 w-4" />
                Crear MP4 {target === 'mobile' ? 'móvil 9:16' : 'PC 16:9'}
              </Button>
            ) : (
              <Button onClick={() => exportText(exportType)} className="gap-2">
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
