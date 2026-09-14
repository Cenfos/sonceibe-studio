'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Pause, Play, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { formatTime } from '@/lib/format';
import { preloadBackgroundImage, renderFrame } from '@/components/studio/preview/canvas-renderer';
import { preloadVisualBranding } from '@/lib/visual-branding';

const WIDTH = 720;
const HEIGHT = 1280;

export function MobilePreviewLauncher() {
  const { currentProject } = useStore();
  const audio = useAudioEngineContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);

  const settings = currentProject?.settings;
  const duration = audio.duration || settings?.audioDuration || 0;
  const sources = useMemo(() => {
    if (!settings) return [];
    const values = new Set<string>();
    const bg = settings.background;
    if (bg.imageUrl) values.add(bg.imageUrl);
    for (const src of bg.images ?? []) if (src) values.add(src);
    for (const clip of bg.imageClips ?? []) if (clip.url) values.add(clip.url);
    return Array.from(values);
  }, [settings]);

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !settings) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderFrame(ctx, WIDTH, HEIGHT, settings, time);
  }, [settings]);

  useEffect(() => {
    if (!open || !settings) return;
    let cancelled = false;

    Promise.all([
      ...sources.map((src) => preloadBackgroundImage(src)),
      preloadVisualBranding(settings.visualStyle),
    ]).then(() => {
      if (!cancelled) draw(audio.audioEl?.currentTime ?? audio.currentTime);
    });

    return () => {
      cancelled = true;
    };
  }, [audio.audioEl, audio.currentTime, draw, open, settings, sources]);

  useEffect(() => {
    if (!open || !audio.isPlaying || !audio.audioEl) {
      if (open) draw(audio.audioEl?.currentTime ?? audio.currentTime);
      return;
    }

    const element = audio.audioEl;
    let frameId = 0;
    const loop = () => {
      draw(element.currentTime);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [audio.audioEl, audio.currentTime, audio.isPlaying, draw, open]);

  useEffect(() => {
    if (open) return;
    audio.pause();
  }, [audio, open]);

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
      {!open && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="fixed right-3 top-2.5 z-[73] h-9 w-9 bg-background/85 shadow-sm backdrop-blur"
          title="Ver proyecto"
          aria-label="Ver proyecto"
        >
          <Eye className="h-4 w-4" />
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-black/95 text-white">
          <header className="flex items-center justify-between px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Vista previa</div>
              <div className="truncate text-[11px] text-white/60">{settings.title}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={closePreview} className="text-white hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-3">
            <div className="h-full max-h-[72dvh] overflow-hidden rounded-xl bg-black shadow-2xl" style={{ aspectRatio: '9 / 16' }}>
              <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="h-full w-full" />
            </div>
          </div>

          <div className="space-y-3 border-t border-white/10 bg-black/80 px-4 pb-5 pt-4">
            <input
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
                <Button size="icon" className="h-12 w-12 rounded-full" onClick={togglePlay} disabled={duration <= 0}>
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
