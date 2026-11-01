'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { formatTime } from '@/lib/format';
import { preloadBackgroundImage, renderFrame } from '@/components/studio/preview/canvas-renderer';
import { preloadVisualBranding } from '@/lib/visual-branding';
import { settingsForVideoTarget } from '@/lib/video-profiles';

const WIDTH = 720;
const HEIGHT = 1280;

export function MobilePreviewLauncher() {
  const { currentProject } = useStore();
  const audio = useAudioEngineContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);

  useEffect(() => {
    const openPreview = () => setOpen(true);
    window.addEventListener('sonceibe:open-mobile-preview', openPreview);
    return () => window.removeEventListener('sonceibe:open-mobile-preview', openPreview);
  }, []);

  const settings = currentProject?.settings;
  const mobileSettings = useMemo(
    () => settings ? settingsForVideoTarget(settings, 'mobile') : null,
    [settings]
  );

  const duration = audio.duration || settings?.audioDuration || 0;
  const sources = useMemo(() => {
    if (!mobileSettings) return [];
    const values = new Set<string>();
    const bg = mobileSettings.background;
    if (bg.imageUrl) values.add(bg.imageUrl);
    for (const src of bg.images ?? []) if (src) values.add(src);
    for (const clip of [...(bg.imageClips ?? []), ...(bg.photoClips ?? [])]) if (clip.url) values.add(clip.url);
    return Array.from(values);
  }, [mobileSettings]);

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !mobileSettings || audio.videoEl?.seeking) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderFrame(ctx, WIDTH, HEIGHT, mobileSettings, time, audio.videoEl);
  }, [mobileSettings, audio.videoEl]);

  useEffect(() => {
    if (!open || !mobileSettings) return;
    let cancelled = false;

    Promise.all([
      ...sources.map((src) => preloadBackgroundImage(src)),
      preloadVisualBranding(mobileSettings.visualStyle, mobileSettings.showSonCeibeBranding),
    ]).then(() => {
      if (!cancelled) draw(audio.audioEl?.currentTime ?? audio.currentTime);
    });

    return () => {
      cancelled = true;
    };
  }, [audio.audioEl, audio.currentTime, draw, mobileSettings, open, sources]);

  useEffect(() => {
    if (!open) return;
    let frameId = 0, previousTime = -1, previousVideoTime = -1;
    const video = audio.videoEl;
    const refreshed = () => { previousTime = -1; };
    video?.addEventListener('seeked', refreshed);
    video?.addEventListener('loadeddata', refreshed);
    const loop = () => {
      const time = audio.audioEl?.currentTime ?? audio.currentTime;
      const videoTime = audio.videoEl?.currentTime ?? -1;
      if (time !== previousTime || videoTime !== previousVideoTime) draw(time);
      previousTime = time; previousVideoTime = videoTime;
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frameId); video?.removeEventListener('seeked', refreshed); video?.removeEventListener('loadeddata', refreshed); };
  }, [audio.audioEl, audio.videoEl, audio.currentTime, draw, open]);

  if (!currentProject || !settings) return null;

  const togglePlay = () => {
    if (duration <= 0) return;
    if (audio.currentTime >= duration - 0.05) audio.seek(0);
    if (audio.isPlaying) audio.pause();
    else audio.play();
  };

  const closePreview = () => {
    audio.pause();
    setOpen(false);
  };

  return (
    <>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Vista previa del proyecto" className="fixed inset-0 z-[110] flex flex-col bg-black text-white">
          <header className="flex items-center justify-between px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Vista previa</div>
              <div className="truncate text-[11px] text-white/60">{settings.title}</div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant={showSafeZone ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowSafeZone((value) => !value)}
                className="gap-1.5 text-white hover:bg-white/10 hover:text-white"
                aria-pressed={showSafeZone}
              >
                <ShieldCheck className="h-4 w-4" />
                Zona segura
              </Button>
              <Button variant="ghost" size="icon" aria-label="Cerrar vista previa" onClick={closePreview} className="text-white hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-3">
            <div className="relative h-full max-h-[72dvh] overflow-hidden rounded-xl bg-black shadow-2xl" style={{ aspectRatio: '9 / 16' }}>
              <canvas aria-label="Imagen del proyecto" ref={canvasRef} width={WIDTH} height={HEIGHT} className="h-full w-full" />
              {showSafeZone && (
                <div className="pointer-events-none absolute inset-0 z-20 text-[8px] font-medium text-white/90">
                  <div className="absolute inset-[5%] rounded border border-dashed border-cyan-300/80">
                    <span className="absolute left-1 top-1 rounded bg-black/65 px-1">Área visible segura</span>
                  </div>
                  <div className="absolute left-[10%] right-[10%] top-[8%] h-[20%] rounded border border-dashed border-amber-300/90">
                    <span className="absolute left-1 top-1 rounded bg-black/65 px-1">Título</span>
                  </div>
                  <div className="absolute bottom-[20%] left-[10%] right-[10%] h-[36%] rounded border border-dashed border-emerald-300/90">
                    <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1">Letra</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-[17%] border-t border-dashed border-fuchsia-300/70 bg-fuchsia-500/10">
                    <span className="absolute left-1 top-1 rounded bg-black/65 px-1">Controles de Reels</span>
                  </div>
                  <div className="absolute bottom-[17%] right-0 top-[18%] w-[13%] border-l border-dashed border-fuchsia-300/70 bg-fuchsia-500/10">
                    <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 [writing-mode:vertical-rl]">Iconos</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {audio.mediaBusy && <p role="status" className="text-center text-sm">Preparando vídeo y sonido…</p>}
          {audio.mediaError && <p role="alert" className="px-4 text-center text-sm">{audio.mediaError}</p>}
          <div className="space-y-3 border-t border-white/10 bg-black/80 px-4 pb-5 pt-4">
            <input
              aria-label="Posición de la vista previa"
              type="range"
              min={0}
              max={duration || 1}
              step={0.05}
              value={Math.min(audio.currentTime, duration || 0)}
              onChange={(event) => {
                const value = Number(event.target.value);
                audio.seek(value);
                draw(value);
              }}
              className="w-full accent-white"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="w-16 text-xs tabular-nums text-white/70">{formatTime(audio.currentTime)}</span>
              <div className="flex items-center gap-2">
                <Button
                  aria-label="Volver al principio"
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    audio.seek(0);
                    draw(0);
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button size="icon" className="h-12 w-12 rounded-full" aria-label={audio.isPlaying ? 'Pausar vista previa' : 'Reproducir vista previa'} onClick={togglePlay} disabled={duration <= 0 || audio.mediaBusy || !!audio.mediaError}>
                  {audio.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                </Button>
              </div>
              <span className="w-16 text-right text-xs tabular-nums text-white/70">{formatTime(duration)}</span>
            </div>
            {duration <= 0 && (
              <p className="text-center text-xs text-white/60">El proyecto se puede ver, pero necesita música para reproducirse.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
