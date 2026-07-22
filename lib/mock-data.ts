import type { LyricLine, Project, ProjectSettings, SyncProgress } from './types';
import { createDefaultProjectSettings } from './types';

const defaultSyncProgress: SyncProgress = { syncedCount: 0, totalCount: 0, currentIndex: 0, inProgress: false };

export const mockLyrics: LyricLine[] = [
  { id: 'l1', text: 'En la ciudad que nunca duerme', start: 0, end: 4.2 },
  { id: 'l2', text: 'Las luces brillan en la oscuridad', start: 4.2, end: 8.5 },
  { id: 'l3', text: 'Cada esquina cuenta una historia', start: 8.5, end: 12.8 },
  { id: 'l4', text: 'De amor, sueños y libertad', start: 12.8, end: 17.0 },
  { id: 'l5', text: 'Bailando bajo la luna llena', start: 17.0, end: 21.3 },
  { id: 'l6', text: 'El ritmo nos lleva a volar', start: 21.3, end: 25.5 },
  { id: 'l7', text: 'Y aunque el mundo siga girando', start: 25.5, end: 29.8 },
  { id: 'l8', text: 'Aquí nos quedamos, sin parar', start: 29.8, end: 34.0 },
  { id: 'l9', text: 'La música es nuestra bandera', start: 34.0, end: 38.2 },
  { id: 'l10', text: 'Que ondea al compás del corazón', start: 38.2, end: 42.5 },
  { id: 'l11', text: 'Y cuando llegue la mañana', start: 42.5, end: 46.8 },
  { id: 'l12', text: 'Seguiremos cantando esta canción', start: 46.8, end: 51.0 },
];

export const mockProjects: Project[] = [
  {
    id: 'p1',
    settings: {
      ...createDefaultProjectSettings(),
      title: 'Noche de Verano',
      artist: 'Los Astronautas',
      audioName: 'noche-de-verano.mp3',
      audioDuration: 51,
      lyrics: mockLyrics,
      syncProgress: { syncedCount: 0, totalCount: mockLyrics.length, currentIndex: 0, inProgress: false },
      background: {
        type: 'gradient',
        color: '#0f172a',
        gradientFrom: '#1e3a8a',
        gradientTo: '#ec4899',
        gradientAngle: 135,
        imageUrl: '',
        images: [],
        videoUrl: '',
        blur: 0,
        overlay: 0.35,
      },
      updatedAt: 1753100000000,
      createdAt: 1753013600000,
    },
  },
  {
    id: 'p2',
    settings: {
      ...createDefaultProjectSettings(),
      title: 'Corazón de Acero',
      artist: 'María Fuego',
      audioName: 'corazon-de-acero.mp3',
      audioDuration: 48,
      lyrics: mockLyrics.slice(0, 8),
      syncProgress: { syncedCount: 0, totalCount: 8, currentIndex: 0, inProgress: false },
      background: {
        type: 'color',
        color: '#18181b',
        gradientFrom: '#1e3a8a',
        gradientTo: '#7c3aed',
        gradientAngle: 135,
        imageUrl: '',
        images: [],
        videoUrl: '',
        blur: 0,
        overlay: 0.5,
      },
      updatedAt: 1753146400000,
      createdAt: 1753100000000,
    },
  },
  {
    id: 'p3',
    settings: {
      ...createDefaultProjectSettings(),
      title: 'Proyecto Sin Título',
      artist: '',
      audioName: '',
      audioDuration: 0,
      lyrics: [],
      syncProgress: { ...defaultSyncProgress },
      updatedAt: 1753180000000,
      createdAt: 1753180000000,
    },
  },
];

export const fontOptions = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Impact', value: 'Impact' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS' },
  { label: 'Comic Sans MS', value: 'Comic Sans MS' },
];

export const sampleBackgroundImages = [
  'https://images.pexels.com/photos/1763062/pexels-photo-1763062.jpeg',
  'https://images.pexels.com/photos/1671325/pexels-photo-1671325.jpeg',
  'https://images.pexels.com/photos/1233030/pexels-photo-1233030.jpeg',
  'https://images.pexels.com/photos/1819644/pexels-photo-1819644.jpeg',
];

export const sampleBackgroundVideos = [
  'https://images.pexels.com/photos/18583841/pexels-photo-18583841.jpeg',
  'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg',
];
