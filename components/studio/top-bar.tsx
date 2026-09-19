'use client';

import {
  Music,
  Home,
  Settings,
  Download,
  Undo2,
  Redo2,
  Upload,
  FileText,
  Hand,
  LogOut,
  HardDrive,
  MoreVertical,
  Save,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { useStudioUserId } from '@/lib/studio-user-context';
import { getProjectAudio, LOCAL_AUDIO_URL, saveProjectAudio } from '@/lib/local-media-storage';
import { downloadCurrentProject } from '@/lib/project/download-current-project';
import { isDefaultProjectTitle, PENDING_PROJECT_TITLE_KEY, titleFromAudioFilename } from '@/lib/project-title';
import {
  cleanLyricsText,
  cleanParsedLyrics,
  parseTxtLyrics,
  parseLrcLyrics,
  readLyricsFile,
} from '@/lib/lyrics-utils';
import { LyricsSyncDialog } from './lyrics/lyrics-sync-dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export function TopBar() {
  const {
    currentProject,
    closeProject,
    setExportOpen,
    setSettingsOpen,
    updateSettings,
    setLyrics,
    setTab,
    undo,
    redo,
    undoStack,
    redoStack,
  } = useStore();
  const userId = useStudioUserId();
  const audio = useAudioEngineContext();
  const [lyricsSyncOpen, setLyricsSyncOpen] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentProject) return;
    const pendingTitle = sessionStorage.getItem(PENDING_PROJECT_TITLE_KEY)?.trim();
    if (!pendingTitle) return;
    sessionStorage.removeItem(PENDING_PROJECT_TITLE_KEY);
    updateSettings({ title: pendingTitle });
  }, [currentProject?.id, updateSettings]);

  const handleExport = () => {
    setExportOpen(true);
  };

  const handleSaveProject = useCallback(async () => {
    if (!currentProject) return;
    try {
      const audioFile = await getProjectAudio(userId, currentProject.id);
      await downloadCurrentProject(currentProject, undefined, audioFile);
      toast.success('Proyecto .scs guardado con su audio');
    } catch (error) {
      console.error('Failed to save project file:', error);
      toast.error('No se pudo guardar el proyecto .scs');
    }
  }, [currentProject, userId]);

  useEffect(() => {
    const save = () => void handleSaveProject();
    window.addEventListener('sonceibe:save-project', save);
    return () => window.removeEventListener('sonceibe:save-project', save);
  }, [handleSaveProject]);

  const handleLogout = async () => {
    try {
      await fetch('/api/studio-auth/logout', { method: 'POST' });
    } finally {
      window.location.replace('/access');
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    try {
      await audio.loadFile(file);
      await saveProjectAudio(userId, currentProject.id, file);
      const derivedTitle = isDefaultProjectTitle(currentProject.settings.title)
        ? titleFromAudioFilename(file.name)
        : undefined;
      updateSettings({
        audioName: file.name,
        audioUrl: LOCAL_AUDIO_URL,
        ...(derivedTitle ? { title: derivedTitle } : {}),
      });
      toast.success(`MP3 cargado y guardado en este equipo: ${file.name}`);
    } catch (error) {
      console.error('Failed to load or persist audio:', error);
      updateSettings({ audioName: file.name, audioUrl: '' });
      toast.error('El MP3 se ha abierto, pero no se pudo guardar de forma permanente en este navegador');
    } finally {
      e.target.value = '';
    }
  };

  const handleLyricsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imported = await readLyricsFile(file);
      const duration = audio.duration || currentProject?.settings.audioDuration || 0;
      const isLrc = imported.format === 'lrc';

      let parsedLyrics;
      let removedLines = 0;
      let removedChordMarks = 0;

      if (isLrc) {
        const cleaned = cleanParsedLyrics(parseLrcLyrics(imported.text));
        parsedLyrics = cleaned.lyrics;
        removedLines = cleaned.removedLines;
        removedChordMarks = cleaned.removedChordMarks;
      } else {
        const cleaned = cleanLyricsText(imported.text);
        parsedLyrics = parseTxtLyrics(cleaned.text, duration);
        removedLines = cleaned.removedLines;
        removedChordMarks = cleaned.removedChordMarks;
      }

      const sungLines = parsedLyrics.filter((line) => line.text.trim().length > 0);
      if (sungLines.length === 0) {
        toast.error('El archivo no contiene líneas de letra utilizables');
        return;
      }

      setLyrics(parsedLyrics);
      setTab('lyrics');

      const formatLabel = imported.format.toUpperCase();
      const cleanupCount = removedLines + removedChordMarks;
      const cleanupMessage = cleanupCount > 0
        ? ` · ${removedLines} línea${removedLines !== 1 ? 's' : ''} y ${removedChordMarks} acorde${removedChordMarks !== 1 ? 's' : ''} eliminados`
        : '';

      if (isLrc) {
        toast.success(`Letra ${formatLabel} cargada y sincronizada${cleanupMessage}`);
      } else if (duration > 0) {
        toast.success(`${formatLabel} convertido a letra limpia: ${sungLines.length} líneas${cleanupMessage}`);
        toast.info('El documento no contiene tiempos. Sincronízalo escuchando la canción y pulsando ESPACIO.');
        setLyricsSyncOpen(true);
      } else {
        toast.success(`${formatLabel} convertido a letra limpia: ${sungLines.length} líneas${cleanupMessage}`);
        toast.info('Carga un MP3 para poder sincronizar la letra con la música');
      }
    } catch (error) {
      console.error('Failed to load lyrics:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el archivo de letra');
    } finally {
      e.target.value = '';
    }
  };

  const hasLyrics = (currentProject?.settings.lyrics.length ?? 0) > 0;
  const hasAudio = (audio.duration || currentProject?.settings.audioDuration || 0) > 0;

  return (
    <>
      <header className="studio-topbar h-14 shrink-0 flex items-center justify-between px-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2 shrink-0" title="SonCeibe Studio">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/30">
              <Music className="h-4 w-4 text-primary" />
            </div>
          </div>

          <Separator orientation="vertical" className="studio-mobile-hide h-6" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="studio-project-title text-sm font-medium truncate">
              {currentProject?.settings.title || 'Sin título'}
            </span>
            {currentProject?.settings.artist && (
              <>
                <span className="studio-mobile-hide text-muted-foreground">·</span>
                <span className="studio-mobile-hide text-sm text-muted-foreground">
                  {currentProject.settings.artist}
                </span>
              </>
            )}
            <span
              className="hidden xl:flex items-center gap-1 text-[11px] text-muted-foreground ml-1"
              title="El proyecto y su audio se conservan en el almacenamiento local de este equipo"
            >
              <HardDrive className="h-3 w-3" />
              Proyecto local
            </span>
          </div>
        </div>

        <div className="studio-mobile-hide flex items-center gap-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={undoStack.length === 0}>
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Deshacer (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={redoStack.length === 0}>
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rehacer (Ctrl+Y)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={audioInputRef}
            type="file"
            accept=".mp3,audio/*"
            className="hidden"
            onChange={handleAudioUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => audioInputRef.current?.click()}
            className="studio-mobile-icon-only gap-1.5"
            aria-label="Cargar MP3"
          >
            <Upload className="h-4 w-4" />
            <span className="studio-action-label">Cargar MP3</span>
          </Button>

          <input
            ref={lyricsInputRef}
            type="file"
            accept=".txt,.lrc,.odt,.docx,.rtf,.html,.htm,.md,.markdown,text/plain,application/rtf,application/vnd.oasis.opendocument.text,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleLyricsUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => lyricsInputRef.current?.click()}
            className="studio-mobile-icon-only gap-1.5"
            title="TXT, LRC, ODT, DOCX, RTF, HTML o Markdown"
            aria-label="Cargar letra"
          >
            <FileText className="h-4 w-4" />
            <span className="studio-action-label">Cargar letra</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLyricsSyncOpen(true)}
            className="studio-mobile-icon-only gap-1.5"
            disabled={!hasLyrics || !hasAudio}
            title={!hasLyrics ? 'Primero carga una letra' : !hasAudio ? 'Primero carga un MP3' : 'Sincronizar letra con el MP3'}
            aria-label="Sincronizar letra"
          >
            <Hand className="h-4 w-4" />
            <span className="studio-action-label">Sincronizar</span>
          </Button>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="studio-mobile-icon-only gap-1.5"
                  onClick={handleExport}
                  disabled={!currentProject}
                  aria-label="Exportar"
                >
                  <Download className="h-4 w-4" />
                  <span className="studio-action-label">Exportar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar MP4, TXT o LRC (Ctrl+E)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Más opciones">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => void handleSaveProject()} className="gap-2">
                <Save className="h-4 w-4" />
                Guardar proyecto .scs
                <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={closeProject} className="gap-2">
                <Home className="h-4 w-4" />
                Proyectos e inicio
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)} className="gap-2">
                <Settings className="h-4 w-4" />
                Ajustes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleLogout()} className="gap-2 text-muted-foreground">
                <LogOut className="h-4 w-4" />
                Salir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <LyricsSyncDialog open={lyricsSyncOpen} onOpenChange={setLyricsSyncOpen} />
    </>
  );
}
