import { expect, it } from 'vitest';
import { visualPresets, settingsWithVisualPreset } from '../../lib/visual-presets';
import { createDefaultProjectSettings } from '../../lib/types';
it.each(visualPresets)('$id preserves footage, framing, sound and existing text when used on video', preset => {
  const settings = createDefaultProjectSettings(); settings.text.fontSize = 77;
  settings.background = { ...settings.background, type: 'video', videoUrl: 'sonceibe-local://source-video/unit', videoStart: 12, videoEnd: 42, videoDuration: 60, videoMuted: true, songOffset: 8, videoPlacement: { fit: 'contain', scale: 60, x: 30, y: 70 } };
  const result = { ...settings, ...settingsWithVisualPreset(settings, preset) };
  expect(result.background).toMatchObject({ ...settings.background, overlay: 0, blur: 0 });
  expect(result.text).toEqual(settings.text); expect(result.titleStyle).toEqual(settings.titleStyle);
  expect(result.effects).toMatchObject({ overlay: 0, blur: 0, lightleaks: false, vignette: false, particles: false });
  expect(result.visualStyle).toBe(preset.id); expect(result.showSonCeibeBranding).toBe(true);
});
