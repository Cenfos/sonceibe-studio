'use client';

import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { formatTime } from '@/lib/format';
import { generateWaveformPeaks } from '@/lib/waveform';
import { WaveformDisplay } from './waveform-display';
import { cn } from '@/lib/utils';
import {
  Music,
  FileText,
  Image,
  Wand2,
  Plus,
  ZoomIn,
  ZoomOut,
  Copy,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BackgroundImageClip } from '@/lib/types';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

const TRACK_LABEL_W = 120;
const TRACK_H = 44;
const RULER_H = 28;
const SNAP_INTERVAL = 0.5;
const IMAGE_DRAG_TYPE = 'application/x-sonceibe-image-index';

function snapTime(t: number): number {
  return Math.round(t / SNAP_INTERVAL) * SNAP_INTERVAL;
}

function genClipId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function Timeline() {
  const {
    currentProject,
    updateLyric,
    addLyric,
    deleteLyric,
    duplicateLyric,
    updateBackground,
  } = useStore();
  const audio = useAudioEngineContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragMovedRef = useRef(false);
  const [pxPerSec, setPxPerSec] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const settings = currentProject?.settings;
  const duration = audio.duration || settings?.audioDuration || 0;
  const lyrics = settings?.lyrics || [];
  const playheadTime = audio.currentTime;
  const imageMode = settings?.background.imageMode ?? 'auto';
  const imageDuration = settings?.background.imageDuration ?? 5;
  const imageClips = settings?.background.imageClips ?? [];

  const waveformPeaks = useMemo(() => {
    if (audio.audioBuffer) return generateWaveformPeaks(audio.audioBuffer, 2000);
    return [];
  }, [audio.audioBuffer]);

  const totalWidth = Math.max(duration * pxPerSec, 800);

  const rulerTicks = useCallback(() => {
    const ticks: { time: number; major: boolean }[] = [];
    const interval = pxPerSec < 10 ? 5 : pxPerSec < 25 ? 2 : 1;
    for (let t = 0; t <= duration; t += interval) {
      ticks.push({ time: t, major: t % (interval * 5) === 0 });
    }
    return ticks;
  }, [duration, pxPerSec]);

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setPxPerSec((p) => Math.max(5, Math.min(100, p - Math.sign(e.deltaY) * 5)));
    }
  };

  const onRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const pointerId = e.pointerId;
    const target = e.currentTarget;
    target.setPointerCapture?.(pointerId);

    const update = (clientX: number) => {
      const x = clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
      const t = Math.max(0, Math.min(duration, x / pxPerSec));
      audio.seek(t);
    };

    update(e.clientX);

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      update(ev.clientX);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      try { target.releasePointerCapture?.(pointerId); } catch {}
    };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const updateBackgroundClip = (id: string, patch: Partial<BackgroundImageClip>) => {
    const clips = imageClips.map((clip) => clip.id === id ? { ...clip, ...patch } : clip);
    updateBackground({ imageClips: clips });
  };

  const deleteBackgroundClip = (id: string) => {
    updateBackground({ imageClips: imageClips.filter((clip) => clip.id !== id) });
    if (selectedBackgroundId === id) setSelectedBackgroundId(null);
  };

  const duplicateBackgroundClip = (id: string) => {
    const clip = imageClips.find((item) => item.id === id);
    if (!clip) return;

    const clipLength = Math.max(0.2, clip.end - clip.start);
    const desiredStart = clip.end + 0.2;
    const maxStart = duration > 0 ? Math.max(0, duration - clipLength) : desiredStart;
    const start = Math.max(0, Math.min(maxStart, desiredStart));
    const copy: BackgroundImageClip = {
      ...clip,
      id: genClipId(),
      start,
      end: start + clipLength,
    };

    updateBackground({ imageClips: [...imageClips, copy] });
    setSelectedBackgroundId(copy.id);
    setSelectedId(null);
    audio.seek(copy.start);
  };

  const onLyricPointerDown = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    setSelectedBackgroundId(null);
    dragMovedRef.current = false;

    const line = lyrics.find((item) => item.id === id);
    if (!line) return;

    const pointerId = e.pointerId;
    const target = e.currentTarget;
    target.setPointerCapture?.(pointerId);
    const startX = e.clientX;
    const origStart = line.start;
    const origEnd = line.end;
    const mode = (e.target as HTMLElement).dataset.handle;

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      const pixelDx = ev.clientX - startX;
      if (Math.abs(pixelDx) > 3) dragMovedRef.current = true;
      const dx = pixelDx / pxPerSec;

      if (mode === 'left') {
        let newStart = Math.max(0, Math.min(origEnd - 0.2, origStart + dx));
        if (snapEnabled) newStart = snapTime(newStart);
        updateLyric(id, { start: newStart });
      } else if (mode === 'right') {
        let newEnd = Math.max(origStart + 0.2, Math.min(duration, origEnd + dx));
        if (snapEnabled) newEnd = snapTime(newEnd);
        updateLyric(id, { end: newEnd });
      } else {
        const len = origEnd - origStart;
        let newStart = Math.max(0, Math.min(Math.max(0, duration - len), origStart + dx));
        if (snapEnabled) newStart = snapTime(newStart);
        updateLyric(id, { start: newStart, end: newStart + len });
      }
    };

    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      try { target.releasePointerCapture?.(pointerId); } catch {}
      if (!dragMovedRef.current) audio.seek(origStart);
    };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onBackgroundClipPointerDown = (clip: BackgroundImageClip, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedBackgroundId(clip.id);
    setSelectedId(null);
    dragMovedRef.current = false;

    const pointerId = e.pointerId;
    const target = e.currentTarget;
    target.setPointerCapture?.(pointerId);
    const startX = e.clientX;
    const origStart = clip.start;
    const origEnd = clip.end;
    const mode = (e.target as HTMLElement).dataset.handle;

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      const pixelDx = ev.clientX - startX;
      if (Math.abs(pixelDx) > 3) dragMovedRef.current = true;
      const dx = pixelDx / pxPerSec;

      if (mode === 'left') {
        let newStart = Math.max(0, Math.min(origEnd - 0.2, origStart + dx));
        if (snapEnabled) newStart = snapTime(newStart);
        updateBackgroundClip(clip.id, { start: newStart });
      } else if (mode === 'right') {
        const maxEnd = duration > 0 ? duration : origEnd + Math.abs(dx) + 30;
        let newEnd = Math.max(origStart + 0.2, Math.min(maxEnd, origEnd + dx));
        if (snapEnabled) newEnd = snapTime(newEnd);
        updateBackgroundClip(clip.id, { end: newEnd });
      } else {
        const len = origEnd - origStart;
        const maxStart = duration > 0 ? Math.max(0, duration - len) : Number.POSITIVE_INFINITY;
        let newStart = Math.max(0, Math.min(maxStart, origStart + dx));
        if (snapEnabled) newStart = snapTime(newStart);
        updateBackgroundClip(clip.id, { start: newStart, end: newStart + len });
      }
    };

    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      try { target.releasePointerCapture?.(pointerId); } catch {}
      if (!dragMovedRef.current) audio.seek(origStart);
    };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  useEffect(() => {
    if (!selectedId && !selectedBackgroundId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable;
      if (isEditing) return;

      const isDelete = event.key === 'Delete' || event.key === 'Backspace';
      const isDuplicate = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd';
      const isNudge = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      if (!isDelete && !isDuplicate && !isNudge) return;
      event.preventDefault();

      if (isDelete) {
        if (selectedBackgroundId) deleteBackgroundClip(selectedBackgroundId);
        else if (selectedId) {
          deleteLyric(selectedId);
          setSelectedId(null);
        }
        return;
      }

      if (isDuplicate) {
        if (selectedBackgroundId) duplicateBackgroundClip(selectedBackgroundId);
        else if (selectedId) duplicateLyric(selectedId);
        return;
      }

      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      const step = event.shiftKey ? 0.5 : 0.1;
      const offset = direction * step;

      if (selectedBackgroundId) {
        const clip = imageClips.find((item) => item.id === selectedBackgroundId);
        if (!clip) return;
        const len = Math.max(0.2, clip.end - clip.start);
        const maxStart = duration > 0 ? Math.max(0, duration - len) : Number.POSITIVE_INFINITY;
        const start = Math.max(0, Math.min(maxStart, clip.start + offset));
        updateBackgroundClip(clip.id, { start, end: start + len });
        audio.seek(start);
      } else if (selectedId) {
        const line = lyrics.find((item) => item.id === selectedId);
        if (!line) return;
        const len = Math.max(0.2, line.end - line.start);
        const maxStart = duration > 0 ? Math.max(0, duration - len) : Number.POSITIVE_INFINITY;
        const start = Math.max(0, Math.min(maxStart, line.start + offset));
        updateLyric(line.id, { start, end: start + len });
        audio.seek(start);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    audio,
    deleteLyric,
    duplicateLyric,
    duration,
    imageClips,
    lyrics,
    selectedBackgroundId,
    selectedId,
    updateBackground,
    updateLyric,
  ]);

  const deleteSelection = () => {
    if (selectedBackgroundId) deleteBackgroundClip(selectedBackgroundId);
    else if (selectedId) {
      deleteLyric(selectedId);
      setSelectedId(null);
    }
  };

  const duplicateSelection = () => {
    if (selectedBackgroundId) duplicateBackgroundClip(selectedBackgroundId);
    else if (selectedId) duplicateLyric(selectedId);
  };

  const onBackgroundDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (settings?.background.type !== 'images') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onBackgroundDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!settings || settings.background.type !== 'images') return;
    e.preventDefault();

    const rawIndex = e.dataTransfer.getData(IMAGE_DRAG_TYPE);
    if (rawIndex === '') return;
    const imageIndex = Number(rawIndex);
    if (!Number.isInteger(imageIndex)) return;
    const url = settings.background.images[imageIndex];
    if (!url) return;

    const rect = e.currentTarget.getBoundingClientRect();
    let start = Math.max(0, (e.clientX - rect.left) / pxPerSec);
    if (snapEnabled) start = snapTime(start);

    const clipLength = Math.max(1, imageDuration || 5);
    if (duration > 0) start = Math.min(start, Math.max(0, duration - 0.2));

    let end = start + clipLength;
    if (duration > 0) {
      end = Math.min(duration, end);
      if (end - start < 0.2) {
        start = Math.max(0, duration - Math.min(clipLength, duration));
        end = duration;
      }
    }

    const clip: BackgroundImageClip = {
      id: genClipId(),
      url,
      start,
      end: Math.max(start + 0.2, end),
    };

    updateBackground({ imageMode: 'manual', imageClips: [...imageClips, clip] });
    setSelectedBackgroundId(clip.id);
    setSelectedId(null);
    audio.seek(start);
  };

  const backgroundLabel = settings?.background.type === 'gradient'
    ? 'Gradiente animado'
    : settings?.background.type === 'color'
      ? 'Color sólido'
      : settings?.background.type === 'image'
        ? 'Imagen fija'
        : settings?.background.type === 'images'
          ? imageMode === 'auto'
            ? `Automático · ${settings.background.images.length} imágenes · ${imageDuration}s`
            : 'Imágenes manuales'
          : 'Video';

  return (
    <div className="studio-timeline h-64 shrink-0 flex flex-col border-t border-border bg-card/30">
      <div className="studio-timeline-header h-9 flex items-center justify-between px-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium min-w-0">
          <Music className="h-4 w-4 text-primary shrink-0" />
          <span className="shrink-0">Línea de Tiempo</span>
          <span className="studio-timeline-help hidden 2xl:inline text-[10px] font-normal text-muted-foreground truncate">
            Supr elimina · ← → mueve 0,1 s · Shift + ← → 0,5 s · Ctrl+D duplica
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="studio-timeline-time text-xs text-muted-foreground mr-2 font-mono">
            {formatTime(playheadTime)} / {formatTime(duration)}
          </span>
          {(selectedId || selectedBackgroundId) && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={duplicateSelection}
                title="Duplicar selección"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={deleteSelection}
                title="Eliminar selección"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] gap-1 px-2"
            onClick={() => setSnapEnabled(!snapEnabled)}
            title="Activar/desactivar ajuste"
          >
            <span className={snapEnabled ? 'text-primary' : 'text-muted-foreground'}>Snap</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPxPerSec((p) => Math.max(5, p - 5))} title="Alejar timeline">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPxPerSec((p) => Math.min(100, p + 5))} title="Acercar timeline">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => addLyric()} title="Añadir línea de letra">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="studio-timeline-labels shrink-0 border-r border-border" style={{ width: TRACK_LABEL_W }}>
          <div style={{ height: RULER_H }} className="border-b border-border bg-card/50" />
          <TrackLabel icon={Music} label="Audio" color="hsl(var(--track-audio))" />
          <TrackLabel icon={FileText} label="Letra" color="hsl(var(--track-lyrics))" />
          <TrackLabel icon={Image} label="Fondo" color="hsl(var(--track-bg))" />
          <TrackLabel icon={Wand2} label="Efectos" color="hsl(var(--track-effect))" />
        </div>

        <div
          ref={scrollRef}
          className="studio-timeline-scroll flex-1 overflow-x-auto scrollbar-thin relative touch-pan-x"
          onWheel={onWheel}
        >
          <div style={{ width: totalWidth, position: 'relative' }}>
            <div
              className="relative border-b border-border bg-card/50 cursor-pointer select-none touch-none"
              style={{ height: RULER_H }}
              onPointerDown={onRulerPointerDown}
            >
              {rulerTicks().map((tick) => (
                <div key={tick.time} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: tick.time * pxPerSec }}>
                  <div className={cn('w-px bg-border', tick.major ? 'h-full' : 'h-1/2')} />
                  {tick.major && (
                    <span className="absolute top-1 left-1 text-[10px] text-muted-foreground font-mono">
                      {formatTime(tick.time)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <TrackRow height={TRACK_H} color="hsl(var(--track-audio) / 0.15)">
              <div
                className="absolute rounded-md flex items-center px-2 overflow-hidden"
                style={{
                  left: 0,
                  width: duration * pxPerSec,
                  top: 4,
                  bottom: 4,
                  background: 'hsl(var(--track-audio) / 0.2)',
                  border: '1px solid hsl(var(--track-audio) / 0.5)',
                }}
              >
                {waveformPeaks.length > 0 ? (
                  <WaveformDisplay
                    peaks={waveformPeaks}
                    width={Math.max(0, duration * pxPerSec - 4)}
                    height={TRACK_H - 8}
                    playheadRatio={duration > 0 ? playheadTime / duration : 0}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-xs text-muted-foreground">
                    {duration === 0 ? 'Importa un MP3 para ver la forma de onda' : 'Decodificando audio...'}
                  </div>
                )}
              </div>
            </TrackRow>

            <TrackRow height={TRACK_H} color="hsl(var(--track-lyrics) / 0.1)">
              {lyrics.map((line) => {
                const left = line.start * pxPerSec;
                const width = (line.end - line.start) * pxPerSec;
                const selected = selectedId === line.id;
                const isPlaying = playheadTime >= line.start && playheadTime <= line.end && line.end > line.start;

                return (
                  <ContextMenu key={line.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        className={cn(
                          'studio-timeline-clip absolute rounded-md flex items-center px-2 cursor-grab active:cursor-grabbing overflow-hidden text-xs font-medium group touch-none select-none',
                          selected ? 'ring-2 ring-primary z-10' : 'hover:ring-1 hover:ring-primary/50',
                          isPlaying && 'ring-2 ring-primary/70 z-10'
                        )}
                        style={{
                          left,
                          width: Math.max(width, 30),
                          top: 4,
                          bottom: 4,
                          background: isPlaying
                            ? 'hsl(var(--track-lyrics) / 0.4)'
                            : 'hsl(var(--track-lyrics) / 0.25)',
                          border: '1px solid hsl(var(--track-lyrics) / 0.5)',
                        }}
                        onPointerDown={(e) => onLyricPointerDown(line.id, e)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingClipId(line.id);
                          setSelectedId(line.id);
                        }}
                      >
                        {editingClipId === line.id ? (
                          <input
                            autoFocus
                            type="text"
                            defaultValue={line.text}
                            onBlur={(e) => {
                              updateLyric(line.id, { text: e.target.value });
                              setEditingClipId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateLyric(line.id, { text: (e.target as HTMLInputElement).value });
                                setEditingClipId(null);
                              }
                              if (e.key === 'Escape') setEditingClipId(null);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="w-full bg-background border border-primary rounded px-1 text-xs outline-none"
                          />
                        ) : (
                          <span className="truncate flex-1 pointer-events-none">{line.text || '...'}</span>
                        )}
                        <span
                          data-handle="left"
                          className="studio-timeline-handle absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-primary/0 group-hover:bg-primary/40 touch-none"
                        />
                        <span
                          data-handle="right"
                          className="studio-timeline-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-primary/0 group-hover:bg-primary/40 touch-none"
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => duplicateLyric(line.id)}>Duplicar</ContextMenuItem>
                      <ContextMenuItem onClick={() => {
                        const t = audio.currentTime;
                        updateLyric(line.id, { start: t, end: t + 4 });
                      }}>
                        Asignar tiempo actual
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem className="text-destructive" onClick={() => deleteLyric(line.id)}>
                        Eliminar
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </TrackRow>

            <TrackRow height={TRACK_H} color="hsl(var(--track-bg) / 0.1)">
              <div className="absolute inset-0" onDragOver={onBackgroundDragOver} onDrop={onBackgroundDrop}>
                {settings?.background.type === 'images' && imageMode === 'manual' ? (
                  imageClips.length > 0 ? (
                    imageClips.map((clip, index) => {
                      const left = clip.start * pxPerSec;
                      const width = (clip.end - clip.start) * pxPerSec;
                      const selected = selectedBackgroundId === clip.id;
                      const active = playheadTime >= clip.start && playheadTime < clip.end;

                      return (
                        <ContextMenu key={clip.id}>
                          <ContextMenuTrigger asChild>
                            <div
                              className={cn(
                                'studio-timeline-clip absolute rounded-md overflow-hidden cursor-grab active:cursor-grabbing group text-xs font-medium touch-none select-none',
                                selected ? 'ring-2 ring-primary z-10' : 'hover:ring-1 hover:ring-primary/50',
                                active && 'ring-2 ring-primary/70 z-10'
                              )}
                              style={{
                                left,
                                width: Math.max(width, 30),
                                top: 4,
                                bottom: 4,
                                backgroundImage: `linear-gradient(rgba(0,0,0,.28), rgba(0,0,0,.55)), url("${clip.url}")`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                border: '1px solid hsl(var(--track-bg) / 0.6)',
                              }}
                              onPointerDown={(e) => onBackgroundClipPointerDown(clip, e)}
                            >
                              <span className="absolute inset-0 flex items-center px-2 text-white drop-shadow truncate pointer-events-none">
                                Foto {index + 1}
                              </span>
                              <span
                                data-handle="left"
                                className="studio-timeline-handle absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 group-hover:bg-white/50 touch-none"
                              />
                              <span
                                data-handle="right"
                                className="studio-timeline-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 group-hover:bg-white/50 touch-none"
                              />
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => audio.seek(clip.start)}>Ir al inicio de la imagen</ContextMenuItem>
                            <ContextMenuItem onClick={() => duplicateBackgroundClip(clip.id)}>Duplicar</ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem className="text-destructive" onClick={() => deleteBackgroundClip(clip.id)}>
                              Quitar de la línea de tiempo
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })
                  ) : (
                    <div
                      className="absolute rounded-md flex items-center px-2 text-xs text-muted-foreground pointer-events-none"
                      style={{
                        left: 0,
                        width: Math.max(duration * pxPerSec, 220),
                        top: 4,
                        bottom: 4,
                        border: '1px dashed hsl(var(--track-bg) / 0.5)',
                      }}
                    >
                      Arrastra aquí una imagen desde el panel Fondo
                    </div>
                  )
                ) : (
                  <div
                    className="absolute rounded-md flex items-center px-2 text-xs pointer-events-none"
                    style={{
                      left: 0,
                      width: duration * pxPerSec,
                      top: 4,
                      bottom: 4,
                      background: 'hsl(var(--track-bg) / 0.2)',
                      border: '1px solid hsl(var(--track-bg) / 0.5)',
                    }}
                  >
                    {backgroundLabel}
                  </div>
                )}
              </div>
            </TrackRow>

            <TrackRow height={TRACK_H} color="hsl(var(--track-effect) / 0.1)">
              {settings?.effects.vignette && (
                <div
                  className="absolute rounded-md flex items-center px-2 text-xs"
                  style={{
                    left: 0,
                    width: duration * pxPerSec,
                    top: 4,
                    bottom: 4,
                    background: 'hsl(var(--track-effect) / 0.2)',
                    border: '1px solid hsl(var(--track-effect) / 0.5)',
                  }}
                >
                  Viñeta · Partículas · Fugas de luz
                </div>
              )}
            </TrackRow>

            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none z-20"
              style={{ left: playheadTime * pxPerSec }}
            >
              <div className="absolute -top-0 -left-1.5 w-3 h-3 bg-primary rounded-sm rotate-45" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackLabel({
  icon: Icon,
  label,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  color: string;
}) {
  return (
    <div className="studio-track-label flex items-center gap-2 px-3 border-b border-border" style={{ height: TRACK_H }}>
      <Icon className="h-4 w-4 shrink-0" style={{ color }} />
      <span className="text-xs font-medium truncate">{label}</span>
    </div>
  );
}

function TrackRow({
  children,
  height,
  color,
}: {
  children: React.ReactNode;
  height: number;
  color: string;
}) {
  return (
    <div className="relative border-b border-border" style={{ height, background: color }}>
      {children}
    </div>
  );
}
