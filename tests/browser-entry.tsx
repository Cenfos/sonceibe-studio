import React from 'react';
import { createRoot } from 'react-dom/client';
import { StudioClient } from '../components/studio-client';
import { createDefaultProjectSettings, type ProjectSettings } from '../lib/types';
import { createProjectMp4 } from '../lib/video-exporter';
import { renderFrame, preloadBackgroundImage } from '../components/studio/preview/canvas-renderer';
import { settingsForVideoTarget, type VideoTarget } from '../lib/video-profiles';
import { getProjectAudio, saveProjectAudio, LOCAL_AUDIO_URL } from '../lib/local-media-storage';
import { listSnapshots } from '../lib/project-history';
import { Input, BlobSource, MP4 } from 'mediabunny';

export function wav(seconds: number): File {
  const rate = 16000, length = rate * seconds;
  const buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer);
  const ascii = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) view.setInt16(44 + i * 2, Math.sin(i / rate * 440 * Math.PI * 2) * 1000, true);
  return new File([buffer], 'fixture.wav', { type: 'audio/wav' });
}

function solidImage(color: string, width = 320, height = 180): string {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL();
}

async function seed() {
  const settings = createDefaultProjectSettings();
  settings.title = 'Prueba Studio'; settings.audioDuration = 120;
  settings.audioUrl = LOCAL_AUDIO_URL; settings.audioName = 'fixture.wav';
  settings.lyrics = [{ id: 'lyric-1', text: 'Primera frase', start: 2, end: 6 }, { id: 'lyric-2', text: 'Última frase', start: 110, end: 120 }];
  const url = solidImage('#bb2222');
  settings.background = { ...settings.background, type: 'images', images: [url], imageMode: 'manual', imageClips: [{ id: 'image-1', url, start: 1, end: 5 }], photoClips: [{ id: 'photo-1', url, start: 7, end: 10, placement: { x: 25, y: 75, scale: 65 } }] };
  await saveProjectAudio('owner', 'fixture', wav(120));
  localStorage.setItem('sonceibe-projects-v2:owner', JSON.stringify([{ id: 'fixture', settings }]));
}

async function exportFixture(target: VideoTarget) {
  const settings = createDefaultProjectSettings();
  settings.showTitle = false; settings.audioDuration = 6;
  settings.background = { ...settings.background, type: 'image', imageUrl: solidImage('#bb2222', target === 'mobile' ? 320 : 180, target === 'mobile' ? 180 : 320), imageFit: 'contain', overlay: 0 };
  settings.effects = { ...settings.effects, overlay: 0, vignette: false, particles: false, lightleaks: false };
  settings.animation = { ...settings.animation, in: 'line', out: 'line', duration: 0.05 };
  settings.text = { ...settings.text, fontFamily: 'Arial', shadow: false, outlineWidth: 0 };
  settings.lyrics = [{ id: '1', text: 'PRIMERA', start: 0, end: 2 }, { id: '2', text: 'SEGUNDA', start: 2, end: 4 }, { id: '3', text: 'ULTIMA', start: 4, end: 6 }];
  const audio = document.createElement('audio');
  audio.src = URL.createObjectURL(wav(6)); document.body.appendChild(audio);
  await new Promise<void>((resolve, reject) => { audio.oncanplaythrough = () => resolve(); audio.onerror = () => reject(new Error('Fixture audio failed')); });
  const drawn: string[] = [];
  const originalFillText = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
    drawn.push(text); if (maxWidth === undefined) originalFillText.call(this, text, x, y); else originalFillText.call(this, text, x, y, maxWidth);
  };
  try {
    const result = await createProjectMp4({ audioEl: audio, duration: 6, settings, target });
    const bytes = new Uint8Array(await result.blob.arrayBuffer()), view = new DataView(bytes.buffer);
    const boxes: string[] = [];
    for (let offset = 0; offset + 8 <= bytes.length;) {
      const size = view.getUint32(offset), kind = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      boxes.push(kind); if (size < 8) break; offset += size;
    }
    const video = document.createElement('video'); video.muted = true; video.src = URL.createObjectURL(result.blob); document.body.appendChild(video);
    await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error('MP4 cannot decode')); });
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    const sampleFrames = [];
    for (const time of [0.8, 2.8, 5.3, 1.2]) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('MP4 seek timeout')), 10_000);
        video.onseeked = () => { clearTimeout(timer); resolve(); }; video.currentTime = time;
      });
      ctx.drawImage(video, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let whitePixels = 0, signature = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] > 180 && pixels[index + 1] > 180 && pixels[index + 2] > 180) { whitePixels++; signature = (signature + index) % 1000000007; }
      }
      const corners = [[10, 10], [canvas.width - 10, 10], [10, canvas.height - 10], [canvas.width - 10, canvas.height - 10]].map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
      sampleFrames.push({ time: video.currentTime, whitePixels, signature, corners });
    }
    const input = new Input({ formats: [MP4], source: new BlobSource(result.blob) });
    const audioTracks = (await input.getAudioTracks()).length;
    input.dispose();
    const report = { width: video.videoWidth, height: video.videoHeight, duration: video.duration, boxes, drawn: [...new Set(drawn)], sampleFrames, size: bytes.length, audioTracks, audioRestored: audio.paused && audio.currentTime === 0 };
    video.remove(); URL.revokeObjectURL(video.src);
    return report;
  } finally {
    CanvasRenderingContext2D.prototype.fillText = originalFillText;
    audio.remove(); URL.revokeObjectURL(audio.src);
  }
}

async function renderIntervals() {
  const settings = createDefaultProjectSettings(); settings.showTitle = false; settings.effects.overlay = 0; settings.background.overlay = 0;
  const red = solidImage('#ff0000'), blue = solidImage('#0000ff');
  settings.background = { ...settings.background, type: 'images', imageMode: 'manual', images: [red, blue], imageClips: [{ id: 'red', url: red, start: 0, end: 5 }, { id: 'blue', url: blue, start: 5, end: 10 }] };
  await Promise.all([preloadBackgroundImage(red), preloadBackgroundImage(blue)]);
  const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 108;
  const ctx = canvas.getContext('2d')!;
  return [1, 6].map(time => { renderFrame(ctx, 192, 108, settingsForVideoTarget(settings, 'pc'), time); return Array.from(ctx.getImageData(3, 3, 1, 1).data); });
}

function renderLongLyrics() {
  const settings = createDefaultProjectSettings(); settings.showTitle = false;
  settings.lyrics = Array.from({ length: 60 }, (_, index) => ({ id: String(index), text: `LINEA-${index}`, start: index * 5, end: (index + 1) * 5 }));
  // A long overlapping first line must not hide later phrases.
  settings.lyrics[0].end = 300;
  const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 108;
  const ctx = canvas.getContext('2d')!;
  const drawn: string[] = [];
  ctx.fillText = text => { drawn.push(text); };
  for (const time of [1, 121, 181, 299.5]) renderFrame(ctx, 192, 108, settings, time);
  return drawn;
}
const api = { seed, exportFixture, renderIntervals, renderLongLyrics, getProjectAudio, listSnapshots };
declare global { interface Window { studioTest: typeof api } }
window.studioTest = api;
if (location.search.includes('ui')) createRoot(document.getElementById('root')!).render(<StudioClient userId="owner" />);
