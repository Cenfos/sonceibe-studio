import type { ProjectSettings } from './types';

function normalizeHex(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim?.() ?? '';
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Math.min(max, Math.max(min, finite(value, fallback)));
}

export function sanitizeRenderSettings(settings: ProjectSettings): ProjectSettings {
  return {
    ...settings,
    background: {
      ...settings.background,
      color: normalizeHex(settings.background.color, '#000000'),
      gradientFrom: normalizeHex(settings.background.gradientFrom, '#1e3a8a'),
      gradientTo: normalizeHex(settings.background.gradientTo, '#7c3aed'),
      gradientAngle: finite(settings.background.gradientAngle, 135),
      blur: clamp(settings.background.blur, 0, 100, 0),
      overlay: clamp(settings.background.overlay, 0, 1, 0),
    },
    text: {
      ...settings.text,
      color: normalizeHex(settings.text.color, '#ffffff'),
      outlineColor: normalizeHex(settings.text.outlineColor, '#000000'),
      shadowColor: normalizeHex(settings.text.shadowColor, '#000000'),
      glowColor: normalizeHex(settings.text.glowColor, '#3b82f6'),
      fontSize: Math.max(1, finite(settings.text.fontSize, 64)),
      fontWeight: clamp(settings.text.fontWeight, 100, 900, 700),
      lineHeight: Math.max(0.5, finite(settings.text.lineHeight, 1.3)),
      outlineWidth: Math.max(0, finite(settings.text.outlineWidth, 2)),
      shadowBlur: Math.max(0, finite(settings.text.shadowBlur, 12)),
      glowIntensity: Math.max(0, finite(settings.text.glowIntensity, 20)),
    },
    animation: {
      ...settings.animation,
      karaokeColor: normalizeHex(settings.animation.karaokeColor, '#22d3ee'),
      duration: Math.max(0.05, finite(settings.animation.duration, 0.5)),
      wordStagger: Math.max(0, finite(settings.animation.wordStagger, 60)),
    },
    effects: {
      ...settings.effects,
      overlayColor: normalizeHex(settings.effects.overlayColor, '#000000'),
      blur: clamp(settings.effects.blur, 0, 100, 0),
      overlay: clamp(settings.effects.overlay, 0, 1, 0),
      kenburnsIntensity: clamp(settings.effects.kenburnsIntensity, 0, 1, 0.5),
      particlesCount: Math.max(0, Math.round(finite(settings.effects.particlesCount, 40))),
      vignetteIntensity: clamp(settings.effects.vignetteIntensity, 0, 1, 0.5),
    },
  };
}
