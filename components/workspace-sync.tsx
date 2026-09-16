'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { useStudioUserId } from '@/lib/studio-user-context';
import { getProjectAudio } from '@/lib/local-media-storage';
import { deleteProjectLocalData } from '@/lib/project-deletion';
import { saveProjectAudioToWorkspace, saveProjectsToWorkspace } from '@/lib/local-workspace';

export function WorkspaceSync() {
  const { projects } = useStore();
  const userId = useStudioUserId();
  const copiedAudio = useRef(new Set<string>());
  const previousProjectIds = useRef(new Set(projects.map((project) => project.id)));

  useEffect(() => {
    const currentIds = new Set(projects.map((project) => project.id));
    const removedIds = Array.from(previousProjectIds.current).filter((id) => !currentIds.has(id));
    previousProjectIds.current = currentIds;

    for (const projectId of removedIds) {
      void deleteProjectLocalData(userId, projectId).catch((error) => {
        console.warn('Local project cleanup skipped:', error);
      });
    }
  }, [projects, userId]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const savedCount = await saveProjectsToWorkspace(userId, projects);
        if (savedCount === 0) return;

        for (const project of projects) {
          const audioName = project.settings.audioName;
          if (!audioName) continue;

          const signature = `${project.id}:${audioName}`;
          if (copiedAudio.current.has(signature)) continue;

          const file = await getProjectAudio(userId, project.id);
          if (!file) continue;

          const copied = await saveProjectAudioToWorkspace(userId, project.id, file);
          if (copied) copiedAudio.current.add(signature);
        }
      } catch (error) {
        console.warn('Workspace autosave skipped:', error);
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [projects, userId]);

  return null;
}
