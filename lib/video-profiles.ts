import type { ExportQuality, ProjectSettings, VideoOrientation } from './types';

export const EXPORT_QUALITIES: Record<ExportQuality, { label: string; description: string; videoBitrate: number; audioBitrate: number }> = {
  light: { label: 'Ligera', description: 'Archivo pequeño para compartir.', videoBitrate: 1_300_000, audioBitrate: 96_000 },
  balanced: { label: 'Equilibrada', description: 'Buen detalle y tamaño moderado.', videoBitrate: 5_500_000, audioBitrate: 160_000 },
  high: { label: 'Alta', description: 'Más detalle en movimiento; archivo mayor.', videoBitrate: 12_000_000, audioBitrate: 192_000 },
};

export function videoProfileForQuality(target: VideoTarget, quality: ExportQuality = 'balanced'): VideoProfile {
  const level = EXPORT_QUALITIES[quality] ?? EXPORT_QUALITIES.balanced;
  return { ...VIDEO_PROFILES[target], videoBitrate: level.videoBitrate, audioBitrate: level.audioBitrate };
}

export type VideoTarget = 'mobile' | 'pc';

export interface VideoProfile {
  id: VideoTarget;
  label: string;
  description: string;
  width: number;
  height: number;
  orientation: VideoOrientation;
  fps: 30;
  videoBitrate: number;
  audioBitrate: number;
  filenameSuffix: string;
}

export const VIDEO_PROFILES: Record<VideoTarget, VideoProfile> = {
  mobile: {
    id: 'mobile',
    label: 'Móvil',
    description: '1080×1920 · 9:16 · pantalla completa',
    width: 1080,
    height: 1920,
    orientation: 'portrait',
    fps: 30,
    videoBitrate: 1_300_000,
    audioBitrate: 96_000,
    filenameSuffix: '-movil-9x16',
  },
  pc: {
    id: 'pc',
    label: 'PC / TV',
    description: '1920×1080 · 16:9 · pantalla completa',
    width: 1920,
    height: 1080,
    orientation: 'landscape',
    fps: 30,
    videoBitrate: 5_500_000,
    audioBitrate: 160_000,
    filenameSuffix: '-pc-16x9',
  },
};

export function videoTargetFromOrientation(
  orientation: VideoOrientation | undefined
): VideoTarget {
  return orientation === 'landscape' ? 'pc' : 'mobile';
}

/**
 * Rendering for a final video is deliberately independent from how a project
 * happened to be saved. Both target formats always fill their complete frame.
 * This prevents an old "contain" setting from reintroducing black side bars.
 */
export function settingsForVideoTarget(
  settings: ProjectSettings,
  target: VideoTarget
): ProjectSettings {
  const profile = VIDEO_PROFILES[target];

  return {
    ...settings,
    background: {
      ...settings.background,
      imageFit: 'cover',
    },
    exportConfig: {
      ...settings.exportConfig,
      resolution: '1080p',
      orientation: profile.orientation,
      fps: profile.fps,
    },
  };
}

export function matchesVideoProfile(
  width: number,
  height: number,
  target: VideoTarget
): boolean {
  const profile = VIDEO_PROFILES[target];
  return width === profile.width && height === profile.height;
}
