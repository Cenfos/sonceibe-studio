'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { HomePage } from '@/components/home/home-page';
import { WorkspaceControl } from '@/components/home/workspace-control';
import { StudioLayout } from '@/components/studio/studio-layout';
import { MobileStudioWizard } from '@/components/mobile/mobile-studio-wizard';
import { MobilePreviewLauncher } from '@/components/mobile/mobile-preview-launcher';
import { ExportDialog } from '@/components/studio/export-dialog';
import { SettingsDialog } from '@/components/studio/settings-dialog';

function usePhoneStudio(): boolean | null {
  const [isPhone, setIsPhone] = useState<boolean | null>(null);

  useEffect(() => {
    const pointer = window.matchMedia('(pointer: coarse)');
    const compact = window.matchMedia('(max-width: 1024px)');
    const update = () => setIsPhone(pointer.matches && compact.matches);
    update();
    pointer.addEventListener?.('change', update);
    compact.addEventListener?.('change', update);
    return () => {
      pointer.removeEventListener?.('change', update);
      compact.removeEventListener?.('change', update);
    };
  }, []);

  return isPhone;
}

export function AppShell() {
  const { currentPage, currentProject } = useStore();
  const isPhone = usePhoneStudio();
  const onHome = currentPage === 'home' || !currentProject;

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {onHome ? (
        <>
          <HomePage />
          <WorkspaceControl />
        </>
      ) : isPhone === null ? (
        <div className="h-full w-full bg-background" />
      ) : isPhone ? (
        <>
          <MobileStudioWizard />
          <MobilePreviewLauncher />
        </>
      ) : (
        <StudioLayout />
      )}
      <ExportDialog />
      <SettingsDialog />
    </div>
  );
}
