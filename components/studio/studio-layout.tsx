'use client';

import { useEffect, useState } from 'react';
import { TopBar } from './top-bar';
import { SidebarRail } from './sidebar-rail';
import { PreviewPanel } from './preview/preview-panel';
import { PropertiesPanel } from './properties/properties-panel';
import { Timeline } from './timeline/timeline';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { useStudioUserId } from '@/lib/studio-user-context';
import { getProjectAudio, LOCAL_AUDIO_URL, saveProjectAudio } from '@/lib/local-media-storage';
import { getProjectAudioFromWorkspace } from '@/lib/local-workspace';
import { LyricsEditor } from './lyrics/lyrics-editor';
import { MobileOrientationGate } from './mobile-orientation-gate';
import { toast } from 'sonner';

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
  const userId = useStudioUserId();
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

    let cancelled = false;
    const projectId = currentProject.id;
    const { audioUrl, audioName } = currentProject.settings;

    const restoreAudio = async () => {
      try {
        if (audioName || audioUrl === LOCAL_AUDIO_URL) {
          const storedFile = await getProjectAudio(userId, projectId);
          if (cancelled) return;

          if (storedFile) {
            await audio.loadFile(storedFile);
            if (audioUrl !== LOCAL_AUDIO_URL || audioName !== storedFile.name) {
              updateSettings({ audioUrl: LOCAL_AUDIO_URL, audioName: storedFile.name });
            }
            return;
          }

          const workspaceFile = audioName
            ? await getProjectAudioFromWorkspace(userId, projectId, audioName)
            : null;
          if (cancelled) return;

          if (workspaceFile) {
            await saveProjectAudio(userId, projectId, workspaceFile);
            await audio.loadFile(workspaceFile);
            updateSettings({ audioUrl: LOCAL_AUDIO_URL, audioName: workspaceFile.name });
            toast.success('Audio recuperado desde la carpeta de trabajo');
            return;
          }
        }

        // Migrate a still-valid legacy blob URL from older Studio versions.
        if (audioUrl?.startsWith('blob:') && audioName) {
          try {
            const response = await fetch(audioUrl);
            if (!response.ok) throw new Error('Legacy blob unavailable');
            const blob = await response.blob();
            const file = new File([blob], audioName, { type: blob.type || 'audio/mpeg' });
            await saveProjectAudio(userId, projectId, file);
            if (cancelled) return;
            await audio.loadFile(file);
            updateSettings({ audioUrl: LOCAL_AUDIO_URL, audioName: file.name });
            return;
          } catch {
            // The blob URL normally expires after closing/reloading the browser.
          }
        }

        if (audioUrl && audioUrl !== LOCAL_AUDIO_URL && !audioUrl.startsWith('blob:')) {
          await audio.loadFromUrl(audioUrl, audioName);
          return;
        }

        audio.clear();
        if (audioName) {
          toast.warning(`No encuentro el audio guardado de este proyecto (${audioName}). Cárgalo una vez más y quedará guardado localmente.`);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to restore project audio:', error);
        audio.clear();
        toast.error('No se pudo recuperar el audio local de este proyecto');
      }
    };

    restoreAudio();
    return () => {
      cancelled = true;
    };
    // Restore when switching projects and once the audio element becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, userId, audio.audioEl]);

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
