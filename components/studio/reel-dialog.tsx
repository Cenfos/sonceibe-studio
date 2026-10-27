'use client';

import { useEffect, useRef, useState } from 'react';
import { Scissors } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { reelSettings, sliceAudioWav, validateReel } from '@/lib/reel';
import { createProjectMp4 } from '@/lib/video-exporter';
import { preloadBackgroundImage, renderFrame } from './preview/canvas-renderer';
import { preloadVisualBranding } from '@/lib/visual-branding';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ReelDialog() {
  const { currentProject, updateSettings } = useStore();
  const audio = useAudioEngineContext();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; blob: Blob } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const project = currentProject?.settings;
  const duration = audio.audioBuffer?.duration || audio.duration || project?.audioDuration || 0;
  const reel = project?.reel || { start: 0, end: Math.min(30, duration), coverUrl: '', showLyrics: true, showTitle: true };
  let valid = true;
  try { validateReel(reel.start, reel.end, duration); } catch { valid = false; }
  const patch = (value: Partial<typeof reel>) => { updateSettings({ reel: { ...reel, ...value } }); setResult(null); setError(''); };
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
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
  const close = (value: boolean) => { if (busy) return; audio.pause(); setPreviewing(false); setOpen(value); };
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
    <Button variant="outline" size="sm" className="gap-2" onClick={() => close(true)}><Scissors className="h-4 w-4" />Reels</Button>
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onKeyDown={e => e.stopPropagation()} onInteractOutside={e => { if (busy) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>Reel de Instagram</DialogTitle><DialogDescription>Elige el fragmento de la canción. MP4 · 1080 × 1920 · 9:16 · 30 FPS. El proyecto completo se conserva.</DialogDescription></DialogHeader>
        <fieldset disabled={busy} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(['start', 'end'] as const).map(key => <div key={key} className="space-y-2">
              <label className="block text-sm">{key === 'start' ? 'Inicio (segundos)' : 'Fin (segundos)'}
                <input className="mt-1 w-full rounded border bg-background p-2" type="number" min={0} max={duration} step={0.1} value={reel[key]} onChange={e => patch({ [key]: Number(e.target.value) })} />
              </label>
              <input aria-label={key === 'start' ? 'Mover inicio' : 'Mover fin'} className="w-full" type="range" min={0} max={duration} step={0.1} value={reel[key]} onChange={e => patch({ [key]: Number(e.target.value) })} />
              <Button variant="outline" size="sm" onClick={() => patch({ [key]: Math.round(audio.currentTime * 10) / 10 })}>Usar posición actual</Button>
            </div>)}
          </div>
          <p className="text-sm" role="status">{valid ? `Duración del Reel: ${(reel.end - reel.start).toFixed(1)} s` : 'El inicio debe ser anterior al fin y ambos deben estar dentro de la canción (mínimo 0,2 s).'}</p>
          <label className="block text-sm">Portada (opcional)
            <input aria-label="Portada del Reel" className="mt-2 block w-full text-sm" type="file" accept="image/*" onChange={e => { void uploadCover(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <p className="text-xs text-muted-foreground">La portada ocupa el fondo de todo el fragmento. Sin portada, se utiliza el montaje del proyecto en los tiempos elegidos.</p>
          {reel.coverUrl && <div className="flex gap-3"><Button variant="outline" size="sm" onClick={() => patch({ coverUrl: '' })}>Quitar portada</Button><a className="text-sm underline" href={reel.coverUrl} download={`${name}-portada.jpg`}>Descargar portada</a></div>}
          <div className="flex gap-4 text-sm"><label><input type="checkbox" checked={reel.showLyrics} onChange={e => patch({ showLyrics: e.target.checked })} /> Letra</label><label><input type="checkbox" checked={reel.showTitle} onChange={e => patch({ showTitle: e.target.checked })} /> Título</label></div>
          <div className="flex flex-col items-center gap-2">
            <canvas ref={canvas} width={270} height={480} className="h-64 w-36 rounded bg-black" aria-label="Vista previa del Reel" />
            <Button variant="outline" disabled={!valid || !audio.audioBuffer} onClick={() => { if (previewing) { audio.pause(); setPreviewing(false); } else { audio.seek(reel.start); void audio.play(); setPreviewing(true); } }}>{previewing ? 'Parar fragmento' : 'Escuchar y previsualizar fragmento'}</Button>
          </div>
          <Button className="w-full" disabled={!valid || !audio.audioBuffer} onClick={() => void exportReel()}>Crear Reel MP4</Button>
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
