import { defaultVideoAdjustments, type VideoAdjustments, type BackgroundConfig } from './types';
import { videoFrameRect } from './source-video';

export function normalizedVideoAdjustments(value?: Partial<VideoAdjustments>): VideoAdjustments {
  const bounded = (n: number | undefined, fallback: number, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n!)) : fallback;
  return {
    brightness: bounded(value?.brightness, 100, 200), contrast: bounded(value?.contrast, 100, 200),
    saturation: bounded(value?.saturation, 100, 200), sharpness: bounded(value?.sharpness, 0, 100),
  };
}

/** One color pass, then an optional four-neighbour sharpen. Alpha remains unchanged. */
export function adjustVideoPixels(data: Uint8ClampedArray, width: number, height: number, value: VideoAdjustments) {
  const a = normalizedVideoAdjustments(value);
  const brightness = a.brightness / 100, contrast = a.contrast / 100, saturation = a.saturation / 100;
  if (brightness !== 1 || contrast !== 1 || saturation !== 1) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
      data[i] = ((luminance + (r - luminance) * saturation) * brightness - 127.5) * contrast + 127.5;
      data[i + 1] = ((luminance + (g - luminance) * saturation) * brightness - 127.5) * contrast + 127.5;
      data[i + 2] = ((luminance + (b - luminance) * saturation) * brightness - 127.5) * contrast + 127.5;
    }
  }
  if (!a.sharpness) return;
  const source = data.slice(), strength = a.sharpness / 200;
  const stride = width * 4;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * stride + x * 4;
      if (!source[i + 3] || !source[i - 4 + 3] || !source[i + 4 + 3] || !source[i - stride + 3] || !source[i + stride + 3]) continue;
      for (let c = 0; c < 3; c++) {
        const k = i + c;
        data[k] = source[k] + strength * (4 * source[k] - source[k - 4] - source[k + 4] - source[k - stride] - source[k + stride]);
      }
    }
  }
}

const frames = new WeakMap<HTMLVideoElement, { canvas: HTMLCanvasElement; key: string }>();

export function drawAdjustedVideo(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, w: number, h: number, bg: BackgroundConfig) {
  const a = normalizedVideoAdjustments(bg.videoAdjustments);
  const rect = videoFrameRect(w, h, video.videoWidth, video.videoHeight, { scale: 100, x: 50, y: 50, fit: 'cover', ...bg.videoPlacement });
  if (Object.keys(defaultVideoAdjustments).every(key => a[key as keyof VideoAdjustments] === defaultVideoAdjustments[key as keyof VideoAdjustments])) {
    ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height); return;
  }
  let cached = frames.get(video);
  if (!cached) { cached = { canvas: document.createElement('canvas'), key: '' }; frames.set(video, cached); }
  const key = JSON.stringify([video.currentTime, w, h, rect, a]);
  if (cached.key !== key) {
    const canvas = cached.canvas;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const target = canvas.getContext('2d', { willReadFrequently: true });
    if (!target) throw new Error('No se pudieron preparar los ajustes del vídeo');
    target.clearRect(0, 0, w, h);
    target.drawImage(video, rect.x, rect.y, rect.width, rect.height);
    const pixels = target.getImageData(0, 0, w, h);
    adjustVideoPixels(pixels.data, w, h, a);
    target.putImageData(pixels, 0, 0);
    cached.key = key;
  }
  ctx.drawImage(cached.canvas, 0, 0);
}
