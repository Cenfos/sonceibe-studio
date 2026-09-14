import type { AnimationType, ImageFitMode, LyricLine, ProjectSettings } from '@/lib/types';
import { drawVisualBranding } from '@/lib/visual-branding';

const imageCache = new Map<string, HTMLImageElement>();

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getActiveLine(lyrics: LyricLine[], time: number): LyricLine | null {
  let active: LyricLine | null = null;

  for (const line of lyrics) {
    if (!line.text || time < line.start || time > line.end) continue;

    // If malformed/suspended synchronization left an older line extending far
    // into the song, prefer the most recently started valid line. This prevents
    // one accidental long end time from masking every lyric that follows it.
    if (!active || line.start >= active.start) active = line;
  }

  return active;
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
  time: number
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
    // Black is intentional in contain mode: the complete photograph is kept
    // visible and any unused canvas area becomes letterbox/pillarbox space.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const src = getBackgroundImageSource(settings, time);
    const image = getCachedImage(src);
    if (image?.complete && image.naturalWidth > 0) {
      drawImageFitted(
        ctx,
        image,
        w,
        h,
        bg.imageFit ?? 'contain',
        time,
        fx.kenburns,
        fx.kenburnsIntensity
      );
    }
  } else if (bg.type === 'video') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();

  // Background-level darkening used by the Fondo tab.
  if (bg.overlay > 0) {
    ctx.fillStyle = hexToRgba('#000000', bg.overlay);
    ctx.fillRect(0, 0, w, h);
  }

  // Extra color overlay from the Effects tab.
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
  const line = getActiveLine(settings.lyrics, time);
  if (!line || !line.text) return;

  const t = settings.text;
  const anim = settings.animation;
  let text = line.text;
  if (t.transform === 'uppercase') text = text.toUpperCase();
  if (t.transform === 'lowercase') text = text.toLowerCase();

  const renderScale = Math.min(w, h) / 1080;
  const fontSize = t.fontSize * renderScale;
  ctx.font = `${t.fontWeight} ${fontSize}px ${t.fontFamily}, sans-serif`;
  ctx.textAlign = t.align === 'left' ? 'left' : t.align === 'right' ? 'right' : 'center';
  ctx.textBaseline = 'middle';

  let y = h * 0.5;
  if (t.position === 'top') y = h * 0.2;
  if (t.position === 'bottom') y = h * 0.8;

  let x = w / 2;
  if (t.align === 'left') x = w * 0.1;
  if (t.align === 'right') x = w * 0.9;

  const duration = Math.max(0.05, anim.duration || 0.5);
  const inProgress = clamp01((time - line.start) / duration);
  const outProgress = clamp01((line.end - time) / duration);
  const lineDuration = Math.max(0.05, line.end - line.start);
  const karaokeProgress = clamp01((time - line.start) / lineDuration);

  const inState = animationProgress(anim.in, inProgress, 'in', renderScale);
  const outState = animationProgress(anim.out, outProgress, 'out', renderScale);
  const alpha = inState.alpha * outState.alpha;
  const scale = inState.scale * outState.scale;
  const offsetX = inState.offsetX + outState.offsetX;
  const textBlur = Math.max(inState.blurPx, outState.blurPx);

  const maxWidth = w * 0.8;
  const words = text.split(/\s+/).filter(Boolean);
  const wrappedLines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      wrappedLines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) wrappedLines.push(currentLine);

  const lineHeight = fontSize * t.lineHeight;
  const totalHeight = wrappedLines.length * lineHeight;
  let startY = -totalHeight / 2 + lineHeight / 2;

  const revealIn = getRevealProgress(anim.in, inProgress, words.length);
  const revealOut = getRevealProgress(anim.out, outProgress, words.length);
  const reveal = Math.min(revealIn, revealOut);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + offsetX, y);
  ctx.scale(scale, scale);
  if (textBlur > 0) ctx.filter = `blur(${textBlur}px)`;

  if (reveal < 1) {
    const clipLeft = t.align === 'left' ? 0 : t.align === 'right' ? -maxWidth : -maxWidth / 2;
    ctx.beginPath();
    ctx.rect(clipLeft, -totalHeight / 2 - lineHeight, maxWidth * reveal, totalHeight + lineHeight * 2);
    ctx.clip();
  }

  for (const wrappedLine of wrappedLines) {
    const measuredWidth = ctx.measureText(wrappedLine).width;
    const lineLeft = t.align === 'left'
      ? 0
      : t.align === 'right'
        ? -measuredWidth
        : -measuredWidth / 2;

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
      ctx.strokeText(wrappedLine, 0, startY);
    }

    ctx.fillStyle = t.color;
    ctx.fillText(wrappedLine, 0, startY);

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
      ctx.fillText(wrappedLine, 0, startY);
      ctx.restore();
    }

    startY += lineHeight;
  }

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
  time: number
) {
  ctx.clearRect(0, 0, w, h);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  drawBackground(ctx, w, h, settings, time);
  drawText(ctx, w, h, settings, time);
  drawEffects(ctx, w, h, settings, time);
  drawVisualBranding(ctx, w, h, settings.visualStyle, time);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
}