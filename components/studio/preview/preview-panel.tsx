'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePreviewOptions } from './preview-options';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { reelSettings } from '@/lib/reel';
import { formatTimecode } from '@/lib/format';
import { preloadVisualBranding } from '@/lib/visual-branding';
import { sanitizeRenderSettings } from '@/lib/render-safety';
import { VIDEO_PROFILES, settingsForVideoTarget, videoTargetFromOrientation } from '@/lib/video-profiles';
import { preloadBackgroundImage, renderFrame } from './canvas-renderer';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PreviewPanel() {
  const { currentProject } = useStore();
  const audio = useAudioEngineContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 640, height: 360 });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const { zoom, showSafeZone } = usePreviewOptions();

  const duration = audio.duration || currentProject?.settings.audioDuration || 0;
  const settings = currentProject?.settings;
  const reel = settings?.reel;
  const editingReel = !!reel && settings?.editingTarget !== 'full' && reel.end > reel.start && reel.end <= duration;
  const target = editingReel ? 'mobile' : videoTargetFromOrientation(settings?.exportConfig.orientation);
  const profile = VIDEO_PROFILES[target];
  const safeSettings = useMemo(
    () => settings
      ? sanitizeRenderSettings(editingReel && reel ? reelSettings({ ...settings, audioDuration: duration }, reel.start, reel.end, reel.coverUrl, reel.showLyrics, reel.showTitle) : settingsForVideoTarget(settings, target))
      : null,
    [settings, target, editingReel, duration, reel]
  );
  useEffect(() => { if (editingReel && reel && audio.isPlaying && audio.currentTime >= reel.end) audio.pause(); }, [editingReel, reel, audio]);
  const orientation = profile.orientation;
  const isPortrait = target === 'mobile';
  const canvasWidth = profile.width;
  const canvasHeight = profile.height;
  const frameRatio = canvasWidth / canvasHeight;
  const previewWidth = Math.min(stageSize.width, stageSize.height * frameRatio) * Math.min(1, zoom);

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !safeSettings) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      renderFrame(ctx, canvas.width, canvas.height, safeSettings, editingReel && reel ? Math.max(0, time - reel.start) : time);
    } catch (error) {
      console.error('Preview render error:', error);
      ctx.save();
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No se pudo mostrar este fotograma', canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }
  }, [safeSettings, editingReel, reel]);

  useEffect(() => {
    let cancelled = false;
    void preloadVisualBranding(settings?.visualStyle, settings?.showSonCeibeBranding).then(() => {
      if (!cancelled) draw(audio.audioEl?.currentTime ?? 0);
    });
    return () => { cancelled = true; };
  }, [settings?.visualStyle, settings?.showSonCeibeBranding, draw, audio.audioEl]);

  useEffect(() => {
    if (!audio.isPlaying) {
      draw(audio.audioEl?.currentTime ?? audio.currentTime);
    }
  }, [audio.isPlaying, audio.audioEl, audio.currentTime, draw, orientation]);

  useEffect(() => {
    if (!safeSettings) return;
    const bg = safeSettings.background;

    const clipSources = (bg.imageClips ?? []).map((clip) => clip.url);
    const sources = bg.type === 'images' && bg.images.length > 0
      ? [...bg.images, ...clipSources]
      : bg.imageUrl
        ? [bg.imageUrl]
        : [];

    const uniqueSources = Array.from(new Set([...sources, ...(bg.photoClips ?? []).map(clip => clip.url)].filter(Boolean)));
    if (uniqueSources.length === 0) return;

    let cancelled = false;
    Promise.all(uniqueSources.map(preloadBackgroundImage)).then(() => {
      if (!cancelled) {
        draw(audio.audioEl?.currentTime ?? audio.currentTime);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [safeSettings, audio.audioEl, audio.currentTime, draw]);

  useEffect(() => {
    if (!audio.isPlaying || !audio.audioEl) return;

    const el = audio.audioEl;
    let frameId = 0;

    const loop = () => {
      draw(el.currentTime);
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [audio.isPlaying, audio.audioEl, draw]);

  const togglePlay = () => {
    if (editingReel && reel && (audio.currentTime < reel.start || audio.currentTime >= reel.end)) audio.seek(reel.start);
    else if (audio.currentTime >= duration) audio.seek(0);
    if (audio.isPlaying) audio.pause();
    else audio.play();
  };

  const stop = () => { audio.pause(); audio.seek(editingReel && reel ? reel.start : 0); };
  const seek = (val: number[]) => audio.seek(val[0]);
  const skipBack = () => audio.seek(Math.max(0, audio.currentTime - 5));
  const skipForward = () => audio.seek(Math.min(duration, audio.currentTime + 5));

  useEffect(() => {
    const fullscreen = () => {
      const element = containerRef.current;
      if (!element) return;
      const request = document.fullscreenElement ? document.exitFullscreen() : element.requestFullscreen();
      void request.catch(() => {});
    };
    window.addEventListener('sonceibe:preview-fullscreen', fullscreen);
    return () => window.removeEventListener('sonceibe:preview-fullscreen', fullscreen);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex flex-1 min-h-0 min-w-0 gap-3 p-3 bg-[hsl(222_20%_5%)]">
      <div ref={stageRef} className="studio-preview-stage flex-1 min-w-0 min-h-0 flex items-center justify-center overflow-hidden" aria-label="Vista previa del vídeo">
        <div
          ref={containerRef}
          className="relative shadow-2xl rounded-lg overflow-hidden bg-black"
          style={{
            width: previewWidth,
            height: previewWidth / frameRatio,
            flexShrink: 0,
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full block"
          />
          {showSafeZone ? (
            <div className="pointer-events-none absolute inset-0 z-20 text-[9px] font-medium text-white/90">
              <div className="absolute inset-[5%] rounded border border-dashed border-cyan-300/80">
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1">Área visible segura</span>
              </div>
              <div className="absolute left-[10%] right-[10%] top-[8%] h-[20%] rounded border border-dashed border-amber-300/90">
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1">Título</span>
              </div>
              <div className="absolute bottom-[20%] left-[10%] right-[10%] h-[36%] rounded border border-dashed border-emerald-300/90">
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1">Letra</span>
              </div>
              {isPortrait ? (
                <>
                  <div className="absolute bottom-0 left-0 right-0 h-[17%] bg-fuchsia-500/10 border-t border-dashed border-fuchsia-300/70">
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1">Controles inferiores de Reels</span>
                  </div>
                  <div className="absolute bottom-[17%] right-0 top-[18%] w-[13%] bg-fuchsia-500/10 border-l border-dashed border-fuchsia-300/70">
                    <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 [writing-mode:vertical-rl]">Iconos</span>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <aside aria-label="Reproductor" className="studio-preview-controls flex w-20 shrink-0 flex-col items-center gap-2 overflow-y-auto rounded-xl border border-border bg-card/50 px-2 py-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Retroceder 5 segundos" onClick={skipBack}><SkipBack className="h-4 w-4" /></Button>
        <Button size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label={audio.isPlaying ? 'Pausar' : 'Reproducir'} onClick={togglePlay}>{audio.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}</Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Detener" onClick={stop}><Square className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Avanzar 5 segundos" onClick={skipForward}><SkipForward className="h-4 w-4" /></Button>
        <output aria-label="Tiempo de reproducción" className="text-[10px] font-mono text-muted-foreground tabular-nums">{formatTimecode(audio.currentTime)}</output>
        <input aria-label="Posición del reproductor" type="range" min={0} max={duration || 1} step={0.01} value={audio.currentTime} onChange={event => seek([Number(event.target.value)])} className="min-h-16 w-5 flex-1 accent-primary [writing-mode:vertical-lr] [direction:rtl]" />
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{formatTimecode(duration)}</span>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={audio.muted ? 'Activar sonido' : 'Silenciar'} onClick={() => audio.setMuted(!audio.muted)}>{audio.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</Button>
      </aside>
      </div>
    </div>
  );
}
