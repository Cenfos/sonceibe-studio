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
import { downloadCurrentProject } from '@/lib/project/download-current-project';
import { toast } from 'sonner';

export function StudioLayout() {
  const { activeTab, currentProject, updateSettings, undo, redo, markSaved, setExportOpen, setSettingsOpen, setTab } = useStore();
  const audio = useAudioEngineContext();

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

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
        if (!currentProject) return;
        try {
          markSaved();
          await downloadCurrentProject(currentProject, audio.audioEl?.src);
          toast.success('Proyecto descargado en formato .scs');
        } catch (error) {
          console.error('Failed to download project:', error);
          toast.error('No se pudo descargar el proyecto');
        }
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
  }, [undo, redo, markSaved, setExportOpen, setSettingsOpen, setTab, audio, currentProject]);

  useEffect(() => {
    if (audio.duration > 0 && currentProject) {
      const stored = currentProject.settings.audioDuration;
      if (Math.abs(stored - audio.duration) > 0.1) {
        updateSettings({ audioDuration: audio.duration });
      }
    }
  }, [audio.duration, currentProject, updateSettings]);

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
          <div className="flex-1 min-w-0 flex flex-col">
            {activeTab === 'lyrics' ? (
              <LyricsEditor />
            ) : (
              <PreviewPanel />
            )}
          </div>
          <PropertiesPanel />
        </div>
      </div>
      <Timeline />
    </div>
  );
}
