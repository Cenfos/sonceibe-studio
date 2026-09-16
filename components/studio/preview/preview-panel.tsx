'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { formatTimecode } from '@/lib/format';
import { sanitizeRenderSettings } from '@/lib/render-safety';
import { preloadBackgroundImage, renderFrame } from './canvas-renderer';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';

export function PreviewPanel() {
  const { currentProject, updateExport } = useStore();
  const audio = useAudioEngineContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const duration = audio.duration || currentProject?.settings.audioDuration || 0;
  const settings = currentProject?.settings;
  const safeSettings = useMemo(() => {
    if (!settings) return null;
    const sanitized = sanitizeRenderSettings(settings);
    if ((sanitized.exportConfig.orientation ?? 'landscape') !== 'portrait') return sanitized;

    // The desktop "Móvil" preview must be identical to the actual mobile
    // export. In 9:16 we always fill the whole frame, cropping image edges
    // when needed instead of leaving black side bars.
    return {
      ...sanitized,
      background: {
        ...sanitized.background,
        imageFit: 'cover' as const,
      },
    };
  }, [settings]);
  const orientation = safeSettings?.exportConfig.orientation ?? 'landscape';
  const isPortrait = orientation === 'portrait';
  const canvasWidth = isPortrait ? 1080 : 1920;
  const canvasHeight = isPortrait ? 1920 : 1080;
  const aspectRatio = isPortrait ? '9 / 16' : '16 / 9';

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !safeSettings) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      renderFrame(ctx, canvas.width, canvas.height, safeSettings, time);
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
  }, [safeSettings]);

  useEffect(() => {
    if (!audio.isPlaying) {
      draw(audio.audioEl?.currentTime ?? audio.currentTime);
    }
  }, [audio.isPlaying, audio.audioEl, audio.currentTime, draw, orientation]);

  useEffect(() => {
    if (!safeSettings) return;
    const bg = safeSettings.background;
    if (bg.type !== 'image' && bg.type !== 'images') return;

    const clipSources = (bg.imageClips ?? []).map((clip) => clip.url);
    const sources = bg.type === 'images' && bg.images.length > 0
      ? [...bg.images, ...clipSources]
      : bg.imageUrl
        ? [bg.imageUrl]
        : [];

    const uniqueSources = Array.from(new Set(sources.filter(Boolean)));
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
    if (audio.currentTime >= duration) audio.seek(0);
    if (audio.isPlaying) audio.pause();
    else audio.play();
  };

  const stop = () => audio.stop();
  const seek = (val: number[]) => audio.seek(val[0]);
  const skipBack = () => audio.seek(Math.max(0, audio.currentTime - 5));
  const skipForward = () => audio.seek(Math.min(duration, audio.currentTime + 5));

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="studio-preview-header h-10 shrink-0 flex items-center justify-between px-3 border-b border-border bg-card/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
          <span className="font-medium text-foreground shrink-0">Vista Previa</span>
          <span className="studio-preview-meta text-xs truncate">
            {canvasWidth}×{canvasHeight} · {isPortrait ? '9:16 Móvil' : '16:9 PC'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant={orientation === 'landscape' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => updateExport({ orientation: 'landscape' })}
            title="Formato horizontal 16:9"
          >
            <Monitor className="h-3.5 w-3.5" />
            PC
          </Button>
          <Button
            variant={orientation === 'portrait' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => updateExport({ orientation: 'portrait' })}
            title="Formato vertical 9:16"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Móvil
          </Button>
          <div className="studio-preview-zoom flex items-center gap-1">
            <Separator orientation="vertical" className="h-5 mx-1" />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(2, z + 0.25))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-5 mx-1" />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleFullscreen}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="studio-preview-stage flex-1 min-h-0 flex items-center justify-center p-6 bg-[hsl(222_20%_5%)] overflow-hidden">
        <div
          ref={containerRef}
          className="relative shadow-2xl rounded-lg overflow-hidden bg-black"
          style={{
            height: `${Math.min(100, zoom * 100)}%`,
            maxWidth: '100%',
            aspectRatio,
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full block"
          />
        </div>
      </div>

      <div className="studio-preview-controls h-16 shrink-0 flex items-center gap-4 px-4 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={skipBack}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="icon" className="h-10 w-10 rounded-full" onClick={togglePlay}>
            {audio.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={stop}>
            <Square className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={skipForward}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-xs font-mono text-muted-foreground tabular-nums w-20 shrink-0">
          {formatTimecode(audio.currentTime)}
        </div>

        <div className="flex-1 flex items-center min-w-0">
          <Slider
            value={[audio.currentTime]}
            min={0}
            max={duration || 1}
            step={0.01}
            onValueChange={seek}
            className="flex-1"
          />
        </div>

        <div className="studio-time-end text-xs font-mono text-muted-foreground tabular-nums w-20 text-right shrink-0">
          {formatTimecode(duration)}
        </div>

        <Separator orientation="vertical" className="studio-control-separator h-8" />

        <Button
          variant="ghost"
          size="icon"
          className="studio-volume-control h-9 w-9 shrink-0"
          onClick={() => audio.setMuted(!audio.muted)}
        >
          {audio.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
