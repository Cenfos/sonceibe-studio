import type { ProjectSettings } from './types';
import { VIDEO_PROFILES, type VideoTarget } from './video-profiles';

export type ExportCheckLevel = 'ok' | 'warning' | 'error';

export interface ExportCheck {
  id: string;
  level: ExportCheckLevel;
  label: string;
  detail: string;
}

export function getExportPreflight(
  settings: ProjectSettings,
  duration: number,
  target: VideoTarget
): ExportCheck[] {
  const profile = VIDEO_PROFILES[target];
  const lyricLines = settings.lyrics.filter((line) => line.text.trim().length > 0);
  const invalidTimedLines = lyricLines.filter(
    (line) =>
      !Number.isFinite(line.start) ||
      !Number.isFinite(line.end) ||
      line.start < 0 ||
      line.end <= line.start ||
      (duration > 0 && line.start > duration + 0.25)
  );

  const checks: ExportCheck[] = [
    duration > 0
      ? {
          id: 'audio',
          level: 'ok',
          label: 'Música',
          detail: `${Math.round(duration)} s cargados`,
        }
      : {
          id: 'audio',
          level: 'error',
          label: 'Música',
          detail: 'Falta cargar una canción',
        },
    {
      id: 'format',
      level: 'ok',
      label: 'Formato',
      detail: `${profile.width}×${profile.height} · ${target === 'mobile' ? '9:16' : '16:9'} · 30 FPS`,
    },
  ];

  if (lyricLines.length === 0) {
    checks.push({
      id: 'lyrics',
      level: 'warning',
      label: 'Letra',
      detail: 'El vídeo se exportará sin letra',
    });
  } else if (invalidTimedLines.length > 0) {
    checks.push({
      id: 'lyrics',
      level: 'warning',
      label: 'Letra',
      detail: `${invalidTimedLines.length} de ${lyricLines.length} líneas tienen tiempos incompletos o inválidos`,
    });
  } else {
    checks.push({
      id: 'lyrics',
      level: 'ok',
      label: 'Letra',
      detail: `${lyricLines.length} líneas con tiempos válidos`,
    });
  }

  const hasImages =
    Boolean(settings.background.imageUrl) ||
    (settings.background.images?.length ?? 0) > 0 ||
    (settings.background.imageClips?.length ?? 0) > 0;

  checks.push({
    id: 'visual',
    level: 'ok',
    label: 'Imagen',
    detail: hasImages
      ? 'Fotos preparadas para llenar la pantalla'
      : 'Fondo o estilo visual preparado',
  });

  if (!settings.title.trim() || settings.title.trim() === 'Nuevo Proyecto') {
    checks.push({
      id: 'title',
      level: 'warning',
      label: 'Título',
      detail: 'Conviene poner el título definitivo antes de exportar',
    });
  } else {
    checks.push({
      id: 'title',
      level: 'ok',
      label: 'Título',
      detail: settings.title.trim(),
    });
  }

  return checks;
}

export function hasBlockingExportIssue(checks: ExportCheck[]): boolean {
  return checks.some((check) => check.level === 'error');
}
