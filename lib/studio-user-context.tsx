'use client';

import React, { createContext, useContext } from 'react';

const StudioUserContext = createContext<string | null>(null);

export function StudioUserProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  return <StudioUserContext.Provider value={userId}>{children}</StudioUserContext.Provider>;
}

export function useStudioUserId(): string {
  const userId = useContext(StudioUserContext);
  if (!userId) throw new Error('useStudioUserId must be used within StudioUserProvider');
  return userId;
}
