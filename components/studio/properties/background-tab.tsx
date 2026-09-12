'use client';

import { useStore } from '@/lib/store';
import { ControlRow, ColorInput, SliderRow } from './controls';
import { sampleBackgroundImages } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Images, Video, Palette, Blend, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const bgTypes = [
  { v: 'image', label: 'Imagen', icon: ImageIcon },
  { v: 'images', label: 'Múltiple', icon: Images },
  { v: 'video', label: 'Video', icon: Video },
  { v: 'color', label: 'Color', icon: Palette },
  { v: 'gradient', label: 'Gradiente', icon: Blend },
] as const;

function prepareImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const maxWidth = 1920;
        const maxHeight = 1080;
        const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo preparar la imagen');

        ctx.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/webp', 0.85);
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen'));
    };

    image.src = objectUrl;
  });
}

export function BackgroundTab() {
  const { currentProject, updateBackground } = useStore();
  if (!currentProject) return null;
  const bg = currentProject.settings.background;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    try {
      const prepared = await Promise.all(files.map(prepareImage));

      if (bg.type === 'images') {
        const images = [...bg.images, ...prepared];
        updateBackground({
          images,
          imageUrl: bg.imageUrl || images[0] || '',
        });
        toast.success(`${prepared.length} imagen${prepared.length !== 1 ? 'es' : ''} añadida${prepared.length !== 1 ? 's' : ''}`);
      } else {
        updateBackground({ imageUrl: prepared[0] });
        toast.success('Imagen de fondo cargada');
      }
    } catch (error) {
      console.error('Failed to prepare background image:', error);
      toast.error('No se pudo cargar la imagen');
    } finally {
      e.target.value = '';
    }
  };

  const selectSampleImage = (url: string) => {
    if (bg.type === 'images') {
      const exists = bg.images.includes(url);
      const images = exists ? bg.images.filter((item) => item !== url) : [...bg.images, url];
      updateBackground({
        images,
        imageUrl: images[0] || '',
      });
      return;
    }

    updateBackground({ imageUrl: url });
  };

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
        <ControlRow label={bg.type === 'images' ? 'Imágenes de fondo' : 'Imagen de fondo'}>
          <div className="space-y-3">
            <Button variant="outline" size="sm" className="w-full gap-2" asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4" />
                {bg.type === 'images' ? 'Añadir imágenes' : 'Subir imagen'}
                <input
                  type="file"
                  accept="image/*"
                  multiple={bg.type === 'images'}
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            </Button>

            {bg.type === 'image' && bg.imageUrl && !sampleBackgroundImages.includes(bg.imageUrl) && (
              <div className="overflow-hidden rounded-md border border-border aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bg.imageUrl} alt="Imagen de fondo seleccionada" className="w-full h-full object-cover" />
              </div>
            )}

            {bg.type === 'images' && bg.images.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  {bg.images.length} imagen{bg.images.length !== 1 ? 'es' : ''} · cambio automático cada 5 segundos
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {bg.images.slice(0, 6).map((url, index) => (
                    <div key={`${url}-${index}`} className="aspect-video rounded-md overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {sampleBackgroundImages.map((url) => {
                const selected = bg.type === 'images' ? bg.images.includes(url) : bg.imageUrl === url;
                return (
                  <button
                    key={url}
                    onClick={() => selectSampleImage(url)}
                    className={cn(
                      'aspect-video rounded-md overflow-hidden border-2 transition-all',
                      selected ? 'border-primary' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                );
              })}
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
