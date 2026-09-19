'use client';

import { useStore } from '@/lib/store';
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
import { Cpu, Bell, Palette, Info } from 'lucide-react';

export function SettingsDialog() {
  const { isSettingsOpen, setSettingsOpen, currentProject, updateSettings } = useStore();

  if (!currentProject) return null;
  const s = currentProject.settings;

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
              <Label>Artista</Label>
              <Input
                value={s.artist}
                onChange={(e) => updateSettings({ artist: e.target.value })}
                placeholder="Nombre del artista"
              />
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
