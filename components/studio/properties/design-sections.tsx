'use client';

import { useStore } from '@/lib/store';
import { emptyStyle } from '@/lib/reel';
import { Button } from '@/components/ui/button';
import { BackgroundTab } from './background-tab';
import { VisualPresetPicker } from './visual-preset-picker';

export function FormatSection() {
  const { currentProject, updateExport } = useStore();
  if (!currentProject) return null;
  return <section aria-label="Formato y fotos" className="space-y-4">
    <p className="text-sm">Elige la orientación y añade una foto fija, varias fotos o fotos puntuales. Los estilos preparados se eligen en Estilo.</p>
    <div className="flex flex-wrap gap-2">{(['portrait', 'landscape'] as const).map(orientation => <Button key={orientation} variant={currentProject.settings.exportConfig.orientation === orientation ? 'default' : 'outline'} aria-pressed={currentProject.settings.exportConfig.orientation === orientation} onClick={() => updateExport({ orientation, resolution: '1080p', fps: 30 })}>{orientation === 'portrait' ? 'Vertical · 9:16' : 'Horizontal · 16:9'}</Button>)}</div>
    <BackgroundTab />
  </section>;
}

export function StyleSection() {
  const { updateSettings } = useStore();
  return <section aria-label="Estilo del vídeo" className="space-y-3">
    <p className="text-sm">Elige el estilo preparado para el marco y la letra. Tus fotos se conservan.</p>
    <VisualPresetPicker />
    <Button variant="outline" size="sm" onClick={() => updateSettings(emptyStyle())}>Sin estilo · fondo vacío</Button>
  </section>;
}
