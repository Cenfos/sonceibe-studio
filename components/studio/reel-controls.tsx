'use client';

import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { markReelBoundary } from '@/lib/reel';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ReelControls() {
  const { currentProject, updateSettings } = useStore();
  const audio = useAudioEngineContext();
  const settings = currentProject?.settings;
  const reel = settings?.reel;
  if (!settings || !reel) return null;
  const duration = audio.audioBuffer?.duration || audio.duration || settings.audioDuration;
  const patch = (value: Partial<typeof reel>) => updateSettings({ reel: { ...reel, ...value } });
  const boundary = (edge: 'start' | 'end', value: number) => {
    if (!Number.isFinite(value)) return;
    audio.pause();
    updateSettings(markReelBoundary(settings, edge, value, duration));
  };
  const uploadCover = async (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      const scale = Math.max(1080 / image.width, 1920 / image.height);
      context.drawImage(image, (1080 - image.width * scale) / 2, (1920 - image.height * scale) / 2, image.width * scale, image.height * scale);
      patch({ coverUrl: canvas.toDataURL('image/jpeg', 0.9) });
    } catch { toast.error('No se pudo abrir la portada. Prueba con una imagen JPG o PNG.'); }
    finally { URL.revokeObjectURL(url); }
  };
  return <section aria-label="Ajustes del fragmento" className="space-y-3 rounded-lg border border-primary/30 p-3">
    <p className="text-sm">Marca el fragmento aquí o arrastra sus bordes en la línea de tiempo. El proyecto completo se conserva.</p>
    <div className="grid grid-cols-2 gap-3">{(['start', 'end'] as const).map(edge => <div key={edge} className="space-y-2">
      <label className="block text-sm">{edge === 'start' ? 'Inicio del fragmento (segundos)' : 'Fin del fragmento (segundos)'}
        <input type="number" min={0} max={duration} step={0.01} value={reel[edge]} disabled={duration < 0.2 || !!audio.mediaBusy} className="mt-1 w-full rounded border bg-background p-2" onChange={event => boundary(edge, event.target.valueAsNumber)} />
      </label>
      <Button size="sm" variant="outline" disabled={duration < 0.2 || !!audio.mediaBusy} onClick={() => boundary(edge, audio.currentTime)}>Usar posición actual como {edge === 'start' ? 'inicio' : 'fin'}</Button>
    </div>)}</div>
    <p role="status" className="text-sm">Fragmento: {reel.start.toFixed(1)}–{reel.end.toFixed(1)} s · {(reel.end - reel.start).toFixed(1)} s · vertical 9:16</p>
    <label className="block text-sm">Portada del fragmento (opcional)<input className="mt-2 block w-full text-sm" type="file" accept="image/*" onChange={event => { void uploadCover(event.target.files?.[0]); event.target.value = ''; }} /></label>
    {reel.coverUrl && <><p className="text-xs text-muted-foreground">La portada sustituye al fondo durante todo el fragmento.</p><Button size="sm" variant="outline" onClick={() => patch({ coverUrl: '' })}>Quitar portada y usar el montaje</Button></>}
    <div className="flex gap-3 text-sm"><label><input type="checkbox" checked={reel.showLyrics} onChange={event => patch({ showLyrics: event.target.checked })} /> Mostrar letra en el Reel</label><label><input type="checkbox" checked={reel.showTitle} onChange={event => patch({ showTitle: event.target.checked })} /> Mostrar título en el Reel</label></div>
  </section>;
}
