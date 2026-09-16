'use client';

import type { Project } from './types';
import { deleteProjectMedia } from './local-media-storage';

const WORKSPACE_DB_NAME = 'sonceibe-studio-workspace-v1';
const WORKSPACE_DB_VERSION = 1;
const HANDLE_STORE = 'handles';
const APP_FOLDER = 'SonCeibe Studio';
const USERS_FOLDER = 'users';
const PROJECTS_FOLDER = 'projects';
const DELETED_KEY_PREFIX = 'sonceibe-deleted-projects-v1:';

type PermissionMode = 'read' | 'readwrite';
type HandlePermission = 'granted' | 'denied' | 'prompt';

interface DirectoryHandleLike {
  kind: 'directory';
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  queryPermission?(options?: { mode?: PermissionMode }): Promise<HandlePermission>;
  requestPermission?(options?: { mode?: PermissionMode }): Promise<HandlePermission>;
  removeEntry?(name: string, options?: { recursive?: boolean }): Promise<void>;
}

interface StoredHandle {
  userId: string;
  handle: DirectoryHandleLike;
  updatedAt: number;
}

function deletedProjectsKey(userId: string): string {
  return `${DELETED_KEY_PREFIX}${userId}`;
}

export function getDeletedProjectIds(userId: string): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(deletedProjectsKey(userId));
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function persistDeletedProjectIds(userId: string, ids: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(deletedProjectsKey(userId), JSON.stringify(Array.from(ids)));
  } catch {
    // The project list itself is still removed even if this small safety marker cannot be stored.
  }
}

export function markProjectDeleted(userId: string, projectId: string): void {
  const ids = getDeletedProjectIds(userId);
  ids.add(projectId);
  persistDeletedProjectIds(userId, ids);
}

export function restoreDeletedProjectId(userId: string, projectId: string): void {
  const ids = getDeletedProjectIds(userId);
  if (!ids.delete(projectId)) return;
  persistDeletedProjectIds(userId, ids);
}

export function filterDeletedProjects(userId: string, projects: Project[]): Project[] {
  const deleted = getDeletedProjectIds(userId);
  if (deleted.size === 0) return projects;
  return projects.filter((project) => !deleted.has(project.id));
}

function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible'));
      return;
    }
    const request = indexedDB.open(WORKSPACE_DB_NAME, WORKSPACE_DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la carpeta local recordada'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Error al leer la carpeta local recordada'));
  });
}

async function getStoredWorkspaceHandle(userId: string): Promise<DirectoryHandleLike | null> {
  try {
    const db = await openWorkspaceDb();
    try {
      if (!db.objectStoreNames.contains(HANDLE_STORE)) return null;
      const tx = db.transaction(HANDLE_STORE, 'readonly');
      const record = await requestToPromise(
        tx.objectStore(HANDLE_STORE).get(userId) as IDBRequest<StoredHandle | undefined>
      );
      return record?.handle ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

async function permissionFor(handle: DirectoryHandleLike): Promise<HandlePermission> {
  if (!handle.queryPermission) return 'granted';
  try {
    return await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'prompt';
  }
}

function safeFolderName(value: string): string {
  return (value || 'user')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'user';
}

async function getProjectsDirectory(handle: DirectoryHandleLike, userId: string): Promise<DirectoryHandleLike> {
  const root = await handle.getDirectoryHandle(APP_FOLDER, { create: false });
  const users = await root.getDirectoryHandle(USERS_FOLDER, { create: false });
  const userRoot = await users.getDirectoryHandle(safeFolderName(userId), { create: false });
  return userRoot.getDirectoryHandle(PROJECTS_FOLDER, { create: false });
}

async function deleteWorkspaceProjectDirectory(userId: string, projectId: string): Promise<boolean> {
  const handle = await getStoredWorkspaceHandle(userId);
  if (!handle || !handle.removeEntry) return false;
  if (await permissionFor(handle) !== 'granted') return false;

  try {
    const projectsDir = await getProjectsDirectory(handle, userId);
    if (!projectsDir.removeEntry) return false;
    await projectsDir.removeEntry(projectId, { recursive: true });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return true;
    return false;
  }
}

/**
 * A user deletion is definitive on this device:
 * - remove the project from browser media storage (audio/video),
 * - remove its physical workspace folder when the browser still has permission,
 * - keep a local tombstone so an old folder copy can never resurrect it via Recover.
 */
export async function deleteProjectLocalData(userId: string, projectId: string): Promise<void> {
  markProjectDeleted(userId, projectId);
  await Promise.allSettled([
    deleteProjectMedia(userId, projectId),
    deleteWorkspaceProjectDirectory(userId, projectId),
  ]);
}

/** Remove any old workspace folders corresponding to projects already deleted in Studio. */
export async function purgeDeletedWorkspaceProjects(userId: string): Promise<number> {
  const deleted = getDeletedProjectIds(userId);
  if (deleted.size === 0) return 0;

  let removed = 0;
  for (const projectId of deleted) {
    if (await deleteWorkspaceProjectDirectory(userId, projectId)) removed += 1;
  }
  return removed;
}
