'use client';

import type { VisualStyleId } from './types';
import { SONCEIBE_LOGO_URL } from './visual-presets';

let sonCeibeLogo: HTMLImageElement | null = null;

function getLogo(): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (sonCeibeLogo) return sonCeibeLogo;
  const image = new Image();
  image.src = SONCEIBE_LOGO_URL;
  sonCeibeLogo = image;
  return image;
}

export async function preloadVisualBranding(
  style: VisualStyleId | undefined,
  showBranding = false
): Promise<void> {
  if (style !== 'sonceibe' && !showBranding) return;
  const image = getLogo();
  if (!image || (image.complete && image.naturalWidth > 0)) return;

  await new Promise<void>((resolve) => {
    const finish = () => {
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
      resolve();
    };
    image.addEventListener('load', finish);
    image.addEventListener('error', finish);
  });
}

function drawSonCeibeCorners(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number, size: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(231, 184, 109, 0.62)';
  ctx.lineWidth = Math.max(2, w * 0.0023);
  ctx.lineCap = 'round';

  const corners: Array<[number, number, number, number]> = [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ];

  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * size);
    ctx.quadraticCurveTo(x, y, x + sx * size, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + sx * size * 0.22, y + sy * size * 0.72);
    ctx.quadraticCurveTo(
      x + sx * size * 0.48,
      y + sy * size * 0.42,
      x + sx * size * 0.72,
      y + sy * size * 0.2
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawBrandSignature(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  inset: number,
  borderWidth: number
) {
  const logo = getLogo();
  const minSide = Math.min(w, h);
  const safeBottom = inset + borderWidth * 1.5;

  if (logo?.complete && logo.naturalWidth > 0 && logo.naturalHeight > 0) {
    const maxLogoHeight = Math.max(92, minSide * 0.18);
    const ratio = logo.naturalWidth / logo.naturalHeight;
    const logoHeight = maxLogoHeight;
    const logoWidth = logoHeight * ratio;
    const x = w - inset - logoWidth - borderWidth * 1.5;
    const y = h - safeBottom - logoHeight - Math.max(18, minSide * 0.032);

    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.shadowColor = 'rgba(2, 8, 18, 0.86)';
    ctx.shadowBlur = Math.max(10, minSide * 0.016);
    ctx.drawImage(logo, x, y, logoWidth, logoHeight);
    ctx.restore();
  }

  const website = 'www.sonceibe.es';
  const fontSize = Math.max(15, minSide * 0.023);
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `600 ${fontSize}px Georgia, serif`;
  ctx.fillStyle = '#f1d6a7';
  ctx.shadowColor = 'rgba(0,0,0,0.92)';
  ctx.shadowBlur = Math.max(5, minSide * 0.009);
  ctx.fillText(website, w / 2, h - safeBottom, w * 0.48);

  const textWidth = ctx.measureText(website).width;
  const ornamentGap = Math.max(12, minSide * 0.018);
  const lineWidth = Math.max(24, minSide * 0.055);
  const y = h - safeBottom - fontSize * 0.42;
  ctx.strokeStyle = 'rgba(217,154,69,0.72)';
  ctx.lineWidth = Math.max(1, minSide * 0.0016);
  ctx.beginPath();
  ctx.moveTo(w / 2 - textWidth / 2 - ornamentGap - lineWidth, y);
  ctx.lineTo(w / 2 - textWidth / 2 - ornamentGap, y);
  ctx.moveTo(w / 2 + textWidth / 2 + ornamentGap, y);
  ctx.lineTo(w / 2 + textWidth / 2 + ornamentGap + lineWidth, y);
  ctx.stroke();
  ctx.restore();
}

export function drawVisualBranding(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: VisualStyleId | undefined,
  time = 0,
  showBranding = false
): void {
  const isSonCeibeStyle = style === 'sonceibe';
  if (!isSonCeibeStyle && !showBranding) return;

  const minSide = Math.min(w, h);
  const inset = Math.max(20, minSide * 0.032);
  const borderWidth = Math.max(3, minSide * 0.0045);

  if (isSonCeibeStyle) {
    ctx.save();
    ctx.shadowColor = 'rgba(217, 154, 69, 0.42)';
    ctx.shadowBlur = Math.max(12, minSide * 0.018);
    ctx.strokeStyle = 'rgba(217, 154, 69, 0.82)';
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(37, 91, 145, 0.7)';
    ctx.lineWidth = Math.max(1.5, borderWidth * 0.45);
    const innerInset = inset + borderWidth * 2.2;
    ctx.strokeRect(innerInset, innerInset, w - innerInset * 2, h - innerInset * 2);
    ctx.restore();

    drawSonCeibeCorners(ctx, w, h, inset + borderWidth, minSide * 0.11);

    const pulse = 0.04 + ((Math.sin(time * 0.8) + 1) / 2) * 0.035;
    const glow = ctx.createRadialGradient(w * 0.78, h * 0.83, 0, w * 0.78, h * 0.83, minSide * 0.42);
    glow.addColorStop(0, `rgba(37,91,145,${pulse})`);
    glow.addColorStop(0.45, `rgba(217,154,69,${pulse * 0.65})`);
    glow.addColorStop(1, 'rgba(217,154,69,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  drawBrandSignature(ctx, w, h, inset, borderWidth);
}
