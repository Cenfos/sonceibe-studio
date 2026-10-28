'use client';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { Button } from '@/components/ui/button';
import { ReelDialog } from './reel-dialog';

export function EditingScope() {
  const { currentProject, updateSettings } = useStore();
  const audio = useAudioEngineContext();
  const settings = currentProject?.settings;
  if (!settings) return null;
  const reel = settings.reel;
  const selected = !!reel && settings.editingTarget !== 'full';
  const select = (target: 'reel' | 'full') => {
    audio.pause();
    updateSettings({ editingTarget: target });
    audio.seek(target === 'reel' && reel ? reel.start : 0);
  };
  return <div aria-label="Contenido en edición" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/30 px-4 py-2 text-sm">
    <span className="text-muted-foreground">Estás editando:</span>
    <Button size="sm" variant={!selected ? 'default' : 'outline'} aria-pressed={!selected} onClick={() => select('full')}>Canción completa</Button>
    {reel && <Button size="sm" variant={selected ? 'default' : 'outline'} aria-pressed={selected} onClick={() => select('reel')}>Reel · {reel.start.toFixed(1)}–{reel.end.toFixed(1)} s</Button>}
    <span className="text-xs text-muted-foreground">{selected ? 'La guía y los controles avanzados editan el mismo Reel.' : 'Edición de la canción completa.'}</span>
    {selected && <><ReelDialog label="Volver a la guía del Reel" /><ReelDialog label="Ajustes avanzados del Reel" initialManual /></>}
  </div>;
}
