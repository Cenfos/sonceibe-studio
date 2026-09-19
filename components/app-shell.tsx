'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { HomePage } from '@/components/home/home-page';
import { WorkspaceControl } from '@/components/home/workspace-control';
import { StudioLayout } from '@/components/studio/studio-layout';
import { MobileStudioWizard } from '@/components/mobile/mobile-studio-wizard';
import { MobilePreviewLauncher } from '@/components/mobile/mobile-preview-launcher';
import { MobileProjectTransferButton } from '@/components/mobile/mobile-project-transfer';
import { MobileSavedVideoButton } from '@/components/mobile/mobile-saved-video-button';
import { ExportDialog } from '@/components/studio/export-dialog';
import { SettingsDialog } from '@/components/studio/settings-dialog';
import { isDefaultProjectTitle, PENDING_PROJECT_TITLE_KEY, titleFromAudioFilename } from '@/lib/project-title';

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
  const { currentPage, currentProject, closeProject, updateSettings } = useStore();
  const isPhone = usePhoneStudio();
  const onHome = currentPage === 'home' || !currentProject;
  const previousProjectId = useRef<string | null>(null);

  useEffect(() => {
    const projectId = currentProject?.id ?? null;
    if (projectId && previousProjectId.current !== projectId) {
      window.history.pushState(
        { ...window.history.state, sonCeibeView: 'project', projectId },
        '',
        window.location.href
      );
    }
    previousProjectId.current = projectId;
  }, [currentProject?.id]);

  useEffect(() => {
    const handleBack = () => {
      if (currentProject) closeProject();
    };
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, [currentProject, closeProject]);

  useEffect(() => {
    if (!currentProject) return;

    const pendingTitle = sessionStorage.getItem(PENDING_PROJECT_TITLE_KEY)?.trim();
    if (pendingTitle) {
      sessionStorage.removeItem(PENDING_PROJECT_TITLE_KEY);
      if (currentProject.settings.title !== pendingTitle) updateSettings({ title: pendingTitle });
      return;
    }

    if (currentProject.settings.audioName && isDefaultProjectTitle(currentProject.settings.title)) {
      const derived = titleFromAudioFilename(currentProject.settings.audioName);
      if (derived) updateSettings({ title: derived });
    }
  }, [currentProject?.id, currentProject?.settings.audioName, currentProject?.settings.title, updateSettings]);

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
          <MobileSavedVideoButton />
          <MobileProjectTransferButton />
          <MobilePreviewLauncher />
        </>
      ) : (
        <StudioLayout />
      )}
      {currentProject && (
        <>
          <ExportDialog />
          <SettingsDialog />
        </>
      )}
    </div>
  );
}
