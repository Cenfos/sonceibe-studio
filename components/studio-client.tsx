'use client';

import { StoreProvider } from '@/lib/store';
import { AudioEngineProvider } from '@/lib/audio-engine-context';
import { StudioUserProvider, type StudioAccount } from '@/lib/studio-user-context';
import { WorkspaceSync } from '@/components/workspace-sync';
import { AppShell } from '@/components/app-shell';

export function StudioClient({ userId, account }: { userId: string; account?: StudioAccount }) {
  const storageKey = `sonceibe-projects-v2:${userId}`;

  return (
    <StudioUserProvider userId={userId} account={account}>
      <StoreProvider key={userId} storageKey={storageKey} migrateLegacy={userId === 'owner'}>
        <WorkspaceSync />
        <AudioEngineProvider>
          <AppShell />
        </AudioEngineProvider>
      </StoreProvider>
    </StudioUserProvider>
  );
}
