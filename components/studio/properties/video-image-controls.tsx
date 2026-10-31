'use client';
import { useStore } from '@/lib/store';
import { defaultVideoAdjustments, type VideoAdjustments } from '@/lib/types';
import { normalizedVideoAdjustments } from '@/lib/video-adjustments';
import { Button } from '@/components/ui/button';

const controls: { key: keyof VideoAdjustments; label: string; max: number }[] = [
  { key: 'brightness', label: 'Brillo', max: 200 }, { key: 'contrast', label: 'Contraste', max: 200 },
  { key: 'saturation', label: 'Saturación', max: 200 }, { key: 'sharpness', label: 'Nitidez', max: 100 },
];
export function VideoImageControls() {
  const { currentProject, updateBackground } = useStore();
  if (!currentProject) return null;
  const value = normalizedVideoAdjustments(currentProject.settings.background.videoAdjustments);
  return <fieldset className="space-y-3 rounded-lg border border-border p-3">
    <legend className="px-1 text-sm font-medium">Ajustes de imagen del vídeo</legend>
    {controls.map(({ key, label, max }) => <label key={key} className="block text-xs">{label} · {value[key]}%
      <input aria-label={`${label} del vídeo`} type="range" min={0} max={max} step={1} value={value[key]} className="mt-2 block w-full accent-primary" onChange={e => updateBackground({ videoAdjustments: { ...value, [key]: Number(e.target.value) } })} />
    </label>)}
    <Button type="button" size="sm" variant="outline" onClick={() => updateBackground({ videoAdjustments: { ...defaultVideoAdjustments } })}>Restablecer imagen</Button>
    <p className="text-xs leading-5 text-muted-foreground">Comprueba el resultado en la vista previa. Los ajustes se guardan y se aplican al MP4 y a los Reels, sin modificar el archivo original.</p>
  </fieldset>;
}
