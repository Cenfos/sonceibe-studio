'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import type { ProjectSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';

type Reel = NonNullable<ProjectSettings['reel']>;
export function ReelLyricsEditor({ reel, patch, active, advanced = false, simple = false }: { simple?: boolean; reel: Reel; patch: (value: Partial<Reel>) => void; active: boolean; advanced?: boolean }) {
  const { currentProject } = useStore();
  const audio = useAudioEngineContext();
  const [running, setRunning] = useState(false);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState('');
  const markLock = useRef(false);
  useEffect(() => { setRunning(false); }, [reel.start, reel.end]);
  const lines = reel.lyrics || [];
  const length = Math.max(0, reel.end - reel.start);
  const custom = reel.lyricsMode === 'custom';
  const text = reel.lyricsText ?? lines.map(line => line.text).join('\n');
  const stop = () => { audio.pause(); setRunning(false); };
  // Stop at the selected boundary, including when the user leaves this step.
  useEffect(() => {
    if (!running) return;
    if (!active || !custom || !reel.showLyrics) { audio.pause(); setRunning(false); return; }
    const element = audio.audioEl;
    if (!element) return;
    const end = () => { if (element.currentTime >= reel.end || element.currentTime < reel.start - 0.1) { audio.pause(); setRunning(false); } };
    element.addEventListener('timeupdate', end);
    element.addEventListener('ended', end);
    return () => { element.removeEventListener('timeupdate', end); element.removeEventListener('ended', end); audio.pause(); };
  }, [running, active, custom, reel.showLyrics, reel.start, reel.end, audio.audioEl]);

  if (!reel.showLyrics) return null;
  const start = async () => {
    if (!lines.length || !audio.audioEl || length < 0.2) return;
    audio.pause(); audio.seek(reel.start); setPosition(0); setError('');
    patch({ lyrics: lines.map(line => ({ ...line, start: 0, end: 0, words: undefined })) });
    setRunning(true);
    try { await audio.audioEl.play(); } catch { setError('No se pudo reproducir el fragmento. Vuelve a pulsar Sincronizar.'); setRunning(false); }
  };
  const mark = () => {
    if (markLock.current || !audio.audioEl || audio.audioEl.paused) return;
    markLock.current = true;
    const t = Math.max(0, Math.min(length, audio.audioEl.currentTime - reel.start));
    if (position > 0 && t <= lines[position - 1].start) { markLock.current = false; return; }
    patch({ lyrics: lines.map((line, index) => index === position - 1 ? { ...line, end: t } : index === position ? { ...line, start: t, end: length } : line) });
    if (position >= lines.length) stop();
    else setPosition(position + 1);
    window.setTimeout(() => { markLock.current = false; }, 100);
  };
  const projectLines = (currentProject?.settings.lyrics || []).filter(line => line.end > reel.start && line.start < reel.end && line.text.trim());
  return <section aria-label="Letra del Reel" className="rounded-lg border border-primary/30 p-3 space-y-3">
    <h3 className="text-sm font-semibold">Letra y sincronización del fragmento</h3>
    <div className="flex flex-wrap gap-2">
      <Button variant={!custom ? 'default' : 'outline'} size="sm" aria-pressed={!custom} onClick={() => { stop(); patch({ lyricsMode: 'project' }); }}>Usar letra del proyecto</Button>
      <Button variant={custom ? 'default' : 'outline'} size="sm" aria-pressed={custom} onClick={() => patch({ lyricsMode: 'custom' })}>Letra sólo para este Reel</Button>
    </div>
    {!custom ? <p className="text-xs text-muted-foreground">{projectLines.length ? `${projectLines.length} líneas del proyecto coinciden con el fragmento. Se recortarán automáticamente al exportar.` : 'No hay letra sincronizada en este fragmento. Puedes escribir sólo las frases del Reel con la otra opción.'}</p> : <>
      <p className="text-xs text-muted-foreground">Pega sólo el trozo que se canta, una frase por línea. Los tiempos empiezan en 0 dentro del Reel. La letra del proyecto se conserva.</p>
      <label className="block text-sm">Frases del Reel<textarea aria-label="Frases del Reel" disabled={running} className="mt-1 min-h-[90px] w-full rounded border bg-background p-2" value={text} onChange={event => patch({ lyricsText: event.target.value })} /></label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={running || !text.trim()} onClick={() => patch({ lyrics: text.split(/\r?\n/).map(value => value.trim()).filter(Boolean).map((value, index) => ({ id: `reel-line-${index}`, text: value, start: 0, end: 0 })) })}>Preparar frases</Button>
        <Button size="sm" variant="outline" disabled={running || !projectLines.length} onClick={() => { const copied = projectLines.map(line => ({ ...line, words: undefined, start: Math.max(0, line.start - reel.start), end: Math.min(length, line.end - reel.start) })); patch({ lyrics: copied, lyricsText: copied.map(line => line.text).join('\n') }); }}>Copiar frases de este tramo</Button>
      </div>
      {!running ? <Button disabled={!lines.length || !audio.audioBuffer || length < 0.2 || text.split(/\r?\n/).map(value => value.trim()).filter(Boolean).join('\n') !== lines.map(line => line.text).join('\n')} onClick={() => void start()}>Sincronizar sólo este fragmento</Button> : <>
        <output aria-label="Posición de sincronización" className="block text-xs">{Math.max(0, Math.min(length, audio.currentTime - reel.start)).toFixed(2)} s / {length.toFixed(2)} s</output>
        <p role="status" className="text-sm">{position < lines.length ? `Al empezar a cantar: «${lines[position].text}»` : 'Marca el final de la última frase, o deja que llegue al final del Reel.'}</p>
        <Button onClick={mark}>{position < lines.length ? 'Marcar entrada de frase' : 'Marcar final y terminar'}</Button>
        <Button variant="outline" onClick={stop}>Parar sincronización</Button>
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Escucha únicamente el fragmento y pulsa al entrar cada frase. Si cambias el corte, revisa o repite la sincronización. {!simple && 'También puedes ajustar cada tiempo a mano.'}</p>
      {!simple && <details open={advanced || undefined}><summary className="cursor-pointer text-sm">Ajustar tiempos manualmente · segundos dentro del Reel</summary><div className="mt-2 space-y-2">{lines.map((line, index) => <div key={line.id} className="rounded border p-2 space-y-2"><label className="block text-xs">Frase {index + 1}<input aria-label={`Texto frase ${index + 1} del Reel`} disabled={running} className="mt-1 block w-full rounded border bg-background p-2 text-sm" value={line.text} onChange={event => { const edited = lines.map((item, i) => i === index ? { ...item, text: event.target.value, words: undefined } : item); patch({ lyrics: edited, lyricsText: edited.map(item => item.text).join('\n') }); }} /></label><div className="flex gap-2">{(['start', 'end'] as const).map(key => <label key={key} className="text-xs flex-1">{key === 'start' ? 'Inicio' : 'Fin'}<input disabled={running} aria-label={`${key === 'start' ? 'Inicio' : 'Fin'} frase ${index + 1} del Reel`} type="number" min={0} max={length} step={0.01} className="block w-full rounded border bg-background p-2" value={line[key]} onChange={event => patch({ lyrics: lines.map((item, i) => i === index ? { ...item, [key]: Number(event.target.value), words: undefined } : item) })} /></label>)}</div></div>)}</div></details>}
      {lines.some(line => line.end <= line.start || line.start < 0 || line.end > length) && <p role="status" className="text-xs text-amber-500">Hay frases pendientes de sincronizar o tiempos fuera del fragmento. Revisa sus entradas y salidas antes de exportar.</p>}
    </>}
  </section>;
}
