'use client';

import { Palette } from 'lucide-react';
import { useStore } from '@/lib/store';
import { SONCEIBE_LOGO_URL, visualPresets } from '@/lib/visual-presets';
import { preloadVisualBranding } from '@/lib/visual-branding';
import { defaultTitleStyle, type VisualStyleId } from '@/lib/types';

function ThemePreviewDecoration({ id }: { id: VisualStyleId }) {
  if (id === 'rock-galego') {
    return (
      <>
        <div className="absolute -left-4 -top-2 h-20 w-8 rotate-[24deg] bg-orange-400/15 blur-sm" />
        <div className="absolute -right-3 top-0 h-20 w-8 -rotate-[22deg] bg-orange-300/15 blur-sm" />
        <div className="absolute inset-2 border-2 border-zinc-900/90 shadow-[inset_0_0_0_1px_rgba(214,107,60,.7)]" />
        <div className="absolute left-3 top-3 h-1.5 w-1.5 rounded-full bg-zinc-300/80" />
        <div className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-zinc-300/80" />
      </>
    );
  }

  if (id === 'folk-atlantico') {
    return (
      <>
        <div className="absolute inset-x-3 top-3 h-4 rounded-[50%] border-t border-amber-100/50" />
        <div className="absolute inset-x-5 bottom-3 h-4 rounded-[50%] border-b border-amber-100/45" />
        <div className="absolute left-3 bottom-3 h-5 w-2 rotate-[-32deg] rounded-[70%_0_70%_0] bg-amber-100/35" />
        <div className="absolute right-3 top-3 h-4 w-2 rotate-[34deg] rounded-[70%_0_70%_0] bg-emerald-100/30" />
      </>
    );
  }

  if (id === 'ska-ceibe') {
    return (
      <>
        <div className="absolute inset-x-0 top-0 grid h-4 grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={`ska-top-${index}`} className={index % 2 ? 'bg-yellow-300/80' : 'bg-black/80'} />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 grid h-4 grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={`ska-bottom-${index}`} className={index % 2 ? 'bg-black/80' : 'bg-yellow-300/80'} />
          ))}
        </div>
        <div className="absolute left-2 top-5 h-1.5 w-12 -rotate-6 bg-lime-500/70" />
      </>
    );
  }

  if (id === 'galicia-gaita') {
    return (
      <>
        <div className="absolute -left-6 top-1/2 h-5 w-[140%] -translate-y-1/2 -rotate-[28deg] bg-sky-100/18" />
        <div className="absolute inset-2 border border-sky-100/55" />
        <div className="absolute bottom-2 left-3 h-7 w-7 rounded-t-full border-2 border-sky-100/45 border-b-0" />
        <div className="absolute bottom-2 left-[22px] h-6 w-px rotate-[-20deg] bg-sky-100/45" />
        <div className="absolute bottom-2 left-[30px] h-6 w-px rotate-[20deg] bg-sky-100/45" />
      </>
    );
  }

  if (id === 'taberna-galega') {
    return (
      <>
        <div className="absolute inset-1.5 border-[5px] border-amber-950/80 shadow-[inset_0_0_0_1px_rgba(214,160,82,.55)]" />
        <div className="absolute inset-x-3 top-1 flex justify-between">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={`bulb-${index}`} className="h-1.5 w-1.5 rounded-full bg-amber-300/85 shadow-[0_0_7px_rgba(251,191,36,.8)]" />
          ))}
        </div>
        <div className="absolute left-2 top-1/2 h-px w-8 bg-amber-200/20" />
        <div className="absolute right-2 top-1/2 h-px w-8 bg-amber-200/20" />
      </>
    );
  }

  return null;
}

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
            Cada tema aplica fondo, marco, título, letra, animación y efectos propios.
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
                <ThemePreviewDecoration id={preset.id} />
                {preset.id === 'sonceibe' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={SONCEIBE_LOGO_URL}
                    alt=""
                    className="absolute bottom-2 right-2 h-8 w-8 rounded-full object-cover shadow-lg"
                  />
                )}
                <div className="absolute inset-x-2 top-[42%] truncate text-center text-[9px] font-bold text-white drop-shadow-lg">
                  {preset.label}
                </div>
              </div>
              <div className="px-2 py-1.5">
                <div className="truncate text-[11px] font-medium">{preset.label}</div>
                <div className="mt-0.5 line-clamp-2 text-[9px] leading-3 text-muted-foreground">
                  {preset.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
