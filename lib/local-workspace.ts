'use client';

import type { Project } from './types';

const DB_NAME = 'sonceibe-studio-workspace-v1';
const DB_VERSION = 1;
const HANDLE_STORE = 'handles';
const APP_FOLDER = 'SonCeibe Studio';
const PROJECTS_FOLDER = 'projects';

type PermissionMode = 'read' | 'readwrite';
type HandlePermission = 'granted' | 'denied' | 'prompt';

interface WritableLike {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FileHandleLike {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableLike>;
}

interface DirectoryHandleLike {
  kind: 'directory';
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  queryPermission?(options?: { mode?: PermissionMode }): Promise<HandlePermission>;
  requestPermission?(options?: { mode?: PermissionMode }): Promise<HandlePermission>;
}

interface PickerWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: PermissionMode }) => Promise<DirectoryHandleLike>;
}

interface StoredHandle {
  userId: string;
  handle: DirectoryHandleLike;
  updatedAt: number;
}

export interface WorkspaceInfo {
  supported: boolean;
  configured: boolean;
  folderName: string;
  permission: HandlePermission | 'unavailable';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(HANDLE_STORE)) {
        request.result.createObjectStore(HANDLE_STORE, { keyPath: 'userId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la configuración de carpeta local'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Error al acceder a la carpeta local'));
  });
}

async function saveHandle(userId: string, handle: DirectoryHandleLike): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put({ userId, handle, updatedAt: Date.now() } satisfies StoredHandle);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('No se pudo recordar la carpeta local'));
      tx.onabort = () => reject(tx.error ?? new Error('No se pudo recordar la carpeta local'));
    });
  } finally {
    db.close();
  }
}

async function getStoredHandle(userId: string): Promise<DirectoryHandleLike | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openDb();
  try {
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const record = await requestToPromise(
      tx.objectStore(HANDLE_STORE).get(userId) as IDBRequest<StoredHandle | undefined>
    );
    return record?.handle ?? null;
  } finally {
    db.close();
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

async function usableHandle(userId: string, requestPermission: boolean): Promise<DirectoryHandleLike | null> {
  const handle = await getStoredHandle(userId);
  if (!handle) return null;

  let permission = await permissionFor(handle);
  if (permission === 'prompt' && requestPermission && handle.requestPermission) {
    permission = await handle.requestPermission({ mode: 'readwrite' });
  }
  return permission === 'granted' ? handle : null;
}

async function getAppRoot(handle: DirectoryHandleLike, create: boolean): Promise<DirectoryHandleLike> {
  return handle.getDirectoryHandle(APP_FOLDER, { create });
}

async function getProjectDirectory(handle: DirectoryHandleLike, projectId: string, create: boolean): Promise<DirectoryHandleLike> {
  const root = await getAppRoot(handle, create);
  const projects = await root.getDirectoryHandle(PROJECTS_FOLDER, { create });
  return projects.getDirectoryHandle(projectId, { create });
}

function safeFileName(value: string): string {
  return (value || 'audio.mp3')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'audio.mp3';
}

async function writeFile(handle: FileHandleLike, data: Blob | string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

export function isWorkspaceFolderSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function';
}

export async function chooseWorkspaceFolder(userId: string): Promise<WorkspaceInfo> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('Este navegador no permite seleccionar una carpeta de trabajo. Usa Chrome o Edge actualizado.');

  const handle = await picker({ mode: 'readwrite' });
  await saveHandle(userId, handle);
  await getAppRoot(handle, true);
  return {
    supported: true,
    configured: true,
    folderName: handle.name,
    permission: await permissionFor(handle),
  };
}

export async function getWorkspaceInfo(userId: string): Promise<WorkspaceInfo> {
  const supported = isWorkspaceFolderSupported();
  if (!supported) {
    return { supported: false, configured: false, folderName: '', permission: 'unavailable' };
  }

  const handle = await getStoredHandle(userId);
  if (!handle) {
    return { supported: true, configured: false, folderName: '', permission: 'prompt' };
  }

  return {
    supported: true,
    configured: true,
    folderName: handle.name,
    permission: await permissionFor(handle),
  };
}

export async function requestWorkspacePermission(userId: string): Promise<boolean> {
  return Boolean(await usableHandle(userId, true));
}

export async function saveProjectSnapshotToWorkspace(userId: string, project: Project): Promise<boolean> {
  const handle = await usableHandle(userId, false);
  if (!handle) return false;

  const projectDir = await getProjectDirectory(handle, project.id, true);
  const fileHandle = await projectDir.getFileHandle('project.json', { create: true });
  const payload = JSON.stringify({
    format: 'sonceibe-studio-project',
    version: 1,
    savedAt: Date.now(),
    project,
  }, null, 2);
  await writeFile(fileHandle, payload);
  return true;
}

export async function saveProjectsToWorkspace(userId: string, projects: Project[]): Promise<number> {
  const handle = await usableHandle(userId, false);
  if (!handle) return 0;

  let saved = 0;
  for (const project of projects) {
    const projectDir = await getProjectDirectory(handle, project.id, true);
    const fileHandle = await projectDir.getFileHandle('project.json', { create: true });
    const payload = JSON.stringify({
      format: 'sonceibe-studio-project',
      version: 1,
      savedAt: Date.now(),
      project,
    }, null, 2);
    await writeFile(fileHandle, payload);
    saved += 1;
  }
  return saved;
}

export async function saveProjectAudioToWorkspace(
  userId: string,
  projectId: string,
  file: File
): Promise<boolean> {
  const handle = await usableHandle(userId, false);
  if (!handle) return false;

  const projectDir = await getProjectDirectory(handle, projectId, true);
  const audioDir = await projectDir.getDirectoryHandle('audio', { create: true });
  const fileHandle = await audioDir.getFileHandle(safeFileName(file.name), { create: true });
  await writeFile(fileHandle, file);
  return true;
}

export async function getProjectAudioFromWorkspace(
  userId: string,
  projectId: string,
  audioName: string
): Promise<File | null> {
  const handle = await usableHandle(userId, false);
  if (!handle || !audioName) return null;

  try {
    const projectDir = await getProjectDirectory(handle, projectId, false);
    const audioDir = await projectDir.getDirectoryHandle('audio', { create: false });
    const fileHandle = await audioDir.getFileHandle(safeFileName(audioName), { create: false });
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}
