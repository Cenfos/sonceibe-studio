import type { LyricLine } from './types';

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export type LyricsSourceFormat = 'txt' | 'lrc' | 'odt' | 'docx' | 'rtf' | 'html' | 'md';

export interface LyricsTextImport {
  text: string;
  format: LyricsSourceFormat;
}

export interface LyricsCleanupResult {
  text: string;
  removedLines: number;
  removedChordMarks: number;
}

// Lyrics are deliberately preserved as written. We only remove annotations
// enclosed in parentheses or square brackets, because those are commonly used
// for comments, section labels such as [Estribillo], or chord marks such as [Am].
// This avoids deleting real sung words that happen to look like chord names
// (for example "La", "Mi", "Sol") or text that came from bold ODT spans.
const INLINE_ANNOTATION_RE = /\([^()]*\)|\[[^\[\]]*\]/g;

function stripInlineAnnotations(line: string): { text: string; removed: number } {
  let text = line;
  let removed = 0;
  let previous = '';

  // Repeat so simple nested annotations are also removed from the inside out.
  while (text !== previous) {
    previous = text;
    text = text.replace(INLINE_ANNOTATION_RE, () => {
      removed += 1;
      return '';
    });
  }

  return {
    text: text.replace(/[ \t]{2,}/g, ' ').trim(),
    removed,
  };
}

/**
 * Preserve every lyric line exactly as text, regardless of formatting such as
 * bold/italic in ODT or DOCX. Only parenthesized and square-bracket annotations
 * are stripped. If a line consists only of an annotation, the whole line is
 * removed. Verse separation is preserved with a single blank line.
 */
export function cleanLyricsText(text: string): LyricsCleanupResult {
  const inputLines = text.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let removedLines = 0;
  let removedChordMarks = 0;
  let previousBlank = true;

  for (const rawLine of inputLines) {
    const normalized = rawLine.replace(/\u00a0/g, ' ').trim();

    if (!normalized) {
      if (!previousBlank && output.length > 0) output.push('');
      previousBlank = true;
      continue;
    }

    const cleaned = stripInlineAnnotations(normalized);
    removedChordMarks += cleaned.removed;

    if (!cleaned.text) {
      removedLines += 1;
      continue;
    }

    output.push(cleaned.text);
    previousBlank = false;
  }

  while (output[output.length - 1] === '') output.pop();

  return {
    text: output.join('\n'),
    removedLines,
    removedChordMarks,
  };
}

export function cleanParsedLyrics(lyrics: LyricLine[]): { lyrics: LyricLine[]; removedLines: number; removedChordMarks: number } {
  const cleaned: LyricLine[] = [];
  let removedLines = 0;
  let removedChordMarks = 0;

  for (const line of lyrics) {
    if (!line.text.trim()) {
      cleaned.push(line);
      continue;
    }

    const result = cleanLyricsText(line.text);
    removedLines += result.removedLines;
    removedChordMarks += result.removedChordMarks;

    if (!result.text.trim()) continue;
    cleaned.push({ ...line, text: result.text.replace(/\n+/g, ' ').trim() });
  }

  return { lyrics: cleaned, removedLines, removedChordMarks };
}

export function detectEncoding(bytes: Uint8Array): 'utf-8' | 'windows-1252' {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8';
  }

  let i = 0;
  let validUtf8 = true;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      i++;
    } else if (b >= 0xc2 && b <= 0xdf) {
      if (i + 1 < bytes.length && (bytes[i + 1] & 0xc0) === 0x80) i += 2;
      else { validUtf8 = false; break; }
    } else if (b >= 0xe0 && b <= 0xef) {
      if (i + 2 < bytes.length && (bytes[i + 1] & 0xc0) === 0x80 && (bytes[i + 2] & 0xc0) === 0x80) i += 3;
      else { validUtf8 = false; break; }
    } else if (b >= 0xf0 && b <= 0xf4) {
      if (i + 3 < bytes.length && (bytes[i + 1] & 0xc0) === 0x80 && (bytes[i + 2] & 0xc0) === 0x80 && (bytes[i + 3] & 0xc0) === 0x80) i += 4;
      else { validUtf8 = false; break; }
    } else {
      validUtf8 = false;
      break;
    }
  }
  return validUtf8 ? 'utf-8' : 'windows-1252';
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const DecompressionStreamCtor = (globalThis as unknown as {
    DecompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array>;
  }).DecompressionStream;

  if (!DecompressionStreamCtor) {
    throw new Error('Este navegador no puede abrir documentos comprimidos. Usa Chrome o Edge actualizado.');
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStreamCtor('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractZipText(buffer: ArrayBuffer, wantedPath: string): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  const minEocd = 22;
  const maxComment = 0xffff;
  let eocd = -1;

  for (let offset = bytes.length - minEocd; offset >= Math.max(0, bytes.length - minEocd - maxComment); offset--) {
    if (view.getUint32(offset, true) === eocdSignature) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('El documento no parece ser un archivo ODT/DOCX válido.');

  const entryCount = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder('utf-8');

  for (let index = 0; index < entryCount; index++) {
    if (view.getUint32(cursor, true) !== centralSignature) break;

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));

    if (name === wantedPath) {
      if (view.getUint32(localOffset, true) !== localSignature) {
        throw new Error('El documento contiene una entrada comprimida no válida.');
      }
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);

      if (method === 0) return decoder.decode(compressed);
      if (method === 8) return decoder.decode(await inflateRaw(compressed));
      throw new Error('El documento usa un método de compresión no compatible.');
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error(`No se encontró ${wantedPath} dentro del documento.`);
}

function xmlNodeToPlainText(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeType !== 1) return '';

  const element = node as Element;
  const tag = element.tagName;

  if (tag === 'text:line-break' || tag === 'w:br') return '\n';
  if (tag === 'text:tab' || tag === 'w:tab') return ' ';
  if (tag === 'text:s') {
    const rawCount = element.getAttribute('text:c') ?? '1';
    const count = Math.max(1, Math.min(32, Number.parseInt(rawCount, 10) || 1));
    return ' '.repeat(count);
  }

  // text:span / w:r formatting (including bold and italic) is intentionally
  // ignored as styling, but all of its textual content is kept.
  return Array.from(node.childNodes).map(xmlNodeToPlainText).join('');
}

function normalizeOfficeParagraph(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

function xmlParagraphsToText(xml: string, paragraphTags: string[]): string {
  if (typeof DOMParser === 'undefined') throw new Error('El navegador no puede procesar este documento.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('El contenido del documento está dañado.');

  const accepted = new Set(paragraphTags);
  const paragraphs = Array.from(doc.getElementsByTagName('*'))
    .filter((element) => accepted.has(element.tagName))
    .map((element) => normalizeOfficeParagraph(xmlNodeToPlainText(element)));

  return paragraphs.join('\n');
}

function rtfToText(rtf: string): string {
  const decodeHex = (hex: string) => {
    const value = parseInt(hex, 16);
    return new TextDecoder('windows-1252').decode(new Uint8Array([value]));
  };

  return rtf
    .replace(/\\par[d]?\b/gi, '\n')
    .replace(/\\line\b/gi, '\n')
    .replace(/\\tab\b/gi, ' ')
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex: string) => decodeHex(hex))
    .replace(/\\u(-?\d+)\??/gi, (_, raw: string) => String.fromCharCode((Number(raw) + 65536) % 65536))
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\[a-z]+-?\d*\s?/gi, '')
    .replace(/\\([{}\\])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\r\n?/g, '\n');
}

function htmlToText(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]+>/g, ' ');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = Array.from(doc.body.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6'));
  if (blocks.length === 0) return doc.body.textContent ?? '';
  return blocks.map((block) => (block.textContent ?? '').trim()).join('\n');
}

/**
 * Read supported lyric/document files as real text. Office files such as ODT
 * and DOCX are ZIP containers, so they must never be decoded as plain bytes.
 */
export async function readFileWithEncoding(file: File): Promise<string> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.odt')) {
    const xml = await extractZipText(await file.arrayBuffer(), 'content.xml');
    return xmlParagraphsToText(xml, ['text:p', 'text:h']);
  }

  if (lower.endsWith('.docx')) {
    const xml = await extractZipText(await file.arrayBuffer(), 'word/document.xml');
    return xmlParagraphsToText(xml, ['w:p']);
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const encoding = detectEncoding(bytes);
  let text = new TextDecoder(encoding).decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  if (lower.endsWith('.rtf')) return rtfToText(text);
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return htmlToText(text);
  return text;
}

/**
 * Convert common lyric/document formats into plain text in the browser.
 * Supported: TXT, LRC, ODT (LibreOffice), DOCX (Word), RTF, HTML and Markdown.
 */
export async function readLyricsFile(file: File): Promise<LyricsTextImport> {
  const lower = file.name.toLowerCase();
  const text = await readFileWithEncoding(file);

  if (lower.endsWith('.lrc')) return { text, format: 'lrc' };
  if (lower.endsWith('.odt')) return { text, format: 'odt' };
  if (lower.endsWith('.docx')) return { text, format: 'docx' };
  if (lower.endsWith('.rtf')) return { text, format: 'rtf' };
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return { text, format: 'html' };
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return { text, format: 'md' };
  return { text, format: 'txt' };
}

/**
 * Parse plain text lyrics into LyricLine[]. The same conservative cleanup is
 * applied to every import path: preserve lyric text, strip only () and [] notes.
 */
export function parseTxtLyrics(text: string, duration: number): LyricLine[] {
  const cleanedText = cleanLyricsText(text).text;
  const lines = cleanedText.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim());
  const nonEmptyCount = lines.filter((line) => line.length > 0).length;
  const perLine = nonEmptyCount > 0 && duration > 0 ? duration / nonEmptyCount : 4;

  const result: LyricLine[] = [];
  let timedIndex = 0;
  for (const line of lines) {
    if (!line) {
      const markerTime = timedIndex * perLine;
      result.push({ id: genId(), text: '', start: markerTime, end: markerTime });
      continue;
    }

    const start = timedIndex * perLine;
    result.push({ id: genId(), text: line, start, end: start + perLine });
    timedIndex += 1;
  }
  return result;
}

export function parseLrcLyrics(text: string): LyricLine[] {
  const rawLines = text.split('\n');
  const result: LyricLine[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      result.push({ id: genId(), text: '', start: 0, end: 0 });
      continue;
    }

    if (/^\[(ti|ar|al|by|offset|length|re|ve):/i.test(trimmed)) continue;

    const tsRegex = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g;
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = tsRegex.exec(trimmed)) !== null) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const frac = match[3] ? parseInt(match[3]) : 0;
      const fracDiv = match[3] && match[3].length === 3 ? 1000 : 100;
      timestamps.push(min * 60 + sec + frac / fracDiv);
      lastIndex = tsRegex.lastIndex;
    }

    const lyricText = lastIndex > 0 ? trimmed.slice(lastIndex).trim() : '';
    if (timestamps.length === 0) {
      if (lyricText || trimmed) result.push({ id: genId(), text: lyricText || trimmed, start: 0, end: 0 });
    } else {
      for (const ts of timestamps) result.push({ id: genId(), text: lyricText, start: ts, end: ts + 4 });
    }
  }

  const sorted = [...result].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].end <= sorted[i].start || sorted[i].end > sorted[i + 1].start) sorted[i].end = sorted[i + 1].start;
  }
  if (sorted.length > 0 && sorted[sorted.length - 1].end <= sorted[sorted.length - 1].start) {
    sorted[sorted.length - 1].end = sorted[sorted.length - 1].start + 4;
  }
  return cleanParsedLyrics(sorted).lyrics;
}

export function exportToTxt(lyrics: LyricLine[]): string {
  return lyrics.map((line) => line.text).join('\n');
}

export function exportToLrc(lyrics: LyricLine[], title?: string, artist?: string): string {
  const lines: string[] = [];
  if (title) lines.push(`[ti:${title}]`);
  if (artist) lines.push(`[ar:${artist}]`);
  lines.push('[re:SonCeibe Studio]');
  lines.push('');

  for (const line of lyrics) {
    if (line.text === '' && line.start === 0 && line.end === 0) {
      lines.push('');
      continue;
    }
    lines.push(`[${formatLrcTimestamp(line.start)}]${line.text}`);
  }
  return lines.join('\n');
}

export function formatLrcTimestamp(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

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
