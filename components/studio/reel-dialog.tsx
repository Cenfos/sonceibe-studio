'use client';

import { useEffect, useRef, useState } from 'react';
import { Scissors } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { reelSettings, sliceAudioWav, validateReel, reelLyricsIssue } from '@/lib/reel';
import { createProjectMp4 } from '@/lib/video-exporter';
import { preloadBackgroundImage, renderFrame } from './preview/canvas-renderer';
import { preloadVisualBranding } from '@/lib/visual-branding';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReelLyricsEditor } from './reel-lyrics-editor';
import type { ProjectSettings } from '@/lib/types';
import { VisualPresetPicker } from './properties/visual-preset-picker';

export function ReelDialog({ fromTimeline = false, onRequestAudio, onManualDesign, label, initialManual = false, simple = false, triggerVariant }: { triggerVariant?: 'default' | 'outline'; simple?: boolean; initialManual?: boolean; label?: string; fromTimeline?: boolean; onRequestAudio?: () => void; onManualDesign?: () => void }) {
  const { currentProject, updateSettings, setTab } = useStore();
  const audio = useAudioEngineContext();
  const [step, setStep] = useState(0);
  const [manual, setManual] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; blob: Blob } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const project = currentProject?.settings;
  const duration = audio.audioBuffer?.duration || audio.duration || project?.audioDuration || 0;
  const reel: NonNullable<ProjectSettings['reel']> = project?.reel || { start: 0, end: Math.min(30, duration), coverUrl: '', showLyrics: true, showTitle: true };
  const lyricsIssue = reelLyricsIssue(reel);
  let valid = true;
  try { validateReel(reel.start, reel.end, duration); } catch { valid = false; }
  const patch = (value: Partial<typeof reel>) => { updateSettings({ editingTarget: 'reel', reel: { ...reel, ...value } }); setResult(null); setError(''); };
  const setBoundary = (key: 'start' | 'end', value: number) => {
    if (!Number.isFinite(value)) return;
    const time = Math.max(0, Math.min(duration, value));
    audio.pause();
    setPreviewing(false);
    audio.seek(time);
    patch({ [key]: time });
  };
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => { setResult(null); }, [project]);
  useEffect(() => { if (!open || !previewing) return;
    if (audio.currentTime >= reel.end || audio.currentTime < reel.start - 0.1) { audio.pause(); setPreviewing(false); }
  }, [audio, open, previewing, reel.start, reel.end]);
  useEffect(() => {
    if (!open || !project || !valid || !canvas.current) return;
    let cancelled = false;
    const settings = reelSettings({ ...project, audioDuration: duration }, reel.start, reel.end, reel.coverUrl, reel.showLyrics, reel.showTitle);
    const bg = settings.background;
    Promise.all([
      ...[bg.imageUrl, ...bg.images, ...bg.imageClips.map(c => c.url), ...(bg.photoClips || []).map(c => c.url)].filter(Boolean).map(preloadBackgroundImage),
      preloadVisualBranding(settings.visualStyle || 'default'),
    ]).then(() => {
      if (cancelled || !canvas.current) return;
      const ctx = canvas.current.getContext('2d');
      if (ctx) renderFrame(ctx, 270, 480, settings, Math.max(0, Math.min(reel.end - reel.start, audio.currentTime - reel.start)));
    }).catch(() => { if (!cancelled) setError('No se pudo cargar una imagen para la vista previa.'); });
    return () => { cancelled = true; };
  }, [open, project, valid, duration, reel.start, reel.end, reel.coverUrl, reel.showLyrics, reel.showTitle, audio.currentTime]);

  if (!project) return null;
  const name = `${project.title || 'SonCeibe'}-reel`.replace(/[\\/:*?"<>|]/g, '-');
  const close = (value: boolean) => { if (busy) return; audio.pause(); setPreviewing(false); setOpen(value); if (value) { setStep(0); setManual(!simple && initialManual); if (duration >= 0.2) updateSettings({ editingTarget: 'reel', reel }); } };
  const uploadCover = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError('');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const output = document.createElement('canvas'); output.width = 1080; output.height = 1920;
      const ctx = output.getContext('2d')!;
      const scale = Math.max(1080 / img.width, 1920 / img.height);
      ctx.drawImage(img, (1080 - img.width * scale) / 2, (1920 - img.height * scale) / 2, img.width * scale, img.height * scale);
      patch({ coverUrl: output.toDataURL('image/jpeg', 0.9) });
    } catch { setError('No se pudo abrir la portada. Prueba con una imagen JPG o PNG.'); }
    finally { URL.revokeObjectURL(url); setBusy(false); }
  };
  const exportReel = async () => {
    if (lyricsIssue) { setError(lyricsIssue); return; }
    if (!audio.audioBuffer) { setError('Espera a que termine de cargar la canción.'); return; }
    setBusy(true); setError(''); setResult(null); setProgress(0); audio.pause(); setPreviewing(false);
    let url = ''; const clip = new Audio();
    try {
      const wav = sliceAudioWav(audio.audioBuffer, reel.start, reel.end);
      url = URL.createObjectURL(wav); clip.preload = 'auto';
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => { cleanup(); reject(new Error('No se pudo cargar el fragmento de audio.')); }, 15000);
        const cleanup = () => { clearTimeout(timeout); clip.oncanplay = null; clip.onerror = null; };
        clip.oncanplay = () => { cleanup(); resolve(); };
        clip.onerror = () => { cleanup(); reject(new Error('No se pudo leer el fragmento de audio.')); };
        clip.src = url; clip.load();
      });
      const settings = reelSettings({ ...project, audioDuration: duration }, reel.start, reel.end, reel.coverUrl, reel.showLyrics, reel.showTitle);
      const exported = await createProjectMp4({ audioEl: clip, duration: clip.duration, settings, target: 'mobile', onProgress: setProgress });
      setResult({ url: URL.createObjectURL(exported.blob), blob: exported.blob });
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear el Reel.'); }
    finally { clip.pause(); clip.removeAttribute('src'); clip.load(); if (url) URL.revokeObjectURL(url); setBusy(false); }
  };

  return <>
    <Button variant={triggerVariant || (fromTimeline ? "outline" : "default")} size="sm" className="gap-2" disabled={fromTimeline && !valid} onClick={() => close(true)}><Scissors className="h-4 w-4" />{label || (fromTimeline ? 'Crear Reel' : 'Reels')}</Button>
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onKeyDown={e => e.stopPropagation()} onInteractOutside={e => { if (busy) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>Reel de Instagram</DialogTitle><DialogDescription>{fromTimeline ? 'Fragmento seleccionado en la línea de tiempo.' : 'Elige el fragmento de la canción.'} MP4 · 1080 × 1920 · 9:16 · 30 FPS. El proyecto completo se conserva.</DialogDescription></DialogHeader>
        {!simple && <Button variant="outline" disabled={busy} onClick={() => { close(false); setTab('lyrics'); }}>Abrir edición avanzada · Letra y línea de tiempo</Button>}
        <fieldset disabled={busy} className="space-y-4">
          {!fromTimeline && <>
            <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">Crea tu Reel en tres pasos</p>{!simple && <Button variant="ghost" size="sm" onClick={() => setManual(!manual)}>{manual ? 'Volver a la guía' : 'Ajustar manualmente'}</Button>}</div>
            {!manual && <nav aria-label="Pasos del Reel" className="grid grid-cols-3 gap-2">{['Fragmento', 'Diseño', 'Exportar'].map((label, index) => <Button key={label} variant={step === index ? 'default' : 'outline'} aria-current={step === index ? 'step' : undefined} onClick={() => { audio.pause(); setPreviewing(false); setStep(index); }}>{index + 1}. {label}</Button>)}</nav>}
            {!audio.audioBuffer && <div role="status" className="rounded-lg border p-3 text-sm">Carga una canción para elegir el fragmento y exportar. <Button variant="outline" size="sm" onClick={() => { close(false); if (onRequestAudio) onRequestAudio(); else window.dispatchEvent(new Event('sonceibe:upload-audio')); }}>Cargar audio</Button></div>}
          </>}
          <div hidden={!fromTimeline && !manual && step !== 0} className="space-y-3">
          {!fromTimeline && <><p className="text-sm">Elige una duración aproximada o marca el inicio y el fin exactos. Al mover las barras también sitúas el audio en ese punto. El Reel durará lo que haya entre ambos cortes.</p><div className="flex flex-wrap gap-2">{[15, 30, 60].map(seconds => <Button key={seconds} variant="outline" size="sm" disabled={duration < 0.2} onClick={() => { const start = Math.max(0, Math.min(audio.currentTime, duration - Math.min(seconds, duration))); patch({ start: Math.round(start * 100) / 100, end: Math.min(duration, Math.round((start + seconds) * 100) / 100) }); }}>{seconds} segundos</Button>)}</div></>}
          {!fromTimeline && <div className="grid grid-cols-2 gap-3">
            {(['start', 'end'] as const).map(key => <div key={key} className="space-y-2">
              <label className="block text-sm">{key === 'start' ? 'Inicio (segundos)' : 'Fin (segundos)'}
                <input className="mt-1 w-full rounded border bg-background p-2" type="number" min={0} max={duration} step={0.01} value={reel[key]} onChange={e => setBoundary(key, Number(e.target.value))} />
              </label>
              <input aria-label={key === 'start' ? 'Mover inicio' : 'Mover fin'} className="w-full" type="range" min={0} max={duration} step={0.01} value={reel[key]} onChange={e => setBoundary(key, Number(e.target.value))} />
              <Button variant="outline" size="sm" aria-label={key === 'start' ? 'Usar posición actual como inicio' : 'Usar posición actual como fin'} onClick={() => setBoundary(key, Math.round((audio.audioEl?.currentTime ?? audio.currentTime) * 100) / 100)}>Usar posición actual</Button>
            </div>)}
          </div>}
          {!fromTimeline && <p className="text-xs text-muted-foreground" role="status">Posición actual del audio: {audio.currentTime.toFixed(2)} s. La previsualización empieza en Inicio y se detiene en Fin.</p>}
          {fromTimeline && <p className="text-sm">Inicio: {reel.start.toFixed(2)} s · Fin: {reel.end.toFixed(2)} s. Para ajustar el corte, vuelve a la línea de tiempo.</p>}
          <p className="text-sm" role="status">{valid ? `Duración del Reel: ${(reel.end - reel.start).toFixed(1)} s` : 'El inicio debe ser anterior al fin y ambos deben estar dentro de la canción (mínimo 0,2 s).'}</p>
          </div>
          <div hidden={!fromTimeline && !manual && step !== 1} className="space-y-3">
          {!fromTimeline && <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm">Plantillas opcionales · fondo, letra y animación</summary><p className="my-2 text-xs text-muted-foreground">Se aplican al diseño del proyecto y puedes deshacerlas en el editor. Conserva tu diseño si ya está listo.</p><VisualPresetPicker /></details>}
          <label className="block text-sm">Portada (opcional)
            <input aria-label="Portada del Reel" className="mt-2 block w-full text-sm" type="file" accept="image/*" onChange={e => { void uploadCover(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <p className="text-xs text-muted-foreground">La portada ocupa el fondo de todo el fragmento. Sin portada, se utiliza el montaje del proyecto en los tiempos elegidos.</p>
          {reel.coverUrl && <div className="flex gap-3"><Button variant="outline" size="sm" onClick={() => patch({ coverUrl: '' })}>Quitar portada</Button><a className="text-sm underline" href={reel.coverUrl} download={`${name}-portada.jpg`}>Descargar portada</a></div>}
          <div className="flex gap-4 text-sm"><label><input type="checkbox" checked={reel.showLyrics} onChange={e => patch({ showLyrics: e.target.checked })} /> Letra</label><label><input type="checkbox" checked={reel.showTitle} onChange={e => patch({ showTitle: e.target.checked })} /> Título</label></div>
          <ReelLyricsEditor simple={simple} active={open && (fromTimeline || manual || step === 1)} reel={reel} patch={patch} />
          {!simple && <Button variant="outline" size="sm" onClick={() => { close(false); if (onManualDesign) onManualDesign(); else setTab('background'); }}>Editar diseño a mano en el editor</Button>}
          </div>
          <div className="flex flex-col items-center gap-2">
            <canvas ref={canvas} width={270} height={480} className="h-64 w-36 rounded bg-black" aria-label="Vista previa del Reel" />
            <Button variant="outline" disabled={!valid || !audio.audioBuffer} onClick={() => { if (previewing) { audio.pause(); setPreviewing(false); } else { audio.seek(reel.start); void audio.play(); setPreviewing(true); } }}>{previewing ? 'Parar fragmento' : 'Escuchar y previsualizar fragmento'}</Button>
          </div>
          {(fromTimeline || manual || step === 2) && <><div aria-label="Resumen del Reel" className="rounded-lg border bg-secondary/30 p-3 text-sm space-y-1"><p>Fragmento: {reel.start.toFixed(1)}–{reel.end.toFixed(1)} s · {(reel.end - reel.start).toFixed(1)} s</p><p>Vertical · 1080 × 1920 · 9:16 · MP4 con música</p><p>Fondo: {reel.coverUrl ? 'Portada elegida' : 'Montaje del proyecto'} · Letra: {reel.showLyrics ? (reel.lyricsMode === 'custom' ? 'sólo del Reel' : 'del proyecto') : 'no'} · Título: {reel.showTitle ? 'sí' : 'no'}</p></div><Button className="w-full" disabled={!valid || !audio.audioBuffer || !!lyricsIssue} onClick={() => void exportReel()}>Crear Reel MP4</Button></>}
          {lyricsIssue && <p role="status" className="text-xs text-amber-500">{lyricsIssue}</p>}
          {!fromTimeline && !manual && <div className="flex justify-between gap-2"><Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Anterior</Button>{step < 2 && <Button disabled={!valid || !audio.audioBuffer} onClick={() => setStep(step + 1)}>Continuar</Button>}</div>}
        </fieldset>
        {busy && <p role="status">Preparando Reel… {Math.round(progress)} % · Mantén esta ventana abierta.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {result && <div className="space-y-3"><video src={result.url} controls className="mx-auto max-h-72 rounded" /><a className="block rounded bg-primary p-3 text-center text-primary-foreground" href={result.url} download={`${name}.mp4`}>Descargar Reel</a>
          {typeof navigator !== 'undefined' && navigator.canShare?.({ files: [new File([result.blob], `${name}.mp4`, { type: 'video/mp4' })] }) && <Button className="w-full" variant="outline" onClick={() => { void navigator.share({ files: [new File([result.blob], `${name}.mp4`, { type: 'video/mp4' })] }).catch(err => { if (err.name !== 'AbortError') setError('No se pudo compartir. Puedes descargar el Reel.'); }); }}>Compartir Reel</Button>}
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
