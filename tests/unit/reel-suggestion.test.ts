import { expect, it } from 'vitest';
import { suggestReel } from '../../lib/reel-suggestion';

it('suggests 30 seconds around a repeated timed phrase, ignoring punctuation and accents', () => {
  const lines = [
    { id: 'a', text: '¡Volveré a tu lado!', start: 42, end: 46 },
    { id: 'b', text: 'VOLVERE A TU LADO', start: 88, end: 93 },
    { id: 'c', text: 'Sin sincronizar', start: 0, end: 0 },
  ];
  expect(suggestReel(lines, 120)).toEqual({ start: 42, end: 72, repeatedText: '¡Volveré a tu lado!' });
});

it('keeps suggested ranges within short songs and the end of a song', () => {
  expect(suggestReel([], 12)).toEqual({ start: 0, end: 12, repeatedText: '' });
  expect(suggestReel([], 120, 115)).toEqual({ start: 90, end: 120, repeatedText: '' });
  expect(suggestReel([], 0)).toEqual({ start: 0, end: 0, repeatedText: '' });
});
