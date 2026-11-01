'use client';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import type { BackgroundImageClip } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ImageFramingControls } from '@/components/studio/properties/image-framing-controls';

export function MobilePhotoEditor() {
  const { currentProject, updateBackground } = useStore();
  const audio = useAudioEngineContext();
  if (!currentProject) return null;
  const bg = currentProject.settings.background;
  if (bg.type !== 'image' && bg.type !== 'images') return null;
  const sources = bg.images.length ? bg.images : bg.imageUrl ? [bg.imageUrl] : [];
  const duration = audio.duration || currentProject.settings.audioDuration || sources.length * (bg.imageDuration || 5);
  const clips: BackgroundImageClip[] = bg.type === 'images' && bg.imageMode === 'manual'
    ? bg.imageClips
    : sources.map((url, index) => ({ id: `mobile-photo-${index}`, url, start: index * duration / sources.length, end: (index + 1) * duration / sources.length, placement: bg.imagePlacement }));
  const save = (next: BackgroundImageClip[], redistribute: boolean) => {
    if (!next.length) { updateBackground({ type: 'gradient', images: [], imageUrl: '', imageClips: [], imagePlacement: undefined }); return; }
    const imageClips = redistribute ? next.map((clip, index) => ({ ...clip, start: index * duration / next.length, end: (index + 1) * duration / next.length })) : next;
    updateBackground({ type: 'images', images: imageClips.map(c => c.url), imageUrl: imageClips[0].url, imageMode: 'manual', imageClips });
  };
  const move = (index: number, direction: number) => {
    const next = [...clips], target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; save(next, true);
  };
  if (!clips.length) return null;
  return <section aria-label="Organizar fotos" className="space-y-3">
    <h3 className="text-sm font-medium">Tus fotos · {clips.length}</h3>
    <p className="text-xs leading-5 text-muted-foreground">Al ordenar o eliminar fotos se reparten de nuevo a lo largo de la canción. {bg.type === 'images' && bg.imageMode === 'manual' ? 'Encuadrar una foto conserva sus tiempos.' : 'Al editar esta secuencia automática, cada foto pasa a ocupar una parte de la canción.'}</p>
    {clips.map((clip, index) => <article key={clip.id} aria-label={`Foto ${index + 1}`} className="min-w-0 space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={clip.url} alt={`Foto ${index + 1}`} className="h-24 w-16 shrink-0 rounded bg-black object-cover" />
        <div className="min-w-0 flex-1 space-y-2"><p className="text-sm font-medium">Foto {index + 1}</p><div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11 px-3" disabled={index === 0} aria-label={`Subir foto ${index + 1}`} onClick={() => move(index, -1)}>↑ Subir</Button>
          <Button variant="outline" className="min-h-11 px-3" disabled={index === clips.length - 1} aria-label={`Bajar foto ${index + 1}`} onClick={() => move(index, 1)}>↓ Bajar</Button>
          <Button variant="ghost" className="min-h-11 px-3" aria-label={`Eliminar foto ${index + 1}`} onClick={() => save(clips.filter((_, i) => i !== index), true)}>Eliminar</Button>
        </div></div>
      </div>
      <details><summary className="min-h-11 cursor-pointer py-3 text-sm">Encuadrar foto {index + 1}</summary><ImageFramingControls label={`foto ${index + 1}`} fit="cover" value={clip.placement} onChange={placement => save(clips.map((c, i) => i === index ? { ...c, placement } : c), false)} /></details>
    </article>)}
  </section>;
}
