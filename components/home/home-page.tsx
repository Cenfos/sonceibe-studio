'use client';

import { Download, ExternalLink, Plus, Clock, MoreVertical, Trash2, Film, Sparkles, LogOut, HardDrive, FolderOpen, Copy } from 'lucide-react';
import Image from 'next/image';
import { SONCEIBE_LOGO_DATA_URL } from '@/lib/sonceibe-logo-data';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { readPortableProjectFile } from '@/lib/project/download-current-project';
import { visualPresets } from '@/lib/visual-presets';
import { toast } from 'sonner';
import { MAX_RECENT_PROJECTS, hasExternalCopy } from '@/lib/recent-projects';
import { WorkspaceControl } from './workspace-control';

export function HomePage() {
  const { projects, openProject, createProject, deleteProject, duplicateProject, importProject, saveProjectFile, externalCopies, trimRecentProjects } = useStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const duplicateBusy = useRef(false);
  const handleDuplicate = async (id: string) => {
    if (duplicateBusy.current) return;
    duplicateBusy.current = true; setDuplicating(true);
    try { if (await duplicateProject(id)) toast.success('Proyecto duplicado con su audio y fotografías'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo duplicar el proyecto'); }
    finally { duplicateBusy.current = false; setDuplicating(false); }
  };
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
    setProjectTitle('');
    setCreateOpen(true);
  };

  const confirmCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = projectTitle.trim();
    setCreateOpen(false);
    try { await createProject(title); }
    catch { toast.error('No se pudo crear el proyecto. Los proyectos anteriores se conservan.'); }
  };

  const handleProjectImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const imported = await readPortableProjectFile(file);
      if (await importProject(imported.project, imported.audioFile)) toast.success('Proyecto abierto desde el archivo .scs');
    } catch (error) {
      console.error('Project import failed:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo importar el proyecto');
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-background">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
            <DialogDescription>Puedes dejar el título en blanco: al cargar el audio se usará el nombre del archivo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={confirmCreateProject} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="new-project-title" className="text-sm font-medium">Título de la canción (opcional)</label>
              <Input id="new-project-title" value={projectTitle} onChange={event => setProjectTitle(event.target.value)} placeholder="Nombre de tu canción" autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit">Crear proyecto</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
        <div className="relative px-8 pt-20 pb-12 md:px-16 md:py-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/30">
              <Image src={SONCEIBE_LOGO_DATA_URL} alt="Son Ceibe" width={48} height={48} unoptimized className="rounded-xl object-contain" />
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
            Guarda tus proyectos .scs en tu equipo y ábrelos para continuar. Studio conserva hasta cinco recientes en este navegador como recuperación.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" variant="outline" className="gap-2" asChild>
              <a href="/download/windows"><Download className="h-5 w-5" /> Descargar para Windows</a>
            </Button>
            <Button size="lg" variant="outline" className="gap-2" asChild>
              <a href="https://www.sonceibe.es"><ExternalLink className="h-5 w-5" /> Volver a SonCeibe.es</a>
            </Button>
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
              Abrir proyecto .scs
            </Button>
            <Button size="lg" variant="outline" className="gap-2" disabled title="Lo añadiremos más adelante">
              <Film className="h-5 w-5" />
              Tutoriales · próximamente
            </Button>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 md:px-16 space-y-12">
        <WorkspaceControl />
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Proyectos Recientes</h2>
              <p className="text-sm text-muted-foreground">
                {mounted ? `${projects.length} de ${MAX_RECENT_PROJECTS} recientes en este navegador · tus archivos .scs se conservan aparte` : 'Cargando...'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCreateProject} className="gap-1">
              <Plus className="h-4 w-4" />
              Nuevo
            </Button>
          </div>

          {projects.length > MAX_RECENT_PROJECTS && <div role="status" className="mb-4 rounded-lg border p-3 text-sm space-y-2"><p>Se han recuperado {projects.length} proyectos anteriores. Ninguno se ha eliminado. Guarda o descarta los más antiguos para conservar cinco recientes.</p><Button variant="outline" onClick={() => void trimRecentProjects()}>Revisar proyectos antiguos</Button></div>}
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
                    <p className="mt-2 text-xs">{hasExternalCopy(p, externalCopies) ? 'Copia guardada en tu equipo' : 'Sólo en este navegador · guarda una copia .scs'}</p>
                  </div>

                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 bg-black/50 border-0 hover:bg-black/70"
                          aria-label={`Opciones de ${p.settings.title}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem className="gap-2" onSelect={() => void saveProjectFile(p.id)}><FolderOpen className="h-4 w-4" />Guardar proyecto .scs</DropdownMenuItem>
                        <DropdownMenuItem className="gap-2" disabled={duplicating} onSelect={() => void handleDuplicate(p.id)}>
                          <Copy className="h-4 w-4" />Duplicar proyecto
                        </DropdownMenuItem>
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
                    onClick={async () => {
                      try { await deleteProject(confirmId); setConfirmId(null); }
                      catch { toast.error('No se pudo actualizar el almacenamiento. El proyecto se conserva.'); }
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
                  <Image src={SONCEIBE_LOGO_DATA_URL} alt="" width={36} height={36} unoptimized className="absolute bottom-3 right-3 rounded-full" />
                  <div className="absolute inset-0 flex items-center justify-center px-4">
                    <span
                      className="font-bold text-center drop-shadow-sm"
                      style={{ fontFamily: preset.title.fontFamily || 'Inter', color: preset.title.color }}
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
