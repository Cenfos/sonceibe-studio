'use client';

import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ReelFragmentTimeline } from './reel-fragment-timeline';

export function ReelControls() {
  const { currentProject, updateSettings } = useStore();
  const settings = currentProject?.settings;
  const reel = settings?.reel;
  if (!settings || !reel) return null;
  const patch = (value: Partial<typeof reel>) => updateSettings({ reel: { ...reel, ...value } });
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
    <ReelFragmentTimeline />
    <label className="block text-sm">Portada del fragmento (opcional)<input className="mt-2 block w-full text-sm" type="file" accept="image/*" onChange={event => { void uploadCover(event.target.files?.[0]); event.target.value = ''; }} /></label>
    {reel.coverUrl && <><p className="text-xs text-muted-foreground">La portada sustituye al fondo durante todo el fragmento.</p><Button size="sm" variant="outline" onClick={() => patch({ coverUrl: '' })}>Quitar portada y usar el montaje</Button></>}
    <div className="flex gap-3 text-sm"><label><input type="checkbox" checked={reel.showLyrics} onChange={event => patch({ showLyrics: event.target.checked })} /> Mostrar letra en el Reel</label><label><input type="checkbox" checked={reel.showTitle} onChange={event => patch({ showTitle: event.target.checked })} /> Mostrar título en el Reel</label></div>
  </section>;
}
