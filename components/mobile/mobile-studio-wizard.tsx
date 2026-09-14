'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Film,
  Home,
  Images,
  Music,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { useStudioUserId } from '@/lib/studio-user-context';
import {
  cleanLyricsText,
  cleanParsedLyrics,
  parseLrcLyrics,
  parseTxtLyrics,
  readLyricsFile,
} from '@/lib/lyrics-utils';
import { LOCAL_AUDIO_URL, getProjectAudio, saveProjectAudio } from '@/lib/local-media-storage';
import { getProjectAudioFromWorkspace, saveProjectAudioToWorkspace } from '@/lib/local-workspace';
import { LyricsSyncDialog } from '@/components/studio/lyrics/lyrics-sync-dialog';
import { MobileOrientationGate } from '@/components/studio/mobile-orientation-gate';
import { toast } from 'sonner';

const steps = [
  { id: 'music', label: 'Música', icon: Music },
  { id: 'lyrics', label: 'Letra', icon: FileText },
  { id: 'photos', label: 'Fotos', icon: Images },
  { id: 'finish', label: 'Vídeo', icon: Film },
] as const;

function prepareImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const maxWidth = 1920;
        const maxHeight = 1920;
        const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo preparar la imagen');
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.8));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer una de las fotos'));
    };
    image.src = objectUrl;
  });
}

export function MobileStudioWizard() {
  const {
    currentProject,
    updateSettings,
    updateBackground,
    updateExport,
    setLyrics,
    setExportOpen,
    closeProject,
  } = useStore();
  const audio = useAudioEngineContext();
  const userId = useStudioUserId();
  const [step, setStep] = useState(0);
  const [syncOpen, setSyncOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  const settings = currentProject?.settings;
  const hasLyrics = Boolean(settings?.lyrics.some((line) => line.text.trim()));
  const hasPhotos = Boolean((settings?.background.images?.length ?? 0) > 0 || settings?.background.imageUrl);
  const hasAudio = Boolean(audio.duration > 0 || settings?.audioDuration);

  useEffect(() => {
    if (!currentProject) return;
    updateExport({
      orientation: 'portrait',
      resolution: '1080p',
      fps: 30,
      includeAudio: true,
    });
    // Set the mobile project to fill a 9:16 phone screen instead of letterboxing photos.
    updateBackground({ imageFit: 'cover' });
    // Only apply the mobile defaults when entering this project in mobile mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject.id]);

  useEffect(() => {
    if (!currentProject || !audio.audioEl) return;

    let cancelled = false;
    const projectId = currentProject.id;
    const { audioName, audioUrl } = currentProject.settings;

    const restore = async () => {
      try {
        let file = await getProjectAudio(userId, projectId);
        if (!file && audioName) {
          file = await getProjectAudioFromWorkspace(userId, projectId, audioName);
          if (file) await saveProjectAudio(userId, projectId, file);
        }
        if (cancelled) return;

        if (file) {
          await audio.loadFile(file);
          if (audioUrl !== LOCAL_AUDIO_URL || audioName !== file.name) {
            updateSettings({ audioName: file.name, audioUrl: LOCAL_AUDIO_URL });
          }
          return;
        }

        if (audioUrl && !audioUrl.startsWith('blob:') && audioUrl !== LOCAL_AUDIO_URL) {
          await audio.loadFromUrl(audioUrl, audioName);
          return;
        }

        audio.clear();
      } catch (error) {
        console.error('Mobile audio restore failed:', error);
        audio.clear();
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject.id, userId, audio.audioEl]);

  useEffect(() => {
    if (!currentProject || audio.duration <= 0) return;
    if (Math.abs((currentProject.settings.audioDuration || 0) - audio.duration) > 0.1) {
      updateSettings({ audioDuration: audio.duration });
    }
  }, [audio.duration, currentProject, updateSettings]);

  const title = settings?.title || 'Proyecto';
  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  if (!currentProject || !settings) return null;

  const loadAudio = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await audio.loadFile(file);
      await saveProjectAudio(userId, currentProject.id, file);
      saveProjectAudioToWorkspace(userId, currentProject.id, file).catch(() => false);
      updateSettings({ audioName: file.name, audioUrl: LOCAL_AUDIO_URL });
      toast.success('Música guardada en el proyecto');
    } catch (error) {
      console.error('Mobile audio load failed:', error);
      toast.error('No se pudo cargar la música');
    } finally {
      event.target.value = '';
      setBusy(false);
    }
  };

  const loadLyrics = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const imported = await readLyricsFile(file);
      const duration = audio.duration || settings.audioDuration || 0;
      const isLrc = imported.format === 'lrc';
      const parsed = isLrc
        ? cleanParsedLyrics(parseLrcLyrics(imported.text)).lyrics
        : parseTxtLyrics(cleanLyricsText(imported.text).text, duration);
      const usable = parsed.filter((line) => line.text.trim());
      if (usable.length === 0) throw new Error('No se encontraron líneas de letra utilizables');
      setLyrics(parsed);
      toast.success(`Letra cargada · ${usable.length} líneas`);
      if (!isLrc && duration > 0) {
        toast.info('Puedes sincronizar la letra ahora tocando el botón Sincronizar');
      }
    } catch (error) {
      console.error('Mobile lyrics load failed:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la letra');
    } finally {
      event.target.value = '';
      setBusy(false);
    }
  };

  const loadPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const prepared = await Promise.all(files.map(prepareImage));
      const images = [...(settings.background.images ?? []), ...prepared];
      const duration = audio.duration || settings.audioDuration || 0;
      const imageDuration = duration > 0 && images.length > 0
        ? Math.max(1, duration / images.length)
        : 5;
      updateBackground({
        type: images.length > 1 ? 'images' : 'image',
        images,
        imageUrl: images[0] || '',
        imageMode: 'auto',
        imageDuration,
        imageFit: 'cover',
      });
      toast.success(`${prepared.length} foto${prepared.length !== 1 ? 's' : ''} añadida${prepared.length !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Mobile photo load failed:', error);
      toast.error('No se pudieron preparar las fotos');
    } finally {
      event.target.value = '';
      setBusy(false);
    }
  };

  const prepareVideo = () => {
    updateExport({ orientation: 'portrait', resolution: '1080p', fps: 30, includeAudio: true });
    updateBackground({ imageFit: 'cover' });
    setExportOpen(true);
  };

  const StepIcon = steps[step].icon;

  return (
    <>
      <MobileOrientationGate />
      <div className="mobile-studio-wizard h-[100dvh] overflow-y-auto bg-background">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <Button variant="ghost" size="icon" onClick={closeProject} aria-label="Volver a proyectos">
              <Home className="h-5 w-5" />
            </Button>
            <div className="min-w-0 text-center">
              <div className="truncate text-sm font-semibold">{title}</div>
              <div className="text-[11px] text-muted-foreground">Paso {step + 1} de {steps.length} · {steps[step].label}</div>
            </div>
            <div className="w-10" />
          </div>
          <div className="h-1 bg-secondary">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100dvh-72px)] max-w-lg flex-col px-4 py-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <StepIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{steps[step].label}</h1>
              <p className="text-xs text-muted-foreground">Todo es opcional salvo la música para crear el MP4</p>
            </div>
          </div>

          {step === 0 && (
            <Card className="p-5 space-y-4">
              <div>
                <h2 className="font-medium">Añade la canción</h2>
                <p className="mt-1 text-sm text-muted-foreground">Quedará guardada localmente con este proyecto para no tener que buscarla de nuevo.</p>
              </div>
              <input ref={audioInputRef} type="file" accept=".mp3,audio/*" className="hidden" onChange={loadAudio} />
              <Button className="w-full gap-2 h-12" onClick={() => audioInputRef.current?.click()} disabled={busy}>
                <Upload className="h-4 w-4" />
                {hasAudio ? 'Cambiar música' : 'Elegir música'}
              </Button>
              {settings.audioName && (
                <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="truncate">{settings.audioName}</span>
                </div>
              )}
            </Card>
          )}

          {step === 1 && (
            <Card className="p-5 space-y-4">
              <div>
                <h2 className="font-medium">Añade la letra</h2>
                <p className="mt-1 text-sm text-muted-foreground">TXT, LRC, ODT, DOCX, RTF, HTML o Markdown. Studio limpia acordes y etiquetas automáticamente.</p>
              </div>
              <input
                ref={lyricsInputRef}
                type="file"
                accept=".txt,.lrc,.odt,.docx,.rtf,.html,.htm,.md,.markdown,text/plain,application/rtf,application/vnd.oasis.opendocument.text,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={loadLyrics}
              />
              <Button className="w-full gap-2 h-12" onClick={() => lyricsInputRef.current?.click()} disabled={busy}>
                <FileText className="h-4 w-4" />
                {hasLyrics ? 'Cambiar letra' : 'Elegir letra'}
              </Button>
              {hasLyrics && (
                <>
                  <div className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                    <span className="font-medium">{settings.lyrics.filter((line) => line.text.trim()).length}</span> líneas cargadas
                  </div>
                  {hasAudio && (
                    <Button variant="outline" className="w-full h-11" onClick={() => setSyncOpen(true)}>
                      Sincronizar letra con la canción
                    </Button>
                  )}
                </>
              )}
            </Card>
          )}

          {step === 2 && (
            <Card className="p-5 space-y-4">
              <div>
                <h2 className="font-medium">Añade fotos</h2>
                <p className="mt-1 text-sm text-muted-foreground">Puedes elegir varias de una vez. En vídeo móvil se recortarán automáticamente para llenar toda la pantalla 9:16.</p>
              </div>
              <input ref={photosInputRef} type="file" accept="image/*" multiple className="hidden" onChange={loadPhotos} />
              <Button className="w-full gap-2 h-12" onClick={() => photosInputRef.current?.click()} disabled={busy}>
                <Images className="h-4 w-4" />
                {hasPhotos ? 'Añadir más fotos' : 'Elegir fotos'}
              </Button>
              {(settings.background.images?.length ?? 0) > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {settings.background.images.slice(0, 6).map((src, index) => (
                    <div key={`${src}-${index}`} className="aspect-[9/16] overflow-hidden rounded-lg bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              {hasPhotos && (
                <div className="text-xs text-muted-foreground">Las fotos se repartirán automáticamente a lo largo de la canción.</div>
              )}
            </Card>
          )}

          {step === 3 && (
            <Card className="p-5 space-y-4">
              <div>
                <h2 className="font-medium">Listo para crear el vídeo</h2>
                <p className="mt-1 text-sm text-muted-foreground">El MP4 se generará en vertical 1080×1920 (9:16), pensado para verse a pantalla completa en el móvil.</p>
              </div>
              <div className="space-y-2 rounded-lg bg-secondary/40 p-3 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Música</span><span className="truncate">{settings.audioName || 'No añadida'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Letra</span><span>{hasLyrics ? `${settings.lyrics.filter((line) => line.text.trim()).length} líneas` : 'Sin letra'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Fotos</span><span>{settings.background.images?.length ?? (settings.background.imageUrl ? 1 : 0)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Formato</span><span>1080×1920 · 30 FPS</span></div>
              </div>
              <Button className="w-full h-13 gap-2" onClick={prepareVideo} disabled={!hasAudio}>
                <Film className="h-5 w-5" />
                Crear MP4 para móvil
              </Button>
              {!hasAudio && <p className="text-xs text-destructive">Para crear el vídeo necesitas añadir una canción.</p>}
            </Card>
          )}

          <div className="mt-auto flex gap-2 pt-6 pb-3">
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || busy}
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </Button>
            {step < steps.length - 1 && (
              <Button
                className="flex-1 gap-1.5"
                onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
                disabled={busy}
              >
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </main>
      </div>

      <LyricsSyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
    </>
  );
}
