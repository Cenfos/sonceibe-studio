export type ID = string;

export type BackgroundType =
  | 'image'
  | 'images'
  | 'video'
  | 'color'
  | 'gradient';

export type AnimationType =
  | 'fade'
  | 'zoom'
  | 'slide'
  | 'karaoke'
  | 'word'
  | 'line'
  | 'bounce'
  | 'blur';

export type EffectType =
  | 'kenburns'
  | 'blur'
  | 'overlay'
  | 'particles'
  | 'lightleaks'
  | 'vignette';

export type ExportFormat = 'mp4';
export type ExportResolution = '720p' | '1080p' | '4k';
export type ExportFps = 30 | 60;

export interface LyricLine {
  id: ID;
  text: string;
  start: number; // seconds
  end: number; // seconds
  words?: { text: string; start: number; end: number }[];
}

export interface BackgroundConfig {
  type: BackgroundType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  imageUrl: string;
  images: string[];
  videoUrl: string;
  blur: number;
  overlay: number;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  outlineWidth: number;
  outlineColor: string;
  shadow: boolean;
  shadowBlur: number;
  shadowColor: string;
  glow: boolean;
  glowColor: string;
  glowIntensity: number;
  position: 'top' | 'center' | 'bottom';
  align: 'left' | 'center' | 'right';
  transform: 'none' | 'uppercase' | 'lowercase';
  letterSpacing: number;
  lineHeight: number;
}

export interface AnimationConfig {
  in: AnimationType;
  out: AnimationType;
  duration: number;
  karaokeColor: string;
  wordStagger: number;
}

export interface EffectsConfig {
  kenburns: boolean;
  kenburnsIntensity: number;
  blur: number;
  overlay: number;
  overlayColor: string;
  particles: boolean;
  particlesCount: number;
  lightleaks: boolean;
  vignette: boolean;
  vignetteIntensity: number;
}

export interface ExportConfig {
  format: ExportFormat;
  resolution: ExportResolution;
  fps: ExportFps;
  includeAudio: boolean;
}

export interface SyncProgress {
  syncedCount: number;
  totalCount: number;
  currentIndex: number;
  inProgress: boolean;
}

export interface ProjectSettings {
  title: string;
  artist: string;
  audioUrl: string;
  audioName: string;
  audioDuration: number;
  lyrics: LyricLine[];
  syncProgress: SyncProgress;
  background: BackgroundConfig;
  text: TextStyle;
  animation: AnimationConfig;
  effects: EffectsConfig;
  exportConfig: ExportConfig;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: ID;
  settings: ProjectSettings;
}

export const defaultTextStyle: TextStyle = {
  fontFamily: 'Inter',
  fontSize: 64,
  fontWeight: 700,
  color: '#ffffff',
  outlineWidth: 2,
  outlineColor: '#000000',
  shadow: true,
  shadowBlur: 12,
  shadowColor: '#000000',
  glow: false,
  glowColor: '#3b82f6',
  glowIntensity: 20,
  position: 'center',
  align: 'center',
  transform: 'none',
  letterSpacing: 0,
  lineHeight: 1.3,
};

export const defaultBackground: BackgroundConfig = {
  type: 'gradient',
  color: '#0f172a',
  gradientFrom: '#1e3a8a',
  gradientTo: '#7c3aed',
  gradientAngle: 135,
  imageUrl: '',
  images: [],
  videoUrl: '',
  blur: 0,
  overlay: 0.3,
};

export const defaultAnimation: AnimationConfig = {
  in: 'fade',
  out: 'fade',
  duration: 0.5,
  karaokeColor: '#22d3ee',
  wordStagger: 60,
};

export const defaultEffects: EffectsConfig = {
  kenburns: false,
  kenburnsIntensity: 0.5,
  blur: 0,
  overlay: 0.3,
  overlayColor: '#000000',
  particles: false,
  particlesCount: 40,
  lightleaks: false,
  vignette: false,
  vignetteIntensity: 0.5,
};

export const defaultExport: ExportConfig = {
  format: 'mp4',
  resolution: '1080p',
  fps: 30,
  includeAudio: true,
};

export function createDefaultProjectSettings(): ProjectSettings {
  const now = Date.now();
  return {
    title: 'Nuevo Proyecto',
    artist: '',
    audioUrl: '',
    audioName: '',
    audioDuration: 0,
    lyrics: [],
    syncProgress: { syncedCount: 0, totalCount: 0, currentIndex: 0, inProgress: false },
    background: { ...defaultBackground },
    text: { ...defaultTextStyle },
    animation: { ...defaultAnimation },
    effects: { ...defaultEffects },
    exportConfig: { ...defaultExport },
    createdAt: now,
    updatedAt: now,
  };
}
