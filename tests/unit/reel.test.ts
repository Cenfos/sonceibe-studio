import { expect, it } from 'vitest';
import { emptyStyle, reelSettings, sliceAudioWav, validateReel, reelLyricsIssue, markReelBoundary } from '../../lib/reel';
import { createDefaultProjectSettings } from '../../lib/types';

it('clips overlapping lines, words and photos without mutating the full project', () => {
  const settings = createDefaultProjectSettings(); settings.audioDuration = 60;
  settings.lyrics = [{ id: 'a', text: 'hola mundo', start: 8, end: 15, words: [{ text: 'hola', start: 8, end: 11 }, { text: 'mundo', start: 11, end: 15 }] }, { id: 'b', text: 'fuera', start: 20, end: 30 }];
  settings.background.photoClips = [{ id: 'photo', url: 'photo', start: 9, end: 13 }];
  const before = JSON.stringify(settings);
  const reel = reelSettings(settings, 10, 14);
  expect(reel.audioDuration).toBe(4);
  expect(reel.lyrics).toEqual([{ id: 'a', text: 'hola mundo', start: 0, end: 4, words: [{ text: 'hola', start: 0, end: 1 }, { text: 'mundo', start: 1, end: 4 }] }]);
  expect(reel.background.photoClips?.[0]).toMatchObject({ start: 0, end: 3 });
  expect(JSON.stringify(settings)).toBe(before);
});

it('preserves automatic photo sequences and the chosen style over a cover', () => {
  const settings = createDefaultProjectSettings(); settings.audioDuration = 60;
  settings.background = { ...settings.background, type: 'images', images: ['a', 'b'], imageDuration: 5 };
  expect(reelSettings(settings, 8, 12).background.imageClips).toEqual([{ id: 'reel-1', url: 'b', start: 0, end: 2 }, { id: 'reel-2', url: 'a', start: 2, end: 4 }]);
  settings.visualStyle = 'sonceibe'; settings.effects.particles = true;
  settings.text = { ...settings.text, fontFamily: 'Georgia', color: '#00ff00', fontSize: 85 };
  settings.titleStyle = { ...settings.titleStyle!, color: '#ff00ff' };
  const cover = reelSettings(settings, 8, 12, 'cover', false, false);
  expect(cover.background).toMatchObject({ type: 'image', imageUrl: 'cover', imageFit: 'cover', photoClips: [] });
  expect(cover.visualStyle).toBe('sonceibe'); expect(cover.showTitle).toBe(false); expect(cover.lyrics).toEqual([]); expect(cover.effects.particles).toBe(true);
  expect(cover.text).toEqual(settings.text);
  expect(cover.titleStyle).toEqual(settings.titleStyle);
  expect(cover.animation).toEqual(settings.animation);
});

it('encodes the selected stereo samples, with neither the intro nor the outro', async () => {
  const left = new Float32Array([0, 0, 0.5, -0.5, 1, -1, 0, 0]);
  const right = new Float32Array([1, 1, -0.5, 0.5, -1, 1, 1, 1]);
  const blob = sliceAudioWav({ duration: 2, length: 8, sampleRate: 4, numberOfChannels: 2, getChannelData: n => n ? right : left }, 0.5, 1.5);
  const view = new DataView(await blob.arrayBuffer());
  expect(view.getUint32(40, true)).toBe(16);
  expect(view.getUint16(22, true)).toBe(2);
  expect(Array.from({ length: 8 }, (_, n) => view.getInt16(44 + n * 2, true))).toEqual([16384, -16384, -16384, 16384, 32767, -32768, -32768, 32767]);
});

it('rejects invalid boundaries and resets backgrounds including overlays', () => {
  for (const [a, b] of [[-1, 3], [5, 4], [1, 100], [0, NaN], [0, 0.1]]) expect(() => validateReel(a, b, 60)).toThrow();
  const reset = emptyStyle();
  expect(reset.background).toMatchObject({ type: 'color', color: '#000000', imageUrl: '', images: [], photoClips: [], overlay: 0 });
  expect(reset.effects).toMatchObject({ overlay: 0, particles: false, vignette: false });
});


it('uses relative Reel lyrics at a later song offset and preserves project lyrics', () => {
  const settings = createDefaultProjectSettings(); settings.audioDuration = 120;
  settings.lyrics = [{ id: 'original', text: 'Canción completa', start: 40, end: 50 }];
  settings.reel = { start: 40, end: 44, coverUrl: '', showTitle: true, showLyrics: true, lyricsMode: 'custom', lyrics: [{ id: 'custom', text: 'Sólo este Reel', start: 0.5, end: 3 }] };
  const before = JSON.stringify(settings);
  expect(reelSettings(settings, 40, 44).lyrics).toEqual(settings.reel.lyrics);
  expect(reelSettings(settings, 40, 44, '', false).lyrics).toEqual([]);
  settings.reel.lyricsMode = 'project';
  expect(reelSettings(settings, 40, 44).lyrics[0]).toMatchObject({ text: 'Canción completa', start: 0, end: 4 });
  settings.reel.lyricsMode = 'custom';
  expect(JSON.stringify(settings)).toBe(before);
  expect(reelLyricsIssue(settings.reel)).toBe('');
  settings.reel.lyrics![0].end = 0;
  expect(reelLyricsIssue(settings.reel)).not.toBe('');
  settings.reel.lyrics![0].end = 3;
  settings.reel.lyricsText = 'Texto cambiado';
  expect(reelLyricsIssue(settings.reel)).not.toBe('');
});


it('marks a Reel from song lyrics without shifting the custom lyrics in the song', () => {
  const settings = createDefaultProjectSettings(); settings.audioDuration = 120;
  settings.reel = { start: 40, end: 50, coverUrl: '', showTitle: true, showLyrics: true, lyricsMode: 'custom', lyricsText: 'Una frase', lyrics: [{ id: 'a', text: 'Una frase', start: 2, end: 8 }] };
  const next = { ...settings, ...markReelBoundary(settings, 'start', 43, 120) };
  expect(next.reel!.lyrics![0]).toMatchObject({ start: -1, end: 5 });
  expect(next.reel!.start).toBe(43);
  expect(settings.reel.lyrics![0].start).toBe(2);
  const cropped = { ...next, ...markReelBoundary(next, 'end', 47, 120) };
  expect(reelLyricsIssue(cropped.reel!)).toBe('');
  expect(reelSettings(cropped, 43, 47).lyrics[0]).toMatchObject({ text: 'Una frase', start: 0, end: 4 });
});
