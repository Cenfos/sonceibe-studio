import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { createDefaultProjectSettings } from '../../lib/types';
import { hasExternalCopy, loadRecentProjects, saveRecentProjects } from '../../lib/recent-projects';
import { saveProjectToDevice } from '../../lib/project/download-current-project';

const project = (id = crypto.randomUUID()) => ({ id, settings: createDefaultProjectSettings() });
function legacy() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

it('migrates large photos into IndexedDB and removes legacy browser strings only after committing', async () => {
  const key = crypto.randomUUID(), store = legacy(), saved = project();
  saved.settings.background.imageUrl = `data:image/webp;base64,${'A'.repeat(6 * 1024 * 1024)}`;
  store.setItem(key, JSON.stringify([saved]));
  const loaded = await loadRecentProjects(key, store);
  expect(loaded.projects[0]).toEqual(saved);
  expect(store.getItem(key)).toBeNull();
  expect((await loadRecentProjects(key)).projects[0].settings.background.imageUrl).toBe(saved.settings.background.imageUrl);
});

it('keeps every legacy project rather than silently discarding unsaved work above five', async () => {
  const key = crypto.randomUUID(), store = legacy();
  store.setItem(key, JSON.stringify(Array.from({ length: 7 }, () => project())));
  expect((await loadRecentProjects(key, store)).projects).toHaveLength(7);
});

it('does not migrate or overwrite damaged originals', async () => {
  const key = crypto.randomUUID(), store = legacy(), saved = project();
  store.setItem(key, '{broken'); store.setItem(`${key}:backup`, JSON.stringify([saved]));
  const loaded = await loadRecentProjects(key, store);
  expect(loaded.recovery).toBe(true);
  expect(loaded.backup).toEqual([saved]);
  expect(store.getItem(key)).toBe('{broken');
  expect((await loadRecentProjects(key)).projects).toEqual([]);
});

it('persists current external-copy markers, invalidates edits and isolates users', async () => {
  const key = crypto.randomUUID(), saved = project();
  const copies = { [saved.id]: { updatedAt: saved.settings.updatedAt, savedAt: Date.now() } };
  await saveRecentProjects(key, [saved], copies);
  const loaded = await loadRecentProjects(key);
  expect(hasExternalCopy(saved, loaded.copies)).toBe(true);
  saved.settings.updatedAt += 1;
  expect(hasExternalCopy(saved, loaded.copies)).toBe(false);
  expect((await loadRecentProjects(`${key}-other`)).projects).toEqual([]);
});

it('rolls back a quota failure without losing the old project or its photos', async () => {
  const key = crypto.randomUUID(), saved = project();
  await saveRecentProjects(key, [saved]);
  const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  await expect(saveRecentProjects(key, [])).rejects.toThrow('Full');
  put.mockRestore();
  expect((await loadRecentProjects(key)).projects).toEqual([saved]);
});

it('opens a file picker before loading audio and only succeeds after closing the written file', async () => {
  const order: string[] = [];
  vi.stubGlobal('window', { showSaveFilePicker: async () => { order.push('picker'); return { createWritable: async () => ({ write: async (blob: Blob) => { expect((await blob.text())).toContain('sonceibe-studio'); order.push('write'); }, close: async () => { order.push('close'); } }) }; } });
  try {
    expect(await saveProjectToDevice(project(), async () => { order.push('audio'); return null; })).toBe('file');
    expect(order).toEqual(['picker', 'audio', 'write', 'close']);
  } finally { vi.unstubAllGlobals(); }
});

it('does not treat a cancelled or failed disk write as a saved copy', async () => {
  const audio = vi.fn(async () => null);
  vi.stubGlobal('window', { showSaveFilePicker: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
  await expect(saveProjectToDevice(project(), audio)).rejects.toThrow('Cancelled');
  expect(audio).not.toHaveBeenCalled();
  const abort = vi.fn(async () => {});
  vi.stubGlobal('window', { showSaveFilePicker: async () => ({ createWritable: async () => ({ write: async () => { throw new Error('Disk full'); }, close: async () => {}, abort }) }) });
  try { await expect(saveProjectToDevice(project(), audio)).rejects.toThrow('Disk full'); expect(abort).toHaveBeenCalledOnce(); }
  finally { vi.unstubAllGlobals(); }
});
