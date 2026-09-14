'use client';

import type { VisualStyleId } from './types';
import { SONCEIBE_LOGO_URL } from './visual-presets';

let sonCeibeLogo: HTMLImageElement | null = null;

function getLogo(): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (sonCeibeLogo) return sonCeibeLogo;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = SONCEIBE_LOGO_URL;
  sonCeibeLogo = image;
  return image;
}

export async function preloadVisualBranding(style: VisualStyleId | undefined): Promise<void> {
  if (style !== 'sonceibe') return;
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

export function drawVisualBranding(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: VisualStyleId | undefined,
  time = 0
): void {
  if (style !== 'sonceibe') return;

  const minSide = Math.min(w, h);
  const inset = Math.max(20, minSide * 0.032);
  const borderWidth = Math.max(3, minSide * 0.0045);

  ctx.save();
  ctx.shadowColor = 'rgba(217, 154, 69, 0.42)';
  ctx.shadowBlur = Math.max(12, minSide * 0.018);
  ctx.strokeStyle = 'rgba(217, 154, 69, 0.82)';
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(72, 122, 98, 0.62)';
  ctx.lineWidth = Math.max(1.5, borderWidth * 0.45);
  const innerInset = inset + borderWidth * 2.2;
  ctx.strokeRect(innerInset, innerInset, w - innerInset * 2, h - innerInset * 2);
  ctx.restore();

  drawSonCeibeCorners(ctx, w, h, inset + borderWidth, minSide * 0.11);

  // A very subtle warm pulse keeps the frame alive without distracting from the lyrics.
  const pulse = 0.04 + ((Math.sin(time * 0.8) + 1) / 2) * 0.035;
  const glow = ctx.createRadialGradient(w * 0.78, h * 0.83, 0, w * 0.78, h * 0.83, minSide * 0.42);
  glow.addColorStop(0, `rgba(217,154,69,${pulse})`);
  glow.addColorStop(1, 'rgba(217,154,69,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const logo = getLogo();
  if (!logo?.complete || logo.naturalWidth <= 0 || logo.naturalHeight <= 0) return;

  const logoSize = Math.max(82, minSide * 0.15);
  const x = w - inset - logoSize - borderWidth * 2;
  const y = h - inset - logoSize - borderWidth * 2;

  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.shadowColor = 'rgba(217, 154, 69, 0.46)';
  ctx.shadowBlur = Math.max(10, minSide * 0.018);
  ctx.drawImage(logo, x, y, logoSize, logoSize);
  ctx.restore();
}
