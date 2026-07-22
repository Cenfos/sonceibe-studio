import type { LyricLine } from './types';

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * Detect whether a byte array is UTF-8 or ANSI (windows-1252).
 * Returns 'utf-8' or 'windows-1252'.
 */
export function detectEncoding(bytes: Uint8Array): 'utf-8' | 'windows-1252' {
  // Check for UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8';
  }
  // Validate as UTF-8
  let i = 0;
  let validUtf8 = true;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      i++;
    } else if (b >= 0xc2 && b <= 0xdf) {
      if (i + 1 < bytes.length && (bytes[i + 1] & 0xc0) === 0x80) {
        i += 2;
      } else {
        validUtf8 = false;
        break;
      }
    } else if (b >= 0xe0 && b <= 0xef) {
      if (
        i + 2 < bytes.length &&
        (bytes[i + 1] & 0xc0) === 0x80 &&
        (bytes[i + 2] & 0xc0) === 0x80
      ) {
        i += 3;
      } else {
        validUtf8 = false;
        break;
      }
    } else if (b >= 0xf0 && b <= 0xf4) {
      if (
        i + 3 < bytes.length &&
        (bytes[i + 1] & 0xc0) === 0x80 &&
        (bytes[i + 2] & 0xc0) === 0x80 &&
        (bytes[i + 3] & 0xc0) === 0x80
      ) {
        i += 4;
      } else {
        validUtf8 = false;
        break;
      }
    } else {
      validUtf8 = false;
      break;
    }
  }
  return validUtf8 ? 'utf-8' : 'windows-1252';
}

/**
 * Read a File as text with encoding detection.
 */
export async function readFileWithEncoding(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const encoding = detectEncoding(bytes);
  let text: string;
  if (encoding === 'utf-8') {
    text = new TextDecoder('utf-8').decode(bytes);
    // Strip BOM if present
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  } else {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text;
}

/**
 * Parse plain text lyrics into LyricLine[].
 * Preserves blank lines and order.
 * Timestamps are distributed evenly if duration is known, otherwise sequential.
 */
export function parseTxtLyrics(text: string, duration: number): LyricLine[] {
  const rawLines = text.split('\n');
  // Preserve blank lines but mark them
  const lines = rawLines.map((l) => l.trim());
  const nonEmptyCount = lines.filter((l) => l.length > 0).length;
  const perLine = nonEmptyCount > 0 && duration > 0 ? duration / nonEmptyCount : 4;

  const result: LyricLine[] = [];
  let idx = 0;
  for (const line of lines) {
    if (line.length === 0) {
      // Preserve blank line as empty lyric
      result.push({
        id: genId(),
        text: '',
        start: idx * perLine,
        end: (idx + 1) * perLine,
      });
      idx++;
    } else {
      result.push({
        id: genId(),
        text: line,
        start: idx * perLine,
        end: (idx + 1) * perLine,
      });
      idx++;
    }
  }
  return result;
}

/**
 * Parse LRC formatted lyrics.
 * Supports [mm:ss.xx] and [mm:ss.xxx] timestamps.
 * Handles multiple timestamps per line.
 */
export function parseLrcLyrics(text: string): LyricLine[] {
  const rawLines = text.split('\n');
  const result: LyricLine[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      result.push({ id: genId(), text: '', start: 0, end: 0 });
      continue;
    }

    // Skip metadata tags like [ti:...], [ar:...], [al:...], [by:...], [offset:...]
    if (/^\[(ti|ar|al|by|offset|length|re|ve):/i.test(trimmed)) continue;

    // Find all timestamps at the start of the line
    const tsRegex = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g;
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = tsRegex.exec(trimmed)) !== null) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const frac = match[3] ? parseInt(match[3]) : 0;
      const fracDiv = match[3] && match[3].length === 3 ? 1000 : 100;
      const time = min * 60 + sec + frac / fracDiv;
      timestamps.push(time);
      lastIndex = tsRegex.lastIndex;
    }

    const lyricText = lastIndex > 0 ? trimmed.slice(lastIndex).trim() : '';

    if (timestamps.length === 0) {
      // No timestamp — treat as plain text line
      if (lyricText || trimmed) {
        result.push({
          id: genId(),
          text: lyricText || trimmed,
          start: 0,
          end: 0,
        });
      }
    } else {
      for (const ts of timestamps) {
        result.push({
          id: genId(),
          text: lyricText,
          start: ts,
          end: ts + 4,
        });
      }
    }
  }

  // Fix end times: each line's end is the next line's start
  const sorted = [...result].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].end <= sorted[i].start || sorted[i].end > sorted[i + 1].start) {
      sorted[i].end = sorted[i + 1].start;
    }
  }
  // Last line end
  if (sorted.length > 0 && sorted[sorted.length - 1].end <= sorted[sorted.length - 1].start) {
    sorted[sorted.length - 1].end = sorted[sorted.length - 1].start + 4;
  }

  return sorted;
}

/**
 * Serialize lyrics to plain TXT format.
 */
export function exportToTxt(lyrics: LyricLine[]): string {
  return lyrics
    .map((l) => l.text)
    .join('\n');
}

/**
 * Serialize lyrics to LRC format with timestamps.
 */
export function exportToLrc(lyrics: LyricLine[], title?: string, artist?: string): string {
  const lines: string[] = [];
  if (title) lines.push(`[ti:${title}]`);
  if (artist) lines.push(`[ar:${artist}]`);
  lines.push('[re:Lyric Video Studio]');
  lines.push('');

  for (const l of lyrics) {
    if (l.text === '' && l.start === 0 && l.end === 0) {
      lines.push('');
      continue;
    }
    const ts = formatLrcTimestamp(l.start);
    lines.push(`[${ts}]${l.text}`);
  }
  return lines.join('\n');
}

/**
 * Format seconds as LRC timestamp [mm:ss.xx]
 */
export function formatLrcTimestamp(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/**
 * Download text content as a file.
 */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
