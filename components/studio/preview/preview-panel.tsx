'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { formatTimecode } from '@/lib/format';
import { renderFrame } from './canvas-renderer';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';

export function PreviewPanel() {
  const { currentProject, updateSettings } = useStore();
  const audio = useAudioEngineContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const duration = audio.duration || currentProject?.settings.audioDuration || 0;
  const settings = currentProject?.settings;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !settings) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderFrame(ctx, canvas.width, canvas.height, settings, audio.currentTime);
  }, [settings, audio.currentTime]);

  useEffect(() => {
    draw();
  }, [draw]);

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
      {/* Toolbar */}
      <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-border bg-card/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Vista Previa</span>
          <span className="text-xs">1920×1080 · 16:9</span>
        </div>
        <div className="flex items-center gap-1">
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
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleFullscreen}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-6 bg-[hsl(222_20%_5%)] overflow-hidden">
        <div
          ref={containerRef}
          className="relative shadow-2xl rounded-lg overflow-hidden"
          style={{
            width: `${zoom * 100}%`,
            maxWidth: '100%',
            aspectRatio: '16 / 9',
            maxHeight: '100%',
          }}
        >
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            className="w-full h-full block"
          />
        </div>
      </div>

      {/* Transport controls */}
      <div className="h-16 shrink-0 flex items-center gap-4 px-4 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={skipBack}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={togglePlay}
          >
            {audio.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={stop}>
            <Square className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={skipForward}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-xs font-mono text-muted-foreground tabular-nums w-20">
          {formatTimecode(audio.currentTime)}
        </div>

        <div className="flex-1 flex items-center">
          <Slider
            value={[audio.currentTime]}
            min={0}
            max={duration || 1}
            step={0.01}
            onValueChange={seek}
            className="flex-1"
          />
        </div>

        <div className="text-xs font-mono text-muted-foreground tabular-nums w-20 text-right">
          {formatTimecode(duration)}
        </div>

        <Separator orientation="vertical" className="h-8" />

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => audio.setMuted(!audio.muted)}
        >
          {audio.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
