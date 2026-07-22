'use client';

import { useEffect } from 'react';
import { TopBar } from './top-bar';
import { SidebarRail } from './sidebar-rail';
import { PreviewPanel } from './preview/preview-panel';
import { PropertiesPanel } from './properties/properties-panel';
import { Timeline } from './timeline/timeline';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { LyricsEditor } from './lyrics/lyrics-editor';
import { toast } from 'sonner';

export function StudioLayout() {
  const { activeTab, currentProject, updateSettings, undo, redo, markSaved, setExportOpen, setSettingsOpen, setTab } = useStore();
  const audio = useAudioEngineContext();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Ctrl+Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      // Ctrl+Y or Ctrl+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      // Ctrl+S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        markSaved();
        toast.success('Proyecto guardado');
        return;
      }
      // Ctrl+E = Export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setExportOpen(true);
        return;
      }
      // Ctrl+O = Open settings (audio import)
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }
      // Ctrl+F = Search (only in lyrics tab)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setTab('lyrics');
        return;
      }
      // Space = Play/pause (only when not in input)
      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        if (audio.isPlaying) audio.pause();
        else audio.play();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, markSaved, setExportOpen, setSettingsOpen, setTab, audio]);

  // Sync real audio duration to project settings
  useEffect(() => {
    if (audio.duration > 0 && currentProject) {
      const stored = currentProject.settings.audioDuration;
      if (Math.abs(stored - audio.duration) > 0.1) {
        updateSettings({ audioDuration: audio.duration });
      }
    }
  }, [audio.duration, currentProject, updateSettings]);

  // Load audio from existing project URL on mount
  useEffect(() => {
    if (currentProject?.settings.audioUrl && audio.audioEl) {
      audio.loadFromUrl(currentProject.settings.audioUrl, currentProject.settings.audioName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  return (
    <div className="flex flex-col h-full">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <SidebarRail />
        <div className="flex flex-1 min-w-0">
          {/* Center: Preview (or lyrics editor full width) */}
          <div className="flex-1 min-w-0 flex flex-col">
            {activeTab === 'lyrics' ? (
              <LyricsEditor />
            ) : (
              <PreviewPanel />
            )}
          </div>
          {/* Right: Properties */}
          <PropertiesPanel />
        </div>
      </div>
      {/* Bottom: Timeline */}
      <Timeline />
    </div>
  );
}
