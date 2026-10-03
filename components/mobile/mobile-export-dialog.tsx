'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Film, FolderOpen, Loader2, RefreshCw, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { useStudioUserId } from '@/lib/studio-user-context';
import { getProjectVideo, saveProjectVideo } from '@/lib/local-media-storage';
import { createProjectMp4, type CapturableAudioElement } from '@/lib/video-exporter';
import { VIDEO_PROFILES } from '@/lib/video-profiles';
import { toast } from 'sonner';

function safeFilename(value: string): string {
  return (value || 'sonceibe-video')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'sonceibe-video';
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

function estimatedSizeBytes(duration: number): number {
  if (duration <= 0) return 0;
  const profile = VIDEO_PROFILES.mobile;
  return duration * (profile.videoBitrate + profile.audioBitrate) / 8 * 1.03;
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
  const estimatedSize = useMemo(() => estimatedSizeBytes(duration), [duration]);

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
    if (!audioEl || duration <= 0) {
      toast.error('Añade primero una canción');
      return;
    }

    setExporting(true);
    setProgress(0);
    setBlob(null);
    setFilename('');

    try {
      const result = await createProjectMp4({
        audioEl,
        duration,
        settings: currentProject.settings,
        target: 'mobile',
        includeAudio: true,
        // Render lighter on the phone, but capture and verify the final canvas
        // at the exact 1080×1920 mobile profile.
        internalWidth: 720,
        internalHeight: 1280,
        onProgress: setProgress,
      });

      const nextFilename = `${safeFilename(currentProject.settings.title)}${VIDEO_PROFILES.mobile.filenameSuffix}.mp4`;
      const resultFile = new File([result.blob], nextFilename, {
        type: result.blob.type || result.mimeType,
      });

      setBlob(resultFile);
      setFilename(nextFilename);
      await saveProjectVideo(userId, currentProject.id, resultFile, currentProject.settings.updatedAt);
      markSaved();
      toast.success(
        `MP4 móvil comprobado · ${result.width}×${result.height} · 9:16 · ${formatMb(result.blob.size)}`
      );
    } catch (error) {
      console.error('Mobile video export failed:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el MP4');
    } finally {
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
