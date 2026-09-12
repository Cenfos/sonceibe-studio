'use client';

import {
  Music,
  Home,
  Settings,
  Save,
  Undo2,
  Redo2,
  Upload,
  FileText,
  Hand,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { readFileWithEncoding, parseTxtLyrics, parseLrcLyrics } from '@/lib/lyrics-utils';
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
    isDirty,
    undoStack,
    redoStack,
  } = useStore();
  const audio = useAudioEngineContext();
  const [editingTitle, setEditingTitle] = useState(false);
  const [lyricsSyncOpen, setLyricsSyncOpen] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    setExportOpen(true);
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
      const text = await readFileWithEncoding(file);
      const duration = audio.duration || currentProject?.settings.audioDuration || 0;
      const isLrc = file.name.toLowerCase().endsWith('.lrc');
      const parsedLyrics = isLrc
        ? parseLrcLyrics(text)
        : parseTxtLyrics(text, duration);

      if (parsedLyrics.length === 0) {
        toast.error('El archivo no contiene líneas de letra');
        return;
      }

      setLyrics(parsedLyrics);
      setTab('lyrics');

      if (isLrc) {
        toast.success(`Letra LRC cargada y sincronizada: ${file.name}`);
      } else if (duration > 0) {
        toast.success(`Letra TXT cargada: ${parsedLyrics.length} líneas`);
        toast.info('El TXT no contiene tiempos. Sincronízalo escuchando la canción y pulsando ESPACIO.');
        setLyricsSyncOpen(true);
      } else {
        toast.success(`Letra TXT cargada: ${parsedLyrics.length} líneas`);
        toast.info('Carga un MP3 para poder sincronizar la letra con la música');
      }
    } catch (error) {
      console.error('Failed to load lyrics:', error);
      toast.error('No se pudo cargar el archivo de letra');
    } finally {
      e.target.value = '';
    }
  };

  const hasLyrics = (currentProject?.settings.lyrics.length ?? 0) > 0;
  const hasAudio = (audio.duration || currentProject?.settings.audioDuration || 0) > 0;

  return (
    <>
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={closeProject}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/30">
              <Music className="h-4 w-4 text-primary" />
            </div>
          </button>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
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
                className="bg-background border border-border rounded-md px-2 py-1 text-sm outline-none focus:border-primary"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                {currentProject?.settings.title || 'Sin título'}
              </button>
            )}
            {isDirty && (
              <span className="h-2 w-2 rounded-full bg-amber-500" title="Cambios sin guardar" />
            )}
            {currentProject?.settings.artist && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">
                  {currentProject.settings.artist}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
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

        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSave}
                  disabled={!currentProject}
                >
                  <Save className="h-4 w-4" />
                  Guardar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Elegir formato de salida (Ctrl+S)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="h-6" />

          <Button variant="ghost" size="sm" onClick={closeProject} className="gap-1.5">
            <Home className="h-4 w-4" />
            Inicio
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
            className="gap-1.5"
          >
            <Upload className="h-4 w-4" />
            Cargar MP3
          </Button>

          <input
            ref={lyricsInputRef}
            type="file"
            accept=".txt,.lrc,text/plain"
            className="hidden"
            onChange={handleLyricsUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => lyricsInputRef.current?.click()}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" />
            Cargar letra
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLyricsSyncOpen(true)}
            className="gap-1.5"
            disabled={!hasLyrics || !hasAudio}
            title={!hasLyrics ? 'Primero carga una letra' : !hasAudio ? 'Primero carga un MP3' : 'Sincronizar letra con el MP3'}
          >
            <Hand className="h-4 w-4" />
            Sincronizar
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="gap-1.5"
          >
            <Settings className="h-4 w-4" />
            Ajustes
          </Button>
        </div>
      </header>

      <LyricsSyncDialog open={lyricsSyncOpen} onOpenChange={setLyricsSyncOpen} />
    </>
  );
}
