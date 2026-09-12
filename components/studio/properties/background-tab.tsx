'use client';

import { useStore } from '@/lib/store';
import { ControlRow, ColorInput, SliderRow } from './controls';
import { sampleBackgroundImages } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import {
  Image as ImageIcon,
  Images,
  Video,
  Palette,
  Blend,
  Upload,
  Clock3,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { BackgroundImageClip, ImageFitMode, ImageSequenceMode } from '@/lib/types';

const IMAGE_DRAG_TYPE = 'application/x-sonceibe-image-index';

const bgTypes = [
  { v: 'image', label: 'Imagen', icon: ImageIcon },
  { v: 'images', label: 'Múltiple', icon: Images },
  { v: 'video', label: 'Video', icon: Video },
  { v: 'color', label: 'Color', icon: Palette },
  { v: 'gradient', label: 'Gradiente', icon: Blend },
] as const;

function genClipId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

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
        const dataUrl = canvas.toDataURL('image/webp', 0.82);
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

function distributeImagesAcrossSong(images: string[], duration: number): BackgroundImageClip[] {
  if (images.length === 0) return [];
  const safeDuration = duration > 0 ? duration : images.length * 5;
  const clipDuration = safeDuration / images.length;

  return images.map((url, index) => ({
    id: genClipId(),
    url,
    start: index * clipDuration,
    end: index === images.length - 1 ? safeDuration : (index + 1) * clipDuration,
  }));
}

function appendManualClips(
  prepared: string[],
  existing: BackgroundImageClip[],
  duration: number,
  fallbackLength: number
): BackgroundImageClip[] {
  if (prepared.length === 0) return existing;
  if (existing.length === 0) return distributeImagesAcrossSong(prepared, duration);

  const defaultLength = Math.max(1, fallbackLength || 5);
  let cursor = Math.max(...existing.map((clip) => clip.end));
  const clips = [...existing];

  for (const url of prepared) {
    let start = cursor;
    let end = cursor + defaultLength;

    if (duration > 0) {
      if (start >= duration) {
        start = Math.max(0, duration - defaultLength);
        end = duration;
      } else {
        end = Math.min(duration, end);
      }
    }

    clips.push({ id: genClipId(), url, start, end: Math.max(start + 0.2, end) });
    cursor = end;
  }

  return clips;
}

export function BackgroundTab() {
  const { currentProject, updateBackground } = useStore();
  if (!currentProject) return null;

  const bg = currentProject.settings.background;
  const duration = currentProject.settings.audioDuration || 0;
  const imageMode: ImageSequenceMode = bg.imageMode ?? 'auto';
  const imageFit: ImageFitMode = bg.imageFit ?? 'contain';
  const imageDuration = bg.imageDuration ?? 5;
  const imageClips = bg.imageClips ?? [];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    try {
      const prepared = await Promise.all(files.map(prepareImage));

      if (bg.type === 'images') {
        const images = [...bg.images, ...prepared];
        const patch: Parameters<typeof updateBackground>[0] = {
          images,
          imageUrl: bg.imageUrl || images[0] || '',
        };

        if (imageMode === 'manual') {
          patch.imageClips = appendManualClips(prepared, imageClips, duration, imageDuration);
        }

        updateBackground(patch);
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

  const setImageMode = (mode: ImageSequenceMode) => {
    if (mode === 'manual' && imageClips.length === 0 && bg.images.length > 0) {
      updateBackground({
        imageMode: mode,
        imageClips: distributeImagesAcrossSong(bg.images, duration),
      });
      return;
    }
    updateBackground({ imageMode: mode });
  };

  const selectSampleImage = (url: string) => {
    if (bg.type === 'images') {
      const exists = bg.images.includes(url);
      const images = exists ? bg.images.filter((item) => item !== url) : [...bg.images, url];
      let clips = imageClips;

      if (imageMode === 'manual') {
        clips = exists
          ? imageClips.filter((clip) => clip.url !== url)
          : appendManualClips([url], imageClips, duration, imageDuration);
      }

      updateBackground({ images, imageUrl: images[0] || '', imageClips: clips });
      return;
    }

    updateBackground({ imageUrl: url });
  };

  const redistributeManualImages = () => {
    if (bg.images.length === 0) return;
    updateBackground({ imageClips: distributeImagesAcrossSong(bg.images, duration) });
    toast.success('Imágenes repartidas por toda la canción');
  };

  const handleLibraryDragStart = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(IMAGE_DRAG_TYPE, String(index));
  };

  const removeLibraryImage = (index: number) => {
    const url = bg.images[index];
    if (!url) return;

    const images = bg.images.filter((_, itemIndex) => itemIndex !== index);
    const nextClips = (bg.imageClips ?? []).filter((clip) => clip.url !== url);

    updateBackground({
      images,
      imageClips: nextClips,
      imageUrl: bg.imageUrl === url ? images[0] || '' : bg.imageUrl,
    });
    toast.success('Imagen eliminada');
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
                className={cn('flex-col h-16 gap-1 px-1', !active && 'text-muted-foreground')}
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

            <div className="space-y-2 rounded-lg border border-border bg-card/30 p-3">
              <p className="text-xs font-medium">Cómo mostrar la imagen</p>
              <div className="space-y-2">
                <Button
                  size="sm"
                  className="w-full justify-start h-auto min-h-10 py-2 whitespace-normal text-left"
                  variant={imageFit === 'contain' ? 'default' : 'outline'}
                  onClick={() => updateBackground({ imageFit: 'contain' })}
                >
                  Ver completa · sin recortar
                </Button>
                <Button
                  size="sm"
                  className="w-full justify-start h-auto min-h-10 py-2 whitespace-normal text-left"
                  variant={imageFit === 'cover' ? 'default' : 'outline'}
                  onClick={() => updateBackground({ imageFit: 'cover' })}
                >
                  Llenar pantalla · recortar bordes
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {imageFit === 'contain'
                  ? 'Recomendado: la foto se ve entera. El espacio sobrante queda negro.'
                  : 'La foto ocupa toda la pantalla. Puede perder parte de los bordes.'}
              </p>
            </div>

            {bg.type === 'images' && (
              <div className="space-y-3 rounded-lg border border-border bg-card/30 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={imageMode === 'auto' ? 'default' : 'outline'}
                    className="gap-1.5"
                    onClick={() => setImageMode('auto')}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Automático
                  </Button>
                  <Button
                    size="sm"
                    variant={imageMode === 'manual' ? 'default' : 'outline'}
                    className="gap-1.5"
                    onClick={() => setImageMode('manual')}
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    Manual
                  </Button>
                </div>

                {imageMode === 'auto' ? (
                  <div className="space-y-2">
                    <SliderRow
                      label="Duración por imagen"
                      value={imageDuration}
                      min={1}
                      max={30}
                      unit=" s"
                      onChange={(value) => updateBackground({ imageDuration: value })}
                    />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Las imágenes cambian automáticamente siguiendo este intervalo.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Arrastra una miniatura hasta la pista Fondo para colocarla donde quieras. También puedes mover y redimensionar cada bloque directamente en la línea de tiempo.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={redistributeManualImages}
                      disabled={bg.images.length === 0 || duration <= 0}
                    >
                      Repartir por toda la canción
                    </Button>
                  </div>
                )}
              </div>
            )}

            {bg.type === 'image' && bg.imageUrl && !sampleBackgroundImages.includes(bg.imageUrl) && (
              <div className="overflow-hidden rounded-md border border-border aspect-video bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bg.imageUrl}
                  alt="Imagen de fondo seleccionada"
                  className={cn('w-full h-full', imageFit === 'contain' ? 'object-contain' : 'object-cover')}
                />
              </div>
            )}

            {bg.type === 'images' && bg.images.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  {bg.images.length} imagen{bg.images.length !== 1 ? 'es' : ''}
                  {imageMode === 'auto'
                    ? ` · cambio cada ${imageDuration}s`
                    : ` · ${imageClips.length} bloque${imageClips.length !== 1 ? 's' : ''} en timeline`}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {bg.images.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      draggable
                      onDragStart={(e) => handleLibraryDragStart(index, e)}
                      title="Arrastra esta imagen hasta la pista Fondo"
                      className="relative aspect-video rounded-md overflow-hidden border border-border cursor-grab active:cursor-grabbing group bg-black"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-contain pointer-events-none" />
                      <button
                        type="button"
                        title="Eliminar imagen"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeLibraryImage(index);
                        }}
                        className="absolute top-1 right-1 h-6 w-6 rounded-md bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
                      'aspect-video rounded-md overflow-hidden border-2 transition-all bg-black',
                      selected ? 'border-primary' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-contain" />
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
