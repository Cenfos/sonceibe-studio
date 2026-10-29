'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { hasExternalCopy } from '@/lib/recent-projects';

export function MobileProjectTransferButton() {
  const { currentProject, saveProjectFile, externalCopies } = useStore();

  if (!currentProject) return null;

  const exportProject = async () => {
    await saveProjectFile(currentProject.id);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={exportProject}
      className="fixed right-14 top-2.5 z-[72] h-9 w-9 bg-background/85 shadow-sm backdrop-blur"
      title={hasExternalCopy(currentProject, externalCopies) ? 'Copia guardada en tu equipo · guardar otra vez' : 'Guardar proyecto .scs en tu equipo'}
      aria-label="Guardar proyecto .scs"
    >
      <Download className="h-4 w-4" />
    </Button>
  );
}
