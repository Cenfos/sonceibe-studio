'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Hand, Pause, Play, RotateCcw, Square } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { formatTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface LyricsSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LyricsSyncDialog({ open, onOpenChange }: LyricsSyncDialogProps) {
  const {
    currentProject,
    updateLyric,
    clearTimestamps,
    setSyncProgress,
  } = useStore();
  const audio = useAudioEngineContext();

  const [running, setRunning] = useState(false);
  const [position, setPosition] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [playbackError, setPlaybackError] = useState('');

  const lyrics = currentProject?.settings.lyrics ?? [];
  const syncableLyrics = useMemo(
    () => lyrics.filter((line) => line.text.trim().length > 0),
    [lyrics]
  );
  const duration = audio.duration || currentProject?.settings.audioDuration || 0;
  const currentLine = syncableLyrics[position] ?? null;
  const nextLine = syncableLyrics[position + 1] ?? null;
  const actuallyPlaying = Boolean(audio.audioEl && !audio.audioEl.paused && !audio.audioEl.ended);

  const playDirectly = useCallback(async (): Promise<boolean> => {
    const element = audio.audioEl;
    if (!element) {
      setPlaybackError('No se encuentra el reproductor de audio. Cierra esta ventana y vuelve a abrir el proyecto.');
      return false;
    }

    try {
      await element.play();
      setPlaybackError('');
      return true;
    } catch (error) {
      console.error('Lyric sync playback failed:', error);
      setPlaybackError('El móvil ha bloqueado la reproducción. Toca de nuevo «Continuar» para iniciar la canción.');
      return false;
    }
  }, [audio.audioEl]);

  const startSync = useCallback(async () => {
    if (syncableLyrics.length === 0 || duration <= 0 || !audio.audioEl) return;

    // Call play() directly from the user's tap before React state updates. This is
    // important on mobile browsers, where playback can otherwise be rejected as
    // an autoplay attempt.
    audio.seek(0);
    const playPromise = audio.audioEl.play();

    clearTimestamps();
    setPosition(0);
    setCompleted(false);
    setRunning(true);
    setPlaybackError('');
    setSyncProgress({
      inProgress: true,
      currentIndex: 0,
      syncedCount: 0,
      totalCount: syncableLyrics.length,
    });

    try {
      await playPromise;
    } catch (error) {
      console.error('Lyric sync start playback failed:', error);
      setPlaybackError('No se pudo iniciar la canción. Toca «Continuar» para volver a intentarlo.');
    }
  }, [audio, clearTimestamps, duration, setSyncProgress, syncableLyrics.length]);

  const stopSync = useCallback(() => {
    setRunning(false);
    audio.pause();
    setPlaybackError('');
    setSyncProgress({ inProgress: false });
  }, [audio, setSyncProgress]);

  const registerCurrentLine = useCallback(() => {
    const element = audio.audioEl;
    if (!running || !element || element.paused || element.ended || !currentLine) return;

    const t = element.currentTime;

    if (position > 0) {
      const previousLine = syncableLyrics[position - 1];
      if (previousLine) {
        updateLyric(previousLine.id, {
          end: Math.max(previousLine.start + 0.05, t),
        });
      }
    }

    const nextPosition = position + 1;
    const finished = nextPosition >= syncableLyrics.length;
    const provisionalEnd = finished
      ? Math.max(t + 0.05, duration)
      : Math.min(duration, Math.max(t + 0.05, t + 4));

    updateLyric(currentLine.id, {
      start: t,
      end: provisionalEnd,
    });

    setSyncProgress({
      inProgress: !finished,
      currentIndex: nextPosition,
      syncedCount: nextPosition,
      totalCount: syncableLyrics.length,
    });

    if (finished) {
      setRunning(false);
      setCompleted(true);
      audio.pause();
    } else {
      setPosition(nextPosition);
    }
  }, [
    audio,
    currentLine,
    duration,
    position,
    running,
    setSyncProgress,
    syncableLyrics,
    updateLyric,
  ]);

  useEffect(() => {
    if (!open || !running) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      event.stopPropagation();
      registerCurrentLine();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, registerCurrentLine, running]);

  useEffect(() => {
    if (!open) {
      setPlaybackError('');
      setRunning(false);
      setCompleted(false);
      setPosition(0);
    }
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && running) stopSync();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sincronizar letra con la música</DialogTitle>
          <DialogDescription>
            Reproduce la canción y toca «MARCAR ESTA LÍNEA» justo cuando empiece cada frase. En PC también puedes pulsar ESPACIO.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-3 gap-3">
            <div className="min-w-0 space-y-1">
              <div className="truncate text-sm font-medium">
                {currentProject?.settings.audioName || 'Sin archivo de audio'}
              </div>
              <div className="text-xs text-muted-foreground">
                {syncableLyrics.length} líneas para sincronizar
              </div>
            </div>
            <div className="shrink-0 font-mono text-sm tabular-nums">
              {formatTime(audio.currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {playbackError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {playbackError}
            </div>
          )}

          {completed ? (
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-6 text-center space-y-2">
              <div className="text-lg font-semibold">Sincronización completada</div>
              <p className="text-sm text-muted-foreground">
                Las {syncableLyrics.length} líneas ya tienen tiempos ligados a la reproducción del MP3.
              </p>
            </div>
          ) : running && currentLine ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">
                  Línea {position + 1} de {syncableLyrics.length}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Toca al comenzar la frase
                </span>
              </div>

              <div className="rounded-xl border-2 border-primary bg-primary/10 px-5 py-7 text-center">
                <div className="text-xl font-semibold leading-relaxed">
                  {currentLine.text}
                </div>
              </div>

              {nextLine && (
                <div className="rounded-lg border border-border px-4 py-3 text-center text-sm text-muted-foreground">
                  Siguiente: {nextLine.text}
                </div>
              )}

              <Button
                size="lg"
                className="w-full min-h-14 gap-2 text-base"
                onClick={registerCurrentLine}
                disabled={!actuallyPlaying}
              >
                <Hand className="h-5 w-5" />
                MARCAR ESTA LÍNEA (ESPACIO)
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card/30 p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                El documento no contiene tiempos musicales. Al iniciar la sincronización se eliminarán
                los tiempos aproximados y los marcarás escuchando la canción. Las líneas vacías
                se omiten automáticamente.
              </p>
              {duration <= 0 && (
                <p className="text-sm text-destructive">
                  Primero carga un MP3 para poder sincronizar la letra.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {!running && !completed && (
              <Button
                onClick={startSync}
                disabled={syncableLyrics.length === 0 || duration <= 0 || !audio.audioEl}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Iniciar sincronización
              </Button>
            )}

            {running && (
              <>
                {actuallyPlaying ? (
                  <Button variant="outline" onClick={audio.pause} className="gap-2">
                    <Pause className="h-4 w-4" />
                    Pausar
                  </Button>
                ) : (
                  <Button variant="default" onClick={playDirectly} className="gap-2">
                    <Play className="h-4 w-4" />
                    Continuar
                  </Button>
                )}
                <Button variant="destructive" onClick={stopSync} className="gap-2">
                  <Square className="h-4 w-4" />
                  Detener
                </Button>
              </>
            )}

            {completed && (
              <Button variant="outline" onClick={startSync} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Repetir sincronización
              </Button>
            )}
          </div>

          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
