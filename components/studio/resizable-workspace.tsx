'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const STORAGE_KEY = 'sonceibe-workspace-height-ratio';
const HANDLE_HEIGHT = 12;
export function ResizableWorkspace({ editor, timeline }: { editor: ReactNode; timeline: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const [available, setAvailable] = useState(800);
  const [timelineLimit, setTimelineLimit] = useState(400);
  const [ratio, setRatio] = useState(1);
  useEffect(() => {
    try { const saved = Number(localStorage.getItem(STORAGE_KEY)); if (saved > 0 && saved <= 1) setRatio(saved); } catch {}
    const element = root.current;
    if (!element) return;
    const measure = () => {
      setAvailable(element.clientHeight);
      const section = element.querySelector<HTMLElement>('.studio-timeline');
      const tracks = element.querySelector<HTMLElement>('.studio-timeline-tracks');
      const count = element.querySelector('.studio-timeline-labels')?.children.length;
      if (section && tracks && count) {
        const chrome = section.offsetHeight - tracks.offsetHeight;
        setTimelineLimit(chrome + 28 + (count - 1) * 56);
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const section = element.querySelector('.studio-timeline');
    if (section) observer.observe(section);
    const tracks = element.querySelector('.studio-timeline-tracks');
    if (tracks) observer.observe(tracks);
    const changes = new MutationObserver(measure);
    if (section) changes.observe(section, { childList: true });
    const labels = element.querySelector('.studio-timeline-labels');
    if (labels) changes.observe(labels, { childList: true });
    measure();
    return () => { observer.disconnect(); changes.disconnect(); };
  }, []);
  const maximum = Math.max(180, available - HANDLE_HEIGHT);
  const minimum = Math.max(Math.round(maximum / 2), maximum - timelineLimit);
  const height = Math.round(Math.max(minimum, Math.min(maximum, ratio * available - HANDLE_HEIGHT)));
  const resize = (next: number) => {
    const value = (Math.max(minimum, Math.min(maximum, next)) + HANDLE_HEIGHT) / Math.max(1, available);
    setRatio(value);
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch {}
  };
  return <div ref={root} className="studio-workspace-scroll flex-1 min-h-0 overflow-y-scroll overscroll-contain">
    <div className="studio-main-workspace flex min-h-0 shrink-0" style={{ height }}>{editor}</div>
    <div role="separator" aria-label="Ajustar altura de la línea de tiempo" aria-orientation="horizontal" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={height} tabIndex={0}
      className="studio-timeline-resizer sticky top-0 z-30 flex h-3 cursor-row-resize touch-none items-center justify-center border-y border-border bg-card hover:bg-primary/25 focus-visible:bg-primary/25 focus-visible:outline-none"
      title="Arrastra arriba o abajo para repartir el espacio. Flechas para ajustar; doble clic para desplegar o ampliar la vista previa."
      onDoubleClick={() => resize(height > maximum * 0.85 ? maximum * 0.65 : maximum)}
      onKeyDown={event => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); resize(height + (event.key === 'ArrowUp' ? -32 : 32)); }
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); resize(event.key === 'Home' ? minimum : maximum); }
      }}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); drag.current = { y: event.clientY, height }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (drag.current) resize(drag.current.height + event.clientY - drag.current.y); }}
      onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
    ><span className="h-1 w-16 rounded-full bg-muted-foreground/60" /></div>
    <div style={{ '--timeline-min-height': Math.max(0, available - height - HANDLE_HEIGHT) + 'px' } as CSSProperties}>{timeline}</div>
  </div>;
}
