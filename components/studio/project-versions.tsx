'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import type { ProjectSnapshot } from '@/lib/project-history';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';

export function ProjectVersions() {
  const { saveVersion, getVersions, restoreVersion, historyError } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<ProjectSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await action(); setVersions(await getVersions()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo leer el historial'); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={value => {
    if (busy) return;
    setOpen(value);
    if (value) void run(async () => {});
  }}>
    <DialogTrigger asChild><Button variant="outline" size="sm" aria-label="Versiones locales" title="Versiones locales" className={historyError ? 'text-destructive' : ''}>
      <History className="h-4 w-4" /><span className="hidden xl:inline ml-2">Versiones</span>
    </Button></DialogTrigger>
    <DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Versiones locales</DialogTitle><DialogDescription>
        Se guardan antes de cambiar letras, fotos o estilos. Hasta 20 versiones y 128 MB por proyecto en este navegador. Incluyen el audio disponible. Al restaurar se conserva primero el estado actual.
      </DialogDescription></DialogHeader>
      {(error || historyError) && <p role="alert" className="text-sm text-destructive">{error || historyError}</p>}
      <Button disabled={busy} onClick={() => void run(() => saveVersion())}>{busy ? 'Guardando o leyendo…' : 'Guardar versión ahora'}</Button>
      <div className="max-h-[50vh] overflow-y-auto space-y-3" aria-busy={busy}>
        {!busy && !versions.length && <p className="text-sm text-muted-foreground">Aún no hay versiones guardadas.</p>}
        {versions.map(version => <div key={version.id} className="flex items-center justify-between gap-3 rounded border p-3">
          <div className="min-w-0"><p className="text-sm font-medium">{version.reason}</p>
            <p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString('es-ES')}</p>
            <p className="text-xs truncate">{version.settings.title} · {version.settings.lyrics.length} líneas</p>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
            await restoreVersion(version.id);
            toast.success('Versión restaurada. El estado anterior queda en el historial.');
          })}>Restaurar</Button>
        </div>)}
      </div>
    </DialogContent>
  </Dialog>;
}
