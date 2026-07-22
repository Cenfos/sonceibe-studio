'use client';

import { Music, Plus, Clock, MoreVertical, Trash2, Film, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelative, formatTime } from '@/lib/format';
import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const templates = [
  { name: 'Karaoke Pop', desc: 'Animación palabra por palabra con fondo de gradiente', color: 'from-pink-500 to-rose-500' },
  { name: 'Minimalista', desc: 'Texto limpio sobre color sólido', color: 'from-slate-600 to-slate-800' },
  { name: 'Neón Nocturno', desc: 'Efectos de glow y partículas', color: 'from-blue-500 to-cyan-400' },
  { name: 'Cine Clásico', desc: 'Estilo cinematográfico con viñeta', color: 'from-amber-500 to-orange-600' },
];

export function HomePage() {
  const { projects, openProject, createProject, deleteProject } = useStore();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative px-8 py-12 md:px-16 md:py-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/30">
              <Music className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Lyric Video Studio</h1>
              <p className="text-sm text-muted-foreground">Crea videos de letras profesionales</p>
            </div>
          </div>
          <p className="text-muted-foreground max-w-2xl mb-8">
            Importa tu música, sincroniza las letras automáticamente, personaliza
            el estilo y exporta en calidad profesional.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={createProject} className="gap-2">
              <Plus className="h-5 w-5" />
              Nuevo Proyecto
            </Button>
            <Button size="lg" variant="outline" className="gap-2">
              <Film className="h-5 w-5" />
              Ver Tutoriales
            </Button>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 md:px-16 space-y-12">
        {/* Recent Projects */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Proyectos Recientes</h2>
              <p className="text-sm text-muted-foreground">
                {projects.length} proyecto{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={createProject} className="gap-1">
              <Plus className="h-4 w-4" />
              Nuevo
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((p) => (
              <Card
                key={p.id}
                className="group relative overflow-hidden border-border bg-card hover:border-primary/50 transition-all cursor-pointer"
                onClick={() => openProject(p.id)}
              >
                {/* Thumbnail */}
                <div
                  className="aspect-video relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${p.settings.background.gradientFrom}, ${p.settings.background.gradientTo})`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white/90 font-bold text-lg px-4 text-center drop-shadow-lg line-clamp-2">
                      {p.settings.lyrics[0]?.text || p.settings.title}
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

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-medium truncate">{p.settings.title}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {p.settings.artist || 'Artista desconocido'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {mounted ? formatRelative(p.settings.updatedAt) : 'Hace un momento'}
                  </p>
                </div>

                {/* Menu */}
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

        {/* Templates */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Plantillas</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {templates.map((t) => (
              <Card
                key={t.name}
                className="group overflow-hidden border-border bg-card hover:border-primary/50 transition-all cursor-pointer"
                onClick={createProject}
              >
                <div className={`aspect-video bg-gradient-to-br ${t.color} relative`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-bold drop-shadow-lg">{t.name}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-medium">{t.name}</h3>
                  <p className="text-sm text-muted-foreground">{t.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
