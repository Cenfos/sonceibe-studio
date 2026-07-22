'use client';

import { StoreProvider } from '@/lib/store';
import { AudioEngineProvider } from '@/lib/audio-engine-context';
import { AppShell } from '@/components/app-shell';

export default function Home() {
  return (
    <StoreProvider>
      <AudioEngineProvider>
        <AppShell />
      </AudioEngineProvider>
    </StoreProvider>
  );
}
