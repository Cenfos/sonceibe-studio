import { z } from 'zod';
import { createDefaultProjectSettings, type Project, type ProjectSettings } from './types';

const defaults = createDefaultProjectSettings();
const text = z.string().max(100_000);
const number = z.number().finite().min(-10_000_000).max(10_000_000);
const time = number;
const url = z.string().max(30_000_000).refine(value => !value || /^(https?:\/\/|blob:|sonceibe-local:\/\/|data:(image|audio)\/)/i.test(value), 'Recurso no compatible');
const word = z.object({ text, start: time, end: time });
const lyric = z.object({ id: text, text, start: time, end: time, words: z.array(word).max(10_000).optional() });
const lyrics = z.array(lyric).max(10_000);
const fit = z.enum(['contain', 'cover']);
const placement = z.object({ x: number, y: number, scale: number, fit: fit.optional() });
const clip = z.object({ id: text, url, start: time, end: time, placement: placement.optional() });
const clips = z.array(clip).max(2_000);
const textStyle = z.object({
  fontFamily: text, fontSize: number, fontWeight: number, color: text, outlineWidth: number,
  outlineColor: text, shadow: z.boolean(), shadowBlur: number, shadowColor: text,
  glow: z.boolean(), glowColor: text, glowIntensity: number,
  position: z.enum(['top', 'center', 'bottom']), align: z.enum(['left', 'center', 'right']),
  transform: z.enum(['none', 'uppercase', 'lowercase']), letterSpacing: number, lineHeight: number,
}).partial();
const titleStyle = z.object({
  fontFamily: text, fontSize: number, fontWeight: number, fontStyle: z.enum(['normal', 'italic']),
  color: text, outlineWidth: number, outlineColor: text, shadow: z.boolean(), shadowBlur: number,
  shadowColor: text, glow: z.boolean(), glowColor: text, glowIntensity: number,
  topOffset: number, uppercase: z.boolean(),
}).partial();
const animationType = z.enum(['fade', 'zoom', 'slide', 'karaoke', 'word', 'line', 'bounce', 'blur']);
const settingsSchema = z.object({
  title: text, artist: text, audioUrl: url, audioName: text, audioDuration: number.nonnegative(),
  lyrics,
  background: z.object({
    type: z.enum(['image', 'images', 'video', 'color', 'gradient']), color: text,
    gradientFrom: text, gradientTo: text, gradientAngle: number, imageUrl: url,
    images: z.array(url).max(2_000), imageMode: z.enum(['auto', 'manual']), imageDuration: number,
    imageClips: clips, photoClips: clips, imageFit: fit, imagePlacement: placement,
    videoUrl: url, blur: number, overlay: number,
  }).partial(),
  text: textStyle, titleStyle,
  animation: z.object({ in: animationType, out: animationType, duration: number, karaokeColor: text, wordStagger: number }).partial(),
  effects: z.object({
    kenburns: z.boolean(), kenburnsIntensity: number, blur: number, overlay: number, overlayColor: text,
    particles: z.boolean(), particlesCount: number.min(0).max(1_000), lightleaks: z.boolean(),
    vignette: z.boolean(), vignetteIntensity: number,
  }).partial(),
  exportConfig: z.object({
    format: z.literal('mp4'), resolution: z.enum(['720p', '1080p', '4k']), fps: z.union([z.literal(30), z.literal(60)]),
    includeAudio: z.boolean(), orientation: z.enum(['landscape', 'portrait']),
  }).partial(),
  syncProgress: z.object({ syncedCount: number, totalCount: number, currentIndex: number, inProgress: z.boolean() }).partial(),
  editingTarget: z.enum(['full', 'reel']),
  reel: z.object({
    start: time.nonnegative(), end: time.nonnegative(), coverUrl: url, showLyrics: z.boolean(), showTitle: z.boolean(),
    lyricsMode: z.enum(['project', 'custom']).optional(), lyrics: lyrics.optional(), lyricsText: text.optional(),
  }),
  visualStyle: z.enum(['default', 'sonceibe', 'rock-galego', 'folk-atlantico', 'ska-ceibe', 'galicia-gaita', 'taberna-galega', 'noite-estrelada', 'papel-e-tinta', 'karaoke-pop', 'minimal', 'neon', 'cinema']),
  showTitle: z.boolean(), showSonCeibeBranding: z.boolean(), createdAt: z.number().finite().nonnegative(), updatedAt: z.number().finite().nonnegative(),
}).partial().required({ title: true }).transform((value): ProjectSettings => ({
  ...defaults, ...value,
  background: { ...defaults.background, ...value.background },
  text: { ...defaults.text, ...value.text },
  titleStyle: { ...defaults.titleStyle!, ...value.titleStyle },
  animation: { ...defaults.animation, ...value.animation },
  effects: { ...defaults.effects, ...value.effects },
  exportConfig: { ...defaults.exportConfig, ...value.exportConfig },
  syncProgress: { ...defaults.syncProgress, ...value.syncProgress, inProgress: false },
}));
const projectSchema = z.object({ id: z.string().min(1).max(200).regex(/^[\w-]+$/), settings: settingsSchema });

export function validateProject(value: unknown): Project {
  const result = projectSchema.safeParse(value);
  if (!result.success) throw new Error('El proyecto contiene ajustes o recursos no válidos. El original se conserva.');
  return result.data;
}

export function parseProjectList(raw: string): Project[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > 1_000) throw new Error('La lista de proyectos no es válida');
  const projects = value.map(validateProject);
  if (new Set(projects.map(project => project.id)).size !== projects.length) throw new Error('Hay identificadores de proyecto duplicados');
  return projects;
}
