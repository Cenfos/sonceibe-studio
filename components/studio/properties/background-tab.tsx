'use client';

import { useStore } from '@/lib/store';
import { ControlRow, ColorInput, SliderRow } from './controls';
import { sampleBackgroundImages } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Images, Video, Palette, Blend, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const bgTypes = [
  { v: 'image', label: 'Imagen', icon: ImageIcon },
  { v: 'images', label: 'Múltiple', icon: Images },
  { v: 'video', label: 'Video', icon: Video },
  { v: 'color', label: 'Color', icon: Palette },
  { v: 'gradient', label: 'Gradiente', icon: Blend },
] as const;

export function BackgroundTab() {
  const { currentProject, updateBackground } = useStore();
  if (!currentProject) return null;
  const bg = currentProject.settings.background;

  return (
    <div className="space-y-5">
      <ControlRow label="Tipo de fondo">
        <div className="grid grid-cols-5 gap-1.5">
          {bgTypes.map((bt) => {
            const Icon = bt.icon;
            const active = bg.type === bt.v;
            return (
              <Button
                key={bt.v}
                variant={active ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'flex-col h-16 gap-1 px-1',
                  !active && 'text-muted-foreground'
                )}
                onClick={() => updateBackground({ type: bt.v })}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px]">{bt.label}</span>
              </Button>
            );
          })}
        </div>
      </ControlRow>

      {(bg.type === 'image' || bg.type === 'images') && (
        <ControlRow label="Imagen de fondo">
          <div className="space-y-3">
            <Button variant="outline" size="sm" className="w-full gap-2">
              <Upload className="h-4 w-4" />
              Subir imagen
            </Button>
            <div className="grid grid-cols-3 gap-2">
              {sampleBackgroundImages.map((url) => (
                <button
                  key={url}
                  onClick={() => updateBackground({ imageUrl: url })}
                  className={cn(
                    'aspect-video rounded-md overflow-hidden border-2 transition-all',
                    bg.imageUrl === url ? 'border-primary' : 'border-border hover:border-primary/50'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </ControlRow>
      )}

      {bg.type === 'video' && (
        <ControlRow label="Video de fondo">
          <Button variant="outline" size="sm" className="w-full gap-2">
            <Upload className="h-4 w-4" />
            Subir video
          </Button>
        </ControlRow>
      )}

      {bg.type === 'color' && (
        <ControlRow label="Color de fondo">
          <ColorInput value={bg.color} onChange={(v) => updateBackground({ color: v })} />
        </ControlRow>
      )}

      {bg.type === 'gradient' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ControlRow label="Color inicial">
              <ColorInput
                value={bg.gradientFrom}
                onChange={(v) => updateBackground({ gradientFrom: v })}
              />
            </ControlRow>
            <ControlRow label="Color final">
              <ColorInput
                value={bg.gradientTo}
                onChange={(v) => updateBackground({ gradientTo: v })}
              />
            </ControlRow>
          </div>
          <SliderRow
            label="Ángulo"
            value={bg.gradientAngle}
            min={0}
            max={360}
            unit="°"
            onChange={(v) => updateBackground({ gradientAngle: v })}
          />
        </>
      )}

      <SliderRow
        label="Desenfoque de fondo"
        value={bg.blur}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => updateBackground({ blur: v })}
      />

      <SliderRow
        label="Superposición oscura"
        value={Math.round(bg.overlay * 100)}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => updateBackground({ overlay: v / 100 })}
      />
    </div>
  );
}
