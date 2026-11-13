'use client';
import { useState } from 'react';
import { Download, History, Share2 } from 'lucide-react';
import { AccountMenu } from '@/components/account-menu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ProjectVersions } from '@/components/studio/project-versions';
import { MobileExportDialog } from './mobile-export-dialog';
import { useStore } from '@/lib/store';

export function MobileStudioMenu() {
  const { currentProject, saveProjectFile } = useStore();
  const [videoOpen, setVideoOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  if (!currentProject) return null;
  return <>
    <AccountMenu mobileMenu projectActions={<>
      <DropdownMenuItem className="min-h-[44px] gap-2" onSelect={() => void saveProjectFile(currentProject.id)}><Download className="h-4 w-4 shrink-0" />Guardar proyecto .scs</DropdownMenuItem>
      <DropdownMenuItem className="min-h-[44px] gap-2" onSelect={() => setVideoOpen(true)}><Share2 className="h-4 w-4 shrink-0" />Compartir o descargar MP4</DropdownMenuItem>
      <DropdownMenuItem className="min-h-[44px] gap-2" onSelect={() => setVersionsOpen(true)}><History className="h-4 w-4 shrink-0" />Versiones locales</DropdownMenuItem>
      <DropdownMenuSeparator />
    </>} />
    <MobileExportDialog open={videoOpen} onClose={() => setVideoOpen(false)} />
    {versionsOpen && <ProjectVersions initiallyOpen hideTrigger onClose={() => setVersionsOpen(false)} />}
  </>;
}
