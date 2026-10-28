'use client';
import { useEffect, useState } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { formatTime } from '@/lib/format';
import { Button } from '@/components/ui/button';

export function MobileAudioPlayer() {
  const { currentProject } = useStore();
  const audio = useAudioEngineContext();
  const [error, setError] = useState('');
  const settings = currentProject?.settings;
  const reel = settings?.editingTarget !== 'full' ? settings?.reel : undefined;
  const start = reel?.start || 0;
  const end = reel?.end || audio.duration || settings?.audioDuration || 0;
  useEffect(() => { if (reel && audio.isPlaying && audio.currentTime >= end) audio.pause(); }, [reel, audio, end]);
  if (!settings?.audioName && !audio.duration) return null;
  const play = async () => {
    if (audio.isPlaying) { audio.pause(); return; }
    if (!audio.audioEl) return;
    if (audio.currentTime < start || audio.currentTime >= end) audio.seek(start);
    audio.setMuted(false); setError('');
    try { await audio.audioEl.play(); } catch { setError('No se pudo reproducir. Pulsa Escuchar para volver a intentarlo.'); }
  };
  return <section aria-label="Escuchar proyecto" className="border-t border-border bg-background px-3 py-2">
    <div className="flex items-center gap-2">
      <Button size="sm" className="h-10 shrink-0 gap-1.5" disabled={!audio.audioBuffer} onClick={() => void play()}>{audio.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{audio.isPlaying ? 'Pausar' : reel ? 'Escuchar Reel' : 'Escuchar'}</Button>
      <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" aria-label="Detener música" disabled={!audio.audioBuffer} onClick={() => { audio.pause(); audio.seek(start); }}><Square className="h-4 w-4" /></Button>
      <div className="min-w-0 flex-1"><div className="flex justify-between text-[10px] tabular-nums text-muted-foreground"><output aria-label="Tiempo de escucha">{formatTime(Math.max(0, audio.currentTime - start))}</output><span>{formatTime(end - start)}</span></div><input aria-label="Posición de la música" type="range" className="block h-7 w-full accent-primary" min={start} max={Math.max(start + 0.01, end)} step={0.01} value={Math.max(start, Math.min(end, audio.currentTime))} disabled={!audio.audioBuffer} onChange={e => audio.seek(Number(e.target.value))} /></div>
    </div>
    {!audio.audioBuffer && <p className="text-xs text-muted-foreground">Cargando música…</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </section>;
}
