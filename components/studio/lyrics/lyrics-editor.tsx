'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { formatTime } from '@/lib/format';
import {
  readFileWithEncoding,
  parseTxtLyrics,
  parseLrcLyrics,
  exportToTxt,
  exportToLrc,
  downloadTextFile,
} from '@/lib/lyrics-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  Plus,
  Trash2,
  Wand2,
  Play,
  Mic,
  Clock,
  Check,
  Loader2,
  Copy,
  ArrowUp,
  ArrowDown,
  Search,
  Replace,
  Hand,
  Pause,
  Square,
  RotateCcw,
  Download,
  X,
} from 'lucide-react';
import type { LyricLine } from '@/lib/types';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

type ImportMode = 'txt' | 'lrc' | 'manual' | null;

export function LyricsEditor() {
  const store = useStore();
  const audio = useAudioEngineContext();
  const {
    currentProject,
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
  } = store;

  const [importMode, setImportMode] = useState<ImportMode>(null);
  const [pastedText, setPastedText] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [tapSyncActive, setTapSyncActive] = useState(false);
  const [tapSyncIndex, setTapSyncIndex] = useState(0);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftValue, setShiftValue] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const lyrics = currentProject?.settings.lyrics ?? [];
  const duration = audio.duration || currentProject?.settings.audioDuration || 0;
  const syncProgress = currentProject?.settings.syncProgress ?? { syncedCount: 0, totalCount: 0, currentIndex: 0, inProgress: false };

  // Determine active line from playback for highlighting
  const activePlaybackLine = useCallback(() => {
    const t = audio.currentTime;
    for (const line of lyrics) {
      if (line.start > 0 && t >= line.start && t <= line.end) return line.id;
    }
    return null;
  }, [lyrics, audio.currentTime]);

  const playingLineId = activePlaybackLine();

  // Auto-scroll to playing line
  useEffect(() => {
    if (!playingLineId) return;
    const el = itemRefs.current.get(playingLineId);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [playingLineId]);

  // Auto-scroll during tap sync
  useEffect(() => {
    if (!tapSyncActive) return;
    const line = lyrics[tapSyncIndex];
    if (!line) return;
    const el = itemRefs.current.get(line.id);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [tapSyncIndex, tapSyncActive, lyrics]);

  // Keyboard handler for tap sync (spacebar) and general shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't interfere with input/textarea typing unless it's tap sync space
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (tapSyncActive && e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        handleTapSync();
        return;
      }

      if (isInput) return;

      if (e.key === 'Escape' && tapSyncActive) {
        e.preventDefault();
        stopTapSync();
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [tapSyncActive, tapSyncIndex, lyrics, audio.currentTime]);

  // Tap sync: assign current time to next line
  const handleTapSync = useCallback(() => {
    if (!tapSyncActive) return;
    const line = lyrics[tapSyncIndex];
    if (!line) {
      stopTapSync();
      return;
    }
    const t = audio.currentTime;
    updateLyric(line.id, { start: t, end: t + 4 });
    setSyncProgress({
      syncedCount: tapSyncIndex + 1,
      currentIndex: tapSyncIndex + 1,
    });
    setTapSyncIndex((i) => i + 1);
  }, [tapSyncActive, tapSyncIndex, lyrics, audio.currentTime, updateLyric, setSyncProgress]);

  const startTapSync = () => {
    if (lyrics.length === 0) return;
    setTapSyncActive(true);
    setTapSyncIndex(0);
    setSyncProgress({ inProgress: true, currentIndex: 0, syncedCount: 0 });
    audio.seek(0);
    audio.play();
  };

  const pauseTapSync = () => {
    audio.pause();
  };

  const resumeTapSync = () => {
    audio.play();
  };

  const stopTapSync = () => {
    setTapSyncActive(false);
    audio.pause();
    setSyncProgress({ inProgress: false });
  };

  // File upload with encoding detection
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileWithEncoding(file);
    if (file.name.endsWith('.lrc')) {
      setLyrics(parseLrcLyrics(text));
    } else {
      setLyrics(parseTxtLyrics(text, duration));
    }
    setImportMode(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = () => {
    if (!pastedText.trim()) return;
    if (importMode === 'txt' || importMode === 'manual') {
      setLyrics(parseTxtLyrics(pastedText, duration));
    } else if (importMode === 'lrc') {
      setLyrics(parseLrcLyrics(pastedText));
    }
    setImportMode(null);
    setPastedText('');
  };

  const handleSetTimeToLine = (id: string) => {
    const t = audio.currentTime;
    updateLyric(id, { start: t, end: t + 4 });
    setActiveId(id);
  };

  const handleExportTxt = () => {
    const text = exportToTxt(lyrics);
    downloadTextFile(`${currentProject?.settings.title || 'letra'}.txt`, text);
  };

  const handleExportLrc = () => {
    const text = exportToLrc(lyrics, currentProject?.settings.title, currentProject?.settings.artist);
    downloadTextFile(`${currentProject?.settings.title || 'letra'}.lrc`, text, 'application/octet-stream');
  };

  const handleReplace = () => {
    if (!searchQuery) return;
    replaceInLyrics(searchQuery, replaceQuery, matchCase);
  };

  // Drag & drop reordering
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (id: string, e: React.DragEvent) => {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  };

  const handleDrop = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    const dragId = dragIdRef.current;
    if (!dragId || dragId === id) return;
    // Reorder via move up/down
    const dragIdx = lyrics.findIndex((l) => l.id === dragId);
    const dropIdx = lyrics.findIndex((l) => l.id === id);
    if (dragIdx === -1 || dropIdx === -1) return;
    const direction = dragIdx < dropIdx ? 'down' : 'up';
    const steps = Math.abs(dropIdx - dragIdx);
    for (let i = 0; i < steps; i++) {
      moveLyric(dragId, direction);
    }
    dragIdRef.current = null;
    setDragOverId(null);
  };

  // Line status for coloring
  const getLineStatus = (line: LyricLine): 'past' | 'current' | 'upcoming' | 'unsynced' => {
    if (line.start === 0 && line.end === 0) return 'unsynced';
    const t = audio.currentTime;
    if (t >= line.start && t <= line.end) return 'current';
    if (t > line.end) return 'past';
    return 'upcoming';
  };

  if (!currentProject) return null;

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar: import options */}
      <div className="w-64 shrink-0 border-r border-border bg-card/30 flex flex-col">
        <div className="h-10 flex items-center px-4 border-b border-border">
          <span className="text-sm font-medium">Importar Letra</span>
        </div>
        <div className="p-3 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.lrc"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Subir archivo TXT/LRC
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => { setImportMode('txt'); setPastedText(''); }}
          >
            <FileText className="h-4 w-4" />
            Pegar texto (TXT)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => { setImportMode('lrc'); setPastedText(''); }}
          >
            <FileText className="h-4 w-4" />
            Pegar LRC con tiempos
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => { setImportMode('manual'); setPastedText(''); }}
          >
            <Plus className="h-4 w-4" />
            Editor manual
          </Button>
        </div>

        <Separator />

        {/* Tap Sync */}
        <div className="p-3 space-y-2">
          <div className="text-xs text-muted-foreground mb-1">Tap Sync</div>
          {!tapSyncActive ? (
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={startTapSync}
              disabled={lyrics.length === 0 || duration === 0}
            >
              <Hand className="h-4 w-4" />
              Iniciar Tap Sync
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-1">
                {audio.isPlaying ? (
                  <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={pauseTapSync}>
                    <Pause className="h-3.5 w-3.5" />
                    Pausar
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={resumeTapSync}>
                    <Play className="h-3.5 w-3.5" />
                    Reanudar
                  </Button>
                )}
                <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={stopTapSync}>
                  <Square className="h-3.5 w-3.5" />
                  Detener
                </Button>
              </div>
              <Button size="sm" className="w-full gap-2 animate-pulse-glow" onClick={handleTapSync}>
                <Hand className="h-4 w-4" />
                TAP (Espacio)
              </Button>
              <div className="text-[11px] text-muted-foreground text-center">
                Línea {tapSyncIndex + 1} de {lyrics.length}
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Pulsa ESPACIO al ritmo de cada línea para asignar tiempos automáticamente.
          </p>
        </div>

        <Separator />

        {/* Synchronization tools */}
        <div className="p-3 space-y-2">
          <div className="text-xs text-muted-foreground mb-1">Sincronización</div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setShiftOpen(!shiftOpen)}
          >
            <Clock className="h-4 w-4" />
            Desplazar tiempos
          </Button>
          {shiftOpen && (
            <div className="space-y-2 p-2 rounded-md bg-secondary/30">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.1"
                  value={shiftValue}
                  onChange={(e) => setShiftValue(parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs"
                  placeholder="Segundos"
                />
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => { shiftTimestamps(shiftValue); setShiftValue(0); }}>
                  Aplicar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Positivo = adelante, negativo = atrás</p>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => { clearTimestamps(); }}
          >
            <RotateCcw className="h-4 w-4" />
            Borrar tiempos
          </Button>
        </div>

        <Separator />

        {/* Export lyrics */}
        <div className="p-3 space-y-2">
          <div className="text-xs text-muted-foreground mb-1">Exportar Letra</div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleExportTxt}
            disabled={lyrics.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar TXT
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleExportLrc}
            disabled={lyrics.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar LRC
          </Button>
        </div>

        <div className="mt-auto p-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Líneas:</span>
              <Badge variant="secondary">{lyrics.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Sincronizadas:</span>
              <Badge variant="secondary">{syncProgress.syncedCount}/{syncProgress.totalCount}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Audio:</span>
              <span className="truncate ml-2 max-w-[120px]">{currentProject.settings.audioName || 'Sin audio'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main: lyrics list / import editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {importMode ? (
          <div className="flex-1 flex flex-col p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">
                {importMode === 'txt' && 'Pegar texto de letra'}
                {importMode === 'lrc' && 'Pegar letra con formato LRC'}
                {importMode === 'manual' && 'Escribir letra manualmente'}
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setImportMode(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {importMode === 'lrc'
                ? 'Formato: [mm:ss.xx] texto de la línea'
                : 'Una línea por cada frase de la letra'}
            </p>
            <Textarea
              autoFocus
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={
                importMode === 'lrc'
                  ? '[00:01.00] Primera línea\n[00:05.20] Segunda línea'
                  : 'Escribe o pega la letra aquí...'
              }
              className="flex-1 font-mono text-sm resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setImportMode(null)}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={!pastedText.trim()}>
                <Check className="h-4 w-4 mr-1" />
                Importar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="h-10 flex items-center justify-between px-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Editor de Letra</span>
                {tapSyncActive && (
                  <Badge className="bg-primary/20 text-primary border border-primary/30">
                    Tap Sync: línea {tapSyncIndex + 1}/{lyrics.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-7"
                  onClick={() => setSearchOpen(!searchOpen)}
                >
                  <Search className="h-3.5 w-3.5" />
                  Buscar
                </Button>
                <Button size="sm" variant="outline" onClick={() => addLyric()} className="gap-1.5 h-7">
                  <Plus className="h-4 w-4" />
                  Añadir línea
                </Button>
              </div>
            </div>

            {/* Search & Replace bar */}
            {searchOpen && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 max-w-[200px]"
                  autoFocus
                />
                <Replace className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  type="text"
                  placeholder="Reemplazar..."
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  className="h-8 max-w-[200px]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setMatchCase(!matchCase)}
                >
                  {matchCase ? 'Aa' : 'aa'}
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 text-xs gap-1"
                  onClick={handleReplace}
                  disabled={!searchQuery}
                >
                  <Replace className="h-3.5 w-3.5" />
                  Reemplazar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { setSearchOpen(false); setSearchQuery(''); setReplaceQuery(''); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Lyrics list */}
            <ScrollArea className="flex-1">
              <div ref={listRef} className="p-4 space-y-1">
                {lyrics.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <FileText className="h-10 w-10 mb-3 opacity-50" />
                    <p className="text-sm">No hay letra importada</p>
                    <p className="text-xs">Usa las opciones de la izquierda para importar</p>
                  </div>
                )}
                {lyrics.map((line, idx) => {
                  const status = getLineStatus(line);
                  const isActive = activeId === line.id;
                  const isPlaying = playingLineId === line.id;
                  const isTapSyncCurrent = tapSyncActive && tapSyncIndex === idx;
                  const isDragOver = dragOverId === line.id;
                  const matchesSearch = searchQuery && (
                    matchCase
                      ? line.text.includes(searchQuery)
                      : line.text.toLowerCase().includes(searchQuery.toLowerCase())
                  );

                  return (
                    <ContextMenu key={line.id}>
                      <ContextMenuTrigger asChild>
                        <div
                          ref={(el) => {
                            if (el) itemRefs.current.set(line.id, el);
                          }}
                          draggable
                          onDragStart={(e) => handleDragStart(line.id, e)}
                          onDragOver={(e) => handleDragOver(line.id, e)}
                          onDrop={(e) => handleDrop(line.id, e)}
                          onDragEnd={() => { dragIdRef.current = null; setDragOverId(null); }}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                            isTapSyncCurrent
                              ? 'border-primary bg-primary/15 ring-2 ring-primary/40'
                              : isPlaying
                              ? 'border-primary/60 bg-primary/10'
                              : isActive
                              ? 'border-primary/40 bg-primary/5'
                              : isDragOver
                              ? 'border-primary/50 bg-primary/5'
                              : status === 'past'
                              ? 'border-border/50 bg-muted/20 opacity-60'
                              : status === 'upcoming'
                              ? 'border-border bg-card/30'
                              : 'border-border hover:border-primary/30'
                          } ${matchesSearch ? 'ring-1 ring-yellow-500/40' : ''}`}
                          onClick={() => setActiveId(line.id)}
                          onDoubleClick={() => setEditingId(line.id)}
                        >
                          {/* Line number + drag handle */}
                          <div className="flex flex-col items-center gap-0.5 shrink-0 w-7">
                            <span className="text-[10px] text-muted-foreground font-mono">{idx + 1}</span>
                            <Hand className="h-3 w-3 text-muted-foreground/40 cursor-grab" />
                          </div>

                          {/* Text */}
                          {editingId === line.id ? (
                            <input
                              autoFocus
                              type="text"
                              defaultValue={line.text}
                              onBlur={(e) => { updateLyric(line.id, { text: e.target.value }); setEditingId(null); }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateLyric(line.id, { text: (e.target as HTMLInputElement).value });
                                  setEditingId(null);
                                }
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 bg-background border border-primary rounded px-2 py-1 text-sm outline-none"
                            />
                          ) : (
                            <span
                              className={`flex-1 text-sm truncate ${
                                status === 'past' ? 'text-muted-foreground' : 'text-foreground'
                              } ${line.text === '' ? 'italic text-muted-foreground/50' : ''}`}
                            >
                              {line.text || 'Línea vacía'}
                            </span>
                          )}

                          {/* Timestamps */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Input
                              type="number"
                              step="0.1"
                              value={line.start > 0 ? line.start.toFixed(1) : ''}
                              onChange={(e) => updateLyric(line.id, { start: parseFloat(e.target.value) || 0 })}
                              onClick={(e) => e.stopPropagation()}
                              className="w-16 h-7 text-[11px] font-mono"
                              placeholder="Inicio"
                            />
                            <span className="text-muted-foreground text-[10px]">→</span>
                            <Input
                              type="number"
                              step="0.1"
                              value={line.end > 0 ? line.end.toFixed(1) : ''}
                              onChange={(e) => updateLyric(line.id, { end: parseFloat(e.target.value) || 0 })}
                              onClick={(e) => e.stopPropagation()}
                              className="w-16 h-7 text-[11px] font-mono"
                              placeholder="Fin"
                            />
                          </div>

                          {/* Set time button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Asignar tiempo actual"
                            onClick={(e) => { e.stopPropagation(); handleSetTimeToLine(line.id); }}
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </Button>

                          {/* Play from here */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Reproducir desde aquí"
                            onClick={(e) => { e.stopPropagation(); if (line.start > 0) audio.seek(line.start); audio.play(); }}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => duplicateLyric(line.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => moveLyric(line.id, 'up')}>
                          <ArrowUp className="h-4 w-4 mr-2" />
                          Mover arriba
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => moveLyric(line.id, 'down')}>
                          <ArrowDown className="h-4 w-4 mr-2" />
                          Mover abajo
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleSetTimeToLine(line.id)}>
                          <Clock className="h-4 w-4 mr-2" />
                          Asignar tiempo actual
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-destructive"
                          onClick={() => deleteLyric(line.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
