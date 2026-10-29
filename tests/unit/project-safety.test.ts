import { expect, it } from 'vitest';
import { createDefaultProjectSettings } from '../../lib/types';
import { validateProject, parseProjectList } from '../../lib/project-validation';
import { loadProjectStorage, saveProjectStorage } from '../../lib/project-storage';
import { readPortableProjectFile, downloadCurrentProject } from '../../lib/project/download-current-project';

const project = () => ({ id: 'safe-project', settings: createDefaultProjectSettings() });
function storage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

it('validates projects and supplies older settings without losing Reel lyrics or images', () => {
  const saved = project();
  saved.settings.reel = { start: 40, end: 45, coverUrl: 'data:image/jpeg;base64,abc', showTitle: false, showLyrics: true, lyricsMode: 'custom', lyrics: [{ id: 'line', text: 'Amores cegos', start: -1, end: 4 }] };
  expect(validateProject(saved)).toEqual(saved);
  expect(validateProject({ id: 'old', settings: { title: 'Antigua' } }).settings.background).toEqual(saved.settings.background);
  // In-progress boundary edits must survive reload even before the end is fixed.
  saved.settings.reel.end = 30;
  expect(validateProject(saved).settings.reel?.start).toBe(40);
});

it('rejects malformed nested settings, unsafe resources and nonfinite times', () => {
  const saved = project();
  for (const settings of [null, { title: 'Bad', lyrics: {} }, { title: 'Bad', effects: { particlesCount: 1e9 } }, { title: 'Bad', audioUrl: 'javascript:alert(1)' }, { title: 'Bad', audioDuration: NaN }]) {
    expect(() => validateProject({ ...saved, settings })).toThrow();
  }
  expect(() => parseProjectList('{}')).toThrow();
  expect(() => parseProjectList(JSON.stringify([saved, saved]))).toThrow();
});

it('retains the previous valid state and refuses to overwrite unreadable originals', () => {
  const db = storage();
  const saved = project();
  saveProjectStorage(db, 'projects', [saved]);
  const original = db.getItem('projects');
  saved.settings.title = 'Changed';
  saveProjectStorage(db, 'projects', [saved]);
  expect(db.getItem('projects:backup')).toBe(original);
  db.setItem('projects', '{broken');
  const loaded = loadProjectStorage(db, 'projects');
  expect(loaded).toMatchObject({ recovery: true, raw: '{broken', projects: [] });
  expect(loaded.backup?.[0].settings.title).toBe(project().settings.title);
  expect(() => saveProjectStorage(db, 'projects', [])).toThrow();
  expect(db.getItem('projects')).toBe('{broken');
});

it('keeps the current project intact if saving the backup runs out of space', () => {
  const db = storage();
  saveProjectStorage(db, 'projects', [project()]);
  const original = db.getItem('projects');
  const full = { getItem: db.getItem, setItem: () => { throw new Error('QuotaExceeded'); } };
  expect(() => saveProjectStorage(full, 'projects', [])).toThrow('QuotaExceeded');
  expect(db.getItem('projects')).toBe(original);
});

it('imports portable audio and rejects corrupted or oversized files before saving', async () => {
  const payload = { format: 'sonceibe-studio', version: 1, project: project(), audioDataUrl: 'data:audio/wav;base64,YWJj' };
  const file = (value: unknown) => new File([JSON.stringify(value)], 'project.scs');
  const imported = await readPortableProjectFile(file(payload));
  expect(await imported.audioFile?.text()).toBe('abc');
  expect(imported.project.id).toBe('safe-project');
  await expect(readPortableProjectFile(file({ ...payload, project: { id: 'bad', settings: { title: {}, lyrics: [] } } }))).rejects.toThrow();
  await expect(readPortableProjectFile(file({ ...payload, audioDataUrl: 'data:text/html;base64,WA==' }))).rejects.toThrow('audio');
  await expect(readPortableProjectFile({ size: 257 * 1024 * 1024 } as File)).rejects.toThrow('256 MB');
});

it('does not download an apparently complete backup if the original audio is missing', async () => {
  const saved = project(); saved.settings.audioName = 'missing.mp3';
  await expect(downloadCurrentProject(saved)).rejects.toThrow('incluir el audio');
});
