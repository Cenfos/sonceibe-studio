'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { formatTime } from '@/lib/format';
import { generateWaveformPeaks } from '@/lib/waveform';
import { WaveformDisplay } from './waveform-display';
import { cn } from '@/lib/utils';
import { Music, FileText, Image, Wand2, Plus, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
const SNAP_INTERVAL = 0.5; // seconds

function snapTime(t: number): number {
  return Math.round(t / SNAP_INTERVAL) * SNAP_INTERVAL;
}

export function Timeline() {
  const { currentProject, updateLyric, addLyric, deleteLyric, duplicateLyric } = useStore();
  const audio = useAudioEngineContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerSec, setPxPerSec] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const settings = currentProject?.settings;
  const duration = audio.duration || settings?.audioDuration || 0;
  const lyrics = settings?.lyrics || [];
  const playheadTime = audio.currentTime;

  const waveformPeaks = useMemo(() => {
    if (audio.audioBuffer) {
      return generateWaveformPeaks(audio.audioBuffer, 2000);
    }
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

  // Playhead drag
  const onRulerMouseDown = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const update = (clientX: number) => {
      const x = clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
      const t = Math.max(0, Math.min(duration, x / pxPerSec));
      audio.seek(t);
    };
    update(e.clientX);
    const move = (ev: MouseEvent) => update(ev.clientX);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onClipClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedId(id);
    const line = lyrics.find((l) => l.id === id);
    if (line) audio.seek(line.start);
  };

  // Mouse wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setPxPerSec((p) => Math.max(5, Math.min(100, p - Math.sign(e.deltaY) * 5)));
    }
  };

  // Clip drag with snapping
  const onClipMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedId(id);
    const line = lyrics.find((l) => l.id === id);
    if (!line) return;
    const startX = e.clientX;
    const origStart = line.start;
    const origEnd = line.end;
    const mode = (e.target as HTMLElement).dataset.handle;

    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / pxPerSec;
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
        let newStart = Math.max(0, Math.min(duration - len, origStart + dx));
        if (snapEnabled) newStart = snapTime(newStart);
        updateLyric(id, { start: newStart, end: newStart + len });
      }
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="h-64 shrink-0 flex flex-col border-t border-border bg-card/30">
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Music className="h-4 w-4 text-primary" />
          Línea de Tiempo
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2 font-mono">
            {formatTime(playheadTime)} / {formatTime(duration)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] gap-1"
            onClick={() => setSnapEnabled(!snapEnabled)}
            title="Activar/desactivar ajuste"
          >
            <span className={snapEnabled ? 'text-primary' : 'text-muted-foreground'}>Snap</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPxPerSec((p) => Math.max(5, p - 5))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPxPerSec((p) => Math.min(100, p + 5))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => addLyric()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tracks */}
      <div className="flex-1 flex min-h-0">
        {/* Track labels */}
        <div className="shrink-0 border-r border-border" style={{ width: TRACK_LABEL_W }}>
          {/* Ruler spacer */}
          <div style={{ height: RULER_H }} className="border-b border-border bg-card/50" />
          {/* Audio track label */}
          <TrackLabel icon={Music} label="Audio" color="hsl(var(--track-audio))" />
          {/* Lyrics track label */}
          <TrackLabel icon={FileText} label="Letra" color="hsl(var(--track-lyrics))" />
          {/* Background track label */}
          <TrackLabel icon={Image} label="Fondo" color="hsl(var(--track-bg))" />
          {/* Effects track label */}
          <TrackLabel icon={Wand2} label="Efectos" color="hsl(var(--track-effect))" />
        </div>

        {/* Scrollable track area */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto scrollbar-thin relative" onWheel={onWheel}>
          <div style={{ width: totalWidth, position: 'relative' }}>
            {/* Ruler */}
            <div
              className="relative border-b border-border bg-card/50 cursor-pointer select-none"
              style={{ height: RULER_H }}
              onMouseDown={onRulerMouseDown}
            >
              {rulerTicks().map((tick) => (
                <div
                  key={tick.time}
                  className="absolute top-0 bottom-0"
                  style={{ left: tick.time * pxPerSec }}
                >
                  <div
                    className={cn(
                      'w-px bg-border',
                      tick.major ? 'h-full' : 'h-1/2'
                    )}
                  />
                  {tick.major && (
                    <span className="absolute top-1 left-1 text-[10px] text-muted-foreground font-mono">
                      {formatTime(tick.time)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Audio track */}
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
                    width={duration * pxPerSec - 4}
                    height={TRACK_H - 8}
                    playheadRatio={duration > 0 ? playheadTime / duration : 0}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-xs text-muted-foreground">
                    {duration === 0
                      ? 'Importa un MP3 para ver la forma de onda'
                      : 'Decodificando audio...'}
                  </div>
                )}
              </div>
            </TrackRow>

            {/* Lyrics track */}
            <TrackRow height={TRACK_H} color="hsl(var(--track-lyrics) / 0.1)">
              {lyrics.map((line) => {
                const left = line.start * pxPerSec;
                const width = (line.end - line.start) * pxPerSec;
                const selected = selectedId === line.id;
                const isPlaying = playheadTime >= line.start && playheadTime <= line.end && line.start > 0;
                return (
                  <ContextMenu key={line.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        className={cn(
                          'absolute rounded-md flex items-center px-2 cursor-grab active:cursor-grabbing overflow-hidden text-xs font-medium group',
                          selected
                            ? 'ring-2 ring-primary z-10'
                            : 'hover:ring-1 hover:ring-primary/50',
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
                        onMouseDown={(e) => onClipMouseDown(line.id, e)}
                        onClick={(e) => onClipClick(line.id, e)}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingClipId(line.id); setSelectedId(line.id); }}
                      >
                        {editingClipId === line.id ? (
                          <input
                            autoFocus
                            type="text"
                            defaultValue={line.text}
                            onBlur={(e) => { updateLyric(line.id, { text: e.target.value }); setEditingClipId(null); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { updateLyric(line.id, { text: (e.target as HTMLInputElement).value }); setEditingClipId(null); }
                              if (e.key === 'Escape') setEditingClipId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full bg-background border border-primary rounded px-1 text-xs outline-none"
                          />
                        ) : (
                          <span className="truncate flex-1">{line.text || '...'}</span>
                        )}
                        <span
                          data-handle="left"
                          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-primary/0 group-hover:bg-primary/40"
                        />
                        <span
                          data-handle="right"
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-primary/0 group-hover:bg-primary/40"
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => duplicateLyric(line.id)}>
                        Duplicar
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => { const t = audio.currentTime; updateLyric(line.id, { start: t, end: t + 4 }); }}>
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

            {/* Background track */}
            <TrackRow height={TRACK_H} color="hsl(var(--track-bg) / 0.1)">
              <div
                className="absolute rounded-md flex items-center px-2 text-xs"
                style={{
                  left: 0,
                  width: duration * pxPerSec,
                  top: 4,
                  bottom: 4,
                  background: 'hsl(var(--track-bg) / 0.2)',
                  border: '1px solid hsl(var(--track-bg) / 0.5)',
                }}
              >
                {settings?.background.type === 'gradient'
                  ? 'Gradiente animado'
                  : settings?.background.type === 'color'
                  ? 'Color sólido'
                  : settings?.background.type === 'image'
                  ? 'Imagen'
                  : settings?.background.type === 'images'
                  ? 'Múltiples imágenes'
                  : 'Video'}
              </div>
            </TrackRow>

            {/* Effects track */}
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

            {/* Playhead */}
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
    <div
      className="flex items-center gap-2 px-3 border-b border-border"
      style={{ height: TRACK_H }}
    >
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
    <div
      className="relative border-b border-border"
      style={{ height, background: color }}
    >
      {children}
    </div>
  );
}
