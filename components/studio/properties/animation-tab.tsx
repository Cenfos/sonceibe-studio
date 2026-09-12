'use client';

import { useStore } from '@/lib/store';
import { ControlRow, ColorInput, SliderRow } from './controls';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Waves,
  ZoomIn,
  SlidersHorizontal,
  Mic,
  Type,
  AlignJustify,
  ArrowDownUp,
  Focus,
} from 'lucide-react';

const animations = [
  { v: 'fade', label: 'Fade', icon: Waves },
  { v: 'zoom', label: 'Zoom', icon: ZoomIn },
  { v: 'slide', label: 'Slide', icon: SlidersHorizontal },
  { v: 'karaoke', label: 'Karaoke', icon: Mic },
  { v: 'word', label: 'Palabra', icon: Type },
  { v: 'line', label: 'Línea', icon: AlignJustify },
  { v: 'bounce', label: 'Bounce', icon: ArrowDownUp },
  { v: 'blur', label: 'Blur', icon: Focus },
] as const;

const exitAnimations = animations.filter((animation) => animation.v !== 'karaoke');

export function AnimationTab() {
  const { currentProject, updateAnimation } = useStore();
  if (!currentProject) return null;
  const a = currentProject.settings.animation;

  return (
    <div className="space-y-5">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Las animaciones se aplican a cada línea de letra. Para apreciarlas, reproduce el audio atravesando el inicio o el final de una frase sincronizada.
      </p>

      <ControlRow label="Animación de entrada">
        <div className="grid grid-cols-4 gap-1.5">
          {animations.map((an) => {
            const Icon = an.icon;
            const active = a.in === an.v;
            return (
              <Button
                key={an.v}
                variant={active ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'flex-col h-16 gap-1 px-1',
                  !active && 'text-muted-foreground'
                )}
                onClick={() => updateAnimation({ in: an.v })}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px]">{an.label}</span>
              </Button>
            );
          })}
        </div>
      </ControlRow>

      <ControlRow label="Animación de salida">
        <div className="grid grid-cols-4 gap-1.5">
          {exitAnimations.map((an) => {
            const Icon = an.icon;
            const active = a.out === an.v;
            return (
              <Button
                key={an.v}
                variant={active ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'flex-col h-16 gap-1 px-1',
                  !active && 'text-muted-foreground'
                )}
                onClick={() => updateAnimation({ out: an.v })}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px]">{an.label}</span>
              </Button>
            );
          })}
        </div>
      </ControlRow>

      <SliderRow
        label="Duración de animación"
        value={a.duration}
        min={0.1}
        max={2}
        step={0.1}
        unit="s"
        onChange={(v) => updateAnimation({ duration: v })}
      />

      {a.in === 'karaoke' && (
        <ControlRow label="Color de karaoke">
          <ColorInput
            value={a.karaokeColor}
            onChange={(v) => updateAnimation({ karaokeColor: v })}
          />
        </ControlRow>
      )}
    </div>
  );
}
