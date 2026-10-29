import type { Project } from './types';
import { parseProjectList } from './project-validation';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
export interface ProjectLoad {
  projects: Project[];
  recovery: boolean;
  raw: string | null;
  backup: Project[] | null;
}

export function loadProjectStorage(storage: Storage, key: string): ProjectLoad {
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
    return { projects: raw === null ? [] : parseProjectList(raw), recovery: false, raw, backup: null };
  } catch {
    let backup: Project[] | null = null;
    try {
      const saved = storage.getItem(`${key}:backup`);
      if (saved !== null) backup = parseProjectList(saved);
    } catch { /* Keep the original untouched, even if the backup is also damaged. */ }
    return { projects: [], recovery: true, raw, backup };
  }
}

export function saveProjectStorage(storage: Storage, key: string, projects: Project[]): void {
  const next = JSON.stringify(projects);
  // Validate before touching either copy. Preserve the previous valid state first.
  parseProjectList(next);
  const previous = storage.getItem(key);
  if (previous === next) return;
  if (previous !== null) {
    parseProjectList(previous);
    storage.setItem(`${key}:backup`, previous);
  }
  storage.setItem(key, next);
}
