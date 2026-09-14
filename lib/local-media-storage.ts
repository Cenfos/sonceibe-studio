'use client';

const DB_NAME = 'sonceibe-studio-local-v1';
const DB_VERSION = 1;
const MEDIA_STORE = 'media';

export const LOCAL_AUDIO_URL = 'sonceibe-local://audio';

type MediaKind = 'audio';

interface MediaRecord {
  key: string;
  userId: string;
  projectId: string;
  kind: MediaKind;
  name: string;
  type: string;
  blob: Blob;
  updatedAt: number;
}

function mediaKey(userId: string, projectId: string, kind: MediaKind): string {
  return `${userId}:${projectId}:${kind}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este navegador'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        const store = db.createObjectStore(MEDIA_STORE, { keyPath: 'key' });
        store.createIndex('project', ['userId', 'projectId'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el almacenamiento local'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Error de almacenamiento local'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Error de almacenamiento local'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Operación de almacenamiento cancelada'));
  });
}

export async function saveProjectAudio(userId: string, projectId: string, file: File): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    const record: MediaRecord = {
      key: mediaKey(userId, projectId, 'audio'),
      userId,
      projectId,
      kind: 'audio',
      name: file.name,
      type: file.type || 'audio/mpeg',
      blob: file,
      updatedAt: Date.now(),
    };
    store.put(record);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function getProjectAudio(userId: string, projectId: string): Promise<File | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const record = await requestToPromise(
      tx.objectStore(MEDIA_STORE).get(mediaKey(userId, projectId, 'audio')) as IDBRequest<MediaRecord | undefined>
    );
    if (!record?.blob) return null;
    return new File([record.blob], record.name || 'audio.mp3', {
      type: record.type || record.blob.type || 'audio/mpeg',
      lastModified: record.updatedAt,
    });
  } finally {
    db.close();
  }
}

export async function deleteProjectMedia(userId: string, projectId: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const index = tx.objectStore(MEDIA_STORE).index('project');
    const range = IDBKeyRange.only([userId, projectId]);

    await new Promise<void>((resolve, reject) => {
      const cursorRequest = index.openKeyCursor(range);
      cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error('No se pudo borrar el contenido local'));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve();
          return;
        }
        tx.objectStore(MEDIA_STORE).delete(cursor.primaryKey);
        cursor.continue();
      };
    });

    await transactionDone(tx);
  } finally {
    db.close();
  }
}
