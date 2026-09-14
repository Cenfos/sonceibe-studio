'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useStudioUserId } from '@/lib/studio-user-context';
import { saveProjectsToWorkspace } from '@/lib/local-workspace';

export function WorkspaceSync() {
  const { projects } = useStore();
  const userId = useStudioUserId();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveProjectsToWorkspace(userId, projects).catch((error) => {
        console.warn('Workspace autosave skipped:', error);
      });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [projects, userId]);

  return null;
}
