import type { Project } from './types';
import { parseProjectList } from './project-validation';
import { loadProjectStorage } from './project-storage';

export const MAX_RECENT_PROJECTS = 5;
export interface ExternalCopy { updatedAt: number; savedAt: number }
export type ExternalCopies = Record<string, ExternalCopy>;
export interface RecentLibrary {
  projects: Project[];
  copies: ExternalCopies;
  recovery: boolean;
  raw: string | null;
  backup: Project[] | null;
}
const DB = 'sonceibe-studio-projects-v1';
const STORE = 'libraries';
interface RecordData { key: string; projects: Project[]; copies: ExternalCopies; backup: Project[] }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el almacenamiento de proyectos'));
  });
}

async function readRecord(key: string): Promise<RecordData | undefined> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

/** Projects, embedded photos, and the previous valid state commit atomically in IndexedDB. */
export async function saveRecentProjects(key: string, projects: Project[], copies: ExternalCopies = {}, recovering = false): Promise<void> {
  parseProjectList(JSON.stringify(projects));
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const request = store.get(key);
      request.onsuccess = () => {
        try {
          const previous = request.result as RecordData | undefined;
          const valid = previous && !recovering ? parseProjectList(JSON.stringify(previous.projects)) : [];
          const ids = new Set(projects.map(project => project.id));
          store.put({ key, projects, copies: Object.fromEntries(Object.entries(copies).filter(([id]) => ids.has(id))), backup: valid.filter(project => ids.has(project.id)) } satisfies RecordData);
        } catch (error) { tx.abort(); reject(error); }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('No se pudieron guardar los proyectos'));
      tx.onabort = () => reject(tx.error ?? new Error('Guardado cancelado; se conserva la copia anterior'));
    });
  } finally { db.close(); }
}

export async function loadRecentProjects(key: string, legacy?: Pick<Storage, 'getItem' | 'removeItem'>, migrateLegacy = false): Promise<RecentLibrary> {
  const stored = await readRecord(key);
  if (stored) {
    try {
      const projects = parseProjectList(JSON.stringify(stored.projects));
      const copies = Object.fromEntries(Object.entries(stored.copies ?? {}).filter(([, value]) => value && Number.isFinite(value.updatedAt) && Number.isFinite(value.savedAt)));
      return { projects, copies, recovery: false, raw: null, backup: null };
    } catch {
      let backup: Project[] | null = null;
      try { backup = parseProjectList(JSON.stringify(stored.backup)); } catch {}
      return { projects: [], copies: {}, recovery: true, raw: JSON.stringify(stored), backup };
    }
  }
  if (legacy) {
    const source = legacy.getItem(key) === null && migrateLegacy && legacy.getItem('sonceibe-projects-v1') !== null ? 'sonceibe-projects-v1' : key;
    const loaded = loadProjectStorage(legacy as Storage, source);
    if (loaded.recovery) return { ...loaded, copies: {} };
    // Keep every old project during migration. The five-project rule never silently truncates old work.
    await saveRecentProjects(key, loaded.projects);
    legacy.removeItem(source); legacy.removeItem(`${source}:backup`);
    return { ...loaded, copies: {} };
  }
  return { projects: [], copies: {}, recovery: false, raw: null, backup: null };
}

export function hasExternalCopy(project: Project, copies: ExternalCopies): boolean {
  return copies[project.id]?.updatedAt === project.settings.updatedAt;
}
