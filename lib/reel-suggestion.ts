import type { LyricLine } from './types';

/** Repeated timed lyrics are a suggestion, not automatic chorus detection. */
export function suggestReel(lyrics: LyricLine[], duration: number, position = 0) {
  const groups = new Map<string, LyricLine[]>();
  for (const line of lyrics) {
    if (!Number.isFinite(line.start) || !Number.isFinite(line.end) || line.start < 0 || line.end <= line.start || line.start >= duration) continue;
    const normalized = line.text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (normalized.length < 10) continue;
    groups.set(normalized, [...(groups.get(normalized) || []), line]);
  }
  const repeated = [...groups.values()].filter(lines => lines.length > 1)
    .sort((a, b) => b.length - a.length || a[0].start - b[0].start)[0]?.[0];
  const length = Math.min(30, Math.max(0, duration));
  const preferred = repeated?.start ?? (Number.isFinite(position) ? position : 0);
  const start = Math.max(0, Math.min(Math.max(0, duration - length), preferred));
  return { start, end: start + length, repeatedText: repeated?.text || '' };
}
