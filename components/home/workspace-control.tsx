'use client';

import { useEffect, useState } from 'react';
import { FolderOpen, HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { useStudioUserId } from '@/lib/studio-user-context';
import {
  chooseWorkspaceFolder,
  getWorkspaceInfo,
  requestWorkspacePermission,
  saveProjectsToWorkspace,
  type WorkspaceInfo,
} from '@/lib/local-workspace';
import { toast } from 'sonner';

const initialInfo: WorkspaceInfo = {
  supported: true,
  configured: false,
  folderName: '',
  permission: 'prompt',
};

export function WorkspaceControl() {
  const { projects } = useStore();
  const userId = useStudioUserId();
  const [info, setInfo] = useState<WorkspaceInfo>(initialInfo);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getWorkspaceInfo(userId)
      .then(setInfo)
      .catch(() => setInfo({ ...initialInfo, supported: false, permission: 'unavailable' }));
  }, [userId]);

  const selectFolder = async () => {
    setBusy(true);
    try {
      const next = await chooseWorkspaceFolder(userId);
      setInfo(next);
      const count = await saveProjectsToWorkspace(userId, projects);
      toast.success(`Carpeta de trabajo conectada · ${count} proyecto${count !== 1 ? 's' : ''} sincronizado${count !== 1 ? 's' : ''}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to choose workspace:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo configurar la carpeta de trabajo');
    } finally {
      setBusy(false);
    }
  };

  const reconnect = async () => {
    setBusy(true);
    try {
      const granted = await requestWorkspacePermission(userId);
      const next = await getWorkspaceInfo(userId);
      setInfo(next);
      if (!granted) {
        toast.error('No se concedió permiso para usar la carpeta de trabajo');
        return;
      }
      const count = await saveProjectsToWorkspace(userId, projects);
      toast.success(`Carpeta reconectada · ${count} proyecto${count !== 1 ? 's' : ''} sincronizado${count !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Failed to reconnect workspace:', error);
      toast.error('No se pudo reconectar la carpeta de trabajo');
    } finally {
      setBusy(false);
    }
  };

  if (!info.supported) return null;

  const connected = info.configured && info.permission === 'granted';

  return (
    <Card className="fixed right-5 bottom-5 z-30 max-w-sm border-border bg-card/95 backdrop-blur p-3 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <HardDrive className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Carpeta de trabajo del PC</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {connected
              ? `${info.folderName} / SonCeibe Studio · sincronización automática`
              : info.configured
                ? `${info.folderName} · necesita permiso`
                : 'Opcional: guarda también una copia física de tus proyectos y audios'}
          </div>
        </div>
        {!info.configured ? (
          <Button size="sm" variant="outline" onClick={selectFolder} disabled={busy} className="gap-1.5 shrink-0">
            <FolderOpen className="h-4 w-4" />
            Elegir
          </Button>
        ) : connected ? (
          <Button size="sm" variant="ghost" onClick={selectFolder} disabled={busy} title="Cambiar carpeta" className="shrink-0">
            <FolderOpen className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={reconnect} disabled={busy} className="gap-1.5 shrink-0">
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            Reconectar
          </Button>
        )}
      </div>
    </Card>
  );
}
