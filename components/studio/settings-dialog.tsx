'use client';

import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Music, Upload, Cpu, Bell, Palette, Info } from 'lucide-react';

export function SettingsDialog() {
  const { isSettingsOpen, setSettingsOpen, currentProject, updateSettings } = useStore();
  const audio = useAudioEngineContext();

  if (!currentProject) return null;
  const s = currentProject.settings;

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await audio.loadFile(file);
    updateSettings({
      audioName: file.name,
      audioUrl: URL.createObjectURL(file),
      audioDuration: audio.duration,
    });
  };

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustes del Proyecto</DialogTitle>
          <DialogDescription>
            Configura los detalles y el audio de tu proyecto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Project info */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Información
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={s.title}
                onChange={(e) => updateSettings({ title: e.target.value })}
                placeholder="Nombre del proyecto"
              />
            </div>
            <div className="space-y-2">
              <Label>Artista</Label>
              <Input
                value={s.artist}
                onChange={(e) => updateSettings({ artist: e.target.value })}
                placeholder="Nombre del artista"
              />
            </div>
          </div>

          <Separator />

          {/* Audio */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Audio
            </div>
            <div className="space-y-2">
              <Label>Archivo MP3</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2 flex-1 justify-start" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    {s.audioName || 'Seleccionar archivo...'}
                    <input
                      type="file"
                      accept=".mp3,audio/*"
                      className="hidden"
                      onChange={handleAudioUpload}
                    />
                  </label>
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duración (segundos)</Label>
              <Input
                type="number"
                value={audio.duration || s.audioDuration}
                onChange={(e) => updateSettings({ audioDuration: parseFloat(e.target.value) || 0 })}
                min={0}
                step={0.1}
                disabled={!!audio.duration}
              />
              {audio.duration > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Detectada automáticamente del MP3
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Preferences */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Preferencias
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-secondary/30">
                <Cpu className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs font-medium">Aceleración</div>
                  <div className="text-[11px] text-muted-foreground">GPU activada</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-secondary/30">
                <Bell className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs font-medium">Notificaciones</div>
                  <div className="text-[11px] text-muted-foreground">Activadas</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-secondary/30">
                <Palette className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs font-medium">Tema</div>
                  <div className="text-[11px] text-muted-foreground">Oscuro</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-secondary/30">
                <Info className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs font-medium">Versión</div>
                  <div className="text-[11px] text-muted-foreground">1.0.0</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setSettingsOpen(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
