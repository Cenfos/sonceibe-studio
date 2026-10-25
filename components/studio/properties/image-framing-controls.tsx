'use client';

import { Button } from '@/components/ui/button';
import type { ImagePlacement, ImageFitMode } from '@/lib/types';

export function ImageFramingControls({ value, fit, label, onChange }: { value?: ImagePlacement; fit: ImageFitMode; label: string; onChange: (value: ImagePlacement) => void }) {
  const placement = { scale: 100, x: 50, y: 50, fit, ...value };
  return <fieldset className="space-y-3 rounded-lg border border-border p-3">
    <legend className="px-1 text-xs font-semibold">Encuadrar {label}</legend>
    <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => onChange({ scale: 55, x: 50, y: 50, fit: 'contain' })}>Centro · zona de letras</Button><Button type="button" size="sm" variant="outline" onClick={() => onChange({ scale: 100, x: 50, y: 50, fit: 'cover' })}>Pantalla completa</Button></div>
    {([{ key: 'scale', title: 'Tamaño', min: 20, max: 100 }, { key: 'x', title: 'Posición horizontal', min: 0, max: 100 }, { key: 'y', title: 'Posición vertical', min: 0, max: 100 }] as const).map(control => <label key={control.key} className="block space-y-1 text-xs"><span className="flex justify-between"><span>{control.title}</span><span>{placement[control.key]}%</span></span><input aria-label={control.title + ' de ' + label} type="range" min={control.min} max={control.max} step={1} value={placement[control.key]} onChange={event => onChange({ ...placement, [control.key]: Number(event.target.value) })} className="block w-full accent-primary" /></label>)}
    <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant={placement.fit === 'contain' ? 'default' : 'outline'} onClick={() => onChange({ ...placement, fit: 'contain' })}>Ver completa</Button><Button type="button" size="sm" variant={placement.fit === 'cover' ? 'default' : 'outline'} onClick={() => onChange({ ...placement, fit: 'cover' })}>Recortar para llenar</Button></div>
    <p className="text-xs leading-5 text-muted-foreground">Reduce el tamaño para dejar visible el fondo alrededor. Horizontal: izquierda a derecha. Vertical: arriba a abajo. La letra conserva su posición.</p>
  </fieldset>;
}
