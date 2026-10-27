'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { captureSnapshot, copyProject, deleteSnapshots, listSnapshots, restoreSnapshotAudio, type ProjectSnapshot } from './project-history';
import { deleteProjectMedia } from './local-media-storage';
import { useStudioUserId } from './studio-user-context';
import { toast } from 'sonner';
import { hasProjectContent } from './project-content';
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
  draftProjectId: string | null;
  projects: Project[];
  currentProjectId: string | null;
  currentPage: 'home' | 'studio';
  isExportOpen: boolean;
  isSettingsOpen: boolean;
  activeTab: 'text' | 'background' | 'animation' | 'effects' | 'lyrics';
  isDirty: boolean;
  undoStack: ProjectSettings[];
  redoStack: ProjectSettings[];
}

type Action =
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

const LEGACY_STORAGE_KEY = 'sonceibe-projects-v1';
const MAX_UNDO = 50;

const initialState: State = {
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
  const newSettings = fn({ ...current.settings, updatedAt: Date.now() });
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
    case 'ADD_PROJECT':
      return { ...state, projects: [action.project, ...state.projects] };
    case 'RESTORE_PROJECT':
      return { ...state, isDirty: true, undoStack: [], redoStack: [], projects: state.projects.map(p => p.id === action.id ? { ...p, settings: action.settings } : p) };
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
  duplicateProject: (id: string) => Promise<void>;
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
  createProject: () => void;
  deleteProject: (id: string) => void;
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
  const [state, rawDispatch] = useReducer(reducer, initialState, (init) => {
    if (typeof window === 'undefined') return init;

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const projects = JSON.parse(raw) as Project[];
        if (Array.isArray(projects)) return { ...init, projects };
      }

      if (migrateLegacy) {
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
          const legacyProjects = JSON.parse(legacyRaw) as Project[];
          if (Array.isArray(legacyProjects)) {
            localStorage.setItem(storageKey, JSON.stringify(legacyProjects));
            return { ...init, projects: legacyProjects };
          }
        }
      }
    } catch {
      // Si un almacenamiento local está dañado, comenzamos con una lista vacía.
    }

    return init;
  });

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
    if (action.type === 'DELETE_PROJECT') {
      const task = historyQueue.current.then(() => deleteSnapshots(storageKey, action.id));
      historyQueue.current = task.catch(() => { toast.error('No se pudo eliminar el historial local'); });
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
  const duplicateProject = useCallback(async (id: string) => {
    const project = stateRef.current.projects.find(item => item.id === id);
    if (!project) throw new Error('El proyecto ya no existe');
    const copy = await copyProject(userId, project, stateRef.current.projects);
    try {
      localStorage.setItem(storageKey, JSON.stringify([copy, ...stateRef.current.projects]));
      rawDispatch({ type: 'ADD_PROJECT', project: copy });
    } catch (error) {
      await deleteProjectMedia(userId, copy.id);
      throw error;
    }
  }, [storageKey, userId]);

  const savedProjects = useMemo(() => state.projects.filter(
    (project) => project.id !== state.draftProjectId || hasProjectContent(project.settings)
  ), [state.projects, state.draftProjectId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setAutoSaveStatus('saving');
    try {
      localStorage.setItem(storageKey, JSON.stringify(savedProjects));
      setLastAutoSavedAt(Date.now());
      setAutoSaveStatus('saved');
    } catch {
      setAutoSaveStatus('error');
      // El guardado explícito sigue disponible si el navegador agota la cuota local.
    }
  }, [savedProjects, storageKey]);

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
  const createProject = useCallback(() => dispatch({ type: 'CREATE_PROJECT' }), []);
  const deleteProject = useCallback(
    (id: string) => dispatch({ type: 'DELETE_PROJECT', id }),
    []
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

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
