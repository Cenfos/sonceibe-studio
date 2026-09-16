'use client';

import { Palette } from 'lucide-react';
import { useStore } from '@/lib/store';
import { SONCEIBE_LOGO_URL, visualPresets } from '@/lib/visual-presets';
import { preloadVisualBranding } from '@/lib/visual-branding';
import { defaultTitleStyle, type VisualStyleId } from '@/lib/types';

export function VisualPresetPicker() {
  const {
    currentProject,
    updateSettings,
    updateBackground,
    updateText,
    updateAnimation,
    updateEffects,
  } = useStore();

  if (!currentProject) return null;

  const activeStyle = currentProject.settings.visualStyle ?? 'default';

  const applyPreset = async (presetId: Exclude<VisualStyleId, 'default'>) => {
    const preset = visualPresets.find((item) => item.id === presetId);
    if (!preset) return;

    await preloadVisualBranding(preset.id);
    updateSettings({
      visualStyle: preset.id,
      titleStyle: { ...defaultTitleStyle, ...preset.title },
    });
    updateBackground(preset.background);
    updateText(preset.text);
    updateAnimation(preset.animation);
    updateEffects(preset.effects);
  };

  return (
    <section className="mb-5 rounded-xl border border-border bg-card/40 p-3">
      <div className="mb-3 flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Palette className="h-3.5 w-3.5" />
        </div>
        <div>
          <div className="text-xs font-semibold">Estilos preparados</div>
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
            Disponibles también en PC. Aplican fondo, título, letra, animación y efectos de una vez.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {visualPresets.map((preset) => {
          const active = activeStyle === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => void applyPreset(preset.id)}
              className={`overflow-hidden rounded-lg border text-left transition-all ${
                active ? 'border-primary ring-1 ring-primary/40' : 'border-border hover:border-primary/50'
              }`}
              title={preset.description}
            >
              <div
                className="relative aspect-[16/10] overflow-hidden"
                style={{ background: `linear-gradient(145deg, ${preset.previewFrom}, ${preset.previewTo})` }}
              >
                <div
                  className="absolute inset-1.5 rounded border"
                  style={{ borderColor: `${preset.accent}99`, boxShadow: `inset 0 0 12px ${preset.accent}22` }}
                />
                {preset.id === 'sonceibe' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={SONCEIBE_LOGO_URL}
                    alt=""
                    className="absolute bottom-2 right-2 h-8 w-8 rounded-full object-cover shadow-lg"
                  />
                )}
                <div className="absolute inset-x-2 top-[42%] truncate text-center text-[9px] font-bold text-white drop-shadow-lg">
                  Son Ceibe
                </div>
              </div>
              <div className="px-2 py-1.5">
                <div className="truncate text-[11px] font-medium">{preset.label}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
