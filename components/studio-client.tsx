'use client';

import { StoreProvider } from '@/lib/store';
import { AudioEngineProvider } from '@/lib/audio-engine-context';
import { AppShell } from '@/components/app-shell';

export function StudioClient({ userId }: { userId: string }) {
  const storageKey = `sonceibe-projects-v2:${userId}`;

  return (
    <StoreProvider key={userId} storageKey={storageKey} migrateLegacy={userId === 'owner'}>
      <AudioEngineProvider>
        <AppShell />
      </AudioEngineProvider>
    </StoreProvider>
  );
}
