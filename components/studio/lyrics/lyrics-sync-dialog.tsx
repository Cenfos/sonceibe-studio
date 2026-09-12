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

  const lyrics = currentProject?.settings.lyrics ?? [];
  const syncableLyrics = useMemo(
    () => lyrics.filter((line) => line.text.trim().length > 0),
    [lyrics]
  );
  const duration = audio.duration || currentProject?.settings.audioDuration || 0;
  const currentLine = syncableLyrics[position] ?? null;
  const nextLine = syncableLyrics[position + 1] ?? null;

  const startSync = useCallback(() => {
    if (syncableLyrics.length === 0 || duration <= 0) return;

    clearTimestamps();
    setPosition(0);
    setCompleted(false);
    setRunning(true);
    setSyncProgress({
      inProgress: true,
      currentIndex: 0,
      syncedCount: 0,
      totalCount: syncableLyrics.length,
    });
    audio.seek(0);
    audio.play();
  }, [audio, clearTimestamps, duration, setSyncProgress, syncableLyrics.length]);

  const stopSync = useCallback(() => {
    setRunning(false);
    audio.pause();
    setSyncProgress({ inProgress: false });
  }, [audio, setSyncProgress]);

  const registerCurrentLine = useCallback(() => {
    if (!running || !audio.isPlaying || !currentLine) return;

    const t = audio.audioEl?.currentTime ?? audio.currentTime;

    // The previous line ends exactly when the new one begins. This avoids
    // overlaps and makes the lyric follow the vocal line naturally.
    if (position > 0) {
      const previousLine = syncableLyrics[position - 1];
      if (previousLine) {
        updateLyric(previousLine.id, {
          end: Math.max(previousLine.start + 0.05, t),
        });
      }
    }

    // Keep the current line visible until the next tap. On the last line,
    // the project duration becomes its final end time.
    updateLyric(currentLine.id, {
      start: t,
      end: duration > t ? duration : t + 4,
    });

    const nextPosition = position + 1;
    const finished = nextPosition >= syncableLyrics.length;

    setSyncProgress({
      inProgress: !finished,
      currentIndex: nextPosition,
      syncedCount: nextPosition,
      totalCount: syncableLyrics.length,
    });

    if (finished) {
      setRunning(false);
      setCompleted(true);
    } else {
      setPosition(nextPosition);
    }
  }, [
    audio.audioEl,
    audio.currentTime,
    audio.isPlaying,
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

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && running) stopSync();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sincronizar letra con la música</DialogTitle>
          <DialogDescription>
            Reproduce la canción y pulsa ESPACIO justo cuando empiece cada línea cantada.
            El final de cada línea se ajustará automáticamente al inicio de la siguiente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {currentProject?.settings.audioName || 'Sin archivo de audio'}
              </div>
              <div className="text-xs text-muted-foreground">
                {syncableLyrics.length} líneas para sincronizar
              </div>
            </div>
            <div className="font-mono text-sm tabular-nums">
              {formatTime(audio.currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {completed ? (
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-6 text-center space-y-2">
              <div className="text-lg font-semibold">Sincronización completada</div>
              <p className="text-sm text-muted-foreground">
                Las {syncableLyrics.length} líneas ya tienen tiempos ligados a la reproducción del MP3.
              </p>
            </div>
          ) : running && currentLine ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  Línea {position + 1} de {syncableLyrics.length}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Pulsa al comenzar la frase
                </span>
              </div>

              <div className="rounded-xl border-2 border-primary bg-primary/10 px-6 py-8 text-center">
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
                className="w-full gap-2"
                onClick={registerCurrentLine}
                disabled={!audio.isPlaying}
              >
                <Hand className="h-5 w-5" />
                MARCAR ESTA LÍNEA (ESPACIO)
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card/30 p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                El TXT no contiene tiempos musicales. Al iniciar la sincronización se eliminarán
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
          <div className="flex gap-2">
            {!running && !completed && (
              <Button
                onClick={startSync}
                disabled={syncableLyrics.length === 0 || duration <= 0}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Iniciar sincronización
              </Button>
            )}

            {running && (
              <>
                {audio.isPlaying ? (
                  <Button variant="outline" onClick={audio.pause} className="gap-2">
                    <Pause className="h-4 w-4" />
                    Pausar
                  </Button>
                ) : (
                  <Button variant="outline" onClick={audio.play} className="gap-2">
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
