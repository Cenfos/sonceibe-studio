'use client';

import { Palette } from 'lucide-react';
import { useStore } from '@/lib/store';
import { SONCEIBE_LOGO_URL, visualPresets, presetBackground } from '@/lib/visual-presets';
import { preloadVisualBranding } from '@/lib/visual-branding';
import { defaultTitleStyle, type VisualStyleId } from '@/lib/types';

export function ThemePreviewDecoration({ id }: { id: VisualStyleId }) {
  if (id === 'rustico-ramas') return <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden="true">
    <rect x="4" y="4" width="152" height="92" fill="none" stroke="#b69868" strokeOpacity=".3" />
    {[[8, 8, 1, 1], [152, 8, -1, 1], [8, 92, 1, -1], [152, 92, -1, -1]].map(([x, y, sx, sy], index) => <g key={index} transform={`translate(${x} ${y}) scale(${sx} ${sy})`} fill="none" stroke="#b69868" strokeWidth="1.1" strokeLinecap="round">
      <path d="M0 1 Q20 -2 48 2 M1 0 Q-1 18 3 37 M10 1 l7 6 M23 1 l6 8 M35 1 l6 6 M1 10 l7 6 M2 23 l7 5" />
      <g fill="#94996a" stroke="none"><ellipse cx="18" cy="7" rx="4" ry="1.7" transform="rotate(35 18 7)" /><ellipse cx="30" cy="9" rx="4" ry="1.7" transform="rotate(35 30 9)" /><ellipse cx="9" cy="16" rx="3.5" ry="1.5" /><ellipse cx="10" cy="28" rx="3.5" ry="1.5" /></g>
    </g>)}
  </svg>;
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

  if (id === 'noite-estrelada') return <><div className="absolute inset-3 border border-blue-100/50" /><span className="absolute left-5 top-4 text-blue-100">✦ ·</span><span className="absolute right-4 bottom-4 text-blue-100">· ✧</span></>;
  if (id === 'papel-e-tinta') return <div className="absolute inset-3 border-[3px] border-double border-amber-950/50" />;
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
    updateBackground(presetBackground(currentProject.settings.background, preset));
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
            Marco, título y letra. Si has cargado fotos en Formato, se conservan; sin fotos se utiliza el fondo del estilo.
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
              aria-pressed={active}
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
                {(
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={SONCEIBE_LOGO_URL}
                    alt=""
                    className="absolute bottom-2 right-2 h-8 w-8 rounded-full object-cover shadow-lg"
                  />
                )}
                <div className="absolute inset-x-2 top-[42%] truncate text-center text-[9px] font-bold drop-shadow-sm" style={{ color: preset.text.color, fontFamily: preset.text.fontFamily }}>
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
