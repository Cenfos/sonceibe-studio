export const PENDING_PROJECT_TITLE_KEY = 'sonceibe-pending-project-title';

export function titleFromAudioFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('gl-ES');
}

export function isDefaultProjectTitle(title: string | undefined | null): boolean {
  const normalized = (title ?? '').trim().toLocaleLowerCase('es-ES');
  return !normalized || normalized === 'nuevo proyecto' || normalized === 'sin título' || normalized === 'proyecto';
}
