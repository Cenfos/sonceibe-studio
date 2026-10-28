'use client';

import React, { createContext, useContext } from 'react';
import { useAudioEngine, type AudioEngine } from '@/hooks/use-audio-engine';
import { ProjectAudioRestore } from '@/components/studio/project-audio-restore';
import { useStore } from './store';

const AudioEngineContext = createContext<AudioEngine | null>(null);

export function AudioEngineProvider({ children }: { children: React.ReactNode }) {
  const { audioRevision } = useStore();
  return <AudioEngineSession key={audioRevision}>{children}</AudioEngineSession>;
}

function AudioEngineSession({ children }: { children: React.ReactNode }) {
  const engine = useAudioEngine();
  return (
    <AudioEngineContext.Provider value={engine}>
      <ProjectAudioRestore />
      {children}
    </AudioEngineContext.Provider>
  );
}

export function useAudioEngineContext(): AudioEngine {
  const ctx = useContext(AudioEngineContext);
  if (!ctx) throw new Error('useAudioEngineContext must be used within AudioEngineProvider');
  return ctx;
}
