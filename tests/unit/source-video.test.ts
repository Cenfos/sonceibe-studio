import { expect, it } from 'vitest';
import { videoFrameRect, videoRange } from '../../lib/source-video';
import { createDefaultProjectSettings } from '../../lib/types';
import { reelSettings } from '../../lib/reel';

it('fits portrait phone footage in a landscape frame without distortion and allows crop panning', () => {
  const contained = videoFrameRect(1920, 1080, 1080, 1920, { scale: 100, x: 50, y: 50, fit: 'contain' });
  expect(contained.height).toBe(1080); expect(contained.width / contained.height).toBeCloseTo(1080 / 1920);
  expect(contained.x).toBeCloseTo((1920 - contained.width) / 2);
  const left = videoFrameRect(1080, 1920, 1920, 1080, { scale: 100, x: 0, y: 50, fit: 'cover' });
  const right = videoFrameRect(1080, 1920, 1920, 1080, { scale: 100, x: 100, y: 50, fit: 'cover' });
  expect(left.x).toBeCloseTo(0); expect(right.x + right.width).toBeCloseTo(1080); expect(right.height).toBe(1920);
});
it('clamps a damaged trim and maps a reel to the correct original video interval', () => {
  const settings = createDefaultProjectSettings(); settings.audioDuration = 10;
  settings.background = { ...settings.background, type: 'video', videoDuration: 40, videoStart: 12, videoEnd: 22 };
  expect(videoRange(settings.background)).toEqual({ start: 12, end: 22, duration: 10 });
  const reel = reelSettings(settings, 3, 7);
  expect(reel.background.videoStart).toBe(15); expect(reel.background.videoEnd).toBe(19);
  expect(videoRange({ ...settings.background, videoStart: 1000, videoEnd: -3 }).duration).toBeCloseTo(0.2);
});
