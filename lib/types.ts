export type ID = string;

export type BackgroundType =
  | 'image'
  | 'images'
  | 'video'
  | 'color'
  | 'gradient';

export type ImageSequenceMode = 'auto' | 'manual';
export type ImageFitMode = 'contain' | 'cover';
export type VideoOrientation = 'landscape' | 'portrait';
export type VisualStyleId = 'default' | 'sonceibe' | 'karaoke-pop' | 'minimal' | 'neon' | 'cinema';

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
  start: number;
  end: number;
  words?: { text: string; start: number; end: number }[];
}

export interface BackgroundImageClip {
  id: ID;
  url: string;
  start: number;
  end: number;
}

export interface BackgroundConfig {
  type: BackgroundType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  imageUrl: string;
  images: string[];
  imageMode: ImageSequenceMode;
  imageDuration: number;
  imageClips: BackgroundImageClip[];
  imageFit: ImageFitMode;
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

export interface TitleStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  color: string;
  outlineWidth: number;
  outlineColor: string;
  shadow: boolean;
  shadowBlur: number;
  shadowColor: string;
  glow: boolean;
  glowColor: string;
  glowIntensity: number;
  /** Distance from the top measured as a percentage of the short side. */
  topOffset: number;
  uppercase: boolean;
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
  orientation: VideoOrientation;
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
  /** Independent appearance for the permanent song title. Optional for old projects. */
  titleStyle?: TitleStyle;
  animation: AnimationConfig;
  effects: EffectsConfig;
  exportConfig: ExportConfig;
  visualStyle?: VisualStyleId;
  showSonCeibeBranding?: boolean;
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

export const defaultTitleStyle: TitleStyle = {
  fontFamily: 'Georgia',
  fontSize: 88,
  fontWeight: 800,
  fontStyle: 'normal',
  color: '#ffffff',
  outlineWidth: 2,
  outlineColor: '#000000',
  shadow: true,
  shadowBlur: 14,
  shadowColor: '#000000',
  glow: false,
  glowColor: '#d99a45',
  glowIntensity: 14,
  // Using the short side keeps the title at a similar physical height in
  // 16:9 and 9:16. This is deliberately lower than the old h * 0.085 value.
  topOffset: 18,
  uppercase: true,
};

export const defaultBackground: BackgroundConfig = {
  type: 'gradient',
  color: '#0f172a',
  gradientFrom: '#1e3a8a',
  gradientTo: '#7c3aed',
  gradientAngle: 135,
  imageUrl: '',
  images: [],
  imageMode: 'auto',
  imageDuration: 5,
  imageClips: [],
  imageFit: 'cover',
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

// Mobile-first by default: new projects created on PC are immediately prepared
// for true full-screen 9:16 export. PC/TV 16:9 remains available as an explicit
// export preset when a horizontal video is wanted.
export const defaultExport: ExportConfig = {
  format: 'mp4',
  resolution: '1080p',
  fps: 30,
  includeAudio: true,
  orientation: 'portrait',
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
    titleStyle: { ...defaultTitleStyle },
    animation: { ...defaultAnimation },
    effects: { ...defaultEffects },
    exportConfig: { ...defaultExport },
    visualStyle: 'default',
    showSonCeibeBranding: false,
    createdAt: now,
    updatedAt: now,
  };
}
