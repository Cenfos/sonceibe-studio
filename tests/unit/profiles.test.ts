import { expect, it } from 'vitest';
import { createDefaultProjectSettings } from '../../lib/types';
import { matchesVideoProfile, settingsForVideoTarget, VIDEO_PROFILES } from '../../lib/video-profiles';

it.each([['mobile', 1080, 1920, 'portrait'], ['pc', 1920, 1080, 'landscape']] as const)('locks %s resolution, ratio and cover without mutating projects', (target, width, height, orientation) => {
  const source = createDefaultProjectSettings();
  source.background.imageFit = 'contain';
  source.background.photoClips = [{ id: 'photo', url: 'photo.png', start: 2, end: 5, placement: { scale: 65, x: 12, y: 80, fit: 'contain' } }];
  const original = structuredClone(source);
  const output = settingsForVideoTarget(source, target);
  expect(VIDEO_PROFILES[target]).toMatchObject({ width, height, fps: 30 });
  expect(output.exportConfig).toMatchObject({ orientation, resolution: '1080p', fps: 30 });
  expect(output.background.imageFit).toBe('cover');
  expect(output.background.photoClips).toEqual(original.background.photoClips);
  expect(source).toEqual(original);
  expect(matchesVideoProfile(width, height, target)).toBe(true);
  expect(matchesVideoProfile(height, width, target)).toBe(false);
  expect(matchesVideoProfile(720, 1280, target)).toBe(false);
});
