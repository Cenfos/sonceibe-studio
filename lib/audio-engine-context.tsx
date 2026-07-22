'use client';

import React, { createContext, useContext } from 'react';
import { useAudioEngine, type AudioEngine } from '@/hooks/use-audio-engine';

const AudioEngineContext = createContext<AudioEngine | null>(null);

export function AudioEngineProvider({ children }: { children: React.ReactNode }) {
  const engine = useAudioEngine();
  return (
    <AudioEngineContext.Provider value={engine}>
      {children}
    </AudioEngineContext.Provider>
  );
}

export function useAudioEngineContext(): AudioEngine {
  const ctx = useContext(AudioEngineContext);
  if (!ctx) throw new Error('useAudioEngineContext must be used within AudioEngineProvider');
  return ctx;
}
