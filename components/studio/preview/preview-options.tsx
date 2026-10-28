'use client';
import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
const Context = createContext<{ zoom: number; setZoom: Dispatch<SetStateAction<number>>; showSafeZone: boolean; setShowSafeZone: Dispatch<SetStateAction<boolean>> } | null>(null);
export function PreviewOptionsProvider({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const [showSafeZone, setShowSafeZone] = useState(false);
  return <Context.Provider value={{ zoom, setZoom, showSafeZone, setShowSafeZone }}>{children}</Context.Provider>;
}
export function usePreviewOptions() {
  const value = useContext(Context);
  if (!value) throw new Error('Preview options provider missing');
  return value;
}
