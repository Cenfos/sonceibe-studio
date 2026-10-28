'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useAudioEngineContext } from '@/lib/audio-engine-context';
import { useStudioUserId } from '@/lib/studio-user-context';
import { getProjectAudio, LOCAL_AUDIO_URL, saveProjectAudio } from '@/lib/local-media-storage';
import { getProjectAudioFromWorkspace } from '@/lib/local-workspace';
import { toast } from 'sonner';

// Project media belongs to the shared audio session, rather than either view.
export function ProjectAudioRestore() {
  const { currentProject, updateSettings } = useStore();
  const audio = useAudioEngineContext();
  const userId = useStudioUserId();
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

  return null;
}
