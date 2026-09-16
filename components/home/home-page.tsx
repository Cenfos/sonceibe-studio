'use client';

import { Music, Plus, Clock, MoreVertical, Trash2, Film, Sparkles, LogOut, HardDrive, FolderOpen } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelative, formatTime } from '@/lib/format';
import { useState, useEffect, useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStudioUserId } from '@/lib/studio-user-context';
import { LOCAL_AUDIO_URL, saveProjectAudio } from '@/lib/local-media-storage';
import { readPortableProjectFile } from '@/lib/project/download-current-project';
import { PENDING_PROJECT_TITLE_KEY } from '@/lib/project-title';
import { visualPresets } from '@/lib/visual-presets';
import { toast } from 'sonner';

export function HomePage() {
  const { projects, openProject, createProject, deleteProject } = useStore();
  const userId = useStudioUserId();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setMounted(true), []);

  const handleLogout = async () => {
    try {
      await fetch('/api/studio-auth/logout', { method: 'POST' });
    } finally {
      window.location.replace('/access');
    }
  };

  const handleCreateProject = () => {
    const value = window.prompt(
      'Título de la canción\n\nPuedes dejarlo en blanco: al cargar el MP3 se usará automáticamente el nombre del archivo.'
    );
    if (value === null) return;

    const title = value.trim();
    if (title) sessionStorage.setItem(PENDING_PROJECT_TITLE_KEY, title);
    else sessionStorage.removeItem(PENDING_PROJECT_TITLE_KEY);
    createProject();
  };

  const handleProjectImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const imported = await readPortableProjectFile(file);
      const existingIds = new Set(projects.map((project) => project.id));
      const projectId = existingIds.has(imported.project.id)
        ? `${imported.project.id}-${Date.now().toString(36)}`
        : imported.project.id;
      const now = Date.now();
      const project = {
        ...imported.project,
        id: projectId,
        settings: {
          ...imported.project.settings,
          audioUrl: imported.audioFile ? LOCAL_AUDIO_URL : imported.project.settings.audioUrl,
          updatedAt: now,
        },
      };

      const storageKey = `sonceibe-projects-v2:${userId}`;
      localStorage.setItem(storageKey, JSON.stringify([project, ...projects]));
      if (imported.audioFile) {
        await saveProjectAudio(userId, projectId, imported.audioFile);
      }
      toast.success('Proyecto importado. Se abrirá en este equipo.');
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      console.error('Project import failed:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo importar el proyecto');
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="absolute right-5 top-5 z-20 gap-1.5 text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          Salir
        </Button>
        <div className="relative px-8 py-12 md:px-16 md:py-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/30">
              <Music className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">SonCeibe Studio</h1>
              <p className="text-sm text-muted-foreground">Crea vídeos musicales con letras, fotos y efectos</p>
            </div>
          </div>
          <p className="text-muted-foreground max-w-2xl mb-4">
            Importa tu música, sincroniza la letra, coloca tus fotografías en la línea de tiempo y exporta el resultado en MP4 para PC o móvil.
          </p>
          <p className="text-xs text-muted-foreground max-w-2xl mb-8 flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            Tus proyectos se guardan localmente en este navegador y no se suben a la nube.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={handleCreateProject} className="gap-2">
              <Plus className="h-5 w-5" />
              Nuevo Proyecto
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".scs,application/json"
              className="hidden"
              onChange={handleProjectImport}
            />
            <Button size="lg" variant="outline" className="gap-2" onClick={() => importInputRef.current?.click()}>
              <FolderOpen className="h-5 w-5" />
              Importar proyecto .scs
            </Button>
            <Button size="lg" variant="outline" className="gap-2" disabled title="Lo añadiremos más adelante">
              <Film className="h-5 w-5" />
              Tutoriales · próximamente
            </Button>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 md:px-16 space-y-12">
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Proyectos Recientes</h2>
              <p className="text-sm text-muted-foreground">
                {mounted ? `${projects.length} proyecto${projects.length !== 1 ? 's' : ''} en este navegador` : 'Cargando...'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCreateProject} className="gap-1">
              <Plus className="h-4 w-4" />
              Nuevo
            </Button>
          </div>

          {mounted ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projects.map((p) => (
                <Card
                  key={p.id}
                  className="group relative overflow-hidden border-border bg-card hover:border-primary/50 transition-all cursor-pointer"
                  onClick={() => openProject(p.id)}
                >
                  <div
                    className="aspect-video relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${p.settings.background.gradientFrom}, ${p.settings.background.gradientTo})`,
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white/90 font-bold text-lg px-4 text-center drop-shadow-lg line-clamp-2">
                        {p.settings.title}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                      <Badge variant="secondary" className="bg-black/50 text-white border-0">
                        {p.settings.lyrics.length} líneas
                      </Badge>
                      {p.settings.audioDuration > 0 && (
                        <span className="text-xs text-white/80 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(p.settings.audioDuration)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="font-medium truncate">{p.settings.title}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {p.settings.artist || 'Artista desconocido'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatRelative(p.settings.updatedAt)}
                    </p>
                  </div>

                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 bg-black/50 border-0 hover:bg-black/70"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          className="text-destructive gap-2"
                          onClick={() => setConfirmId(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border bg-card/50">
                  <div className="aspect-video bg-muted animate-pulse rounded-t-lg" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {confirmId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <Card className="p-6 max-w-sm mx-4">
                <h3 className="font-semibold mb-2">¿Eliminar proyecto?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setConfirmId(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      deleteProject(confirmId);
                      setConfirmId(null);
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Estilos preparados</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Los mismos estilos disponibles dentro del editor: fondo, título, letra, animación, efectos y ornamentación.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visualPresets.map((preset) => (
              <Card
                key={preset.id}
                className="overflow-hidden border-border bg-card opacity-95 cursor-default"
              >
                <div
                  className="aspect-video relative overflow-hidden"
                  style={{
                    background: `linear-gradient(145deg, ${preset.previewFrom}, ${preset.previewTo})`,
                  }}
                >
                  <div
                    className="absolute inset-3 rounded-lg border"
                    style={{
                      borderColor: `${preset.accent}99`,
                      boxShadow: `inset 0 0 24px ${preset.accent}22, 0 0 18px ${preset.accent}18`,
                    }}
                  />
                  {preset.id === 'ska-ceibe' && (
                    <div className="absolute inset-x-0 bottom-0 h-6 opacity-70" style={{
                      backgroundImage: 'linear-gradient(45deg,#111 25%,transparent 25%),linear-gradient(-45deg,#111 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#111 75%),linear-gradient(-45deg,transparent 75%,#111 75%)',
                      backgroundSize: '18px 18px',
                      backgroundPosition: '0 0,0 9px,9px -9px,-9px 0px',
                    }} />
                  )}
                  {preset.id === 'folk-atlantico' && (
                    <div className="absolute inset-x-8 bottom-5 h-px opacity-70" style={{ background: preset.accent }} />
                  )}
                  {preset.id === 'rock-galego' && (
                    <div className="absolute inset-x-6 bottom-4 h-1 rotate-[-1deg] opacity-60" style={{ background: preset.accent }} />
                  )}
                  {preset.id === 'galicia-gaita' && (
                    <div className="absolute right-5 top-4 text-2xl opacity-70">✦</div>
                  )}
                  {preset.id === 'taberna-galega' && (
                    <div className="absolute inset-x-6 top-4 flex justify-between text-sm opacity-80">
                      <span>●</span><span>●</span><span>●</span><span>●</span><span>●</span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center px-4">
                    <span
                      className="text-white font-bold text-center drop-shadow-lg"
                      style={{ fontFamily: preset.title.fontFamily || 'Inter' }}
                    >
                      {preset.label}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium">{preset.label}</h3>
                    <Badge variant="outline" className="text-[10px]">Disponible</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{preset.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
