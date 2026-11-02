'use client';

import React, { createContext, useContext, useState } from 'react';

const StudioUserContext = createContext<string | null>(null);
export type StudioAccount = { name: string; email: string };
const StudioAccountContext = createContext<{ account: StudioAccount; setName: (name: string) => void } | null>(null);

export function StudioUserProvider({ userId, account: initialAccount, children }: { userId: string; account?: StudioAccount; children: React.ReactNode }) {
  const [account, setAccount] = useState<StudioAccount>(initialAccount || { name: '', email: '' });
  const setName = (name: string) => setAccount(previous => ({ ...previous, name }));
  return <StudioUserContext.Provider value={userId}><StudioAccountContext.Provider value={{ account, setName }}>{children}</StudioAccountContext.Provider></StudioUserContext.Provider>;
}

export function useStudioAccount() {
  const context = useContext(StudioAccountContext);
  if (!context) throw new Error('useStudioAccount must be used within StudioUserProvider');
  return context;
}

export function useStudioUserId(): string {
  const userId = useContext(StudioUserContext);
  if (!userId) throw new Error('useStudioUserId must be used within StudioUserProvider');
  return userId;
}
