import { expect, it } from 'vitest';
import { adjustVideoPixels, normalizedVideoAdjustments } from '../../lib/video-adjustments';
import { defaultVideoAdjustments, createDefaultProjectSettings } from '../../lib/types';
import { videoProfileForQuality } from '../../lib/video-profiles';
import { validateProject } from '../../lib/project-validation';
import { reelSettings } from '../../lib/reel';

it('keeps the output size and increases the bitrate at each quality level', () => {
  for (const target of ['mobile', 'pc'] as const) {
    const levels = (['light', 'balanced', 'high'] as const).map(q => videoProfileForQuality(target, q));
    expect(levels[0].videoBitrate).toBeLessThan(levels[1].videoBitrate);
    expect(levels[1].videoBitrate).toBeLessThan(levels[2].videoBitrate);
    expect(new Set(levels.map(p => `${p.width}x${p.height}:${p.fps}`)).size).toBe(1);
    expect(videoProfileForQuality(target)).toEqual(levels[1]);
  }
});
it('preserves neutral colors and alpha, adjusts brightness and removes saturation', () => {
  const original = new Uint8ClampedArray([100, 50, 25, 255]);
  const neutral = original.slice(); adjustVideoPixels(neutral, 1, 1, defaultVideoAdjustments);
  expect(neutral).toEqual(original);
  const brighter = original.slice(); adjustVideoPixels(brighter, 1, 1, { ...defaultVideoAdjustments, brightness: 150 });
  expect(Array.from(brighter)).toEqual([150, 75, 38, 255]);
  const gray = original.slice(); adjustVideoPixels(gray, 1, 1, { ...defaultVideoAdjustments, saturation: 0 });
  expect(gray[0]).toBe(gray[1]); expect(gray[1]).toBe(gray[2]); expect(gray[3]).toBe(255);
  const flat = original.slice(); adjustVideoPixels(flat, 1, 1, { ...defaultVideoAdjustments, contrast: 0 });
  expect(Array.from(flat)).toEqual([128, 128, 128, 255]);
});
it('sharpens edges without changing a uniform region', () => {
  const pixels = new Uint8ClampedArray(5 * 5 * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([80, 80, 80, 255], i);
  const uniform = pixels.slice(); adjustVideoPixels(uniform, 5, 5, { ...defaultVideoAdjustments, sharpness: 100 });
  expect(uniform).toEqual(pixels);
  pixels.set([120, 120, 120, 255], 48);
  adjustVideoPixels(pixels, 5, 5, { ...defaultVideoAdjustments, sharpness: 50 });
  expect(pixels[48]).toBeGreaterThan(120); expect(pixels[51]).toBe(255);
});
it('retains settings through validation and Reel creation, with defaults for old projects', () => {
  const settings = createDefaultProjectSettings();
  settings.audioDuration = 3;
  settings.background.videoAdjustments = { brightness: 120, contrast: 110, saturation: 80, sharpness: 15 };
  settings.exportConfig.quality = 'high';
  const restored = validateProject({ id: 'quality', settings }).settings;
  expect(restored.background.videoAdjustments).toEqual(settings.background.videoAdjustments);
  const reel = reelSettings(restored, 0, 2);
  expect(reel.background.videoAdjustments).toEqual(settings.background.videoAdjustments);
  expect(reel.exportConfig.quality).toBe('high');
  expect(validateProject({ id: 'old', settings: { title: 'Old' } }).settings.exportConfig.quality).toBe('balanced');
  expect(normalizedVideoAdjustments()).toEqual(defaultVideoAdjustments);
});
