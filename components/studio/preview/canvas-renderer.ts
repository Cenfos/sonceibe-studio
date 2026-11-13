import { drawAdjustedVideo } from '@/lib/video-adjustments';
import { parseLyricChords } from '@/lib/lyric-chords';
import { defaultTitleStyle, type AnimationType, type ImageFitMode, type ImagePlacement, type LyricLine, type ProjectSettings } from '@/lib/types';
import { drawVisualBranding } from '@/lib/visual-branding';
import { getVisualPreset } from '@/lib/visual-presets';
import { isDefaultProjectTitle } from '@/lib/project-title';

const imageCache = new Map<string, HTMLImageElement>();
interface ScrollLyricsLayout {
  lines: LyricLine[];
  heights: number[];
  centers: number[];
}
const scrollLyricsLayoutCache = new WeakMap<ProjectSettings, Map<string, ScrollLyricsLayout>>();

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const CHORD_GUIDE_RE = /^\[Acordes:\s*([^\]]+)\]$/i;
const SECTION_GUIDE_RE = /^\[Secci[oó]n:\s*([^\]]+)\]$/i;

function isStudioGuideLine(text: string): boolean {
  const value = text.trim();
  return CHORD_GUIDE_RE.test(value) || SECTION_GUIDE_RE.test(value);
}

function getActiveLine(lyrics: LyricLine[], time: number): LyricLine | null {
  let active: LyricLine | null = null;

  for (const line of lyrics) {
    if (!line.text || isStudioGuideLine(line.text) || time < line.start || time > line.end) continue;
    if (!active || line.start >= active.start) active = line;
  }

  return active;
}

function getChordGuide(lyrics: LyricLine[], time: number): { section: string; chords: string } | null {
  // Show the next change a little early so the player can prepare the hand.
  const guideTime = time + 0.65;
  let section = '';
  let chords = '';

  for (const line of lyrics) {
    if (!line.text || line.start > guideTime) continue;
    const value = line.text.trim();
    const sectionMatch = value.match(SECTION_GUIDE_RE);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }
    const chordMatch = value.match(CHORD_GUIDE_RE);
    if (chordMatch) chords = chordMatch[1].trim();
  }

  return chords ? { section, chords } : null;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const normalized = h.length === 3
    ? h.split('').map((char) => char + char).join('')
    : h.padEnd(6, '0').slice(0, 6);
  const r = parseInt(normalized.substring(0, 2), 16) || 0;
  const g = parseInt(normalized.substring(2, 4), 16) || 0;
  const b = parseInt(normalized.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

function getCachedImage(src: string): HTMLImageElement | null {
  if (!src || typeof Image === 'undefined') return null;

  const cached = imageCache.get(src);
  if (cached) return cached;

  const image = new Image();
  if (/^https?:\/\//i.test(src)) image.crossOrigin = 'anonymous';
  image.src = src;
  imageCache.set(src, image);
  return image;
}

export function preloadBackgroundImage(src: string): Promise<void> {
  if (!src || typeof Image === 'undefined') return Promise.resolve();

  const image = getCachedImage(src);
  if (!image) return Promise.resolve();
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();

  return new Promise((resolve) => {
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
    };

    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
  });
}

function drawImageFitted(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  w: number,
  h: number,
  fit: ImageFitMode,
  time: number,
  kenBurns: boolean,
  kenBurnsIntensity: number
) {
  const imageW = image.naturalWidth;
  const imageH = image.naturalHeight;
  if (!imageW || !imageH) return;

  ctx.save();

  if (kenBurns) {
    const intensity = clamp01(kenBurnsIntensity);
    const phase = (Math.sin(time * 0.22) + 1) / 2;
    const zoom = 1 + intensity * (0.03 + phase * 0.09);
    const panX = Math.sin(time * 0.13) * w * 0.025 * intensity;
    const panY = Math.cos(time * 0.11) * h * 0.025 * intensity;
    ctx.translate(w / 2 + panX, h / 2 + panY);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);
  }

  if (fit === 'contain') {
    const scale = Math.min(w / imageW, h / imageH);
    const drawW = imageW * scale;
    const drawH = imageH * scale;
    const drawX = (w - drawW) / 2;
    const drawY = (h - drawH) / 2;
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
  } else {
    const scale = Math.max(w / imageW, h / imageH);
    const sourceW = w / scale;
    const sourceH = h / scale;
    const sourceX = (imageW - sourceW) / 2;
    const sourceY = (imageH - sourceH) / 2;
    ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, w, h);
  }

  ctx.restore();
}

function drawPlacedImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number, fit: ImageFitMode, time: number, kenBurns: boolean, intensity: number, placement?: ImagePlacement) {
  const finite = (n: number | undefined, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  const scale = Math.max(0.2, Math.min(1, finite(placement?.scale, 100) / 100));
  const width = w * scale, height = h * scale;
  const x = (w - width) * Math.max(0, Math.min(100, finite(placement?.x, 50))) / 100;
  const y = (h - height) * Math.max(0, Math.min(100, finite(placement?.y, 50))) / 100;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip(); ctx.translate(x, y);
  drawImageFitted(ctx, image, width, height, placement?.fit ?? fit, time, kenBurns, intensity);
  ctx.restore();
}

function getBackgroundImageSource(settings: ProjectSettings, time: number): string {
  const bg = settings.background;

  if (bg.type === 'images' && bg.images.length > 0) {
    const imageMode = bg.imageMode ?? 'auto';

    if (imageMode === 'manual') {
      const clips = bg.imageClips ?? [];
      const activeClip = clips.find((clip) => time >= clip.start && time < clip.end);
      return activeClip?.url || '';
    }

    const interval = Math.max(0.5, bg.imageDuration ?? 5);
    const index = Math.floor(time / interval) % bg.images.length;
    return bg.images[index] || bg.imageUrl;
  }

  return bg.imageUrl;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings,
  time: number,
  video?: HTMLVideoElement | null
) {
  const bg = settings.background;
  const fx = settings.effects;
  const renderScale = Math.min(w, h) / 1080;
  const blurPercent = Math.max(bg.blur ?? 0, fx.blur ?? 0);
  const blurPx = blurPercent > 0 ? (blurPercent / 100) * 24 * renderScale : 0;

  ctx.save();
  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;

  if (bg.type === 'color') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.type === 'gradient') {
    const angle = (bg.gradientAngle * Math.PI) / 180;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    const offset = (time * 0.04) % 1;
    const grad = ctx.createLinearGradient(
      w / 2 - (x * w) / 2 + offset * 80,
      h / 2 - (y * h) / 2,
      w / 2 + (x * w) / 2 + offset * 80,
      h / 2 + (y * h) / 2
    );
    grad.addColorStop(0, bg.gradientFrom);
    grad.addColorStop(1, bg.gradientTo);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.type === 'image' || bg.type === 'images') {
    if ((bg.imagePlacement?.scale ?? 100) < 100) {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, bg.gradientFrom || '#102d25'); gradient.addColorStop(1, bg.gradientTo || '#26190f');
      ctx.fillStyle = gradient;
    } else ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const src = getBackgroundImageSource(settings, time);
    const image = getCachedImage(src);
    if (image?.complete && image.naturalWidth > 0) {
      drawPlacedImage(
        ctx,
        image,
        w,
        h,
        bg.imageFit ?? 'contain',
        time,
        fx.kenburns,
        fx.kenburnsIntensity,
        bg.type === 'images' && bg.imageMode === 'manual' ? bg.imageClips.find(clip => time >= clip.start && time < clip.end)?.placement ?? bg.imagePlacement : bg.imagePlacement
      );
    }
  } else if (bg.type === 'video') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    if (video && video.readyState >= 2 && video.videoWidth) {
      drawAdjustedVideo(ctx, video, w, h, bg);
    }
  } else {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();

  if (bg.overlay > 0) {
    ctx.fillStyle = hexToRgba('#000000', bg.overlay);
    ctx.fillRect(0, 0, w, h);
  }

  if (fx.overlay > 0) {
    ctx.fillStyle = hexToRgba(fx.overlayColor || '#000000', fx.overlay);
    ctx.fillRect(0, 0, w, h);
  }
}

function animationProgress(
  type: AnimationType,
  progress: number,
  direction: 'in' | 'out',
  renderScale: number
): { alpha: number; scale: number; offsetX: number; blurPx: number } {
  const p = clamp01(progress);
  const result = { alpha: 1, scale: 1, offsetX: 0, blurPx: 0 };

  if (type === 'fade' || (direction === 'out' && type === 'karaoke')) {
    result.alpha = p;
  } else if (type === 'zoom') {
    result.scale = 0.76 + p * 0.24;
  } else if (type === 'slide') {
    const distance = 150 * renderScale * (1 - p);
    result.offsetX = direction === 'in' ? distance : -distance;
  } else if (type === 'bounce') {
    result.scale = 0.88 + p * 0.12 + Math.sin(p * Math.PI) * 0.1;
  } else if (type === 'blur') {
    result.blurPx = (1 - p) * 22 * renderScale;
  }

  return result;
}

function getRevealProgress(
  animation: AnimationType,
  progress: number,
  totalWords: number
): number {
  const p = clamp01(progress);
  if (animation === 'line') return p;
  if (animation === 'word') {
    const words = Math.max(1, totalWords);
    return Math.ceil(p * words) / words;
  }
  return 1;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings,
  time: number
) {
  if (settings.text.lyricsDisplayMode === 'scroll') {
    drawScrollingLyrics(ctx, w, h, settings, time);
    return;
  }

  const line = getActiveLine(settings.lyrics, time);
  if (!line || !line.text) return;

  let y = h * 0.5;
  if (settings.text.position === 'top') y = h * 0.2;
  if (settings.text.position === 'bottom') y = h * 0.8;
  drawLyricLine(ctx, w, h, settings, time, line, y, 1, false);
}

function getScrollLyricsLayout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings
): ScrollLyricsLayout {
  let cache = scrollLyricsLayoutCache.get(settings);
  if (!cache) {
    cache = new Map();
    scrollLyricsLayoutCache.set(settings, cache);
  }
  const key = w + 'x' + h;
  const cached = cache.get(key);
  if (cached) return cached;

  const lines = settings.lyrics
    .filter((line) => line.text.trim() && !isStudioGuideLine(line.text))
    .sort((left, right) => left.start - right.start);
  const t = settings.text;
  const renderScale = Math.min(w, h) / 1080;
  const fontSize = t.fontSize * renderScale;
  const lineHeight = fontSize * t.lineHeight;
  const gap = fontSize * 0.42;
  const maxWidth = w * 0.8;
  const heights: number[] = [];

  ctx.save();
  ctx.font = String(t.fontWeight) + ' ' + fontSize + 'px ' + t.fontFamily + ', sans-serif';
  for (const line of lines) {
    const { text, chords } = parseLyricChords(line.text, (value) => {
      if (t.transform === 'uppercase') return value.toUpperCase();
      if (t.transform === 'lowercase') return value.toLowerCase();
      return value;
    });
    let rows = 1;
    let rowWidth = 0;
    for (const word of text.match(/\S+/g) ?? []) {
      const wordWidth = ctx.measureText(word).width;
      const spaceWidth = rowWidth > 0 ? ctx.measureText(' ').width : 0;
      if (rowWidth > 0 && rowWidth + spaceWidth + wordWidth > maxWidth) {
        rows += 1;
        rowWidth = wordWidth;
      } else {
        rowWidth += spaceWidth + wordWidth;
      }
    }
    heights.push(rows * lineHeight + (chords.length ? fontSize * 0.72 : 0));
  }
  ctx.restore();

  const centers = [0];
  for (let index = 1; index < lines.length; index += 1) {
    centers.push(centers[index - 1] + (heights[index - 1] + heights[index]) / 2 + gap);
  }
  const layout = { lines, heights, centers };
  cache.set(key, layout);
  return layout;
}
function drawScrollingLyrics(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings,
  time: number
) {
  const layout = getScrollLyricsLayout(ctx, w, h, settings);
  const { lines, heights, centers } = layout;
  if (!lines.length || time < lines[0].start) return;
  const hasTimedLines = lines.some((line) => line.start > 0 || line.end > line.start);
  let currentIndex = 0;
  if (hasTimedLines) {
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].start <= time) currentIndex = index;
      else break;
    }
  }

  let progress = 0;
  let scrollOffset = centers[currentIndex];
  if (hasTimedLines && currentIndex < lines.length - 1) {
    const current = lines[currentIndex];
    const next = lines[currentIndex + 1];
    const transitionDuration = next.start > current.start
      ? next.start - current.start
      : Math.max(0.05, current.end - current.start);
    progress = clamp01((time - current.start) / transitionDuration);
    scrollOffset += (centers[currentIndex + 1] - centers[currentIndex]) * progress;
  }

  const chordGuideCenter = Math.min(h * 0.34, Math.min(w, h) * 0.36);
  const viewportTop = Math.max(h * 0.32, chordGuideCenter + 64 * renderScale);
  const viewportBottom = h * 0.93;
  const anchorY = (viewportTop + viewportBottom) / 2;
  const scrollIndex = currentIndex + progress;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, viewportTop, w, viewportBottom - viewportTop);
  ctx.clip();
  for (let index = 0; index < lines.length; index += 1) {
    const y = anchorY + centers[index] - scrollOffset;
    const halfHeight = heights[index] / 2;
    if (y + halfHeight < viewportTop || y - halfHeight > viewportBottom) continue;
    const distance = Math.abs(index - scrollIndex);
    const opacity = Math.max(0.2, 1 - Math.min(1, distance * 0.36));
    drawLyricLine(ctx, w, h, settings, time, lines[index], y, opacity, true);
  }
  ctx.restore();
}

function drawLyricLine(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings,
  time: number,
  line: LyricLine,
  y: number,
  opacity: number,
  scrolling: boolean
) {
  if (!line.text.trim()) return;
  const t = settings.text;
  const anim = settings.animation;
  const { text, chords } = parseLyricChords(line.text, (value) => {
    if (t.transform === 'uppercase') return value.toUpperCase();
    if (t.transform === 'lowercase') return value.toLowerCase();
    return value;
  });

  const renderScale = Math.min(w, h) / 1080;
  const fontSize = t.fontSize * renderScale;
  ctx.font = `${t.fontWeight} ${fontSize}px ${t.fontFamily}, sans-serif`;
  ctx.textAlign = t.align === 'left' ? 'left' : t.align === 'right' ? 'right' : 'center';
  ctx.textBaseline = 'middle';

  let x = w / 2;
  if (t.align === 'left') x = w * 0.1;
  if (t.align === 'right') x = w * 0.9;

  const duration = Math.max(0.05, anim.duration || 0.5);
  const inProgress = clamp01((time - line.start) / duration);
  const outProgress = clamp01((line.end - time) / duration);
  const lineDuration = Math.max(0.05, line.end - line.start);
  const karaokeProgress = scrolling ? 0 : clamp01((time - line.start) / lineDuration);

  const inState = scrolling ? { alpha: 1, scale: 1, offsetX: 0, blurPx: 0 } : animationProgress(anim.in, inProgress, 'in', renderScale);
  const outState = scrolling ? { alpha: 1, scale: 1, offsetX: 0, blurPx: 0 } : animationProgress(anim.out, outProgress, 'out', renderScale);
  const alpha = inState.alpha * outState.alpha;
  const scale = inState.scale * outState.scale;
  const offsetX = inState.offsetX + outState.offsetX;
  const textBlur = Math.max(inState.blurPx, outState.blurPx);

  const maxWidth = w * 0.8;
  const lyricFont = ctx.font;
  const chordSize = fontSize * 0.65;
  const chordFont = `700 ${chordSize}px ${t.fontFamily}, sans-serif`;
  const chordWidths = new Map<string, number>();
  if (chords.length) {
    ctx.font = chordFont;
    for (const { name } of chords) chordWidths.set(name, ctx.measureText(name).width);
    ctx.font = lyricFont;
  }

  const words = [...text.matchAll(/\S+/g)];
  const wrappedLines: { text: string; chords: { name: string; offset: number }[]; width: number }[] = [];
  let row = { text: '', chords: [] as { name: string; offset: number }[], width: 0 };
  let chordIndex = 0;
  for (const { 0: word, index = 0 } of words) {
    const wordChords: typeof chords = [];
    while (chordIndex < chords.length && chords[chordIndex].index < index + word.length) {
      wordChords.push(chords[chordIndex++]);
    }

    let prefix = row.text ? `${row.text} ` : '';
    const getAnchors = () => wordChords.map(({ name, index: at }) => ({
      name,
      offset: ctx.measureText(prefix + word.slice(0, at - index)).width,
    }));
    let anchors = getAnchors();
    const lastChord = row.chords.at(-1);
    const firstAnchor = anchors[0];
    const collides = lastChord && firstAnchor &&
      firstAnchor.offset < lastChord.offset + chordWidths.get(lastChord.name)! + chordSize * 0.2;
    const rowWidth = () => Math.max(row.width, ctx.measureText(prefix + word).width,
      ...anchors.map(({ name, offset }) => offset + chordWidths.get(name)!));

    if (row.text && (rowWidth() > maxWidth || collides)) {
      wrappedLines.push(row);
      row = { text: '', chords: [], width: 0 };
      prefix = '';
      anchors = getAnchors();
    }
    row.width = rowWidth();
    row.text = prefix + word;
    row.chords.push(...anchors);
  }
  if (row.text) wrappedLines.push(row);

  const lineHeight = fontSize * t.lineHeight;
  const chordOffset = (fontSize + chordSize) / 2 + fontSize * 0.1;
  const chordRowHeight = Math.max(lineHeight, fontSize + chordSize + fontSize * 0.1);
  const totalHeight = wrappedLines.reduce((height, row) =>
    height + (row.chords.length ? chordRowHeight : lineHeight), 0);
  let rowTop = -totalHeight / 2;

  const revealIn = getRevealProgress(anim.in, inProgress, words.length);
  const revealOut = getRevealProgress(anim.out, outProgress, words.length);
  const reveal = scrolling ? 1 : Math.min(revealIn, revealOut);

  ctx.save();
  ctx.globalAlpha = alpha * opacity;
  ctx.translate(x + offsetX, y);
  ctx.scale(scale, scale);
  if (textBlur > 0) ctx.filter = `blur(${textBlur}px)`;

  if (reveal < 1) {
    const clipLeft = t.align === 'left' ? 0 : t.align === 'right' ? -maxWidth : -maxWidth / 2;
    ctx.beginPath();
    ctx.rect(clipLeft, -totalHeight / 2 - lineHeight, maxWidth * reveal, totalHeight + lineHeight * 2);
    ctx.clip();
  }

  for (const row of wrappedLines) {
    const wrappedLine = row.text;
    const measuredWidth = ctx.measureText(wrappedLine).width;
    const startY = rowTop + lineHeight / 2 + (row.chords.length ? chordRowHeight - lineHeight : 0);
    const lineLeft = t.align === 'left'
      ? 0
      : t.align === 'right'
        ? -row.width
        : -row.width / 2;
    const lyricX = t.align === 'left' ? lineLeft : lineLeft + measuredWidth / (t.align === 'right' ? 1 : 2);

    if (t.shadow) {
      ctx.shadowColor = t.shadowColor;
      ctx.shadowBlur = t.shadowBlur * renderScale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2 * renderScale;
    }

    if (t.glow) {
      ctx.shadowColor = t.glowColor;
      ctx.shadowBlur = t.glowIntensity * renderScale;
    }

    if (t.outlineWidth > 0) {
      ctx.strokeStyle = t.outlineColor;
      ctx.lineWidth = t.outlineWidth * renderScale;
      ctx.strokeText(wrappedLine, lyricX, startY);
    }

    ctx.fillStyle = t.color;
    ctx.fillText(wrappedLine, lyricX, startY);

    if (anim.in === 'karaoke' && karaokeProgress > 0) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.rect(
        lineLeft,
        startY - lineHeight / 2,
        measuredWidth * karaokeProgress,
        lineHeight
      );
      ctx.clip();
      ctx.fillStyle = anim.karaokeColor;
      ctx.fillText(wrappedLine, lyricX, startY);
      ctx.restore();
    }

    if (row.chords.length) {
      ctx.save();
      ctx.font = chordFont;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ff4848';
      ctx.strokeStyle = '#240909';
      ctx.lineWidth = chordSize * 0.12;
      ctx.lineJoin = 'round';
      for (const { name, offset } of row.chords) {
        ctx.strokeText(name, lineLeft + offset, startY - chordOffset);
        ctx.fillText(name, lineLeft + offset, startY - chordOffset);
      }
      ctx.restore();
    }

    rowTop += row.chords.length ? chordRowHeight : lineHeight;
  }

  ctx.restore();
}

function drawChordGuide(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings,
  time: number
) {
  const guide = getChordGuide(settings.lyrics, time);
  if (!guide) return;

  const renderScale = Math.min(w, h) / 1080;
  const maxWidth = w * 0.84;
  const fontFamily = settings.text.fontFamily || 'Inter';
  const sectionSize = 30 * renderScale;
  let chordSize = 48 * renderScale;
  const minChordSize = 28 * renderScale;
  const chordText = guide.chords.replace(/[|/]+/g, '  ·  ').replace(/\s+/g, ' ').trim();
  const sectionText = guide.section.toLocaleUpperCase('gl-ES');

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  ctx.font = `800 ${chordSize}px ${fontFamily}, sans-serif`;
  while (chordSize > minChordSize && ctx.measureText(chordText).width > maxWidth) {
    chordSize -= Math.max(1, 2 * renderScale);
    ctx.font = `800 ${chordSize}px ${fontFamily}, sans-serif`;
  }

  const centerY = Math.min(h * 0.34, Math.min(w, h) * 0.36);
  const sectionY = centerY - chordSize * 0.68;
  const chordY = centerY + (sectionText ? chordSize * 0.12 : 0);

  if (sectionText) {
    ctx.font = `800 ${sectionSize}px ${fontFamily}, sans-serif`;
    ctx.strokeStyle = 'rgba(0,0,0,0.82)';
    ctx.lineWidth = 5 * renderScale;
    ctx.strokeText(sectionText, w / 2, sectionY, maxWidth);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sectionText, w / 2, sectionY, maxWidth);
  }

  ctx.font = `800 ${chordSize}px ${fontFamily}, sans-serif`;
  ctx.strokeStyle = '#240909';
  ctx.lineWidth = 7 * renderScale;
  ctx.strokeText(chordText, w / 2, chordY, maxWidth);
  ctx.fillStyle = '#ff4848';
  ctx.fillText(chordText, w / 2, chordY, maxWidth);
  ctx.restore();
}

function drawProjectTitle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings,
  time: number
) {
  if (settings.showTitle === false || time < 0 || isDefaultProjectTitle(settings.title)) return;

  const presetTitle = getVisualPreset(settings.visualStyle)?.title ?? {};
  const titleStyle = {
    ...defaultTitleStyle,
    ...presetTitle,
    ...(settings.titleStyle ?? {}),
  };
  const rawTitle = settings.title.trim();
  const title = titleStyle.uppercase ? rawTitle.toLocaleUpperCase('gl-ES') : rawTitle;
  if (!title) return;

  const minSide = Math.min(w, h);
  const renderScale = minSide / 1080;
  const alpha = 1;
  const maxWidth = w * (settings.visualStyle === 'sonceibe' ? 0.78 : 0.84);
  let fontSize = titleStyle.fontSize * renderScale;
  const minTitleSize = Math.max(30 * renderScale, fontSize * 0.62);
  const fontFamily = titleStyle.fontFamily || 'Inter';
  const fontStyle = titleStyle.fontStyle === 'italic' ? 'italic' : 'normal';

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fontStyle} ${titleStyle.fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;

  while (fontSize > minTitleSize && ctx.measureText(title).width > maxWidth) {
    fontSize -= Math.max(1, 2 * renderScale);
    ctx.font = `${fontStyle} ${titleStyle.fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;
  }

  // Use the short side instead of frame height. This moves the title safely
  // below the SonCeibe Celtic border in 16:9 while only lowering it slightly
  // in 9:16, keeping both formats visually consistent.
  const topOffset = Math.max(10, Math.min(35, titleStyle.topOffset));
  const y = minSide * (topOffset / 100);

  if (titleStyle.shadow) {
    ctx.shadowColor = titleStyle.shadowColor;
    ctx.shadowBlur = titleStyle.shadowBlur * renderScale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2 * renderScale;
  }

  if (titleStyle.glow) {
    ctx.shadowColor = titleStyle.glowColor;
    ctx.shadowBlur = titleStyle.glowIntensity * renderScale;
  }

  if (titleStyle.outlineWidth > 0) {
    ctx.strokeStyle = titleStyle.outlineColor;
    ctx.lineWidth = titleStyle.outlineWidth * renderScale;
    ctx.strokeText(title, w / 2, y, maxWidth);
  }

  ctx.fillStyle = titleStyle.color || '#ffffff';
  ctx.fillText(title, w / 2, y, maxWidth);
  ctx.restore();
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings,
  time: number
) {
  const fx = settings.effects;
  const renderScale = Math.min(w, h) / 1080;

  if (fx.particles) {
    const count = fx.particlesCount;
    for (let i = 0; i < count; i++) {
      const seed = i * 137.5;
      const rawX = (Math.sin(seed) * 0.5 + 0.5) * w + time * 20 * (i % 3 - 1);
      const x = ((rawX % w) + w) % w;
      const y = h - ((time * 30 + seed * 50) % (h + 100));
      const size = (1 + (i % 3)) * renderScale;
      const opacity = 0.3 + 0.4 * Math.sin(time * 2 + seed);
      ctx.fillStyle = `rgba(255,255,255,${clamp01(opacity * 0.55)})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (fx.lightleaks) {
    const leakX = (Math.sin(time * 0.3) * 0.3 + 0.5) * w;
    const grad = ctx.createRadialGradient(leakX, h * 0.3, 0, leakX, h * 0.3, w * 0.45);
    grad.addColorStop(0, 'rgba(255,190,90,0.28)');
    grad.addColorStop(0.45, 'rgba(255,90,60,0.10)');
    grad.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  if (fx.vignette) {
    const grad = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.25,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.72
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${clamp01(fx.vignetteIntensity * 0.9)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings,
  time: number,
  video?: HTMLVideoElement | null
) {
  const videoStyle = settings.background.type === 'video' && Boolean(getVisualPreset(settings.visualStyle));
  if (videoStyle) settings = {
    ...settings, background: { ...settings.background, overlay: 0, blur: 0 },
    effects: { ...settings.effects, overlay: 0, blur: 0, particles: false, lightleaks: false, vignette: false },
  };
  ctx.clearRect(0, 0, w, h);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  drawBackground(ctx, w, h, settings, time, video);
  // Photos replace only the chosen interval; the main background remains unchanged.
  const photo = [...(settings.background.photoClips ?? [])].reverse().find(clip => time >= clip.start && time < clip.end);
  if (photo) {
    const image = getCachedImage(photo.url);
    if (image?.complete && image.naturalWidth > 0) {
      if ((photo.placement?.scale ?? 100) >= 100) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h); }
      drawPlacedImage(ctx, image, w, h, settings.background.imageFit ?? 'contain', time, false, 0, photo.placement);
    }
  }
  drawText(ctx, w, h, settings, time);
  drawEffects(ctx, w, h, settings, time);
  drawProjectTitle(ctx, w, h, settings, time);
  drawChordGuide(ctx, w, h, settings, time);
  drawVisualBranding(ctx, w, h, settings.visualStyle, time, settings.showSonCeibeBranding, videoStyle);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
}
