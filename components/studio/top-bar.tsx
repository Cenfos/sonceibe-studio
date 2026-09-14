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
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
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
import { useRef, useState } from 'react';
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
  const audio = useAudioEngineContext();
  const [editingTitle, setEditingTitle] = useState(false);
  const [lyricsSyncOpen, setLyricsSyncOpen] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    setExportOpen(true);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/studio-auth/logout', { method: 'POST' });
    } finally {
      window.location.replace('/access');
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await audio.loadFile(file);
      updateSettings({
        audioName: file.name,
        audioUrl: URL.createObjectURL(file),
      });
      toast.success(`MP3 cargado: ${file.name}`);
    } catch (error) {
      console.error('Failed to load audio:', error);
      toast.error('No se pudo cargar el archivo de audio');
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
          <button
            onClick={closeProject}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
            title="Volver al inicio de SonCeibe Studio"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/30">
              <Music className="h-4 w-4 text-primary" />
            </div>
          </button>

          <Separator orientation="vertical" className="studio-mobile-hide h-6" />

          <div className="flex items-center gap-2 min-w-0">
            {editingTitle ? (
              <input
                autoFocus
                defaultValue={currentProject?.settings.title}
                onBlur={(e) => {
                  updateSettings({ title: e.target.value });
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateSettings({ title: (e.target as HTMLInputElement).value });
                    setEditingTitle(false);
                  }
                }}
                className="bg-background border border-border rounded-md px-2 py-1 text-sm outline-none focus:border-primary max-w-40"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="studio-project-title text-sm font-medium hover:text-primary transition-colors truncate"
              >
                {currentProject?.settings.title || 'Sin título'}
              </button>
            )}
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
              title="El proyecto se conserva en el almacenamiento local de este navegador"
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
              <TooltipContent>Crear MP4 o exportar la letra (Ctrl+S)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="studio-mobile-hide h-6" />

          <Button variant="ghost" size="sm" onClick={closeProject} className="studio-mobile-icon-only gap-1.5" aria-label="Inicio">
            <Home className="h-4 w-4" />
            <span className="studio-action-label">Inicio</span>
          </Button>

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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="studio-mobile-icon-only gap-1.5"
            aria-label="Ajustes"
          >
            <Settings className="h-4 w-4" />
            <span className="studio-action-label">Ajustes</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="studio-mobile-icon-only gap-1.5 text-muted-foreground"
            title="Cerrar acceso privado"
            aria-label="Salir"
          >
            <LogOut className="h-4 w-4" />
            <span className="studio-action-label">Salir</span>
          </Button>
        </div>
      </header>

      <LyricsSyncDialog open={lyricsSyncOpen} onOpenChange={setLyricsSyncOpen} />
    </>
  );
}
