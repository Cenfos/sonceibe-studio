'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { HomePage } from '@/components/home/home-page';
import { StudioLayout } from '@/components/studio/studio-layout';
import { ExportDialog } from '@/components/studio/export-dialog';
import { SettingsDialog } from '@/components/studio/settings-dialog';

export function AppShell() {
  const { currentPage, currentProject } = useStore();

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {currentPage === 'home' || !currentProject ? (
        <HomePage />
      ) : (
        <StudioLayout />
      )}
      <ExportDialog />
      <SettingsDialog />
    </div>
  );
}
