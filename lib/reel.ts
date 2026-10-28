import { defaultAnimation, defaultBackground, defaultEffects, defaultTextStyle, defaultTitleStyle, type ProjectSettings } from './types';

/** A single undoable change removes every preset decoration and active image. */
export function emptyStyle(): Partial<ProjectSettings> {
  return {
    visualStyle: 'default', showSonCeibeBranding: false,
    background: { ...defaultBackground, type: 'color', color: '#000000', overlay: 0, images: [], imageClips: [], photoClips: [] },
    text: { ...defaultTextStyle }, titleStyle: { ...defaultTitleStyle },
    animation: { ...defaultAnimation }, effects: { ...defaultEffects, overlay: 0 },
  };
}

export function validateReel(start: number, end: number, duration: number) {
  if (![start, end, duration].every(Number.isFinite) || start < 0 || end > duration || end - start < 0.2) {
    throw new Error('Elige un inicio y un fin dentro de la canción, separados al menos 0,2 segundos.');
  }
}

export function reelSettings(settings: ProjectSettings, start: number, end: number, coverUrl = '', showLyrics = true, showTitle = true): ProjectSettings {
  validateReel(start, end, settings.audioDuration);
  const trim = <T extends { start: number; end: number }>(clips: T[]): T[] => clips
    .filter(clip => clip.end > start && clip.start < end)
    .map(clip => ({ ...clip, start: Math.max(0, clip.start - start), end: Math.min(end, clip.end) - start }));
  const bg = settings.background;
  let imageClips = bg.imageClips;
  if (bg.type === 'images' && bg.imageMode !== 'manual' && bg.images.length) {
    const interval = Math.max(0.5, bg.imageDuration ?? 5);
    imageClips = [];
    for (let i = Math.floor(start / interval); i * interval < end; i++) {
      imageClips.push({ id: `reel-${i}`, url: bg.images[i % bg.images.length], start: i * interval, end: (i + 1) * interval });
    }
  }
  const base = coverUrl ? { ...settings, ...emptyStyle() } : settings;
  return {
    ...base, audioDuration: end - start, showTitle,
    lyrics: !showLyrics ? [] : settings.reel?.lyricsMode === 'custom'
      ? (settings.reel.lyrics || []).filter(line => line.text.trim() && line.end > line.start && line.start < end - start).map(line => ({ ...line, start: Math.max(0, line.start), end: Math.min(end - start, line.end) }))
      : trim(settings.lyrics).map(line => ({ ...line, words: line.words ? trim(line.words) : undefined })),
    background: coverUrl
      ? { ...base.background, type: 'image', imageUrl: coverUrl, imageFit: 'cover' }
      : { ...bg, imageMode: bg.type === 'images' ? 'manual' : bg.imageMode, imageClips: trim(imageClips), photoClips: trim(bg.photoClips || []) },
    exportConfig: { ...settings.exportConfig, orientation: 'portrait', resolution: '1080p', fps: 30, includeAudio: true },
  };
}

/** Encode only the selected PCM samples. The existing exporter still plays to ended. */
export function sliceAudioWav(buffer: Pick<AudioBuffer, 'duration' | 'sampleRate' | 'numberOfChannels' | 'length' | 'getChannelData'>, start: number, end: number): Blob {
  validateReel(start, end, buffer.duration);
  const first = Math.round(start * buffer.sampleRate);
  const last = Math.min(buffer.length, Math.round(end * buffer.sampleRate));
  const frames = last - first, channels = buffer.numberOfChannels, size = frames * channels * 2;
  const bytes = new ArrayBuffer(44 + size), view = new DataView(bytes);
  const ascii = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  ascii(0, 'RIFF'); view.setUint32(4, 36 + size, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, size, true);
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels; channel++) {
    const sample = Math.max(-1, Math.min(1, data[channel][first + frame]));
    view.setInt16(44 + (frame * channels + channel) * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}


export function reelLyricsIssue(reel: NonNullable<ProjectSettings['reel']>): string {
  if (!reel.showLyrics || reel.lyricsMode !== 'custom') return '';
  const lines = reel.lyrics || [];
  if (!lines.length) return 'Prepara las frases del Reel o desactiva la letra.';
  const draft = (reel.lyricsText ?? lines.map(line => line.text).join('\n')).split(/\r?\n/).map(text => text.trim()).filter(Boolean).join('\n');
  if (draft !== lines.map(line => line.text).join('\n')) return 'Pulsa Preparar frases para aplicar los cambios de texto y sincronízalas.';
  if (lines.some((line, index) => !Number.isFinite(line.start) || !Number.isFinite(line.end) || line.start < 0 || line.end > reel.end - reel.start || line.end <= line.start || (index > 0 && line.start < lines[index - 1].end))) return 'Sincroniza las frases del Reel o ajusta sus tiempos dentro del fragmento, sin solaparlas.';
  return '';
}
