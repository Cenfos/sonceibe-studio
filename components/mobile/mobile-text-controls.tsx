'use client';
import { useStore } from '@/lib/store';

export function MobileTextControls() {
  const { currentProject, updateText, updateSettings } = useStore();
  if (!currentProject) return null;
  const { text, showTitle } = currentProject.settings;
  return <section aria-label="Ajustes sencillos del texto" className="space-y-4 rounded-xl border border-border bg-card p-4">
    <h2 className="text-sm font-semibold">Texto y título</h2>
    <label className="block space-y-2 text-sm">Tamaño de la letra · {text.fontSize}<input aria-label="Tamaño de la letra" type="range" min={20} max={140} step={1} value={text.fontSize} onChange={e => updateText({ fontSize: Number(e.target.value) })} className="block min-h-11 w-full accent-primary" /></label>
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm">Color de la letra<input aria-label="Color de la letra" type="color" value={/^#[0-9a-f]{6}$/i.test(text.color) ? text.color : '#ffffff'} onChange={e => updateText({ color: e.target.value })} className="h-11 w-16 rounded border border-border bg-background p-1" /></label>
    <label className="block space-y-2 text-sm">Posición de la letra<select aria-label="Posición de la letra" value={text.position} onChange={e => updateText({ position: e.target.value as 'top' | 'center' | 'bottom' })} className="block min-h-11 w-full rounded border border-border bg-background p-2 text-base"><option value="top">Arriba</option><option value="center">Centro</option><option value="bottom">Abajo</option></select></label>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={showTitle !== false} onChange={e => updateSettings({ showTitle: e.target.checked })} className="h-5 w-5 accent-primary" />Mostrar título de la canción</label>
    <p className="text-xs leading-5 text-muted-foreground">Comprueba el resultado con Ver proyecto. Se guarda y se aplica al vídeo exportado. Si eliges otro estilo preparado, revisa de nuevo estos ajustes.</p>
  </section>;
}
