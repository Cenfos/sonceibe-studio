'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { generateWaveformPeaks } from '@/lib/waveform';
import { suggestReel } from '@/lib/reel-suggestion';
import { markReelBoundary } from '@/lib/reel';
import { formatTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { getVisualPreset } from '@/lib/visual-presets';

export function ReelFragmentTimeline() {
  const { currentProject, updateSettings } = useStore();
  const audio = useAudioEngineContext();
  const [chooseAgain, setChooseAgain] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const settings = currentProject?.settings;
  const reel = settings?.reel;
  const duration = audio.audioBuffer?.duration || audio.duration || settings?.audioDuration || 0;
  const suggestion = useMemo(() => suggestReel(settings?.lyrics || [], duration), [settings?.lyrics, duration]);
  const peaks = useMemo(() => audio.audioBuffer ? generateWaveformPeaks(audio.audioBuffer, 1000) : [], [audio.audioBuffer]);
  const valid = !!reel && reel.start >= 0 && reel.end <= duration && reel.end - reel.start >= 0.2;
  const choosing = chooseAgain || !valid || reel?.selectionConfirmed === false;
  const start = choosing ? Math.min(position ?? suggestion.start, Math.max(0, duration - Math.min(30, duration))) : reel!.start;
  const end = choosing ? Math.min(duration, start + 30) : reel!.end;
  useEffect(() => {
    if (!listening) return;
    const element = audio.audioEl;
    if (!element) return;
    const stopAtEnd = () => { if (element.currentTime >= end || element.currentTime < start - 0.1 || element.ended) { element.pause(); setListening(false); } };
    const timer = window.setInterval(stopAtEnd, 40);
    return () => { clearInterval(timer); element.pause(); };
  }, [listening, start, end, audio.audioEl]);
  if (!settings || !reel) return null;
  const select = () => {
    audio.pause(); setListening(false);
    const moved = { ...settings, ...markReelBoundary(settings, 'start', start, duration) };
    updateSettings(markReelBoundary(moved, 'end', end, duration));
    audio.seek(start); setChooseAgain(false); setPosition(null);
  };
  const play = async () => {
    if (listening) { audio.pause(); setListening(false); return; }
    audio.seek(start);
    setListening(true);
    try { await audio.play(); } catch { setListening(false); }
  };
  const viewStart = choosing ? 0 : start;
  const viewEnd = choosing ? duration : end;
  const span = Math.max(0.2, viewEnd - viewStart);
  const viewPeaks = peaks.slice(Math.floor(viewStart / (duration || 1) * peaks.length), Math.max(1, Math.ceil(viewEnd / (duration || 1) * peaks.length)));
  const progress = Math.max(0, Math.min(100, (audio.currentTime - viewStart) / span * 100));
  const lyrics = reel.lyricsMode === 'custom' ? (reel.lyrics || []).map(line => ({ ...line, start: line.start + reel.start, end: line.end + reel.start })) : settings.lyrics;
  const rows = [
    { name: 'Letra', clips: reel.showLyrics ? lyrics.map(line => ({ ...line, label: line.text })) : [] },
    { name: 'Fotos puntuales', clips: (settings.background.photoClips || []).map((clip, index) => ({ ...clip, label: `Foto ${index + 1}` })) },
    { name: 'Fondo', clips: reel.coverUrl ? [{ id: 'cover', start, end, label: 'Portada del Reel' }] : settings.background.type === 'images' && settings.background.imageMode === 'manual' ? settings.background.imageClips.map((clip, index) => ({ ...clip, label: `Imagen ${index + 1}` })) : [{ id: 'background', start, end, label: getVisualPreset(settings.visualStyle)?.label || (settings.background.type === 'images' ? 'Fotos de fondo' : settings.background.type === 'video' ? 'Vídeo' : 'Fondo del proyecto') }] },
  ];
  return <section aria-label="Línea de tiempo del fragmento" className="space-y-3">
    {choosing ? <>
      <p className="text-sm font-medium">Elige los 30 segundos de tu Reel</p>
      <p className="text-sm text-muted-foreground">{suggestion.repeatedText ? `Esta frase se repite en la letra: «${suggestion.repeatedText}». Puede ser un buen punto para el estribillo. Escúchalo antes de elegir.` : 'Busca el estribillo o una parte que se repita. Escucha la canción y mueve el inicio de la selección; prepararemos 30 segundos desde ahí.'}</p>
      <label className="block text-sm">Situar el fragmento en la canción<input aria-label="Situar fragmento de 30 segundos" type="range" min={0} max={Math.max(0, duration - Math.min(30, duration))} step={0.1} value={start} disabled={duration < 0.2 || !!audio.mediaBusy} className="mt-2 w-full accent-primary" onChange={event => { audio.pause(); setListening(false); setPosition(Number(event.target.value)); }} /></label>
    </> : <p className="text-sm text-muted-foreground">Este es el tramo seleccionado. Escúchalo y revisa las frases y fotos que aparecen dentro del corte.</p>}
    <div className="overflow-hidden rounded-lg border border-primary/40 bg-background" aria-label={choosing ? 'Canción con selección de 30 segundos' : 'Sólo el tramo seleccionado'}>
      <div className="flex justify-between px-2 py-1 text-xs font-mono"><span>{formatTime(viewStart)}</span><span>{formatTime(viewStart + span / 2)}</span><span>{formatTime(viewEnd)}</span></div>
      <div className="relative h-16 bg-primary/5">
        <svg aria-label="Forma de onda del fragmento" viewBox={`0 0 ${Math.max(1, viewPeaks.length)} 64`} preserveAspectRatio="none" className="h-full w-full"><path d={viewPeaks.map((peak, index) => `M${index},${32 - peak * 28}v${Math.max(1, peak * 56)}`).join(' ')} stroke="currentColor" className="text-primary" strokeWidth="1" /></svg>
        {choosing && <div className="absolute inset-y-0 border-2 border-primary bg-primary/20 pointer-events-none" style={{ left: `${start / (duration || 1) * 100}%`, width: `${(end - start) / (duration || 1) * 100}%` }} />}
        <div className="absolute inset-y-0 w-0.5 bg-white pointer-events-none" style={{ left: `${progress}%` }} />
      </div>
      {!choosing && rows.filter(row => row.clips.length).map(row => <div key={row.name} className="flex border-t border-border text-xs"><span className="w-20 shrink-0 p-1">{row.name}</span><div className="relative min-w-0 flex-1 h-7">{row.clips.filter(clip => clip.end > start && clip.start < end).map(clip => <div key={clip.id} title={`${clip.label} · ${Math.max(start, clip.start).toFixed(1)}–${Math.min(end, clip.end).toFixed(1)} s`} className="absolute inset-y-1 truncate rounded bg-primary/25 px-1" style={{ left: `${(Math.max(start, clip.start) - start) / span * 100}%`, width: `${(Math.min(end, clip.end) - Math.max(start, clip.start)) / span * 100}%` }}>{clip.label}</div>)}</div></div>)}
    </div>
    {!choosing && <label className="block text-xs">Recorrer el fragmento<input aria-label="Posición dentro del fragmento" type="range" min={start} max={end} step={0.01} value={Math.max(start, Math.min(end, audio.currentTime))} className="mt-1 w-full accent-primary" onChange={event => { audio.pause(); setListening(false); audio.seek(Number(event.target.value)); }} /></label>}
    <p role="status" className="text-sm">{formatTime(start)} → {formatTime(end)} · {(end - start).toFixed(1)} s</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={!audio.audioBuffer || !!audio.mediaBusy || !!audio.mediaError || end - start < 0.2} onClick={() => void play()}>{listening ? 'Parar fragmento' : 'Escuchar fragmento'}</Button>
      {choosing ? <><Button size="sm" disabled={duration < 0.2 || !!audio.mediaBusy} onClick={select}>Usar este fragmento</Button>{chooseAgain && valid && reel.selectionConfirmed !== false && <Button size="sm" variant="ghost" onClick={() => { setChooseAgain(false); setPosition(null); }}>Conservar selección anterior</Button>}</> : <Button size="sm" variant="outline" onClick={() => { audio.pause(); setListening(false); setPosition(null); setChooseAgain(true); }}>Elegir otro fragmento</Button>}
    </div>
    {duration < 0.2 && <p className="text-sm text-muted-foreground">Carga la canción en el paso Audio para seleccionar el fragmento.</p>}
  </section>;
}
