import { describe, expect, it } from 'vitest';
import { editTimeRange, pointerTime } from '../../lib/timeline-edit';

describe('timeline bounds and snapping', () => {
  it('accounts for horizontal scrolling exactly once', () => {
    expect(pointerTime(300, -500, 20, 120)).toBe(40);
  });
  it('snaps either edge of a moved clip to the playhead', () => {
    expect(editTimeRange({ start: 1, end: 3 }, 'move', 1.9, 30, { playhead: 5, pxPerSec: 40 })).toEqual({ start: 3, end: 5 });
    expect(editTimeRange({ start: 1, end: 3 }, 'move', 3.9, 30, { playhead: 5, pxPerSec: 40 })).toEqual({ start: 5, end: 7 });
  });
  it('does not round fine edits to a grid', () => {
    expect(editTimeRange({ start: 1, end: 3 }, 'left', 0.01, 30).start).toBe(1.01);
  });
  it('never snaps past song bounds or reverses a clip', () => {
    for (const mode of ['left', 'right', 'move'] as const) {
      for (const delta of [-100, -0.15, 0.01, 0.15, 100]) {
        const result = editTimeRange({ start: 9.6, end: 9.9 }, mode, delta, 10, { playhead: 10, pxPerSec: 20 });
        expect(result.start).toBeGreaterThanOrEqual(0);
        expect(result.end).toBeLessThanOrEqual(10);
        expect(result.end - result.start).toBeGreaterThanOrEqual(0.199999);
      }
    }
  });
  it('allows editing without an audio duration and clamps imported invalid ranges', () => {
    expect(editTimeRange({ start: 1, end: 4 }, 'right', 2, 0).end).toBe(6);
    expect(editTimeRange({ start: 10, end: 10 }, 'move', 0, 5)).toEqual({ start: 4.8, end: 5 });
  });
});
