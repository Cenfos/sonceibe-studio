'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { markReelBoundary } from '@/lib/reel';
import { Button } from '@/components/ui/button';

export function LyricReelMarkers({ start, end, label }: { start: number; end: number; label: string }) {
  const { currentProject, updateSettings } = useStore();
  const audio = useAudioEngineContext();
  if (!currentProject) return null;
  const settings = currentProject.settings;
  const duration = audio.duration || settings.audioDuration;
  const active = settings.editingTarget !== 'full' ? settings.reel : undefined;
  const mark = (edge: 'start' | 'end', time: number) => { audio.pause(); updateSettings(markReelBoundary(settings, edge, time, duration)); audio.seek(time); };
  return <div className="flex shrink-0 flex-wrap gap-1" onClick={event => event.stopPropagation()}>
    <Button size="sm" variant={active && Math.abs(active.start - start) < 0.01 ? 'default' : 'outline'} aria-pressed={!!active && Math.abs(active.start - start) < 0.01} className="h-7 px-2 text-xs" aria-label={`Empezar Reel en ${label}`} disabled={end <= start || duration < 0.2} onClick={() => mark('start', start)}>Inicio Reel</Button>
    <Button size="sm" variant={active && Math.abs(active.end - end) < 0.01 ? 'default' : 'outline'} aria-pressed={!!active && Math.abs(active.end - end) < 0.01} className="h-7 px-2 text-xs" aria-label={`Terminar Reel en ${label}`} disabled={end <= start || duration < 0.2} onClick={() => mark('end', end)}>Fin Reel</Button>
  </div>;
}

export function ReelCutControls() {
  const { currentProject, updateSettings } = useStore();
  const audio = useAudioEngineContext();
  const [listening, setListening] = useState(false);
  const settings = currentProject?.settings;
  const reel = settings?.reel;
  useEffect(() => { if (listening && reel && audio.currentTime >= reel.end) { audio.pause(); setListening(false); } }, [listening, reel, audio]);
  if (!settings) return null;
  const duration = audio.duration || settings.audioDuration;
  const mark = (edge: 'start' | 'end') => { const time = audio.audioEl?.currentTime ?? audio.currentTime; audio.pause(); setListening(false); updateSettings(markReelBoundary(settings, edge, time, duration)); };
  return <section aria-label="Corte del Reel desde la letra" className="shrink-0 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
    <div className="flex flex-wrap items-center gap-2 text-sm"><strong>Corte del Reel</strong><span>{reel ? `${reel.start.toFixed(2)}–${reel.end.toFixed(2)} s` : 'Marca el fragmento desde las frases'}</span></div>
    <p className="text-xs text-muted-foreground">Usa Inicio Reel y Fin Reel en las frases, o escucha y marca la posición actual. El corte se refleja en la línea de tiempo.</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={!audio.duration} onClick={() => { if (!audio.audioEl?.paused) { audio.pause(); setListening(false); } else { if (reel && (audio.currentTime < reel.start || audio.currentTime >= reel.end)) audio.seek(reel.start); void audio.play(); setListening(true); } }}>{audio.isPlaying ? 'Pausar escucha' : 'Escuchar para marcar'}</Button>
      <Button size="sm" variant="outline" disabled={duration < 0.2} onClick={() => mark('start')}>Marcar inicio en la posición actual</Button>
      <Button size="sm" variant="outline" disabled={duration < 0.2} onClick={() => mark('end')}>Marcar fin en la posición actual</Button>
      <span className="self-center text-xs tabular-nums">Audio: {audio.currentTime.toFixed(2)} s</span>
    </div>
    {duration > 0 && <input aria-label="Buscar posición para el corte del Reel" type="range" className="w-full accent-primary" min={0} max={duration} step={0.01} value={audio.currentTime} onChange={event => { audio.pause(); setListening(false); audio.seek(Number(event.target.value)); }} />}
  </section>;
}
