'use client';

import { useEffect, useState } from 'react';
import { PreviewOptionsProvider } from './preview/preview-options';
import { TopBar } from './top-bar';
import { PreviewPanel } from './preview/preview-panel';
import { PropertiesPanel } from './properties/properties-panel';
import { Timeline } from './timeline/timeline';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { LyricsEditor } from './lyrics/lyrics-editor';
import { MobileOrientationGate } from './mobile-orientation-gate';

export function StudioLayout() {
  const {
    activeTab,
    undo,
    redo,
    setExportOpen,
    setSettingsOpen,
    setTab,
  } = useStore();
  const audio = useAudioEngineContext();
  const [mobilePropertiesOpen, setMobilePropertiesOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        window.dispatchEvent(new Event('sonceibe:save-project'));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setExportOpen(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setTab('lyrics');
        return;
      }

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        if (audio.isPlaying) audio.pause();
        else audio.play();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, setExportOpen, setSettingsOpen, setTab, audio]);

  const handleTabSelected = (tab: 'text' | 'background' | 'animation' | 'effects' | 'lyrics') => {
    if (tab === 'lyrics') {
      setMobilePropertiesOpen(false);
      return;
    }
    setMobilePropertiesOpen(true);
  };

  return (
    <PreviewOptionsProvider>
      <MobileOrientationGate />
      <div className="studio-editor-shell flex flex-col h-full">
        <TopBar />
        <div className="studio-workspace-scroll flex-1 min-h-0 overflow-y-scroll overscroll-contain">
        <div className="studio-main-workspace flex h-[calc(100dvh-56px)] min-h-[540px] shrink-0">
          <div className="flex flex-1 min-w-0">
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              {activeTab === 'lyrics' ? (
                <LyricsEditor />
              ) : (
                <PreviewPanel />
              )}
            </div>
            <PropertiesPanel
              onTabSelected={handleTabSelected}
              mobileOpen={mobilePropertiesOpen}
              onMobileClose={() => setMobilePropertiesOpen(false)}
            />
          </div>
        </div>
        <Timeline />
        </div>
      </div>
    </PreviewOptionsProvider>
  );
}
