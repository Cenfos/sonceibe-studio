'use client';

import { useStore } from '@/lib/store';
import { HomePage } from '@/components/home/home-page';
import { WorkspaceControl } from '@/components/home/workspace-control';
import { StudioLayout } from '@/components/studio/studio-layout';
import { ExportDialog } from '@/components/studio/export-dialog';
import { SettingsDialog } from '@/components/studio/settings-dialog';

export function AppShell() {
  const { currentPage, currentProject } = useStore();
  const onHome = currentPage === 'home' || !currentProject;

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {onHome ? (
        <>
          <HomePage />
          <WorkspaceControl />
        </>
      ) : (
        <StudioLayout />
      )}
      <ExportDialog />
      <SettingsDialog />
    </div>
  );
}
