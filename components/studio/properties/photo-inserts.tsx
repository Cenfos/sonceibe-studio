'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { BackgroundImageClip } from '@/lib/types';

export function PhotoInserts({ prepareImage }: { prepareImage: (file: File) => Promise<string> }) {
  const { currentProject, updateBackground } = useStore();
  const audio = useAudioEngineContext();
  const [busy, setBusy] = useState(false);
  if (!currentProject) return null;
  const bg = currentProject.settings.background;
  const clips = bg.photoClips ?? [];
  const duration = audio.duration || currentProject.settings.audioDuration || 0;
  function updateTime(id: string, field: 'start' | 'end', input: HTMLInputElement) {
    const value = input.valueAsNumber;
    const clip = clips.find(item => item.id === id);
    if (!clip) return;
    const candidate = { ...clip, [field]: value };
    if (!Number.isFinite(value) || candidate.start < 0 || candidate.end <= candidate.start || (duration > 0 && candidate.end > duration)) {
      input.value = String(clip[field]); toast.error('El final debe ser posterior al inicio y estar dentro de la canción.'); return;
    }
    updateBackground({ photoClips: clips.map(item => item.id === id ? candidate : item) });
  }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    setBusy(true);
    const start = Math.max(0, Math.min(audio.currentTime, duration - 0.2));
    try {
      const urls = await Promise.all(files.map(prepareImage));
      const added: BackgroundImageClip[] = urls.map((url, i) => ({ id: crypto.randomUUID(), url, start: Math.min(start + i * 5, Math.max(0, duration - 0.2)), end: Math.min(duration, start + (i + 1) * 5) }));
      updateBackground({ photoClips: [...clips, ...added] });
      toast.success('Fotos añadidas. Ajusta el inicio y el final en segundos.');
    } catch { toast.error('No se pudieron cargar las fotos.'); }
    finally { setBusy(false); input.value = ''; }
  }
  return <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
    <h3 className="text-sm font-semibold">Fotos puntuales ({clips.length})</h3>
    <p className="text-xs leading-5 text-muted-foreground">Añade una foto durante un punteo o un tramo instrumental. Fuera de sus segundos vuelve el fondo habitual. El título, la letra y el logo conservan sus ajustes.</p>
    <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary">
      {busy ? 'Preparando fotos…' : 'Añadir fotos en este momento'}
      <input aria-label="Añadir fotos puntuales" type="file" accept="image/*" multiple disabled={busy || duration <= 0} className="sr-only" onChange={upload} />
    </label>
    {duration <= 0 && <p className="text-xs text-muted-foreground">Carga primero la música para elegir los segundos.</p>}
    {clips.length === 0 && <p className="text-xs text-muted-foreground">Las fotos que añadas aparecerán aquí con su miniatura y sus tiempos.</p>}
    {clips.length > 0 && <div className="flex flex-wrap gap-2"><Button size="sm" variant={(bg.imageFit ?? 'contain') === 'contain' ? 'default' : 'outline'} onClick={() => updateBackground({ imageFit: 'contain' })}>Ver foto completa</Button><Button size="sm" variant={bg.imageFit === 'cover' ? 'default' : 'outline'} onClick={() => updateBackground({ imageFit: 'cover' })}>Llenar pantalla</Button></div>}
    {clips.map((clip, i) => <div key={clip.id} id={'photo-insert-' + clip.id} className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-3"><img src={clip.url} alt={'Foto puntual ' + (i + 1)} className="h-14 w-20 rounded object-contain bg-black" /><span className="flex-1 text-sm font-medium">Foto {i + 1}</span><Button size="sm" variant="ghost" onClick={() => updateBackground({ photoClips: clips.filter(item => item.id !== clip.id) })} aria-label={'Quitar foto ' + (i + 1)}>Quitar</Button></div>
      <div className="grid grid-cols-2 gap-3">{(['start', 'end'] as const).map(field => <label key={field} className="space-y-1 text-xs">{field === 'start' ? 'Inicio (segundos)' : 'Final (segundos)'}<input key={clip[field]} aria-label={(field === 'start' ? 'Inicio foto ' : 'Final foto ') + (i + 1)} type="number" min={0} max={duration || undefined} step={0.1} defaultValue={clip[field]} onBlur={e => updateTime(clip.id, field, e.currentTarget)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} className="block w-full rounded border border-border bg-background px-2 py-2 text-sm" /></label>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Duración: {(clip.end - clip.start).toFixed(1)} s</span><Button variant="outline" size="sm" onClick={() => audio.seek(clip.start)}>Ver este momento</Button></div>
    </div>)}
    {clips.length > 1 && <p className="text-xs text-muted-foreground">Si dos fotos coinciden, se muestra la última añadida.</p>}
  </section>;
}
