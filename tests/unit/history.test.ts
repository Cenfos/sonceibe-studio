import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { captureSnapshot, listSnapshots, deleteSnapshots, copyProject, restoreSnapshotAudio, MAX_SNAPSHOTS } from '../../lib/project-history';
import { createDefaultProjectSettings, type Project } from '../../lib/types';
import { saveProjectAudio, getProjectAudio, deleteProjectMedia, LOCAL_AUDIO_URL } from '../../lib/local-media-storage';

it('persists immutable versions, scopes by user, and retains a bounded history', async () => {
  const project: Project = { id: crypto.randomUUID(), settings: createDefaultProjectSettings() };
  project.settings.background.photoClips = [{ id: 'photo', url: 'data:image/png;base64,xx', start: 1, end: 5, placement: { x: 30, y: 50, scale: 80 } }];
  await captureSnapshot('owner', 'owner', project, 'Antes de cambiar fotos');
  project.settings.background.photoClips[0].start = 9;
  expect((await listSnapshots('owner', project.id))[0].settings.background.photoClips?.[0].start).toBe(1);
  expect(await listSnapshots('other', project.id)).toEqual([]);
  for (let i = 0; i < MAX_SNAPSHOTS + 2; i++) { project.settings.title = String(i); await captureSnapshot('owner', 'owner', project, String(i)); }
  const versions = await listSnapshots('owner', project.id);
  expect(versions).toHaveLength(MAX_SNAPSHOTS);
  expect(versions[0].reason).toBe(String(MAX_SNAPSHOTS + 1));
  await deleteSnapshots('owner', project.id);
  expect(await listSnapshots('owner', project.id)).toEqual([]);
});

it('duplicates nested settings and audio independently; restores the old audio after replacement', async () => {
  const project: Project = { id: crypto.randomUUID(), settings: createDefaultProjectSettings() };
  project.settings.audioUrl = LOCAL_AUDIO_URL;
  project.settings.audioName = 'old.wav';
  project.settings.lyrics = [{ id: 'a', text: 'Original', start: 0, end: 4 }];
  await saveProjectAudio('owner', project.id, new File(['original'], 'old.wav', { type: 'audio/wav' }));
  await captureSnapshot('owner', 'owner', project, 'Before audio');
  await saveProjectAudio('owner', project.id, new File(['replacement'], 'new.wav', { type: 'audio/wav' }));
  await restoreSnapshotAudio('owner', project.id, (await listSnapshots('owner', project.id))[0]);
  expect(await (await getProjectAudio('owner', project.id))?.text()).toBe('original');
  const copy = await copyProject('owner', project, [project]);
  expect(copy.id).not.toBe(project.id);
  copy.settings.lyrics[0].text = 'Copy';
  expect(project.settings.lyrics[0].text).toBe('Original');
  await deleteProjectMedia('owner', project.id);
  expect(await (await getProjectAudio('owner', copy.id))?.text()).toBe('original');
  expect(await listSnapshots('owner', copy.id)).toEqual([]);
});

it('refuses to silently create a copy with missing local audio', async () => {
  const project = { id: crypto.randomUUID(), settings: { ...createDefaultProjectSettings(), audioUrl: LOCAL_AUDIO_URL } };
  await expect(copyProject('owner', project, [])).rejects.toThrow('audio original');
});
