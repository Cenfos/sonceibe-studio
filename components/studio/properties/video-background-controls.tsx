 'use client';
import { useRef, useState } from 'react';
import { Film, Music2, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useStudioUserId } from '@/lib/studio-user-context';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { saveSourceVideo, saveProjectAudio, deleteProjectAudio, LOCAL_AUDIO_URL } from '@/lib/local-media-storage';
import { MAX_SOURCE_VIDEO_BYTES, openSourceVideo, releaseVideo, videoRange } from '@/lib/source-video';
import { Button } from '@/components/ui/button';
import { ImageFramingControls } from './image-framing-controls';
import { toast } from 'sonner';

export function VideoBackgroundControls() {
  const { currentProject, updateBackground, updateSettings, saveVersion } = useStore();
  const userId = useStudioUserId(), audio = useAudioEngineContext();
  const [busy, setBusy] = useState(false);
  const latestProject = useRef(currentProject?.id); latestProject.current = currentProject?.id;
  if (!currentProject) return null;
  const project = currentProject, bg = project.settings.background, active = bg.type === 'video' && !!bg.videoUrl;
  const range = videoRange(bg);
  const uploadVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || busy) return;
    setBusy(true); let video: HTMLVideoElement | null = null, url = '';
    try {
      if (file.size > MAX_SOURCE_VIDEO_BYTES) throw new Error('El vídeo supera los 100 MB. Recórtalo o comprímelo antes de importarlo.');
      url = URL.createObjectURL(file); video = await openSourceVideo(url);
      if (video.duration > 600) throw new Error('En esta versión el vídeo puede durar hasta 10 minutos. Recórtalo antes de importarlo.');
      if (latestProject.current !== project.id) return;
      await saveVersion('Antes de cambiar el vídeo de fondo');
      const videoUrl = await saveSourceVideo(userId, project.id, file);
      if (latestProject.current !== project.id) return;
      updateBackground({ type: 'video', videoUrl, videoName: file.name, videoDuration: video.duration, videoStart: 0, videoEnd: video.duration, videoMuted: false, videoVolume: 1, songVolume: 1, songOffset: 0, videoPlacement: { scale: 100, x: 50, y: 50, fit: 'cover' } });
      toast.success('Vídeo cargado y guardado en este equipo');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo importar el vídeo'); }
    finally { if (video) releaseVideo(video); if (url) URL.revokeObjectURL(url); setBusy(false); }
  };
  const uploadSong = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || busy) return;
    setBusy(true);
    try {
      await saveVersion('Antes de cambiar la canción'); await saveProjectAudio(userId, project.id, file);
      if (latestProject.current !== project.id) return;
      await audio.loadFile(file); updateSettings({ audioName: file.name, audioUrl: LOCAL_AUDIO_URL }); updateBackground({ songOffset: 0 });
    } catch { toast.error('No se pudo guardar la canción. El proyecto anterior se conserva.'); }
    finally { setBusy(false); }
  };
  const removeSong = async () => {
    setBusy(true);
    try { await saveVersion('Antes de quitar la canción'); await deleteProjectAudio(userId, project.id); audio.clear(); updateSettings({ audioName: '', audioUrl: '' }); }
    catch { toast.error('No se pudo quitar la canción'); } finally { setBusy(false); }
  };
  return <section aria-label="Vídeo de fondo y sonido" className="space-y-3 rounded-xl border border-border bg-card/30 p-3">
    <h3 className="text-sm font-semibold">Vídeo de fondo</h3>
    <Button asChild variant="outline" size="sm" className="w-full gap-2" disabled={busy}><label className="cursor-pointer"><Film className="h-4 w-4" />{busy ? 'Preparando…' : bg.videoUrl ? 'Cambiar vídeo' : 'Cargar vídeo del móvil'}<input aria-label="Vídeo de fondo" type="file" accept="video/*,.mp4,.mov,.webm" disabled={busy} className="hidden" onChange={uploadVideo} /></label></Button>
    {bg.videoUrl && !active && <Button type="button" variant="outline" size="sm" onClick={() => updateBackground({ type: 'video' })}>Usar el vídeo guardado</Button>}
    {active && <>
      <p className="break-all text-xs text-muted-foreground">{bg.videoName || 'Vídeo cargado'} · {range.duration.toFixed(2)} s de montaje</p>
      <fieldset className="grid grid-cols-2 gap-2 text-xs"><legend className="mb-2 font-medium">Recorte del vídeo (segundos)</legend>
        <label>Inicio<input aria-label="Inicio del vídeo" className="mt-1 w-full rounded border border-border bg-background p-2" type="number" min={0} max={Math.max(0, range.end - 0.2)} step={0.1} value={range.start} onChange={e => { const n = e.currentTarget.valueAsNumber; if (Number.isFinite(n)) updateBackground({ videoStart: Math.max(0, Math.min(range.end - 0.2, n)) }); }} /></label>
        <label>Final<input aria-label="Final del vídeo" className="mt-1 w-full rounded border border-border bg-background p-2" type="number" min={range.start + 0.2} max={bg.videoDuration} step={0.1} value={range.end} onChange={e => { const n = e.currentTarget.valueAsNumber; if (Number.isFinite(n)) updateBackground({ videoEnd: Math.min(bg.videoDuration!, Math.max(range.start + 0.2, n)) }); }} /></label>
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!bg.videoMuted} onChange={e => updateBackground({ videoMuted: !e.target.checked })} />Mantener sonido original</label>
      {!bg.videoMuted && <label className="block text-xs">Volumen original · {Math.round((bg.videoVolume ?? 1) * 100)}%<input aria-label="Volumen del vídeo" type="range" min={0} max={1} step={0.05} value={bg.videoVolume ?? 1} onChange={e => updateBackground({ videoVolume: Number(e.target.value) })} className="mt-2 block w-full accent-primary" /></label>}
      <Button asChild variant="outline" size="sm" className="w-full gap-2"><label className="cursor-pointer"><Music2 className="h-4 w-4" />{project.settings.audioName ? 'Cambiar canción' : 'Añadir canción encima'}<input aria-label="Canción para el vídeo" type="file" accept="audio/*" disabled={busy} className="hidden" onChange={uploadSong} /></label></Button>
      {project.settings.audioName && <>
        <p className="break-all text-xs text-muted-foreground">Canción: {project.settings.audioName}</p>
        <label className="block text-xs">Empezar canción desde (segundos)<input aria-label="Inicio de la canción" type="number" min={0} step={0.1} value={bg.songOffset || 0} onChange={e => { const n = e.currentTarget.valueAsNumber; if (Number.isFinite(n)) updateBackground({ songOffset: Math.max(0, n) }); }} className="mt-1 w-full rounded border border-border bg-background p-2" /></label>
        <label className="block text-xs">Volumen canción · {Math.round((bg.songVolume ?? 1) * 100)}%<input aria-label="Volumen de la canción" type="range" min={0} max={1} step={0.05} value={bg.songVolume ?? 1} onChange={e => updateBackground({ songVolume: Number(e.target.value) })} className="mt-2 block w-full accent-primary" /></label>
        <Button variant="ghost" size="sm" disabled={busy} onClick={removeSong}>Quitar canción añadida</Button>
      </>}
      <p className="text-xs leading-5 text-muted-foreground">El montaje dura lo que el recorte del vídeo. La canción empieza junto al vídeo desde el segundo elegido; si termina antes, el resto queda sin esa canción.</p>
      <ImageFramingControls label="vídeo" value={bg.videoPlacement} fit="cover" maxScale={300} onChange={videoPlacement => updateBackground({ videoPlacement })} />
      <Button variant="outline" size="sm" className="w-full gap-2" disabled={busy} onClick={() => updateBackground({ type: 'gradient', videoUrl: '', videoName: '', videoDuration: 0, videoStart: 0, videoEnd: 0 })}><Trash2 className="h-4 w-4" />Quitar vídeo · conservar canción</Button>
    </>}
    {audio.mediaBusy && <p role="status" className="text-xs text-muted-foreground">Preparando vídeo y sonido…</p>}
    {audio.mediaError && <p role="alert" className="text-xs text-destructive">{audio.mediaError}</p>}
    <p className="text-xs text-muted-foreground">MP4, MOV o WebM compatibles con tu navegador · hasta 100 MB y 10 minutos. Para mayor compatibilidad: MP4 H.264/AAC.</p>
  </section>;
}
