import type { ProjectSettings, LyricLine } from '@/lib/types';

function getActiveLine(lyrics: LyricLine[], time: number): LyricLine | null {
  for (const line of lyrics) {
    if (time >= line.start && time <= line.end) return line;
  }
  // Show upcoming line slightly before
  for (const line of lyrics) {
    if (line.start > time && line.start - time < 0.5) return line;
  }
  return null;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings,
  time: number
) {
  const bg = settings.background;

  // Base background
  if (bg.type === 'color') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.type === 'gradient') {
    const angle = (bg.gradientAngle * Math.PI) / 180;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    const grad = ctx.createLinearGradient(
      w / 2 - (x * w) / 2,
      h / 2 - (y * h) / 2,
      w / 2 + (x * w) / 2,
      h / 2 + (y * h) / 2
    );
    grad.addColorStop(0, bg.gradientFrom);
    grad.addColorStop(1, bg.gradientTo);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Animate gradient
    const offset = (time * 0.05) % 1;
    const grad2 = ctx.createLinearGradient(
      w / 2 - (x * w) / 2 + offset * 100,
      h / 2 - (y * h) / 2,
      w / 2 + (x * w) / 2 + offset * 100,
      h / 2 + (y * h) / 2
    );
    grad2.addColorStop(0, hexToRgba(bg.gradientFrom, 0.3));
    grad2.addColorStop(1, hexToRgba(bg.gradientTo, 0.3));
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.type === 'image' || bg.type === 'images') {
    // Placeholder colored block for image
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, w, h);
  } else if (bg.type === 'video') {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
  }

  // Blur overlay
  if (bg.blur > 0) {
    ctx.fillStyle = hexToRgba('#000000', bg.blur * 0.01);
    ctx.fillRect(0, 0, w, h);
  }

  // Dark overlay
  if (bg.overlay > 0) {
    ctx.fillStyle = hexToRgba('#000000', bg.overlay);
    ctx.fillRect(0, 0, w, h);
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings,
  time: number
) {
  const line = getActiveLine(settings.lyrics, time);
  if (!line) return;

  const t = settings.text;
  let text = line.text;
  if (t.transform === 'uppercase') text = text.toUpperCase();
  if (t.transform === 'lowercase') text = text.toLowerCase();

  const fontSize = t.fontSize * (w / 1920);
  ctx.font = `${t.fontWeight} ${fontSize}px ${t.fontFamily}, sans-serif`;
  ctx.textAlign = t.align === 'left' ? 'left' : t.align === 'right' ? 'right' : 'center';
  ctx.textBaseline = 'middle';

  // Position
  let y: number;
  if (t.position === 'top') y = h * 0.2;
  else if (t.position === 'bottom') y = h * 0.8;
  else y = h * 0.5;

  let x = w / 2;
  if (t.align === 'left') x = w * 0.1;
  if (t.align === 'right') x = w * 0.9;

  // Animation progress
  const lineDuration = line.end - line.start;
  const lineProgress = (time - line.start) / lineDuration;
  const fadeIn = Math.min(1, (time - line.start) / settings.animation.duration);
  const fadeOut = Math.min(1, (line.end - time) / settings.animation.duration);
  let alpha = Math.min(fadeIn, fadeOut);
  if (alpha < 0) alpha = 0;

  let scale = 1;
  let offsetX = 0;
  const anim = settings.animation;

  if (anim.in === 'zoom') {
    scale = 0.8 + 0.2 * fadeIn;
  } else if (anim.in === 'slide') {
    offsetX = (1 - fadeIn) * 100;
  } else if (anim.in === 'bounce') {
    scale = 1 + Math.sin(fadeIn * Math.PI) * 0.1;
  } else if (anim.in === 'blur') {
    ctx.filter = `blur(${(1 - fadeIn) * 20}px)`;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + offsetX, y);
  ctx.scale(scale, scale);

  // Word wrap
  const maxWidth = w * 0.8;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const test = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * t.lineHeight;
  const totalHeight = lines.length * lineHeight;
  let startY = -totalHeight / 2 + lineHeight / 2;

  for (const l of lines) {
    // Shadow
    if (t.shadow) {
      ctx.shadowColor = t.shadowColor;
      ctx.shadowBlur = t.shadowBlur * (w / 1920);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    }

    // Glow
    if (t.glow) {
      ctx.shadowColor = t.glowColor;
      ctx.shadowBlur = t.glowIntensity * (w / 1920);
    }

    // Outline
    if (t.outlineWidth > 0) {
      ctx.strokeStyle = t.outlineColor;
      ctx.lineWidth = t.outlineWidth * (w / 1920);
      ctx.strokeText(l, 0, startY);
    }

    // Fill
    ctx.fillStyle = t.color;

    // Karaoke highlight
    if (anim.in === 'karaoke' && lineProgress > 0) {
      const wordsInLine = l.split(' ');
      const totalChars = l.length;
      const highlightChars = Math.floor(totalChars * lineProgress);
      let drawnChars = 0;
      let cursorX = 0;
      for (let i = 0; i < wordsInLine.length; i++) {
        const word = wordsInLine[i];
        const wordWidth = ctx.measureText(word).width;
        const spaceWidth = i > 0 ? ctx.measureText(' ').width : 0;
        const wordStart = drawnChars;
        const wordEnd = wordStart + word.length;
        if (wordEnd <= highlightChars) {
          ctx.fillStyle = anim.karaokeColor;
          ctx.fillText(word, cursorX + (i > 0 ? spaceWidth : 0), startY);
        } else if (wordStart < highlightChars) {
          const partial = highlightChars - wordStart;
          const partialWidth = ctx.measureText(word.substring(0, partial)).width;
          ctx.fillStyle = anim.karaokeColor;
          ctx.fillText(word.substring(0, partial), cursorX + (i > 0 ? spaceWidth : 0), startY);
          ctx.fillStyle = t.color;
          ctx.fillText(
            word.substring(partial),
            cursorX + (i > 0 ? spaceWidth : 0) + partialWidth,
            startY
          );
        } else {
          ctx.fillStyle = t.color;
          ctx.fillText(word, cursorX + (i > 0 ? spaceWidth : 0), startY);
        }
        cursorX += wordWidth + spaceWidth;
        drawnChars = wordEnd + 1;
      }
    } else {
      ctx.fillStyle = t.color;
      ctx.fillText(l, 0, startY);
    }

    startY += lineHeight;
  }

  ctx.restore();
  ctx.filter = 'none';
  ctx.shadowBlur = 0;
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: ProjectSettings,
  time: number
) {
  const fx = settings.effects;

  // Vignette
  if (fx.vignette) {
    const grad = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.3,
      w / 2, h / 2, Math.max(w, h) * 0.7
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${fx.vignetteIntensity * 0.8})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Particles
  if (fx.particles) {
    const count = fx.particlesCount;
    for (let i = 0; i < count; i++) {
      const seed = i * 137.5;
      const x = ((Math.sin(seed) * 0.5 + 0.5) * w + time * 20 * (i % 3 - 1)) % w;
      const y = (h - ((time * 30 + seed * 50) % (h + 100))) ;
      const size = 1 + (i % 3);
      const opacity = 0.3 + 0.4 * Math.sin(time * 2 + seed);
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Light leaks
  if (fx.lightleaks) {
    const leakX = (Math.sin(time * 0.3) * 0.3 + 0.5) * w;
    const grad = ctx.createRadialGradient(leakX, h * 0.3, 0, leakX, h * 0.3, w * 0.4);
    grad.addColorStop(0, 'rgba(255, 200, 100, 0.15)');
    grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
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
  drawBackground(ctx, w, h, settings, time);
  drawText(ctx, w, h, settings, time);
  drawEffects(ctx, w, h, settings, time);
}
