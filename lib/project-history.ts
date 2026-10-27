import type { Project, ProjectSettings } from './types';
import { getProjectAudio, LOCAL_AUDIO_URL, saveProjectAudio, deleteProjectMedia } from './local-media-storage';

export interface ProjectSnapshot {
  id: string;
  createdAt: number;
  reason: string;
  settings: ProjectSettings;
  audio: File | null;
}
interface HistoryRecord { scope: string; projectId: string; snapshots: ProjectSnapshot[] }
export const MAX_SNAPSHOTS = 20;
const MAX_BYTES = 128 * 1024 * 1024;

function openHistory(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sonceibe-project-history-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('history', { keyPath: ['scope', 'projectId'] });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function historyTransaction<T>(scope: string, projectId: string, change: (record: HistoryRecord) => { value: T; next?: HistoryRecord | null }): Promise<T> {
  const db = await openHistory();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('history', 'readwrite');
      const store = tx.objectStore('history');
      let result: T;
      const request = store.get([scope, projectId]);
      request.onsuccess = () => {
        const changed = change(request.result ?? { scope, projectId, snapshots: [] });
        result = changed.value;
        if (changed.next === null) store.delete([scope, projectId]);
        else if (changed.next) store.put(changed.next);
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('No se pudo guardar la versión local'));
    });
  } finally { db.close(); }
}

export function listSnapshots(scope: string, projectId: string): Promise<ProjectSnapshot[]> {
  return historyTransaction(scope, projectId, record => ({ value: record.snapshots }));
}

export function deleteSnapshots(scope: string, projectId: string): Promise<void> {
  return historyTransaction(scope, projectId, () => ({ value: undefined, next: null }));
}

export async function captureSnapshot(scope: string, userId: string, project: Project, reason: string): Promise<void> {
  // Copy before the first await: subsequent edits must never change this version.
  const settings = structuredClone(project.settings);
  const audio = await getProjectAudio(userId, project.id);
  if (settings.audioUrl === LOCAL_AUDIO_URL && !audio) throw new Error('No se encuentra el audio local para guardar la versión');
  const snapshot: ProjectSnapshot = { id: crypto.randomUUID(), createdAt: Date.now(), reason, settings, audio };
  await historyTransaction(scope, project.id, record => {
    let bytes = 0;
    const snapshots = [snapshot, ...record.snapshots].slice(0, MAX_SNAPSHOTS).filter((item, index) => {
      bytes += new Blob([JSON.stringify(item.settings)]).size + (item.audio?.size ?? 0);
      return index === 0 || bytes <= MAX_BYTES;
    });
    return { value: undefined, next: { ...record, snapshots } };
  });
}

export async function restoreSnapshotAudio(userId: string, projectId: string, snapshot: ProjectSnapshot): Promise<void> {
  if (snapshot.audio) await saveProjectAudio(userId, projectId, snapshot.audio);
  else if (!snapshot.settings.audioName && !snapshot.settings.audioUrl) await deleteProjectMedia(userId, projectId);
}

export async function copyProject(userId: string, source: Project, existing: Project[]): Promise<Project> {
  const copy = structuredClone(source);
  copy.id = crypto.randomUUID();
  const base = `${source.settings.title} — copia`;
  let title = base, suffix = 2;
  while (existing.some(project => project.settings.title === title)) title = `${base} ${suffix++}`;
  copy.settings.title = title;
  copy.settings.createdAt = copy.settings.updatedAt = Date.now();
  copy.settings.syncProgress.inProgress = false;
  const audio = await getProjectAudio(userId, source.id);
  if (source.settings.audioUrl === LOCAL_AUDIO_URL && !audio) throw new Error('No se encuentra el audio original. Cárgalo antes de duplicar.');
  if (audio) {
    await saveProjectAudio(userId, copy.id, audio);
    copy.settings.audioUrl = LOCAL_AUDIO_URL;
  }
  return copy;
}
