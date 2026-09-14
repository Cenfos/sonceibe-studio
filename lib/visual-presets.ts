import type {
  AnimationConfig,
  BackgroundConfig,
  EffectsConfig,
  TextStyle,
  VisualStyleId,
} from './types';

export const SONCEIBE_LOGO_URL = 'https://raw.githubusercontent.com/Cenfos/son-ceibe-web/main/public/son-ceibe-logo.png';

export interface VisualPreset {
  id: Exclude<VisualStyleId, 'default'>;
  label: string;
  description: string;
  previewFrom: string;
  previewTo: string;
  accent: string;
  background: Partial<BackgroundConfig>;
  text: Partial<TextStyle>;
  animation: Partial<AnimationConfig>;
  effects: Partial<EffectsConfig>;
}

export const visualPresets: VisualPreset[] = [
  {
    id: 'sonceibe',
    label: 'SonCeibe',
    description: 'Verde bosque, ámbar, borde iluminado y logo oficial',
    previewFrom: '#102d25',
    previewTo: '#26190f',
    accent: '#d99a45',
    background: {
      type: 'gradient',
      gradientFrom: '#102d25',
      gradientTo: '#26190f',
      gradientAngle: 145,
      overlay: 0.08,
    },
    text: {
      fontFamily: 'Georgia',
      fontSize: 68,
      fontWeight: 700,
      color: '#f4ead7',
      outlineWidth: 2,
      outlineColor: '#17392f',
      shadow: true,
      shadowBlur: 20,
      shadowColor: '#061712',
      glow: true,
      glowColor: '#d99a45',
      glowIntensity: 12,
      position: 'center',
      align: 'center',
      lineHeight: 1.28,
    },
    animation: {
      in: 'fade',
      out: 'fade',
      duration: 0.55,
      karaokeColor: '#e7b86d',
    },
    effects: {
      overlay: 0.08,
      overlayColor: '#071811',
      particles: true,
      particlesCount: 18,
      lightleaks: false,
      vignette: true,
      vignetteIntensity: 0.38,
    },
  },
  {
    id: 'karaoke-pop',
    label: 'Karaoke Pop',
    description: 'Color vivo y entrada suave para letras cantadas',
    previewFrom: '#7c3aed',
    previewTo: '#be185d',
    accent: '#f9a8d4',
    background: {
      type: 'gradient',
      gradientFrom: '#4c1d95',
      gradientTo: '#9d174d',
      gradientAngle: 135,
      overlay: 0.14,
    },
    text: {
      fontFamily: 'Inter',
      fontSize: 68,
      fontWeight: 800,
      color: '#ffffff',
      outlineWidth: 1,
      outlineColor: '#4c1d95',
      shadow: true,
      shadowBlur: 16,
      shadowColor: '#16072b',
      glow: true,
      glowColor: '#f472b6',
      glowIntensity: 10,
    },
    animation: {
      in: 'karaoke',
      out: 'fade',
      duration: 0.45,
      karaokeColor: '#67e8f9',
    },
    effects: {
      overlay: 0.12,
      overlayColor: '#16072b',
      particles: true,
      particlesCount: 24,
      vignette: true,
      vignetteIntensity: 0.25,
      lightleaks: false,
    },
  },
  {
    id: 'minimal',
    label: 'Minimalista',
    description: 'Oscuro, limpio y muy legible',
    previewFrom: '#111827',
    previewTo: '#020617',
    accent: '#cbd5e1',
    background: {
      type: 'gradient',
      gradientFrom: '#111827',
      gradientTo: '#020617',
      gradientAngle: 180,
      overlay: 0,
    },
    text: {
      fontFamily: 'Inter',
      fontSize: 66,
      fontWeight: 700,
      color: '#f8fafc',
      outlineWidth: 0,
      shadow: true,
      shadowBlur: 10,
      shadowColor: '#000000',
      glow: false,
      position: 'center',
      align: 'center',
    },
    animation: {
      in: 'fade',
      out: 'fade',
      duration: 0.4,
      karaokeColor: '#e2e8f0',
    },
    effects: {
      overlay: 0,
      particles: false,
      lightleaks: false,
      vignette: true,
      vignetteIntensity: 0.24,
    },
  },
  {
    id: 'neon',
    label: 'Neón Nocturno',
    description: 'Azul profundo con brillo cian y violeta',
    previewFrom: '#020617',
    previewTo: '#312e81',
    accent: '#22d3ee',
    background: {
      type: 'gradient',
      gradientFrom: '#020617',
      gradientTo: '#312e81',
      gradientAngle: 150,
      overlay: 0.08,
    },
    text: {
      fontFamily: 'Inter',
      fontSize: 68,
      fontWeight: 800,
      color: '#e0f2fe',
      outlineWidth: 1,
      outlineColor: '#082f49',
      shadow: true,
      shadowBlur: 18,
      shadowColor: '#020617',
      glow: true,
      glowColor: '#22d3ee',
      glowIntensity: 22,
    },
    animation: {
      in: 'zoom',
      out: 'fade',
      duration: 0.45,
      karaokeColor: '#c084fc',
    },
    effects: {
      overlay: 0.08,
      overlayColor: '#020617',
      particles: true,
      particlesCount: 34,
      lightleaks: false,
      vignette: true,
      vignetteIntensity: 0.3,
    },
  },
  {
    id: 'cinema',
    label: 'Cine Clásico',
    description: 'Negros cálidos, crema y luz de película',
    previewFrom: '#3b2415',
    previewTo: '#090807',
    accent: '#e7c27d',
    background: {
      type: 'gradient',
      gradientFrom: '#3b2415',
      gradientTo: '#090807',
      gradientAngle: 160,
      overlay: 0.1,
    },
    text: {
      fontFamily: 'Georgia',
      fontSize: 66,
      fontWeight: 700,
      color: '#f6ead3',
      outlineWidth: 1,
      outlineColor: '#2a170c',
      shadow: true,
      shadowBlur: 18,
      shadowColor: '#000000',
      glow: false,
    },
    animation: {
      in: 'fade',
      out: 'fade',
      duration: 0.75,
      karaokeColor: '#e7c27d',
    },
    effects: {
      overlay: 0.08,
      overlayColor: '#1a0f08',
      particles: false,
      lightleaks: true,
      vignette: true,
      vignetteIntensity: 0.52,
    },
  },
];

export function getVisualPreset(id: VisualStyleId | undefined): VisualPreset | null {
  if (!id || id === 'default') return null;
  return visualPresets.find((preset) => preset.id === id) ?? null;
}
