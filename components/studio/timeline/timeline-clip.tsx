'use client';

import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { editTimeRange, type EditMode, type TimeRange } from '@/lib/timeline-edit';

interface Props {
  clip: TimeRange & { id: string; url?: string; text?: string };
  label: string; duration: number; pxPerSec: number; playhead: number; snap: boolean; selected: boolean;
  onSelect: () => void; onSeek: () => void; onChange: (patch: TimeRange) => void;
  onRemove: () => void; onDuplicate: () => void; onTextChange?: (text: string) => void;
}

export function TimelineClip({ clip, label, duration, pxPerSec, playhead, snap, selected, onSelect, onSeek, onChange, onRemove, onDuplicate, onTextChange }: Props) {
  const [draft, setDraft] = useState<TimeRange | null>(null);
  const [editing, setEditing] = useState(false);
  const cancelledEdit = useRef(false);
  const drag = useRef<{ x: number; pointer: number; mode: EditMode; range: TimeRange; latest: TimeRange; playhead: number; moved: boolean } | null>(null);
  const shown = draft ?? clip;
  const limit = duration > 0 ? duration : Math.max(clip.end + 60, 60);
  const nudge = (event: React.KeyboardEvent, mode: EditMode) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    onChange(editTimeRange(clip, mode, (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 0.5 : event.altKey ? 0.01 : 0.1), duration));
  };
  return <div role="group" aria-label={label} tabIndex={0} data-clip-id={clip.id}
    onFocus={onSelect}
    className={`absolute top-1 bottom-1 overflow-hidden rounded border border-primary/70 text-xs text-white cursor-grab touch-none select-none focus:outline-none focus:ring-2 focus:ring-primary focus-within:ring-2 focus-within:ring-primary ${selected ? 'ring-2 ring-primary' : ''}`}
    style={{ left: shown.start * pxPerSec, width: Math.max(24, (shown.end - shown.start) * pxPerSec), background: clip.url ? undefined : 'hsl(var(--track-lyrics) / 0.4)', backgroundImage: clip.url ? `linear-gradient(#0005,#0009),url("${clip.url}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: draft || selected ? 10 : 1 }}
    title={`${label} · ${shown.start.toFixed(2)}–${shown.end.toFixed(2)} s. Arrastra el centro o los bordes. Alt desactiva el ajuste.`}
    onDoubleClick={() => { if (onTextChange) { cancelledEdit.current = false; setEditing(true); } }}
    onPointerDown={event => {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button,input')) return;
      event.preventDefault(); event.stopPropagation();
      (event.target as HTMLElement).focus(); onSelect();
      const handle = (event.target as HTMLElement).dataset.handle;
      const mode: EditMode = handle === 'left' || handle === 'right' ? handle : 'move';
      if (mode === 'move') event.currentTarget.focus();
      drag.current = { x: event.clientX, pointer: event.pointerId, mode, range: { start: clip.start, end: clip.end }, latest: { start: clip.start, end: clip.end }, playhead, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const state = drag.current;
      if (!state || event.pointerId !== state.pointer) return;
      if (Math.abs(event.clientX - state.x) > 2) state.moved = true;
      if (!state.moved) return;
      state.latest = editTimeRange(state.range, state.mode, (event.clientX - state.x) / pxPerSec, duration, snap && !event.altKey ? { playhead: state.playhead, pxPerSec } : undefined);
      setDraft(state.latest);
    }}
    onPointerUp={event => {
      const state = drag.current;
      if (!state || event.pointerId !== state.pointer) return;
      drag.current = null; setDraft(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (state.moved && (state.latest.start !== clip.start || state.latest.end !== clip.end)) onChange(state.latest);
      else if (!state.moved) onSeek();
    }}
    onPointerCancel={() => { drag.current = null; setDraft(null); }}
    onLostPointerCapture={() => { drag.current = null; setDraft(null); }}
    onKeyDown={event => {
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); drag.current = null; setDraft(null); }
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); onRemove(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); event.stopPropagation(); onDuplicate(); }
      nudge(event, 'move');
    }}>
    {editing ? <input autoFocus aria-label="Texto de la línea" defaultValue={clip.text} className="absolute left-2 right-2 z-20 w-[calc(100%-16px)] bg-background text-foreground"
      onBlur={event => { if (!cancelledEdit.current) onTextChange?.(event.target.value); setEditing(false); }}
      onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { cancelledEdit.current = true; setEditing(false); } }} />
      : <span className="pointer-events-none absolute inset-y-0 left-3 right-7 flex items-center truncate">{clip.text ?? label}</span>}
    <button type="button" aria-label={`Eliminar ${label}`} title="Eliminar" className="absolute right-2 top-0 z-10 flex h-5 w-5 items-center justify-center rounded bg-black/65 hover:bg-red-700" onClick={event => { event.stopPropagation(); onRemove(); }}><X className="h-3 w-3" /></button>
    <span data-handle="left" role="slider" tabIndex={0} onKeyDown={event => nudge(event, 'left')} aria-label={`Inicio de ${label}`} aria-valuemin={0} aria-valuemax={Math.max(0, shown.end - 0.2)} aria-valuenow={shown.start} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-white/40 hover:bg-primary" />
    <span data-handle="right" role="slider" tabIndex={0} onKeyDown={event => nudge(event, 'right')} aria-label={`Final de ${label}`} aria-valuemin={shown.start + 0.2} aria-valuemax={limit} aria-valuenow={shown.end} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/40 hover:bg-primary" />
  </div>;
}
