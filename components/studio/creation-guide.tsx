'use client';

import { useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { VideoBackgroundControls } from './properties/video-background-controls';
import { Button } from '@/components/ui/button';
import { FormatSection, StyleSection } from './properties/design-sections';
import { cleanParsedLyrics, parseLrcLyrics, parseTxtLyrics, readLyricsFile } from '@/lib/lyrics-utils';
import { toast } from 'sonner';
import { ReelControls } from './reel-controls';
import { ReelLyricsEditor } from './reel-lyrics-editor';

export function CreationGuide({ guided, onGuidedChange, step, onStepChange: setStep }: { guided: boolean; onGuidedChange: (guided: boolean) => void; step: number; onStepChange: (step: number) => void }) {
  const { currentProject, updateSettings, setExportOpen, setLyrics, setTab } = useStore();
  const audio = useAudioEngineContext();
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const lyricsInput = useRef<HTMLInputElement>(null);
  if (!currentProject) return null;
  const settings = currentProject.settings;
  const hasAudio = !!audio.audioBuffer;
  const reel = settings.editingTarget !== 'full' ? settings.reel : undefined;
  const steps = reel ? ['Audio', 'Fragmento', 'Letra', 'Formato', 'Estilo', 'Exportar'] : ['Audio', 'Letra', 'Formato', 'Estilo', 'Exportar'];
  const currentStep = Math.min(step, steps.length - 1);
  const stage = steps[currentStep];
  const lyricCount = settings.lyrics.filter(line => line.text.trim()).length;
  const importLyrics = async (file?: File) => {
    if (!file) return;
    setLoadingLyrics(true);
    try {
      const imported = await readLyricsFile(file);
      const lines = imported.format === 'lrc'
        ? cleanParsedLyrics(parseLrcLyrics(imported.text)).lyrics
        : parseTxtLyrics(imported.text, audio.duration || settings.audioDuration);
      if (!lines.some(line => line.text.trim())) throw new Error('El archivo no contiene líneas de letra utilizables');
      updateSettings({ editingTarget: 'full' });
      setLyrics(lines);
      toast.success('Letra cargada. Puedes continuar o editar su sincronización.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la letra');
    } finally { setLoadingLyrics(false); }
  };
  return <section aria-label="Creación guiada de vídeo" className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-semibold">{reel ? 'Tu Reel o vídeo corto, paso a paso' : 'Tu vídeo, paso a paso'}</span>
      <Button size="sm" variant="ghost" onClick={() => onGuidedChange(!guided)}>{guided ? 'Editar manualmente' : 'Abrir guía'}</Button>
    </div>
    {guided && <>
      <nav aria-label="Pasos para crear un vídeo" className="flex flex-wrap gap-1">
        {steps.map((label, index) => <Button key={label} className="flex-1 basis-24" size="sm" variant={currentStep === index ? 'default' : 'outline'} aria-current={currentStep === index ? 'step' : undefined} onClick={() => setStep(index)}>{index + 1}. {label}</Button>)}
      </nav>
      {stage === 'Audio' && <><VideoBackgroundControls /><p className="text-sm">{hasAudio ? `Audio listo: ${settings.audioName || 'Canción cargada'}` : 'Carga una canción o un vídeo para empezar.'}</p><Button variant="outline" onClick={() => window.dispatchEvent(new Event('sonceibe:upload-audio'))}>{hasAudio ? 'Cambiar audio' : 'Elegir audio'}</Button></>}
      {stage === 'Fragmento' && <ReelControls />}
      {stage === 'Letra' && reel ? <ReelLyricsEditor reel={reel} patch={value => updateSettings({ reel: { ...reel, ...value } })} active={guided && stage === 'Letra'} advanced /> : stage === 'Letra' && <>
        <p className="text-sm">La letra es opcional. Puedes cargar un archivo, escribirla en el editor o continuar sin letra.</p>
        <p className="text-xs text-muted-foreground" role="status">{lyricCount ? `Letra cargada: ${lyricCount} ${lyricCount === 1 ? 'frase' : 'frases'}. Revisa su sincronización antes de exportar.` : 'Todavía no has añadido letra.'}</p>
        <input ref={lyricsInput} type="file" aria-label="Archivo de letra de la guía" className="hidden" accept=".txt,.lrc,.odt,.docx,.rtf,.html,.htm,.md,.markdown,text/plain,application/rtf,application/vnd.oasis.opendocument.text,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void importLyrics(file); }} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={loadingLyrics} onClick={() => lyricsInput.current?.click()}>{loadingLyrics ? 'Cargando letra…' : lyricCount ? 'Cambiar archivo de letra' : 'Cargar archivo de letra'}</Button>
          <Button variant="outline" disabled={loadingLyrics} onClick={() => { updateSettings({ editingTarget: 'full' }); setTab('lyrics'); }}>Abrir editor de letra</Button>
        </div>
      </>}
      {stage === 'Formato' && <FormatSection />}
      {stage === 'Estilo' && <StyleSection />}
      {stage === 'Exportar' && <><p className="text-sm">{reel ? `Reel · ${reel.start.toFixed(1)}–${reel.end.toFixed(1)} s · ${(reel.end - reel.start).toFixed(1)} s · Vertical 9:16` : `Vídeo completo · ${settings.audioDuration.toFixed(1)} s · ${settings.exportConfig.orientation === 'portrait' ? 'Vertical 9:16' : 'Horizontal 16:9'}`}. Revisa la vista previa y confirma los detalles al exportar.</p><Button disabled={!hasAudio} onClick={() => setExportOpen(true)}>{reel ? 'Revisar y exportar Reel' : 'Revisar y exportar vídeo'}</Button>{!hasAudio && <p className="text-xs text-muted-foreground">Carga el audio para exportar.</p>}</>}
      {currentStep < steps.length - 1 && <Button size="sm" disabled={loadingLyrics || (stage === 'Audio' && !hasAudio)} onClick={() => setStep(currentStep + 1)}>{stage === 'Letra' && !reel && !lyricCount ? 'Continuar sin letra' : 'Continuar'}</Button>}
    </>}
    <p className="text-xs text-muted-foreground">Formato: orientación y fotos. Estilo: estilos preparados. Usa las herramientas de arriba para la edición manual.</p>
  </section>;
}
