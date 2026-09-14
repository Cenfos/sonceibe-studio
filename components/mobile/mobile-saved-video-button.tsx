'use client';

import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { useStudioUserId } from '@/lib/studio-user-context';
import { getProjectVideo } from '@/lib/local-media-storage';
import { MobileExportDialog } from '@/components/mobile/mobile-export-dialog';

export function MobileSavedVideoButton() {
  const { currentProject } = useStore();
  const userId = useStudioUserId();
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!currentProject) {
      setAvailable(false);
      return;
    }
    let cancelled = false;
    getProjectVideo(userId, currentProject.id)
      .then((stored) => {
        if (!cancelled) setAvailable(Boolean(stored));
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentProject?.id, userId, open]);

  if (!currentProject || !available) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="fixed right-[6.5rem] top-2.5 z-[72] h-9 w-9 bg-background/85 shadow-sm backdrop-blur"
        title="Compartir o descargar el MP4 guardado"
        aria-label="Abrir MP4 guardado"
      >
        <Share2 className="h-4 w-4" />
      </Button>
      <MobileExportDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
