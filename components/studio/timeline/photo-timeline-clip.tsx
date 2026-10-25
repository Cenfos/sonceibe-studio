'use client';

import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { BackgroundImageClip } from '@/lib/types';

interface Props { clip: BackgroundImageClip; index: number; duration: number; pxPerSec: number; snap: boolean; onSelect: () => void; onChange: (patch: Pick<BackgroundImageClip, 'start' | 'end'>) => void; onRemove: () => void }

export function PhotoTimelineClip({ clip, index, duration, pxPerSec, snap, onSelect, onChange, onRemove }: Props) {
  const [draft, setDraft] = useState<Pick<BackgroundImageClip, 'start' | 'end'> | null>(null);
  const drag = useRef<{ x: number; start: number; end: number; mode: string; latest: Pick<BackgroundImageClip, 'start' | 'end'> } | null>(null);
  const shown = draft ?? clip;
  const limit = duration > 0 ? duration : Math.max(clip.end + 60, 60);
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const name = 'Foto puntual ' + (index + 1);
  function move(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;
    const delta = (event.clientX - state.x) / pxPerSec;
    const round = (n: number) => snap ? Math.round(n / 0.5) * 0.5 : Math.round(n * 100) / 100;
    let start = state.start, end = state.end;
    if (state.mode === 'left') start = clamp(round(state.start + delta), 0, end - 0.2);
    else if (state.mode === 'right') end = clamp(round(state.end + delta), start + 0.2, limit);
    else { const length = end - start; start = clamp(round(start + delta), 0, Math.max(0, limit - length)); end = start + length; }
    state.latest = { start, end }; setDraft(state.latest);
  }
  function resizeWithKeys(event: React.KeyboardEvent<HTMLSpanElement>, edge: 'start' | 'end') {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault(); event.stopPropagation();
    const delta = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 0.5 : 0.1);
    if (edge === 'start') onChange({ start: clamp(clip.start + delta, 0, clip.end - 0.2), end: clip.end });
    else onChange({ start: clip.start, end: clamp(clip.end + delta, clip.start + 0.2, limit) });
  }
  return <div role="group" aria-label={name} tabIndex={0}
    className="absolute top-1 bottom-1 overflow-hidden rounded border border-primary/70 bg-primary/20 text-xs text-white cursor-grab touch-none select-none focus:outline-none focus:ring-2 focus:ring-primary focus-within:ring-2 focus-within:ring-primary"
    style={{ left: shown.start * pxPerSec, width: Math.max(24, (shown.end - shown.start) * pxPerSec), backgroundImage: `linear-gradient(#0005,#0009),url("${clip.url}")`, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: draft ? 20 : 1 }}
    title={name + ' · ' + shown.start.toFixed(1) + '–' + shown.end.toFixed(1) + ' s. Arrastra el centro para mover; los bordes para cambiar duración. Supr elimina.'}
    onPointerDown={event => {
      if ((event.target as HTMLElement).closest('[data-remove]')) return;
      event.preventDefault(); event.stopPropagation(); event.currentTarget.focus(); onSelect();
      const mode = (event.target as HTMLElement).dataset.handle ?? 'move';
      drag.current = { x: event.clientX, start: clip.start, end: clip.end, mode, latest: { start: clip.start, end: clip.end } };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={move}
    onPointerUp={event => {
      if (!drag.current) return;
      const next = drag.current.latest; drag.current = null; setDraft(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (next.start !== clip.start || next.end !== clip.end) onChange(next);
    }}
    onPointerCancel={() => { drag.current = null; setDraft(null); }}
    onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); onRemove(); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); event.stopPropagation(); const length = clip.end - clip.start;
        const start = clamp(clip.start + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 0.5 : 0.1), 0, Math.max(0, limit - length));
        onChange({ start, end: start + length });
      }
    }}>
    <span className="pointer-events-none absolute inset-y-0 left-3 right-7 flex items-center truncate">Foto {index + 1}</span>
    <button data-remove type="button" aria-label={'Eliminar ' + name.toLowerCase()} title="Eliminar foto" className="absolute right-2 top-0 z-10 flex h-5 w-5 items-center justify-center rounded bg-black/65 hover:bg-red-700" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onRemove(); }}><X className="h-3 w-3" /></button>
    <span data-handle="left" role="slider" tabIndex={0} onKeyDown={event => resizeWithKeys(event, 'start')} aria-label={'Inicio de ' + name.toLowerCase()} aria-valuemin={0} aria-valuemax={shown.end - 0.2} aria-valuenow={shown.start} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-white/40 hover:bg-primary" />
    <span data-handle="right" role="slider" tabIndex={0} onKeyDown={event => resizeWithKeys(event, 'end')} aria-label={'Final de ' + name.toLowerCase()} aria-valuemin={shown.start + 0.2} aria-valuemax={limit} aria-valuenow={shown.end} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/40 hover:bg-primary" />
  </div>;
}
