export interface TimeRange { start: number; end: number }
export type EditMode = 'move' | 'left' | 'right';
export const MIN_CLIP_DURATION = 0.2;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function snapToPlayhead(time: number, playhead: number, pxPerSec: number): number {
  return Math.abs(time - playhead) <= Math.min(0.25, 8 / pxPerSec) ? playhead : time;
}

export function editTimeRange(range: TimeRange, mode: EditMode, delta: number, duration: number, snap?: { playhead: number; pxPerSec: number }): TimeRange {
  const limit = duration > 0 ? duration : Math.max(range.end + Math.abs(delta) + 60, 60);
  const minLength = Math.min(MIN_CLIP_DURATION, limit);
  const start = clamp(range.start, 0, Math.max(0, limit - minLength));
  const end = clamp(range.end, start + minLength, limit);
  const round = (time: number) => Math.round(time * 1000) / 1000;
  const snapped = (time: number) => snap ? snapToPlayhead(time, snap.playhead, snap.pxPerSec) : time;
  if (mode === 'left') return { start: clamp(round(snapped(start + delta)), 0, end - minLength), end };
  if (mode === 'right') return { start, end: clamp(round(snapped(end + delta)), start + minLength, limit) };
  const length = end - start;
  let next = start + delta;
  if (snap) {
    const left = snapped(next), right = snapped(next + length);
    if (left !== next) next = left;
    else if (right !== next + length) next = right - length;
  }
  next = clamp(round(next), 0, limit - length);
  return { start: next, end: next + length };
}

export function pointerTime(clientX: number, contentLeft: number, pxPerSec: number, duration: number): number {
  // getBoundingClientRect already includes the horizontal scroll offset.
  return clamp((clientX - contentLeft) / pxPerSec, 0, duration);
}
