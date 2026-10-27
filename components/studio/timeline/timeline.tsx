'use client';

import { useRef, useState, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import { Music, Plus, ZoomIn, ZoomOut, Copy, Trash2 } from 'lucide-react';
import { ReelDialog } from '../reel-dialog';
import { TimelineClip } from './timeline-clip';
import { WaveformDisplay } from './waveform-display';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { generateWaveformPeaks } from '@/lib/waveform';
import { formatTime } from '@/lib/format';
import { editTimeRange, pointerTime, snapToPlayhead, type EditMode, type TimeRange } from '@/lib/timeline-edit';
import { Button } from '@/components/ui/button';
import type { BackgroundImageClip } from '@/lib/types';

type Track = 'lyrics' | 'imageClips' | 'photoClips';
type Selection = { track: Track; id: string };
const IMAGE_DRAG_TYPE = 'application/x-sonceibe-image-index';
const ROW_HEIGHT = 44;

export function Timeline() {
  const { currentProject, updateLyric, addLyric, deleteLyric, duplicateLyric, updateBackground, updateSettings, setTab } = useStore();
  const audio = useAudioEngineContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ time: number; pixel: number } | null>(null);
  const [pxPerSec, setPxPerSec] = useState(20);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [snap, setSnap] = useState(true);
  const [reelEnabled, setReelEnabled] = useState(Boolean(currentProject?.settings.reel));
  const settings = currentProject?.settings;
  const duration = audio.duration || settings?.audioDuration || 0;
  const reel = settings?.reel || { start: 0, end: Math.min(30, duration), coverUrl: '', showLyrics: true, showTitle: true };
  const reelRange = editTimeRange(reel, 'move', 0, duration);
  function changeReel(range: TimeRange) {
    updateSettings({ reel: { ...reel, ...range } });
  }
  function enableReel() {
    const next = !reelEnabled;
    setReelEnabled(next);
    if (next) {
      changeReel(settings?.reel ? reelRange : editTimeRange({ start: audio.currentTime, end: audio.currentTime + Math.min(30, duration) }, 'move', 0, duration));
      setSelection(null);
    }
  }
  const lyrics = settings?.lyrics ?? [];
  const imageClips = settings?.background.imageClips ?? [];
  const photoClips = settings?.background.photoClips ?? [];
  const manualImages = settings?.background.type === 'images' && settings.background.imageMode === 'manual';
  const clipsFor = (track: Track) => track === 'lyrics' ? lyrics : track === 'imageClips' ? imageClips : photoClips;
  const selected = selection ? clipsFor(selection.track).find(clip => clip.id === selection.id) : undefined;
  const visualDuration = Math.max(duration, ...lyrics.map(line => line.end), ...imageClips.map(clip => clip.end), ...photoClips.map(clip => clip.end), 1);
  const totalWidth = Math.max(visualDuration * pxPerSec + 24, viewportWidth);
  const peaks = useMemo(() => audio.audioBuffer ? generateWaveformPeaks(audio.audioBuffer, 2000) : [], [audio.audioBuffer]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewportWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const zoom = useCallback((value: number, pixel?: number) => {
    const element = scrollRef.current;
    if (element) {
      const playheadPixel = audio.currentTime * pxPerSec - element.scrollLeft;
      const focus = pixel ?? (playheadPixel >= 0 && playheadPixel <= element.clientWidth ? playheadPixel : element.clientWidth / 2);
      anchor.current = { time: (element.scrollLeft + focus) / pxPerSec, pixel: focus };
    }
    setPxPerSec(Math.max(0.25, Math.min(200, value)));
  }, [audio.currentTime, pxPerSec]);

  useLayoutEffect(() => {
    if (scrollRef.current && anchor.current) {
      scrollRef.current.scrollLeft = Math.max(0, anchor.current.time * pxPerSec - anchor.current.pixel);
      anchor.current = null;
    }
  }, [pxPerSec]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoom(pxPerSec * (event.deltaY < 0 ? 1.2 : 1 / 1.2), event.clientX - element.getBoundingClientRect().left);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [pxPerSec, zoom]);

  function change(item: Selection, patch: TimeRange) {
    if (item.track === 'lyrics') updateLyric(item.id, patch);
    else updateBackground({ [item.track]: (item.track === 'imageClips' ? imageClips : photoClips).map(clip => clip.id === item.id ? { ...clip, ...patch } : clip) });
  }
  function remove(item: Selection) {
    if (item.track === 'lyrics') deleteLyric(item.id);
    else updateBackground({ [item.track]: (item.track === 'imageClips' ? imageClips : photoClips).filter(clip => clip.id !== item.id) });
    setSelection(null);
  }
  function duplicate(item: Selection) {
    if (item.track === 'lyrics') { duplicateLyric(item.id); return; }
    const list = item.track === 'imageClips' ? imageClips : photoClips;
    const clip = list.find(value => value.id === item.id);
    if (!clip) return;
    const copy = { ...clip, ...editTimeRange(clip, 'move', clip.end - clip.start, duration), id: crypto.randomUUID() };
    updateBackground({ [item.track]: [...list, copy] });
    setSelection({ track: item.track, id: copy.id });
  }
  function adjust(mode: EditMode, delta: number) {
    if (selection && selected) change(selection, editTimeRange(selected, mode, delta, duration));
  }
  function renderClips(track: Track) {
    return clipsFor(track).map((clip, index) => <TimelineClip key={clip.id} clip={clip}
      label={`${track === 'lyrics' ? 'Letra' : track === 'imageClips' ? 'Imagen múltiple' : 'Foto puntual'} ${index + 1}`}
      duration={duration} pxPerSec={pxPerSec} playhead={audio.currentTime} snap={snap}
      selected={selection?.track === track && selection.id === clip.id}
      onSelect={() => { setSelection({ track, id: clip.id }); if (track !== 'lyrics') setTab('background'); }}
      onSeek={() => audio.seek(clip.start)} onChange={patch => change({ track, id: clip.id }, patch)}
      onRemove={() => remove({ track, id: clip.id })} onDuplicate={() => duplicate({ track, id: clip.id })}
      onTextChange={track === 'lyrics' ? text => updateLyric(clip.id, { text }) : undefined} />);
  }
  const tickStep = pxPerSec < 2 ? 60 : pxPerSec < 10 ? 10 : pxPerSec < 40 ? 5 : 1;
  const ticks = Array.from({ length: Math.floor(visualDuration / tickStep) + 1 }, (_, index) => index * tickStep);
  const labels = ['Audio', 'Letra', 'Fondo', ...(photoClips.length ? ['Fotos puntuales'] : []), 'Efectos'];

  return <section aria-label="Línea de tiempo" className="studio-timeline shrink-0 flex flex-col border-t border-border bg-card/30">
    <div className="studio-timeline-header flex flex-wrap items-center justify-between gap-2 px-3 py-1 border-b border-border">
      <div className="flex items-center gap-2 text-sm"><Music className="h-4 w-4 text-primary" />Línea de Tiempo <span className="text-xs font-mono text-muted-foreground">{formatTime(audio.currentTime)} / {formatTime(duration)}</span></div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant={reelEnabled ? "default" : "outline"} className="h-7" disabled={duration < 0.2} aria-pressed={reelEnabled} onClick={enableReel}>Seleccionar Reel</Button>
        <Button size="sm" variant="ghost" className="h-7" aria-pressed={snap} onClick={() => setSnap(value => !value)} title="Ajustar los bordes al cursor de reproducción; Alt lo desactiva al arrastrar">Ajuste al cursor {snap ? '✓' : '—'}</Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Alejar timeline" onClick={() => zoom(pxPerSec / 1.5)}><ZoomOut className="h-4 w-4" /></Button>
        <input type="range" min={0.25} max={200} step={0.25} value={pxPerSec} aria-label="Zoom horizontal" className="w-20" onChange={event => zoom(Number(event.target.value))} />
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Acercar timeline" onClick={() => zoom(pxPerSec * 1.5)}><ZoomIn className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => { anchor.current = { time: 0, pixel: 0 }; setPxPerSec(Math.max(0.25, Math.min(200, (viewportWidth - 24) / visualDuration))); if (scrollRef.current) scrollRef.current.scrollLeft = 0; }}>Ver todo</Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, audio.currentTime * pxPerSec - viewportWidth / 2); }}>Ir al cursor</Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Añadir línea de letra" onClick={() => addLyric()}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
    {reelEnabled && <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs border-b border-primary/40 bg-primary/10" aria-label="Corte del Reel">
      <span>Arrastra los bordes del Reel sobre el audio</span>
      <Button size="sm" variant="outline" className="h-7" onClick={() => changeReel({ start: Math.min(audio.currentTime, duration - 0.2), end: audio.currentTime >= reelRange.end ? Math.min(duration, audio.currentTime + 30) : reelRange.end })}>Marcar inicio aquí</Button>
      <Button size="sm" variant="outline" className="h-7" onClick={() => changeReel({ start: audio.currentTime <= reelRange.start ? Math.max(0, audio.currentTime - 30) : reelRange.start, end: Math.max(0.2, audio.currentTime) })}>Marcar fin aquí</Button>
      <span className="font-mono" role="status">{formatTime(reelRange.start)} → {formatTime(reelRange.end)} · {(reelRange.end - reelRange.start).toFixed(1)} s</span>
      <ReelDialog key={currentProject?.id} fromTimeline />
    </div>}
    <div className="flex flex-wrap items-center gap-2 px-3 py-1 min-h-[36px] text-xs border-b border-border">
      {selected && selection ? <>
        <span>{selection.track === 'lyrics' ? 'Letra' : 'Foto'}</span>
        <TimeField key={`${selected.id}-start-${selected.start}`} label="Inicio" value={selected.start} onCommit={value => adjust('left', value - selected.start)} />
        <TimeField key={`${selected.id}-end-${selected.end}`} label="Final" value={selected.end} onCommit={value => adjust('right', value - selected.end)} />
        <Button size="sm" variant="outline" className="h-6" onClick={() => adjust('move', -0.1)}>−0,1 s</Button>
        <Button size="sm" variant="outline" className="h-6" onClick={() => adjust('move', 0.1)}>+0,1 s</Button>
        <Button size="sm" variant="ghost" className="h-6" onClick={() => adjust('left', audio.currentTime - selected.start)}>Inicio al cursor</Button>
        <Button size="sm" variant="ghost" className="h-6" onClick={() => adjust('right', audio.currentTime - selected.end)}>Final al cursor</Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Duplicar selección" onClick={() => duplicate(selection)}><Copy className="h-3 w-3" /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Eliminar selección" onClick={() => remove(selection)}><Trash2 className="h-3 w-3" /></Button>
      </> : <span className="text-muted-foreground">Selecciona una letra o foto. ← →: 0,1 s · Shift: 0,5 s · Alt: 0,01 s. Los bordes también admiten teclado.</span>}
    </div>
    <div className="flex min-h-0">
      <div className="studio-timeline-labels shrink-0 border-r border-border w-[120px]">
        <div className="h-7 border-b border-border" />
        {labels.map(label => <div key={label} className="flex items-center px-3 text-xs border-b border-border" style={{ height: ROW_HEIGHT }}>{label}</div>)}
      </div>
      <div ref={scrollRef} className="studio-timeline-scroll flex-1 min-w-0 overflow-x-auto scrollbar-thin relative touch-pan-x">
        <div style={{ width: totalWidth, position: 'relative' }}>
          <div role="slider" aria-label="Cursor de reproducción" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={audio.currentTime} tabIndex={0}
            className="relative h-7 border-b border-border bg-card/50 cursor-pointer select-none touch-none"
            onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); audio.seek(Math.max(0, Math.min(duration, audio.currentTime + (event.key === 'ArrowLeft' ? -1 : 1) * 0.1))); } }}
            onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); audio.seek(pointerTime(event.clientX, event.currentTarget.getBoundingClientRect().left, pxPerSec, duration)); }}
            onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) audio.seek(pointerTime(event.clientX, event.currentTarget.getBoundingClientRect().left, pxPerSec, duration)); }}
            onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
            {ticks.map(time => <span key={time} className="absolute top-0 h-full border-l border-border pl-1 text-[10px] text-muted-foreground pointer-events-none" style={{ left: time * pxPerSec }}>{formatTime(time)}</span>)}
          </div>
          <TrackRow><div className="absolute inset-0 cursor-pointer" onPointerDown={event => { if (event.button === 0) audio.seek(pointerTime(event.clientX, event.currentTarget.getBoundingClientRect().left, pxPerSec, duration)); }}>{peaks.length ? <WaveformDisplay peaks={peaks} width={duration * pxPerSec} height={36} playheadRatio={duration ? audio.currentTime / duration : 0} /> : <p className="p-3 text-xs text-muted-foreground">{duration ? 'Audio del proyecto' : 'Importa un MP3 para ver la forma de onda'}</p>}</div>
            {reelEnabled && <TimelineClip clip={{ ...reelRange, id: 'reel-range', text: 'Reel · arrastra los bordes' }} label="Reel" duration={duration} pxPerSec={pxPerSec} playhead={audio.currentTime} snap={snap} selected
              onSelect={() => setSelection(null)} onSeek={() => audio.seek(reelRange.start)} onChange={changeReel} onRemove={() => setReelEnabled(false)} onDuplicate={() => {}} />}
          </TrackRow>
          <TrackRow>{renderClips('lyrics')}</TrackRow>
          <TrackRow><div className="absolute inset-0"
            onDragOver={event => { if (settings?.background.type === 'images') { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
            onDrop={event => {
              if (settings?.background.type !== 'images') return;
              event.preventDefault();
              const value = event.dataTransfer.getData(IMAGE_DRAG_TYPE);
              if (value === '' || !Number.isInteger(Number(value))) return;
              const url = settings.background.images[Number(value)];
              if (!url) return;
              let start = Math.max(0, (event.clientX - event.currentTarget.getBoundingClientRect().left) / pxPerSec);
              if (snap && !event.altKey) start = snapToPlayhead(start, audio.currentTime, pxPerSec);
              const range = editTimeRange({ start, end: start + Math.max(0.2, settings.background.imageDuration || 5) }, 'move', 0, duration);
              const clip: BackgroundImageClip = { id: crypto.randomUUID(), url, ...range };
              updateBackground({ imageMode: 'manual', imageClips: [...imageClips, clip] });
              setSelection({ track: 'imageClips', id: clip.id });
            }}>
            {manualImages ? imageClips.length ? renderClips('imageClips') : <p className="p-3 text-xs text-muted-foreground">Arrastra aquí una imagen desde el panel Fondo</p>
              : <p className="p-3 text-xs text-muted-foreground">{settings?.background.type === 'images' ? `Automático · ${settings.background.images.length} imágenes · ${settings.background.imageDuration}s` : settings?.background.type === 'image' ? 'Imagen fija' : settings?.background.type === 'gradient' ? 'Gradiente animado' : settings?.background.type === 'video' ? 'Vídeo' : 'Color sólido'}</p>}
          </div></TrackRow>
          {photoClips.length > 0 && <TrackRow>{renderClips('photoClips')}</TrackRow>}
          <TrackRow><p className="p-3 text-xs text-muted-foreground">{[settings?.effects.vignette && 'Viñeta', settings?.effects.particles && 'Partículas', settings?.effects.lightleaks && 'Fugas de luz'].filter(Boolean).join(' · ')}</p></TrackRow>
          <div className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none z-20" style={{ left: audio.currentTime * pxPerSec }}><div className="absolute left-[-5px] w-3 h-3 bg-primary rotate-45" /></div>
        </div>
      </div>
    </div>
  </section>;
}

function TrackRow({ children }: { children: React.ReactNode }) {
  return <div className="relative border-b border-border bg-secondary/10" style={{ height: ROW_HEIGHT }}>{children}</div>;
}
function TimeField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  return <label className="flex items-center gap-1">{label}<input type="number" aria-label={`${label} de selección`} defaultValue={Number(value.toFixed(3))} step="0.01" min="0" className="w-20 rounded border bg-background p-1"
    onBlur={event => { const next = event.currentTarget.valueAsNumber; if (Number.isFinite(next) && next !== value) onCommit(next); else event.currentTarget.value = String(value); }}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = String(value); event.currentTarget.blur(); } }} /> s</label>;
}
