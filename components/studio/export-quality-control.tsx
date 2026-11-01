'use client';
import { EXPORT_QUALITIES } from '@/lib/video-profiles';
import { useStore } from '@/lib/store';
import type { ExportQuality } from '@/lib/types';

export function ExportQualityControl() {
  const { currentProject, updateExport } = useStore();
  if (!currentProject) return null;
  const quality = currentProject.settings.exportConfig.quality ?? 'balanced';
  return <label className="block space-y-2 rounded-lg border border-border p-3 text-sm">
    <span className="font-medium">Calidad del MP4</span>
    <select aria-label="Calidad del MP4" className="block w-full rounded border border-border bg-background p-2" value={quality} onChange={e => updateExport({ quality: e.target.value as ExportQuality })}>
      {(Object.keys(EXPORT_QUALITIES) as ExportQuality[]).map(key => <option key={key} value={key}>{EXPORT_QUALITIES[key].label}</option>)}
    </select>
    <span className="block text-xs leading-5 text-muted-foreground">{EXPORT_QUALITIES[quality].description} Full HD · 30 FPS. No recupera detalle que no tenga el original.</span>
  </label>;
}
