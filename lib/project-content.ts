import { createDefaultProjectSettings, type ProjectSettings } from './types';
import { isDefaultProjectTitle } from './project-title';

// Ignore timestamps and automatic device/export defaults, not user content.
export function hasProjectContent(settings: ProjectSettings): boolean {
  const defaults = createDefaultProjectSettings();
  const comparable = (value: ProjectSettings) => {
    const { createdAt, updatedAt, exportConfig, syncProgress, background, title, ...rest } = value;
    const { imageFit, ...backgroundContent } = background;
    return { ...rest, title: isDefaultProjectTitle(title) ? '' : title.trim(), background: backgroundContent };
  };
  return JSON.stringify(comparable(settings)) !== JSON.stringify(comparable(defaults));
}
