'use client';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { Button } from '@/components/ui/button';
import { ReelDialog } from './reel-dialog';
import { usePreviewOptions } from './preview/preview-options';
import { Maximize2, ZoomIn, ZoomOut, ShieldCheck } from 'lucide-react';

export function EditingScope() {
  const { currentProject, updateSettings, updateExport } = useStore();
  const { zoom, setZoom, showSafeZone, setShowSafeZone } = usePreviewOptions();
  const audio = useAudioEngineContext();
  const settings = currentProject?.settings;
  if (!settings) return null;
  const reel = settings.reel;
  const selected = !!reel && settings.editingTarget !== 'full';
  const portrait = selected || settings.exportConfig.orientation === 'portrait';
  const select = (target: 'reel' | 'full') => {
    audio.pause(); updateSettings({ editingTarget: target });
    audio.seek(target === 'reel' && reel ? reel.start : 0);
  };
  const format = (orientation: 'landscape' | 'portrait') => {
    if (selected) select('full');
    updateExport({ orientation, resolution: '1080p', fps: 30 });
  };
  return <section aria-label="Formato y contenido en edición" className="shrink-0 space-y-2 border-b border-border bg-card/30 p-3">
    <div className="flex flex-wrap items-center gap-1">
      <Button size="sm" variant={!selected && !portrait ? 'default' : 'outline'} aria-pressed={!selected && !portrait} onClick={() => format('landscape')}>PC</Button>
      <Button size="sm" variant={!selected && portrait ? 'default' : 'outline'} aria-pressed={!selected && portrait} onClick={() => format('portrait')}>Móvil</Button>
      <ReelDialog label="Reel" triggerVariant={selected ? 'default' : 'outline'} />
      <span className="ml-auto text-[11px] text-muted-foreground">{portrait ? '1080×1920 · 9:16' : '1920×1080 · 16:9'}</span>
      <details className="relative ml-auto" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false; }} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.stopPropagation(); } }}><summary className="cursor-pointer rounded border border-border px-2 py-1.5 text-xs">Vista y edición</summary><div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[85vw] space-y-3 rounded-lg border border-border bg-card p-3 shadow-xl">
    <div aria-label="Contenido en edición" className="flex flex-wrap items-center gap-1">
      <Button size="sm" className="h-7 text-xs" variant={!selected ? 'secondary' : 'ghost'} aria-pressed={!selected} onClick={() => select('full')}>Canción completa</Button>
      {reel && <Button size="sm" className="h-7 text-xs" variant={selected ? 'secondary' : 'ghost'} aria-pressed={selected} onClick={() => select('reel')}>Reel · {reel.start.toFixed(1)}–{reel.end.toFixed(1)} s</Button>}
    </div>
    {selected && <div className="flex flex-wrap gap-1"><ReelDialog label="Volver a la guía del Reel" /><ReelDialog label="Ajustes avanzados del Reel" initialManual /></div>}
    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => document.querySelector('.studio-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver línea de tiempo ↓</Button>
    <div className="flex flex-wrap items-center gap-1" aria-label="Opciones de vista previa">
      <Button variant={showSafeZone ? 'secondary' : 'ghost'} size="sm" className="h-7 gap-1 px-2 text-xs" aria-pressed={showSafeZone} onClick={() => setShowSafeZone(value => !value)}><ShieldCheck className="h-3.5 w-3.5" />Zona segura</Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Reducir vista previa" onClick={() => setZoom(value => Math.max(0.25, value - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
      <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ampliar vista previa" onClick={() => setZoom(value => Math.min(2, value + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Vista previa a pantalla completa" onClick={() => window.dispatchEvent(new Event('sonceibe:preview-fullscreen'))}><Maximize2 className="h-4 w-4" /></Button>
    </div>
      </div></details>
    </div>
    <p role="status" className="text-xs font-medium">{selected && reel
      ? `Editando Reel · ${reel.start.toFixed(1)}–${reel.end.toFixed(1)} s · ${(reel.end - reel.start).toFixed(1)} s`
      : `Editando canción completa · ${(audio.duration || settings.audioDuration).toFixed(1)} s`}</p>
  </section>;
}
