'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { cleanLyricsText, parseTxtLyrics } from '@/lib/lyrics-utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function MobileLyricsEditor() {
  const { currentProject, updateLyric, deleteLyric, setLyrics, saveVersion } = useStore();
  const audio = useAudioEngineContext();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  if (!currentProject) return null;
  const lyrics = currentProject.settings.lyrics;
  const duration = audio.duration || currentProject.settings.audioDuration;
  const applyText = async () => {
    const text = cleanLyricsText(draft).text;
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await saveVersion('Antes de pegar la letra en móvil');
      setLyrics(parseTxtLyrics(text, duration)); setDraft('');
      toast.success('Letra añadida. Revisa la sincronización con la canción.');
    } catch { toast.error('No se pudo guardar la letra'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Editar letra en móvil" className="space-y-4">
    <details className="rounded-lg border border-border p-3" open={lyrics.length === 0 ? true : undefined}>
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Escribir o pegar letra</summary>
      <div className="space-y-3">
        <label className="block text-sm">Una frase por línea<textarea aria-label="Letra para pegar" value={draft} onChange={e => setDraft(e.target.value)} rows={7} className="mt-2 block w-full resize-y rounded border border-border bg-background p-3 text-base" /></label>
        <p className="text-xs leading-5 text-muted-foreground">{lyrics.length ? 'Al aplicar este texto se reemplaza la letra actual y se reparten los tiempos de nuevo. ' : ''}Después puedes sincronizar las frases escuchando la canción.</p>
        <Button className="min-h-11 w-full" disabled={!draft.trim() || busy} onClick={() => void applyText()}>{busy ? 'Guardando…' : lyrics.length ? 'Reemplazar letra con este texto' : 'Añadir esta letra'}</Button>
      </div>
    </details>
    {lyrics.length > 0 && <>
      <p className="text-xs leading-5 text-muted-foreground">Corrige cada frase sin cambiar sus tiempos. Al borrar una frase, las demás conservan su sincronización.</p>
      {lyrics.map((line, index) => <div key={line.id} className="space-y-2 rounded-lg border border-border p-3">
        <label className="block text-sm">Frase {index + 1}<textarea aria-label={`Frase ${index + 1}`} rows={2} value={line.text} onChange={e => updateLyric(line.id, { text: e.target.value, words: undefined })} className="mt-2 block w-full resize-y rounded border border-border bg-background p-2 text-base" /></label>
        <Button variant="ghost" className="min-h-11" onClick={() => deleteLyric(line.id)} aria-label={`Eliminar frase ${index + 1}`}>Eliminar frase</Button>
      </div>)}
    </>}
  </section>;
}
