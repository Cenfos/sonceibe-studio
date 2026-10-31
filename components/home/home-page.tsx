'use client';

import { Download, ExternalLink, Plus, Clock, MoreVertical, Trash2, Film, LogOut, HardDrive, FolderOpen, Copy } from 'lucide-react';
import Image from 'next/image';
import { SONCEIBE_LOGO_DATA_URL } from '@/lib/sonceibe-logo-data';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { formatRelative, formatTime } from '@/lib/format';
import { useState, useEffect, useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { readPortableProjectFile } from '@/lib/project/download-current-project';
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
    try { if (await duplicateProject(id)) toast.success('Proyecto duplicado con sus archivos y ajustes'); }
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
      <header className="border-b border-border bg-card/30">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Image src={SONCEIBE_LOGO_DATA_URL} alt="Son Ceibe" width={44} height={44} unoptimized className="rounded-lg object-contain" />
            <div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">SonCeibe Studio</h1><p className="text-xs text-muted-foreground">Tu espacio para crear vídeos musicales</p></div>
          </div>
          <nav aria-label="Enlaces de Studio" className="flex flex-wrap items-center gap-1 sm:gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild><a href="/download/windows"><Download className="h-4 w-4" />Windows</a></Button>
            <Button variant="ghost" size="sm" className="gap-2" asChild><a href="https://www.sonceibe.es"><ExternalLink className="h-4 w-4" />SonCeibe.es</a></Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="ml-auto gap-2 text-muted-foreground lg:ml-0"><LogOut className="h-4 w-4" />Salir</Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-9 px-4 py-7 sm:px-8 sm:py-10">
        <section aria-labelledby="home-intro" className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7">
          <h2 id="home-intro" className="text-2xl font-semibold tracking-tight sm:text-3xl">De tu canción al vídeo final</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Empieza con una canción, tus fotos o un vídeo del móvil. Añade y sincroniza letras, ajusta el encuadre y mezcla el sonido. Exporta el vídeo completo o un Reel en MP4, en vertical u horizontal.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={handleCreateProject} className="gap-2"><Plus className="h-5 w-5" />Nuevo Proyecto</Button>
            <Button size="lg" variant="outline" className="gap-2" onClick={() => importInputRef.current?.click()}><FolderOpen className="h-5 w-5" />Abrir proyecto .scs</Button>
            <input ref={importInputRef} type="file" aria-label="Archivo de proyecto .scs" accept=".scs,application/json" className="hidden" onChange={handleProjectImport} />
          </div>
        </section>
        <section>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-semibold">Tus proyectos</h2>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-border bg-card/30 px-5 py-10 text-center"><FolderOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h3 className="font-medium">Tu próximo vídeo empieza aquí</h3><p className="mt-2 text-sm text-muted-foreground">Crea un proyecto nuevo o abre un archivo .scs para continuar trabajando.</p></div>}
              {projects.map((p) => (
                <Card key={p.id} className="group relative overflow-hidden border-border bg-card transition-colors hover:border-primary/60 focus-within:border-primary">
                  <button type="button" aria-label={`Abrir ${p.settings.title}`} onClick={() => openProject(p.id)} className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                    <span className="relative block aspect-video overflow-hidden" style={{ background: `linear-gradient(135deg, ${p.settings.background.gradientFrom}, ${p.settings.background.gradientTo})` }}>
                      <span className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                      <span className="absolute inset-0 flex items-center justify-center px-6 text-center text-lg font-semibold text-white drop-shadow-lg">{p.settings.title}</span>
                      <span className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/90">
                        <span className="rounded bg-black/40 px-2 py-1">{p.settings.background.type === 'video' ? 'Vídeo' : p.settings.audioName ? 'Audio' : 'Proyecto'}</span>
                        {p.settings.audioDuration > 0 && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(p.settings.audioDuration)}</span>}
                      </span>
                    </span>
                    <span className="block p-4">
                      <span role="heading" aria-level={3} className="block truncate font-medium">{p.settings.title}</span>
                      {!!p.settings.artist.trim() && !/^artista desconocido$/i.test(p.settings.artist.trim()) && <span className="mt-1 block truncate text-sm text-muted-foreground">{p.settings.artist.trim()}</span>}
                      <span className="mt-2 block text-xs text-muted-foreground">{formatRelative(p.settings.updatedAt)} · {p.settings.lyrics.length} líneas</span>
                      <span className="mt-2 block text-xs text-muted-foreground">{hasExternalCopy(p, externalCopies) ? 'Copia guardada en tu equipo' : 'Sólo en este navegador · guarda una copia .scs'}</span>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary"><Film className="h-3.5 w-3.5" />Continuar en el editor</span>
                    </span>
                  </button>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        <footer className="space-y-4 border-t border-border pt-5">
          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><HardDrive className="mt-0.5 h-4 w-4 shrink-0" /><span>Guarda una copia .scs en tu equipo para conservar el proyecto completo y abrirlo en otro dispositivo. Studio mantiene hasta cinco proyectos recientes en este navegador como recuperación.</span></p>
          <WorkspaceControl />
        </footer>
      </main>
    </div>
  );
}
