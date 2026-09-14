'use client';

import { StoreProvider } from '@/lib/store';
import { AudioEngineProvider } from '@/lib/audio-engine-context';
import { StudioUserProvider } from '@/lib/studio-user-context';
import { AppShell } from '@/components/app-shell';

export function StudioClient({ userId }: { userId: string }) {
  const storageKey = `sonceibe-projects-v2:${userId}`;

  return (
    <StudioUserProvider userId={userId}>
      <StoreProvider key={userId} storageKey={storageKey} migrateLegacy={userId === 'owner'}>
        <AudioEngineProvider>
          <AppShell />
        </AudioEngineProvider>
      </StoreProvider>
    </StudioUserProvider>
  );
}
