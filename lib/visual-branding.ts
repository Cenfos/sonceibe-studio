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

function drawRockTheme(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  minSide: number,
  time: number
) {
  const inset = Math.max(15, minSide * 0.022);
  const frame = Math.max(5, minSide * 0.007);
  const ember = 0.45 + ((Math.sin(time * 1.8) + 1) / 2) * 0.2;

  ctx.save();
  ctx.strokeStyle = 'rgba(14,14,15,0.98)';
  ctx.lineWidth = frame * 3.2;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.strokeStyle = `rgba(189,82,43,${ember})`;
  ctx.lineWidth = frame;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

  const boltR = Math.max(3, minSide * 0.006);
  const bolts = [
    [inset, inset],
    [w - inset, inset],
    [inset, h - inset],
    [w - inset, h - inset],
  ];
  for (const [x, y] of bolts) {
    ctx.fillStyle = 'rgba(180,181,182,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, boltR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(35,35,36,0.9)';
    ctx.lineWidth = Math.max(1, boltR * 0.28);
    ctx.beginPath();
    ctx.moveTo(x - boltR * 0.6, y);
    ctx.lineTo(x + boltR * 0.6, y);
    ctx.stroke();
  }

  const slashLen = minSide * 0.11;
  ctx.strokeStyle = 'rgba(214,107,60,0.75)';
  ctx.lineWidth = Math.max(4, minSide * 0.008);
  ctx.lineCap = 'square';
  for (let i = 0; i < 3; i++) {
    const gap = i * minSide * 0.025;
    ctx.beginPath();
    ctx.moveTo(inset + gap, inset + slashLen);
    ctx.lineTo(inset + slashLen + gap, inset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w - inset - gap, h - inset - slashLen);
    ctx.lineTo(w - inset - slashLen - gap, h - inset);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(size * 0.7, -size * 0.45, size * 0.95, size * 0.35, 0, size);
  ctx.bezierCurveTo(-size * 0.8, size * 0.35, -size * 0.55, -size * 0.35, 0, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, size * 0.08);
  ctx.lineTo(0, size * 0.88);
  ctx.stroke();
  ctx.restore();
}

function drawFolkTheme(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  minSide: number,
  time: number
) {
  const inset = Math.max(18, minSide * 0.028);
  const amplitude = minSide * 0.012;
  const yTop = inset + minSide * 0.015;
  const yBottom = h - inset - minSide * 0.015;

  ctx.save();
  ctx.strokeStyle = 'rgba(207,188,137,0.58)';
  ctx.lineWidth = Math.max(1.5, minSide * 0.0025);
  ctx.beginPath();
  ctx.moveTo(inset, yTop);
  for (let x = inset; x < w - inset; x += minSide * 0.08) {
    const next = Math.min(w - inset, x + minSide * 0.08);
    ctx.quadraticCurveTo((x + next) / 2, yTop + Math.sin(x * 0.02 + time * 0.25) * amplitude, next, yTop);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(inset, yBottom);
  for (let x = inset; x < w - inset; x += minSide * 0.08) {
    const next = Math.min(w - inset, x + minSide * 0.08);
    ctx.quadraticCurveTo((x + next) / 2, yBottom + Math.cos(x * 0.02 + time * 0.22) * amplitude, next, yBottom);
  }
  ctx.stroke();

  drawLeaf(ctx, inset * 1.45, inset * 1.35, minSide * 0.055, -0.55, 'rgba(207,188,137,0.56)');
  drawLeaf(ctx, w - inset * 1.45, h - inset * 1.35, minSide * 0.055, Math.PI - 0.55, 'rgba(207,188,137,0.5)');
  drawLeaf(ctx, w - inset * 1.5, inset * 1.25, minSide * 0.04, 0.65, 'rgba(147,180,157,0.48)');
  ctx.restore();
}

function drawSkaTheme(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  minSide: number
) {
  const cell = Math.max(14, minSide * 0.026);
  const bandH = cell * 2;
  const columns = Math.ceil(w / cell);

  ctx.save();
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < columns; col++) {
      const dark = (row + col) % 2 === 0;
      ctx.fillStyle = dark ? 'rgba(12,14,12,0.86)' : 'rgba(242,210,77,0.82)';
      ctx.fillRect(col * cell, row * cell, cell + 1, cell + 1);
      ctx.fillRect(col * cell, h - bandH + row * cell, cell + 1, cell + 1);
    }
  }

  const stripe = minSide * 0.025;
  ctx.strokeStyle = 'rgba(108,146,54,0.88)';
  ctx.lineWidth = stripe;
  ctx.beginPath();
  ctx.moveTo(0, bandH + stripe * 1.2);
  ctx.lineTo(w * 0.18, bandH + stripe * 1.2);
  ctx.moveTo(w * 0.82, h - bandH - stripe * 1.2);
  ctx.lineTo(w, h - bandH - stripe * 1.2);
  ctx.stroke();
  ctx.restore();
}

function drawScallop(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, radius * 0.08);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, Math.PI * 2);
  ctx.stroke();
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + radius * 0.05);
    ctx.lineTo(cx + (i / 3) * radius * 0.88, cy - radius * 0.72);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBagpipeSilhouette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(220,235,246,0.26)';
  ctx.fillStyle = 'rgba(220,235,246,0.18)';
  ctx.lineWidth = Math.max(2, size * 0.035);
  ctx.beginPath();
  ctx.ellipse(0, size * 0.18, size * 0.34, size * 0.24, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.2, size * 0.02);
  ctx.lineTo(size * 0.52, -size * 0.62);
  ctx.moveTo(size * 0.08, -size * 0.02);
  ctx.lineTo(size * 0.16, -size * 0.72);
  ctx.moveTo(-size * 0.16, size * 0.08);
  ctx.lineTo(-size * 0.55, size * 0.7);
  ctx.stroke();
  ctx.restore();
}

function drawGaliciaTheme(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  minSide: number
) {
  const inset = Math.max(16, minSide * 0.024);
  const border = Math.max(3, minSide * 0.005);

  ctx.save();
  ctx.strokeStyle = 'rgba(218,233,243,0.72)';
  ctx.lineWidth = border * 2.2;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.strokeStyle = 'rgba(74,133,178,0.86)';
  ctx.lineWidth = border;
  ctx.strokeRect(inset * 1.45, inset * 1.45, w - inset * 2.9, h - inset * 2.9);
  ctx.restore();

  const shellR = minSide * 0.055;
  drawScallop(ctx, inset + shellR * 1.15, h - inset - shellR * 0.3, shellR, 'rgba(225,238,247,0.58)');
  drawScallop(ctx, w - inset - shellR * 1.15, inset + shellR * 0.9, shellR * 0.75, 'rgba(225,238,247,0.45)');
  drawBagpipeSilhouette(ctx, w - inset - minSide * 0.09, h * 0.52, minSide * 0.14);
}

function drawTabernaTheme(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  minSide: number,
  time: number
) {
  const inset = Math.max(14, minSide * 0.02);
  const frame = Math.max(18, minSide * 0.035);

  ctx.save();
  ctx.strokeStyle = 'rgba(43,20,9,0.96)';
  ctx.lineWidth = frame;
  ctx.strokeRect(inset + frame / 2, inset + frame / 2, w - inset * 2 - frame, h - inset * 2 - frame);
  ctx.strokeStyle = 'rgba(164,99,43,0.84)';
  ctx.lineWidth = Math.max(2, frame * 0.16);
  ctx.strokeRect(inset + frame / 2, inset + frame / 2, w - inset * 2 - frame, h - inset * 2 - frame);

  ctx.strokeStyle = 'rgba(213,149,77,0.2)';
  ctx.lineWidth = Math.max(1, minSide * 0.0015);
  for (let i = 0; i < 4; i++) {
    const off = (i + 1) * frame * 0.17;
    ctx.beginPath();
    ctx.moveTo(inset + off, inset + frame);
    ctx.lineTo(inset + off, h - inset - frame);
    ctx.moveTo(w - inset - off, inset + frame);
    ctx.lineTo(w - inset - off, h - inset - frame);
    ctx.stroke();
  }

  const bulbY = inset + frame * 0.55;
  const bulbs = 7;
  for (let i = 0; i < bulbs; i++) {
    const x = inset + frame + ((w - (inset + frame) * 2) * i) / (bulbs - 1);
    const pulse = 0.6 + 0.18 * Math.sin(time * 1.2 + i);
    ctx.strokeStyle = 'rgba(50,25,10,0.8)';
    ctx.lineWidth = Math.max(1, minSide * 0.002);
    ctx.beginPath();
    ctx.moveTo(x, inset);
    ctx.lineTo(x, bulbY - minSide * 0.012);
    ctx.stroke();
    ctx.fillStyle = `rgba(240,177,84,${pulse})`;
    ctx.shadowColor = 'rgba(229,139,48,0.72)';
    ctx.shadowBlur = minSide * 0.02;
    ctx.beginPath();
    ctx.arc(x, bulbY, minSide * 0.0085, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  const nailR = Math.max(3, minSide * 0.005);
  for (const [x, y] of [[inset + frame * 0.5, inset + frame * 0.5], [w - inset - frame * 0.5, inset + frame * 0.5], [inset + frame * 0.5, h - inset - frame * 0.5], [w - inset - frame * 0.5, h - inset - frame * 0.5]]) {
    ctx.fillStyle = 'rgba(95,71,52,0.92)';
    ctx.beginPath();
    ctx.arc(x, y, nailR, 0, Math.PI * 2);
    ctx.fill();
  }
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
  const themed =
    style === 'sonceibe' ||
    style === 'rock-galego' ||
    style === 'folk-atlantico' ||
    style === 'ska-ceibe' ||
    style === 'galicia-gaita' ||
    style === 'taberna-galega';
  if (!themed && !showBranding) return;

  const minSide = Math.min(w, h);
  const inset = Math.max(14, minSide * 0.022);
  const borderWidth = Math.max(3, minSide * 0.0045);
  const isSonCeibeStyle = style === 'sonceibe';

  if (isSonCeibeStyle) {
    drawSonCeibeCelticBorder(ctx, w, h, inset, minSide);

    const pulse = 0.04 + ((Math.sin(time * 0.8) + 1) / 2) * 0.035;
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.84, 0, w * 0.5, h * 0.84, minSide * 0.42);
    glow.addColorStop(0, `rgba(37,91,145,${pulse})`);
    glow.addColorStop(0.45, `rgba(217,154,69,${pulse * 0.65})`);
    glow.addColorStop(1, 'rgba(217,154,69,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  } else if (style === 'rock-galego') {
    drawRockTheme(ctx, w, h, minSide, time);
  } else if (style === 'folk-atlantico') {
    drawFolkTheme(ctx, w, h, minSide, time);
  } else if (style === 'ska-ceibe') {
    drawSkaTheme(ctx, w, h, minSide);
  } else if (style === 'galicia-gaita') {
    drawGaliciaTheme(ctx, w, h, minSide);
  } else if (style === 'taberna-galega') {
    drawTabernaTheme(ctx, w, h, minSide, time);
  }

  if (isSonCeibeStyle || showBranding) {
    drawBrandSignature(ctx, w, h, inset, borderWidth, isSonCeibeStyle);
  }
}
