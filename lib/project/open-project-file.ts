import { cachedWorkspacePickerDirectory } from '@/lib/local-workspace';

interface OpenProjectPickerWindow extends Window {
  showOpenFilePicker?: (options: { startIn?: unknown; multiple: boolean; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ getFile(): Promise<File> }[]>;
}

/** Invoke during the click; the preferred handle is loaded before user interaction. */
export function openProjectFilePicker(userId: string): Promise<File | null> | null {
  const picker = (window as OpenProjectPickerWindow).showOpenFilePicker;
  if (!picker) return null;
  return picker.call(window, {
    startIn: cachedWorkspacePickerDirectory(userId), multiple: false,
    types: [{ description: 'Proyecto SonCeibe Studio', accept: { 'application/json': ['.scs', '.json'] } }],
  }).then(async handles => handles[0] ? handles[0].getFile() : null);
}
