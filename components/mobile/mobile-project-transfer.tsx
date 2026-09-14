'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { useStudioUserId } from '@/lib/studio-user-context';
import { getProjectAudio } from '@/lib/local-media-storage';
import { downloadCurrentProject } from '@/lib/project/download-current-project';
import { toast } from 'sonner';

export function MobileProjectTransferButton() {
  const { currentProject } = useStore();
  const userId = useStudioUserId();

  if (!currentProject) return null;

  const exportProject = async () => {
    try {
      const audioFile = await getProjectAudio(userId, currentProject.id);
      await downloadCurrentProject(currentProject, undefined, audioFile);
      toast.success('Proyecto .scs listo para pasarlo al PC');
    } catch (error) {
      console.error('Portable project export failed:', error);
      toast.error('No se pudo preparar el proyecto para el PC');
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={exportProject}
      className="fixed right-14 top-2.5 z-[72] h-9 w-9 bg-background/85 shadow-sm backdrop-blur"
      title="Exportar proyecto al PC (.scs)"
      aria-label="Exportar proyecto al PC"
    >
      <Download className="h-4 w-4" />
    </Button>
  );
}
