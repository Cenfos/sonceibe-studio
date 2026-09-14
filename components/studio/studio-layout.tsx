'use client';

import { useEffect, useState } from 'react';
import { TopBar } from './top-bar';
import { SidebarRail } from './sidebar-rail';
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
    currentProject,
    updateSettings,
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
        setExportOpen(true);
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

  useEffect(() => {
    if (audio.duration > 0 && currentProject) {
      const stored = currentProject.settings.audioDuration;
      if (Math.abs(stored - audio.duration) > 0.1) {
        updateSettings({ audioDuration: audio.duration });
      }
    }
  }, [audio.duration, currentProject, updateSettings]);

  useEffect(() => {
    if (!currentProject || !audio.audioEl) return;

    if (currentProject.settings.audioUrl) {
      audio.loadFromUrl(currentProject.settings.audioUrl, currentProject.settings.audioName);
    } else {
      audio.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  const handleTabSelected = (tab: 'text' | 'background' | 'animation' | 'effects' | 'lyrics') => {
    if (tab === 'lyrics') {
      setMobilePropertiesOpen(false);
      return;
    }
    setMobilePropertiesOpen(true);
  };

  return (
    <>
      <MobileOrientationGate />
      <div className="studio-editor-shell flex flex-col h-full">
        <TopBar />
        <div className="flex flex-1 min-h-0">
          <SidebarRail onTabSelected={handleTabSelected} />
          <div className="flex flex-1 min-w-0">
            <div className="flex-1 min-w-0 flex flex-col">
              {activeTab === 'lyrics' ? (
                <LyricsEditor />
              ) : (
                <PreviewPanel />
              )}
            </div>
            <PropertiesPanel
              mobileOpen={mobilePropertiesOpen}
              onMobileClose={() => setMobilePropertiesOpen(false)}
            />
          </div>
        </div>
        <Timeline />
      </div>
    </>
  );
}
