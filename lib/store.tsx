'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { captureSnapshot, copyProject, deleteSnapshots, listSnapshots, restoreSnapshotAudio, type ProjectSnapshot } from './project-history';
import { deleteProjectMedia, getSourceVideo, saveSourceVideo, getProjectAudio, saveProjectAudio, LOCAL_AUDIO_URL } from './local-media-storage';
import { useStudioUserId } from './studio-user-context';
import { toast } from 'sonner';
import { hasProjectContent } from './project-content';
import { loadRecentProjects, saveRecentProjects, hasExternalCopy, MAX_RECENT_PROJECTS, type ExternalCopies, type RecentLibrary } from './recent-projects';
import { validateProject } from './project-validation';
import { saveProjectToDevice } from './project/download-current-project';
import { deleteProjectLocalData } from './project-deletion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type {
  Project,
  ProjectSettings,
  LyricLine,
  BackgroundConfig,
  TextStyle,
  AnimationConfig,
  EffectsConfig,
  ExportConfig,
  SyncProgress,
} from './types';
import { createDefaultProjectSettings } from './types';

interface State {
  externalCopies: ExternalCopies;
  draftProjectId: string | null;
  projects: Project[];
  currentProjectId: string | null;
  currentPage: 'home' | 'studio';
  isExportOpen: boolean;
  isSettingsOpen: boolean;
  activeTab: 'text' | 'background' | 'style' | 'animation' | 'effects' | 'lyrics';
  isDirty: boolean;
  undoStack: ProjectSettings[];
  redoStack: ProjectSettings[];
}

type Action =
  | { type: 'LOAD_PROJECTS'; projects: Project[]; copies: ExternalCopies }
  | { type: 'ADMIT_PROJECT'; project: Project; removeIds: string[]; draft?: boolean; external?: boolean; open?: boolean }
  | { type: 'REMOVE_RECENTS'; ids: string[] }
  | { type: 'MARK_EXTERNAL_COPY'; project: Project }
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'RESTORE_PROJECT'; id: string; settings: ProjectSettings }
  | { type: 'SET_PAGE'; page: 'home' | 'studio' }
  | { type: 'OPEN_PROJECT'; id: string }
  | { type: 'CLOSE_PROJECT' }
  | { type: 'CREATE_PROJECT' }
  | { type: 'DELETE_PROJECT'; id: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<ProjectSettings> }
  | { type: 'UPDATE_BACKGROUND'; background: Partial<BackgroundConfig> }
  | { type: 'UPDATE_TEXT'; text: Partial<TextStyle> }
  | { type: 'UPDATE_ANIMATION'; animation: Partial<AnimationConfig> }
  | { type: 'UPDATE_EFFECTS'; effects: Partial<EffectsConfig> }
  | { type: 'UPDATE_EXPORT'; exportConfig: Partial<ExportConfig> }
  | { type: 'SET_LYRICS'; lyrics: LyricLine[] }
  | { type: 'UPDATE_LYRIC'; id: string; patch: Partial<LyricLine> }
  | { type: 'ADD_LYRIC'; line?: Partial<LyricLine> }
  | { type: 'DELETE_LYRIC'; id: string }
  | { type: 'DUPLICATE_LYRIC'; id: string }
  | { type: 'MOVE_LYRIC'; id: string; direction: 'up' | 'down' }
  | { type: 'REPLACE_IN_LYRICS'; find: string; replace: string; matchCase: boolean }
  | { type: 'SHIFT_TIMESTAMPS'; offset: number }
  | { type: 'CLEAR_TIMESTAMPS' }
  | { type: 'SET_SYNC_PROGRESS'; progress: Partial<SyncProgress> }
  | { type: 'SET_TAB'; tab: State['activeTab'] }
  | { type: 'SET_EXPORT_OPEN'; open: boolean }
  | { type: 'SET_SETTINGS_OPEN'; open: boolean }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'MARK_SAVED' };

const MAX_UNDO = 50;
let latestRevision = 0;
function nextProjectRevision(previous: number): number {
  latestRevision = Math.max(Date.now(), latestRevision + 1, previous + 1);
  return latestRevision;
}

const initialState: State = {
  externalCopies: {},
  draftProjectId: null,
  projects: [],
  currentProjectId: null,
  currentPage: 'home',
  isExportOpen: false,
  isSettingsOpen: false,
  activeTab: 'text',
  isDirty: false,
  undoStack: [],
  redoStack: [],
};

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function getCurrentProject(state: State): Project | null {
  return state.projects.find((p) => p.id === state.currentProjectId) ?? null;
}

function applyToSettings(state: State, fn: (s: ProjectSettings) => ProjectSettings): State {
  if (!state.currentProjectId) return state;
  const current = getCurrentProject(state);
  if (!current) return state;
  const newSettings = { ...fn({ ...current.settings }), updatedAt: nextProjectRevision(current.settings.updatedAt) };
  const undoStack = [...state.undoStack, { ...current.settings }].slice(-MAX_UNDO);
  return {
    ...state,
    draftProjectId: state.draftProjectId === current.id && hasProjectContent(newSettings)
      ? null : state.draftProjectId,
    undoStack,
    redoStack: [],
    isDirty: true,
    projects: state.projects.map((p) =>
      p.id === state.currentProjectId ? { ...p, settings: newSettings } : p
    ),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_PROJECTS': return { ...initialState, projects: action.projects, externalCopies: action.copies };
    case 'ADMIT_PROJECT': {
      const ids = new Set(action.removeIds);
      const copies = Object.fromEntries(Object.entries(state.externalCopies).filter(([id]) => !ids.has(id)));
      if (action.external) copies[action.project.id] = { updatedAt: action.project.settings.updatedAt, savedAt: Date.now() };
      return { ...state, projects: [action.project, ...state.projects.filter(project => !ids.has(project.id))], externalCopies: copies,
        ...(action.open === false ? {} : { draftProjectId: action.draft ? action.project.id : null, currentProjectId: action.project.id, currentPage: 'studio' as const, isDirty: false, undoStack: [], redoStack: [] }) };
    }
    case 'REMOVE_RECENTS': return { ...state, projects: state.projects.filter(project => !action.ids.includes(project.id)), externalCopies: Object.fromEntries(Object.entries(state.externalCopies).filter(([id]) => !action.ids.includes(id))) };
    case 'MARK_EXTERNAL_COPY': return { ...state, externalCopies: { ...state.externalCopies, [action.project.id]: { updatedAt: action.project.settings.updatedAt, savedAt: Date.now() } } };
    case 'ADD_PROJECT':
      return { ...state, projects: [action.project, ...state.projects] };
    case 'RESTORE_PROJECT':
      return { ...state, isDirty: true, undoStack: [], redoStack: [], projects: state.projects.map(p => p.id === action.id ? { ...p, settings: { ...action.settings, updatedAt: nextProjectRevision(p.settings.updatedAt) } } : p) };
    case 'SET_PAGE':
      return { ...state, currentPage: action.page };

    case 'OPEN_PROJECT':
      return { ...state, currentProjectId: action.id, currentPage: 'studio', isDirty: false, undoStack: [], redoStack: [] };

    case 'CLOSE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== state.draftProjectId || hasProjectContent(p.settings)),
        draftProjectId: null,
        currentProjectId: null, currentPage: 'home', undoStack: [], redoStack: [], isDirty: false,
      };

    case 'CREATE_PROJECT': {
      const newProject: Project = {
        id: genId(),
        settings: createDefaultProjectSettings(),
      };
      return {
        ...state,
        projects: [newProject, ...state.projects],
        draftProjectId: newProject.id,
        currentProjectId: newProject.id,
        currentPage: 'studio',
        isDirty: false,
        undoStack: [],
        redoStack: [],
      };
    }

    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        currentProjectId:
          state.currentProjectId === action.id ? null : state.currentProjectId,
      };

    case 'UPDATE_SETTINGS':
      return applyToSettings(state, (s) => ({ ...s, ...action.settings }));

    case 'UPDATE_BACKGROUND':
      return applyToSettings(state, (s) => ({
        ...s,
        background: { ...s.background, ...action.background },
      }));

    case 'UPDATE_TEXT':
      return applyToSettings(state, (s) => ({
        ...s,
        text: { ...s.text, ...action.text },
      }));

    case 'UPDATE_ANIMATION':
      return applyToSettings(state, (s) => ({
        ...s,
        animation: { ...s.animation, ...action.animation },
      }));

    case 'UPDATE_EFFECTS':
      return applyToSettings(state, (s) => ({
        ...s,
        effects: { ...s.effects, ...action.effects },
      }));

    case 'UPDATE_EXPORT':
      return applyToSettings(state, (s) => ({
        ...s,
        exportConfig: { ...s.exportConfig, ...action.exportConfig },
      }));

    case 'SET_LYRICS':
      return applyToSettings(state, (s) => ({
        ...s,
        lyrics: action.lyrics,
        syncProgress: {
          ...s.syncProgress,
          totalCount: action.lyrics.length,
          syncedCount: action.lyrics.filter((l) => l.start > 0 || l.end > 0).length,
        },
      }));

    case 'UPDATE_LYRIC':
      return applyToSettings(state, (s) => ({
        ...s,
        lyrics: s.lyrics.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)),
      }));

    case 'ADD_LYRIC': {
      return applyToSettings(state, (s) => {
        const last = s.lyrics[s.lyrics.length - 1];
        const newLine: LyricLine = {
          id: genId(),
          text: action.line?.text ?? '',
          start: action.line?.start ?? last?.end ?? 0,
          end: action.line?.end ?? (last?.end ?? 0) + 4,
        };
        return {
          ...s,
          lyrics: [...s.lyrics, newLine],
          syncProgress: { ...s.syncProgress, totalCount: s.lyrics.length + 1 },
        };
      });
    }

    case 'DELETE_LYRIC':
      return applyToSettings(state, (s) => ({
        ...s,
        lyrics: s.lyrics.filter((l) => l.id !== action.id),
        syncProgress: { ...s.syncProgress, totalCount: Math.max(0, s.lyrics.length - 1) },
      }));

    case 'DUPLICATE_LYRIC':
      return applyToSettings(state, (s) => {
        const idx = s.lyrics.findIndex((l) => l.id === action.id);
        if (idx === -1) return s;
        const orig = s.lyrics[idx];
        const copy: LyricLine = {
          id: genId(),
          text: orig.text,
          start: orig.end,
          end: orig.end + (orig.end - orig.start),
        };
        const lyrics = [...s.lyrics];
        lyrics.splice(idx + 1, 0, copy);
        return { ...s, lyrics, syncProgress: { ...s.syncProgress, totalCount: lyrics.length } };
      });

    case 'MOVE_LYRIC':
      return applyToSettings(state, (s) => {
        const idx = s.lyrics.findIndex((l) => l.id === action.id);
        if (idx === -1) return s;
        const target = action.direction === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= s.lyrics.length) return s;
        const lyrics = [...s.lyrics];
        [lyrics[idx], lyrics[target]] = [lyrics[target], lyrics[idx]];
        return { ...s, lyrics };
      });

    case 'REPLACE_IN_LYRICS': {
      return applyToSettings(state, (s) => {
        const flags = action.matchCase ? 'g' : 'gi';
        const regex = new RegExp(escapeRegex(action.find), flags);
        const lyrics = s.lyrics.map((l) => ({
          ...l,
          text: l.text.replace(regex, action.replace),
        }));
        return { ...s, lyrics };
      });
    }

    case 'SHIFT_TIMESTAMPS':
      return applyToSettings(state, (s) => ({
        ...s,
        lyrics: s.lyrics.map((l) => ({
          ...l,
          start: Math.max(0, l.start + action.offset),
          end: Math.max(0, l.end + action.offset),
        })),
      }));

    case 'CLEAR_TIMESTAMPS':
      return applyToSettings(state, (s) => ({
        ...s,
        lyrics: s.lyrics.map((l) => ({ ...l, start: 0, end: 0 })),
        syncProgress: { ...s.syncProgress, syncedCount: 0, currentIndex: 0, inProgress: false },
      }));

    case 'SET_SYNC_PROGRESS':
      return applyToSettings(state, (s) => ({
        ...s,
        syncProgress: { ...s.syncProgress, ...action.progress },
      }));

    case 'SET_TAB':
      return { ...state, activeTab: action.tab };

    case 'SET_EXPORT_OPEN':
      return { ...state, isExportOpen: action.open };

    case 'SET_SETTINGS_OPEN':
      return { ...state, isSettingsOpen: action.open };

    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const current = getCurrentProject(state);
      if (!current) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      const redoStack = [...state.redoStack, { ...current.settings }].slice(-MAX_UNDO);
      const undoStack = state.undoStack.slice(0, -1);
      return {
        ...state,
        undoStack,
        redoStack,
        isDirty: true,
        projects: state.projects.map((p) =>
          p.id === state.currentProjectId ? { ...p, settings: { ...prev } } : p
        ),
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const current = getCurrentProject(state);
      if (!current) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      const undoStack = [...state.undoStack, { ...current.settings }].slice(-MAX_UNDO);
      const redoStack = state.redoStack.slice(0, -1);
      return {
        ...state,
        undoStack,
        redoStack,
        isDirty: true,
        projects: state.projects.map((p) =>
          p.id === state.currentProjectId ? { ...p, settings: { ...next } } : p
        ),
      };
    }

    case 'MARK_SAVED':
      return { ...state, isDirty: false };

    default:
      return state;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function snapshotReason(action: Action): string | null {
  switch (action.type) {
    case 'SET_LYRICS': case 'CLEAR_TIMESTAMPS': case 'SHIFT_TIMESTAMPS':
    case 'REPLACE_IN_LYRICS': return 'Antes de cambiar o sincronizar la letra';
    case 'UPDATE_LYRIC': case 'ADD_LYRIC': case 'DELETE_LYRIC':
    case 'MOVE_LYRIC': case 'DUPLICATE_LYRIC': return 'Antes de editar la letra';
    case 'UPDATE_BACKGROUND': return 'Antes de cambiar fotos o fondo';
    case 'UPDATE_TEXT': case 'UPDATE_EFFECTS': case 'UPDATE_ANIMATION': return 'Antes de cambiar el estilo';
    case 'UPDATE_SETTINGS':
      return action.settings.visualStyle || action.settings.background || action.settings.lyrics || action.settings.titleStyle
        ? 'Antes de cambiar el proyecto' : null;
    default: return null;
  }
}

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface StoreContextValue extends State {
  historyError: string | null;
  audioRevision: number;
  saveVersion: (reason?: string) => Promise<void>;
  getVersions: () => Promise<ProjectSnapshot[]>;
  restoreVersion: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<boolean>;
  currentProject: Project | null;
  autoSaveStatus: AutoSaveStatus;
  lastAutoSavedAt: number | null;
  dispatch: React.Dispatch<Action>;
  updateSettings: (s: Partial<ProjectSettings>) => void;
  updateBackground: (b: Partial<BackgroundConfig>) => void;
  updateText: (t: Partial<TextStyle>) => void;
  updateAnimation: (a: Partial<AnimationConfig>) => void;
  updateEffects: (e: Partial<EffectsConfig>) => void;
  updateExport: (e: Partial<ExportConfig>) => void;
  setLyrics: (l: LyricLine[]) => void;
  updateLyric: (id: string, patch: Partial<LyricLine>) => void;
  addLyric: (line?: Partial<LyricLine>) => void;
  deleteLyric: (id: string) => void;
  duplicateLyric: (id: string) => void;
  moveLyric: (id: string, direction: 'up' | 'down') => void;
  replaceInLyrics: (find: string, replace: string, matchCase: boolean) => void;
  shiftTimestamps: (offset: number) => void;
  clearTimestamps: () => void;
  setSyncProgress: (progress: Partial<SyncProgress>) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
  openProject: (id: string) => void;
  closeProject: () => void;
  createProject: (title?: string) => Promise<boolean>;
  importProject: (project: Project, audioFile: File | null, external?: boolean) => Promise<boolean>;
  saveProjectFile: (id?: string) => Promise<boolean>;
  trimRecentProjects: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setPage: (page: 'home' | 'studio') => void;
  setTab: (tab: State['activeTab']) => void;
  setExportOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

interface StoreProviderProps {
  children: React.ReactNode;
  storageKey: string;
  migrateLegacy?: boolean;
}

export function StoreProvider({ children, storageKey, migrateLegacy = false }: StoreProviderProps) {
  const userId = useStudioUserId();
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [audioRevision, setAudioRevision] = useState(0);
  const historyQueue = useRef<Promise<void>>(Promise.resolve());
  const lastCapture = useRef<{ projectId: string; reason: string; at: number } | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<RecentLibrary | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [recoveryDownloaded, setRecoveryDownloaded] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [state, rawDispatch] = useReducer(reducer, initialState);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const persistedIds = useRef(new Set<string>());
  const deletedIds = useRef(new Set<string>());
  const admissionBusy = useRef(false);
  const [persistenceEpoch, resumePersistence] = useReducer((value: number) => value + 1, 0);
  const saveBusy = useRef(false);
  const [savingFile, setSavingFile] = useState(false);
  const [eviction, setEviction] = useState<{ project: Project; resolve: (remove: boolean) => void } | null>(null);
  const [downloadConfirmation, setDownloadConfirmation] = useState<{ title: string; resolve: (saved: boolean) => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let legacy: Storage | undefined;
    try { legacy = window.localStorage; } catch { /* IndexedDB may still be available. */ }
    void loadRecentProjects(storageKey, legacy, migrateLegacy).then(result => {
      if (cancelled) return;
      persistedIds.current = new Set(result.projects.map(project => project.id));
      rawDispatch({ type: 'LOAD_PROJECTS', projects: result.projects, copies: result.copies });
      setLoaded(result); setRecovery(result.recovery); setHydrated(true);
    }).catch(() => {
      if (!cancelled) { setRecovery(true); setHydrated(true); setRecoveryError('No se puede acceder al almacenamiento. Tus datos no se han sobrescrito.'); }
    });
    return () => { cancelled = true; };
  }, [storageKey, migrateLegacy]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const queueVersion = useCallback((project: Project, reason: string) => {
    const captured = structuredClone(project);
    const task = historyQueue.current.then(() => captureSnapshot(storageKey, userId, captured, reason));
    historyQueue.current = task.catch(() => {});
    return task.then(() => setHistoryError(null), error => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la versión';
      setHistoryError(message);
      throw error;
    });
  }, [storageKey, userId]);

  const dispatch = useCallback((action: Action) => {
    const current = getCurrentProject(stateRef.current);
    const syncStarting = action.type === 'UPDATE_SETTINGS' && action.settings.syncProgress?.inProgress === true && action.settings.syncProgress.currentIndex === 0 && Boolean(action.settings.lyrics);
    const duringSync = current?.settings.syncProgress.inProgress && action.type === 'UPDATE_SETTINGS' && Boolean(action.settings.lyrics) && !syncStarting;
    const reason = duringSync ? null : syncStarting ? 'Antes de resincronizar la letra' : snapshotReason(action);
    if (current && reason && hasProjectContent(current.settings)) {
      const last = lastCapture.current;
      // Coalesce continuous edits; destructive/bulk actions always get a checkpoint.
      const force = syncStarting || ['SET_LYRICS', 'CLEAR_TIMESTAMPS', 'SHIFT_TIMESTAMPS', 'REPLACE_IN_LYRICS'].includes(action.type)
        || (action.type === 'UPDATE_SETTINGS' && Boolean(action.settings.visualStyle));
      if (force || !last || last.projectId !== current.id || last.reason !== reason || Date.now() - last.at > 60_000) {
        lastCapture.current = { projectId: current.id, reason, at: Date.now() };
        void queueVersion(current, reason).catch(() => {
          lastCapture.current = null;
          toast.error('No se ha podido guardar la versión anterior. Revisa Versiones locales.');
        });
      }
    }
    rawDispatch(action);
  }, [queueVersion, storageKey]);

  const saveVersion = useCallback(async (reason = 'Versión manual') => {
    const project = getCurrentProject(stateRef.current);
    if (project) await queueVersion(project, reason);
  }, [queueVersion]);
  const getVersions = useCallback(async () => {
    const id = stateRef.current.currentProjectId;
    await historyQueue.current;
    return id ? listSnapshots(storageKey, id) : [];
  }, [storageKey]);
  const restoreVersion = useCallback(async (id: string) => {
    const project = getCurrentProject(stateRef.current);
    if (!project) return;
    await historyQueue.current;
    const snapshot = (await listSnapshots(storageKey, project.id)).find(item => item.id === id);
    if (!snapshot) throw new Error('Esta versión ya no está disponible');
    await queueVersion(project, 'Antes de restaurar una versión');
    await restoreSnapshotAudio(userId, project.id, snapshot);
    rawDispatch({ type: 'RESTORE_PROJECT', id: project.id, settings: { ...structuredClone(snapshot.settings), updatedAt: Date.now(), syncProgress: { ...snapshot.settings.syncProgress, inProgress: false } } });
    setAudioRevision(revision => revision + 1);
    lastCapture.current = null;
  }, [queueVersion, storageKey, userId]);
  const saveProjectFile = useCallback(async (id?: string) => {
    if (saveBusy.current) return false;
    const project = stateRef.current.projects.find(item => item.id === (id ?? stateRef.current.currentProjectId));
    if (!project) return false;
    saveBusy.current = true; setSavingFile(true);
    const snapshot = structuredClone(project);
    try {
      const method = await saveProjectToDevice(snapshot, () => getProjectAudio(userId, snapshot.id), userId);
      if (method === 'download') {
        const confirmed = await new Promise<boolean>(resolve => setDownloadConfirmation({ title: snapshot.settings.title, resolve }));
        if (!confirmed) return false;
      }
      rawDispatch({ type: 'MARK_EXTERNAL_COPY', project: snapshot });
      toast.success('Copia .scs guardada en tu equipo');
      return true;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error(error instanceof Error ? error.message : 'No se pudo guardar el proyecto');
      return false;
    } finally { saveBusy.current = false; setSavingFile(false); }
  }, [userId]);

  const requestCapacity = useCallback(async (limit: number): Promise<string[] | null> => {
    let remaining = [...stateRef.current.projects];
    const removeIds: string[] = [];
    while (remaining.length > limit) {
      const oldest = remaining[remaining.length - 1];
      if (!hasExternalCopy(oldest, stateRef.current.externalCopies)) {
        const approved = await new Promise<boolean>(resolve => setEviction({ project: oldest, resolve }));
        if (!approved) return null;
      }
      removeIds.push(oldest.id);
      remaining = remaining.filter(project => project.id !== oldest.id);
    }
    return removeIds;
  }, []);

  const commitAdmission = useCallback(async (project: Project, removeIds: string[], options: { draft?: boolean; external?: boolean; open?: boolean } = {}) => {
    const projects = [project, ...stateRef.current.projects.filter(item => !removeIds.includes(item.id))];
    const copies = { ...stateRef.current.externalCopies };
    if (options.external) copies[project.id] = { updatedAt: project.settings.updatedAt, savedAt: Date.now() };
    const retained = projects.filter(item => !(options.draft && item.id === project.id && !hasProjectContent(item.settings)));
    const task = persistenceQueue.current.then(() => saveRecentProjects(storageKey, retained, copies));
    persistenceQueue.current = task.catch(() => {});
    await task;
    // The new recent list is durable before the old item disappears from the UI.
    rawDispatch({ type: 'ADMIT_PROJECT', project, removeIds, ...options });
  }, [storageKey]);

  const trimRecentProjects = useCallback(async () => {
    if (admissionBusy.current) return;
    admissionBusy.current = true;
    try {
      const ids = await requestCapacity(MAX_RECENT_PROJECTS);
      if (ids) {
        const projects = stateRef.current.projects.filter(project => !ids.includes(project.id));
        const task = persistenceQueue.current.then(() => saveRecentProjects(storageKey, projects, stateRef.current.externalCopies));
        persistenceQueue.current = task.catch(() => {});
        await task;
        rawDispatch({ type: 'REMOVE_RECENTS', ids });
      }
    } catch { toast.error('No se pudo actualizar recientes. Los proyectos se conservan.'); }
    finally { admissionBusy.current = false; resumePersistence(); }
  }, [requestCapacity, storageKey]);

  const importProject = useCallback(async (input: Project, audioFile: File | null, external = true) => {
    if (admissionBusy.current) return false;
    const project = validateProject(input);
    // Each opened file gets an independent cache entry and media keys.
    project.id = genId();
    admissionBusy.current = true;
    try {
      const ids = await requestCapacity(MAX_RECENT_PROJECTS - 1);
      if (!ids) return false;
      if (project.settings.background.videoUrl) {
        const footage = await getSourceVideo(userId, input.id, project.settings.background.videoUrl);
        if (!footage) throw new Error('Falta el vídeo original. Guarda una copia .scs que incluya el vídeo.');
        project.settings.background.videoUrl = await saveSourceVideo(userId, project.id, footage);
      }
      if (audioFile) { await saveProjectAudio(userId, project.id, audioFile); project.settings.audioUrl = LOCAL_AUDIO_URL; project.settings.audioName = audioFile.name; }
      await commitAdmission(project, ids, { external: external && (!project.settings.audioName || !!audioFile) });
      return true;
    } catch (error) {
      await deleteProjectMedia(userId, project.id).catch(() => {});
      throw error;
    } finally { admissionBusy.current = false; resumePersistence(); }
  }, [requestCapacity, commitAdmission, userId]);

  const duplicateProject = useCallback(async (id: string) => {
    if (admissionBusy.current) return false;
    const project = stateRef.current.projects.find(item => item.id === id);
    if (!project) throw new Error('El proyecto ya no existe');
    admissionBusy.current = true;
    let copiedId: string | null = null;
    try {
      const ids = await requestCapacity(MAX_RECENT_PROJECTS - 1);
      if (!ids) return false;
      const copy = await copyProject(userId, project, stateRef.current.projects);
      copiedId = copy.id;
      await commitAdmission(copy, ids, { open: false });
      return true;
    } catch (error) {
      if (copiedId) await deleteProjectMedia(userId, copiedId).catch(() => {});
      throw error;
    } finally { admissionBusy.current = false; resumePersistence(); }
  }, [requestCapacity, commitAdmission, userId]);

  const savedProjects = useMemo(() => state.projects.filter(
    (project) => project.id !== state.draftProjectId || hasProjectContent(project.settings)
  ), [state.projects, state.draftProjectId]);

  useEffect(() => {
    if (!hydrated) return;
    if (admissionBusy.current) return;
    if (recovery) { setAutoSaveStatus('error'); return; }
    setAutoSaveStatus('saving');
    let cancelled = false;
    const task = persistenceQueue.current.then(async () => {
      await saveRecentProjects(storageKey, savedProjects, state.externalCopies);
      const ids = new Set(savedProjects.map(project => project.id));
      const removed = [...persistedIds.current].filter(id => !ids.has(id));
      persistedIds.current = ids;
      await historyQueue.current;
      for (const id of removed) {
        if (stateRef.current.projects.some(project => project.id === id)) continue;
        if (deletedIds.current.delete(id)) await deleteProjectLocalData(userId, id);
        else await deleteProjectMedia(userId, id); // Cache eviction never touches a user's PC folder.
        await deleteSnapshots(storageKey, id);
      }
    });
    persistenceQueue.current = task.catch(() => {});
    void task.then(() => { if (!cancelled) { setLastAutoSavedAt(Date.now()); setAutoSaveStatus('saved'); } }, () => { if (!cancelled) setAutoSaveStatus('error'); });
    return () => { cancelled = true; };
  }, [savedProjects, state.externalCopies, storageKey, recovery, hydrated, userId, persistenceEpoch]);

  useEffect(() => {
    if (!hydrated || (autoSaveStatus !== 'saving' && autoSaveStatus !== 'error')) return;
    const protectPendingChanges = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protectPendingChanges);
    return () => window.removeEventListener('beforeunload', protectPendingChanges);
  }, [hydrated, autoSaveStatus]);

  const currentProject =
    state.projects.find((p) => p.id === state.currentProjectId) ?? null;

  const updateSettings = useCallback(
    (s: Partial<ProjectSettings>) => dispatch({ type: 'UPDATE_SETTINGS', settings: s }),
    []
  );
  const updateBackground = useCallback(
    (b: Partial<BackgroundConfig>) => dispatch({ type: 'UPDATE_BACKGROUND', background: b }),
    []
  );
  const updateText = useCallback(
    (t: Partial<TextStyle>) => dispatch({ type: 'UPDATE_TEXT', text: t }),
    []
  );
  const updateAnimation = useCallback(
    (a: Partial<AnimationConfig>) => dispatch({ type: 'UPDATE_ANIMATION', animation: a }),
    []
  );
  const updateEffects = useCallback(
    (e: Partial<EffectsConfig>) => dispatch({ type: 'UPDATE_EFFECTS', effects: e }),
    []
  );
  const updateExport = useCallback(
    (e: Partial<ExportConfig>) => dispatch({ type: 'UPDATE_EXPORT', exportConfig: e }),
    []
  );
  const setLyrics = useCallback(
    (l: LyricLine[]) => dispatch({ type: 'SET_LYRICS', lyrics: l }),
    []
  );
  const updateLyric = useCallback(
    (id: string, patch: Partial<LyricLine>) => dispatch({ type: 'UPDATE_LYRIC', id, patch }),
    []
  );
  const addLyric = useCallback(
    (line?: Partial<LyricLine>) => dispatch({ type: 'ADD_LYRIC', line }),
    []
  );
  const deleteLyric = useCallback(
    (id: string) => dispatch({ type: 'DELETE_LYRIC', id }),
    []
  );
  const duplicateLyric = useCallback(
    (id: string) => dispatch({ type: 'DUPLICATE_LYRIC', id }),
    []
  );
  const moveLyric = useCallback(
    (id: string, direction: 'up' | 'down') => dispatch({ type: 'MOVE_LYRIC', id, direction }),
    []
  );
  const replaceInLyrics = useCallback(
    (find: string, replace: string, matchCase: boolean) =>
      dispatch({ type: 'REPLACE_IN_LYRICS', find, replace, matchCase }),
    []
  );
  const shiftTimestamps = useCallback(
    (offset: number) => dispatch({ type: 'SHIFT_TIMESTAMPS', offset }),
    []
  );
  const clearTimestamps = useCallback(
    () => dispatch({ type: 'CLEAR_TIMESTAMPS' }),
    []
  );
  const setSyncProgress = useCallback(
    (progress: Partial<SyncProgress>) => dispatch({ type: 'SET_SYNC_PROGRESS', progress }),
    []
  );
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const markSaved = useCallback(() => dispatch({ type: 'MARK_SAVED' }), []);
  const openProject = useCallback(
    (id: string) => dispatch({ type: 'OPEN_PROJECT', id }),
    []
  );
  const closeProject = useCallback(() => dispatch({ type: 'CLOSE_PROJECT' }), []);
  const createProject = useCallback(async (title?: string) => {
    if (admissionBusy.current) return false;
    admissionBusy.current = true;
    try {
      const ids = await requestCapacity(MAX_RECENT_PROJECTS - 1);
      if (!ids) return false;
      const project = { id: genId(), settings: { ...createDefaultProjectSettings(), ...(title ? { title } : {}) } };
      await commitAdmission(project, ids, { draft: true });
      return true;
    } finally { admissionBusy.current = false; resumePersistence(); }
  }, [requestCapacity, commitAdmission]);
  const deleteProject = useCallback(
    async (id: string) => {
      if (admissionBusy.current) throw new Error('Espera a que termine la operación actual');
      admissionBusy.current = true;
      try {
        const projects = stateRef.current.projects.filter(project => project.id !== id);
        const task = persistenceQueue.current.then(() => saveRecentProjects(storageKey, projects, stateRef.current.externalCopies));
        persistenceQueue.current = task.catch(() => {});
        await task;
        deletedIds.current.add(id);
        dispatch({ type: 'DELETE_PROJECT', id });
      } finally { admissionBusy.current = false; resumePersistence(); }
    },
    [storageKey, dispatch]
  );
  const setPage = useCallback(
    (page: 'home' | 'studio') => dispatch({ type: 'SET_PAGE', page }),
    []
  );
  const setTab = useCallback(
    (tab: State['activeTab']) => dispatch({ type: 'SET_TAB', tab }),
    []
  );
  const setExportOpen = useCallback(
    (open: boolean) => dispatch({ type: 'SET_EXPORT_OPEN', open }),
    []
  );
  const setSettingsOpen = useCallback(
    (open: boolean) => dispatch({ type: 'SET_SETTINGS_OPEN', open }),
    []
  );

  const value: StoreContextValue = {
    importProject,
    saveProjectFile,
    trimRecentProjects,
    historyError,
    audioRevision,
    saveVersion,
    getVersions,
    restoreVersion,
    duplicateProject,
    ...state,
    projects: savedProjects,
    currentProject,
    autoSaveStatus,
    lastAutoSavedAt,
    dispatch,
    updateSettings,
    updateBackground,
    updateText,
    updateAnimation,
    updateEffects,
    updateExport,
    setLyrics,
    updateLyric,
    addLyric,
    deleteLyric,
    duplicateLyric,
    moveLyric,
    replaceInLyrics,
    shiftTimestamps,
    clearTimestamps,
    setSyncProgress,
    undo,
    redo,
    markSaved,
    openProject,
    closeProject,
    createProject,
    deleteProject,
    setPage,
    setTab,
    setExportOpen,
    setSettingsOpen,
  };

  if (!hydrated) return <main className="p-6" role="status">Cargando proyectos recientes…</main>;
  if (recovery) return <main className="mx-auto max-w-xl space-y-4 p-6" role="alert">
    <h1 className="text-xl font-semibold">Tus datos necesitan recuperación</h1>
    <p>No se pudieron leer los proyectos guardados. Hemos detenido el autoguardado para conservar el original.</p>
    <p>{loaded?.backup ? `Hay una copia válida con ${loaded.backup.length} proyectos. Descarga primero el original para conservarlo y después restaura la copia.` : 'Descarga el original para conservarlo. Después puedes iniciar una lista nueva y abrir tus archivos .scs desde la portada.'}</p>
    <button className="rounded border px-4 py-2" disabled={!loaded?.raw} onClick={() => {
      const url = URL.createObjectURL(new Blob([loaded!.raw!], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'sonceibe-datos-para-recuperar.json'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); setRecoveryDownloaded(true);
    }}>Descargar datos originales</button>
    <button className="ml-2 rounded border px-4 py-2" disabled={!recoveryDownloaded} onClick={async () => {
      try {
        const projects = loaded?.backup ?? [];
        await saveRecentProjects(storageKey, projects, {}, true);
        localStorage.removeItem(storageKey); localStorage.removeItem(`${storageKey}:backup`);
        persistedIds.current = new Set(projects.map(project => project.id));
        rawDispatch({ type: 'LOAD_PROJECTS', projects, copies: {} });
        setRecovery(false);
      } catch { setRecoveryError('No se pudo recuperar el almacenamiento. El original sigue protegido. Libera espacio y vuelve a intentarlo.'); }
    }}>{loaded?.backup ? 'Restaurar copia válida' : 'Empezar con lista vacía'}</button>
    <button className="block underline" onClick={() => window.location.reload()}>Reintentar lectura</button>
    {recoveryError && <p>{recoveryError}</p>}
  </main>;
  return <StoreContext.Provider value={value}>{children}
    <Dialog open={!!eviction} onOpenChange={open => { if (!open && eviction) { eviction.resolve(false); setEviction(null); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Conservar cinco proyectos recientes</DialogTitle><DialogDescription>«{eviction?.project.settings.title}» es el proyecto más antiguo y tiene cambios sin una copia externa confirmada. Guárdalo o descártalo antes de retirarlo del navegador. Sus archivos del PC se conservan.</DialogDescription></DialogHeader>
        <Button disabled={savingFile} onClick={async () => {
          if (!eviction) return;
          const request = eviction;
          if (await saveProjectFile(request.project.id)) { setEviction(null); request.resolve(true); }
        }}>{savingFile ? 'Guardando…' : 'Guardar .scs y retirar de recientes'}</Button>
        <Button variant="destructive" disabled={savingFile} onClick={() => { if (eviction) { eviction.resolve(true); setEviction(null); } }}>Descartar cambios y retirar de recientes</Button>
        <Button variant="outline" onClick={() => { if (eviction) { eviction.resolve(false); setEviction(null); } }}>Cancelar</Button>
      </DialogContent>
    </Dialog>
    <Dialog open={!!downloadConfirmation} onOpenChange={open => { if (!open && downloadConfirmation) { downloadConfirmation.resolve(false); setDownloadConfirmation(null); } }}>
      <DialogContent className="z-[80]">
        <DialogHeader><DialogTitle>Confirmar copia del proyecto</DialogTitle><DialogDescription>Se ha solicitado la descarga de «{downloadConfirmation?.title}». Comprueba que el archivo .scs está guardado en tu equipo antes de confirmar. Puedes volver a abrirlo desde Studio.</DialogDescription></DialogHeader>
        <Button onClick={() => { if (downloadConfirmation) { downloadConfirmation.resolve(true); setDownloadConfirmation(null); } }}>Sí, guardé la copia</Button>
        <Button variant="outline" onClick={() => { if (downloadConfirmation) { downloadConfirmation.resolve(false); setDownloadConfirmation(null); } }}>Volver sin confirmar</Button>
      </DialogContent>
    </Dialog>
  </StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
