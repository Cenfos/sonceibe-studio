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

function strokeCelticPath(
  ctx: CanvasRenderingContext2D,
  drawPath: () => void,
  minSide: number,
  widthScale = 1
) {
  const darkWidth = Math.max(7, minSide * 0.018 * widthScale);
  const copperWidth = Math.max(5, minSide * 0.0125 * widthScale);
  const highlightWidth = Math.max(1.3, minSide * 0.0028 * widthScale);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  drawPath();
  ctx.strokeStyle = 'rgba(37, 20, 13, 0.98)';
  ctx.lineWidth = darkWidth;
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = Math.max(5, minSide * 0.009);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.beginPath();
  drawPath();
  ctx.strokeStyle = 'rgba(178, 96, 48, 0.98)';
  ctx.lineWidth = copperWidth;
  ctx.stroke();

  ctx.beginPath();
  drawPath();
  ctx.strokeStyle = 'rgba(238, 171, 104, 0.82)';
  ctx.lineWidth = highlightWidth;
  ctx.stroke();
  ctx.restore();
}

function drawHorizontalKnotBand(
  ctx: CanvasRenderingContext2D,
  y: number,
  x1: number,
  x2: number,
  amplitude: number,
  minSide: number
) {
  const width = Math.max(1, x2 - x1);
  const segment = Math.max(42, minSide * 0.092);
  const count = Math.max(2, Math.floor(width / segment));
  const step = width / count;

  const drawWave = (flip: number) => {
    ctx.moveTo(x1, y);
    for (let i = 0; i < count; i++) {
      const start = x1 + i * step;
      const end = start + step;
      const dir = (i % 2 === 0 ? 1 : -1) * flip;
      ctx.bezierCurveTo(
        start + step * 0.24,
        y + amplitude * dir,
        start + step * 0.76,
        y - amplitude * dir,
        end,
        y
      );
    }
  };

  strokeCelticPath(ctx, () => drawWave(1), minSide, 0.9);
  strokeCelticPath(ctx, () => drawWave(-1), minSide, 0.9);
}

function drawVerticalKnotBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y1: number,
  y2: number,
  amplitude: number,
  minSide: number
) {
  const height = Math.max(1, y2 - y1);
  const segment = Math.max(42, minSide * 0.092);
  const count = Math.max(2, Math.floor(height / segment));
  const step = height / count;

  const drawWave = (flip: number) => {
    ctx.moveTo(x, y1);
    for (let i = 0; i < count; i++) {
      const start = y1 + i * step;
      const end = start + step;
      const dir = (i % 2 === 0 ? 1 : -1) * flip;
      ctx.bezierCurveTo(
        x + amplitude * dir,
        start + step * 0.24,
        x - amplitude * dir,
        start + step * 0.76,
        x,
        end
      );
    }
  };

  strokeCelticPath(ctx, () => drawWave(1), minSide, 0.9);
  strokeCelticPath(ctx, () => drawWave(-1), minSide, 0.9);
}

function drawCornerKnot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sx: number,
  sy: number,
  size: number,
  minSide: number
) {
  const drawLoop = () => {
    ctx.moveTo(x + sx * size, y);
    ctx.bezierCurveTo(
      x + sx * size * 0.42,
      y,
      x,
      y + sy * size * 0.42,
      x,
      y + sy * size
    );
    ctx.bezierCurveTo(
      x + sx * size * 0.18,
      y + sy * size * 0.58,
      x + sx * size * 0.58,
      y + sy * size * 0.18,
      x + sx * size,
      y
    );
  };

  strokeCelticPath(ctx, drawLoop, minSide, 1.05);
}

function drawTriskelMedallion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  minSide: number
) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.72)';
  ctx.shadowBlur = Math.max(8, minSide * 0.014);
  ctx.fillStyle = 'rgba(7, 30, 45, 0.98)';
  ctx.strokeStyle = 'rgba(53, 27, 16, 0.98)';
  ctx.lineWidth = Math.max(8, radius * 0.3);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(187, 103, 52, 0.98)';
  ctx.lineWidth = Math.max(4, radius * 0.18);
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.93, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(235, 166, 99, 0.84)';
  ctx.lineWidth = Math.max(1.2, radius * 0.045);
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.83, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    const armX = cx + Math.cos(angle) * radius * 0.28;
    const armY = cy + Math.sin(angle) * radius * 0.28;
    const armRadius = radius * 0.34;

    strokeCelticPath(
      ctx,
      () => {
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(
          cx + Math.cos(angle + 0.55) * radius * 0.66,
          cy + Math.sin(angle + 0.55) * radius * 0.66,
          armX,
          armY
        );
        ctx.arc(armX, armY, armRadius, angle + 0.1, angle + Math.PI * 1.55, false);
      },
      minSide,
      0.55
    );
  }

  ctx.restore();
}

function drawSonCeibeCelticBorder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  inset: number,
  minSide: number
) {
  const band = Math.max(24, minSide * 0.052);
  const halfBand = band / 2;
  const cornerSize = Math.max(46, minSide * 0.105);
  const topY = inset + halfBand;
  const bottomY = h - inset - halfBand;
  const leftX = inset + halfBand;
  const rightX = w - inset - halfBand;
  const horizontalStart = leftX + cornerSize * 0.68;
  const horizontalEnd = rightX - cornerSize * 0.68;
  const verticalStart = topY + cornerSize * 0.68;
  const verticalEnd = bottomY - cornerSize * 0.68;

  ctx.save();
  ctx.strokeStyle = 'rgba(20, 12, 10, 0.94)';
  ctx.lineWidth = band;
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.72)';
  ctx.shadowBlur = Math.max(10, minSide * 0.016);
  ctx.strokeRect(
    leftX,
    topY,
    Math.max(1, rightX - leftX),
    Math.max(1, bottomY - topY)
  );
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(35, 88, 139, 0.92)';
  ctx.lineWidth = Math.max(9, band * 0.5);
  ctx.lineJoin = 'round';
  ctx.strokeRect(
    leftX,
    topY,
    Math.max(1, rightX - leftX),
    Math.max(1, bottomY - topY)
  );
  ctx.restore();

  drawHorizontalKnotBand(ctx, topY, horizontalStart, horizontalEnd, band * 0.36, minSide);
  drawHorizontalKnotBand(ctx, bottomY, horizontalStart, horizontalEnd, band * 0.36, minSide);
  drawVerticalKnotBand(ctx, leftX, verticalStart, verticalEnd, band * 0.36, minSide);
  drawVerticalKnotBand(ctx, rightX, verticalStart, verticalEnd, band * 0.36, minSide);

  drawCornerKnot(ctx, leftX, topY, 1, 1, cornerSize, minSide);
  drawCornerKnot(ctx, rightX, topY, -1, 1, cornerSize, minSide);
  drawCornerKnot(ctx, leftX, bottomY, 1, -1, cornerSize, minSide);
  drawCornerKnot(ctx, rightX, bottomY, -1, -1, cornerSize, minSide);

  const medallionRadius = Math.max(17, minSide * 0.033);
  drawTriskelMedallion(ctx, w / 2, topY, medallionRadius, minSide);
  drawTriskelMedallion(ctx, leftX, h / 2, medallionRadius * 0.9, minSide);
  drawTriskelMedallion(ctx, rightX, h / 2, medallionRadius * 0.9, minSide);
}

function drawBrandSignature(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  inset: number,
  borderWidth: number,
  hasCelticBorder = false
) {
  const logo = getLogo();
  const minSide = Math.min(w, h);
  const celticBand = hasCelticBorder ? Math.max(24, minSide * 0.052) : 0;
  const breathingRoom = hasCelticBorder
    ? Math.max(20, minSide * 0.036)
    : Math.max(8, minSide * 0.012);
  const safeBottom = inset + borderWidth * 1.5 + celticBand + breathingRoom;
  const website = 'www.sonceibe.es';
  const fontSize = Math.max(15, minSide * 0.023);
  const websiteBaseline = h - safeBottom;

  ctx.save();
  ctx.globalAlpha = 0.96;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `600 ${fontSize}px Georgia, serif`;
  ctx.fillStyle = '#f1d6a7';
  ctx.shadowColor = 'rgba(0,0,0,0.96)';
  ctx.shadowBlur = Math.max(6, minSide * 0.011);
  ctx.fillText(website, w / 2, websiteBaseline, w * 0.48);

  const textWidth = ctx.measureText(website).width;
  const ornamentGap = Math.max(12, minSide * 0.018);
  const lineWidth = Math.max(24, minSide * 0.055);
  const lineY = websiteBaseline - fontSize * 0.42;
  ctx.strokeStyle = 'rgba(217,154,69,0.78)';
  ctx.lineWidth = Math.max(1, minSide * 0.0016);
  ctx.beginPath();
  ctx.moveTo(w / 2 - textWidth / 2 - ornamentGap - lineWidth, lineY);
  ctx.lineTo(w / 2 - textWidth / 2 - ornamentGap, lineY);
  ctx.moveTo(w / 2 + textWidth / 2 + ornamentGap, lineY);
  ctx.lineTo(w / 2 + textWidth / 2 + ornamentGap + lineWidth, lineY);
  ctx.stroke();
  ctx.restore();

  if (logo?.complete && logo.naturalWidth > 0 && logo.naturalHeight > 0) {
    const logoHeight = Math.max(82, minSide * 0.145);
    const ratio = logo.naturalWidth / logo.naturalHeight;
    const logoWidth = logoHeight * ratio;
    const gap = Math.max(12, minSide * 0.018);
    const websiteTop = websiteBaseline - fontSize;
    const x = (w - logoWidth) / 2;
    const y = websiteTop - gap - logoHeight;

    ctx.save();
    ctx.globalAlpha = 0.97;
    ctx.shadowColor = 'rgba(2, 8, 18, 0.9)';
    ctx.shadowBlur = Math.max(10, minSide * 0.016);
    ctx.drawImage(logo, x, y, logoWidth, logoHeight);
    ctx.restore();
  }
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
  const inset = Math.max(14, minSide * 0.022);
  const borderWidth = Math.max(3, minSide * 0.0045);

  if (isSonCeibeStyle) {
    drawSonCeibeCelticBorder(ctx, w, h, inset, minSide);

    const pulse = 0.04 + ((Math.sin(time * 0.8) + 1) / 2) * 0.035;
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.84, 0, w * 0.5, h * 0.84, minSide * 0.42);
    glow.addColorStop(0, `rgba(37,91,145,${pulse})`);
    glow.addColorStop(0.45, `rgba(217,154,69,${pulse * 0.65})`);
    glow.addColorStop(1, 'rgba(217,154,69,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  drawBrandSignature(ctx, w, h, inset, borderWidth, isSonCeibeStyle);
}
