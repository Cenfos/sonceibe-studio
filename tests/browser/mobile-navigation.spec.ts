import { expect, test } from '@playwright/test';

test.describe('mobile text and Back', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('text settings persist and Back returns to the beginning before confirming exit', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
    await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
    await page.getByRole('button', { name: 'Estilo', exact: true }).click();
    await page.getByLabel('Tamaño de la letra', { exact: true }).fill('90');
    await page.getByLabel('Color de la letra', { exact: true }).fill('#ff5500');
    await page.getByLabel('Posición de la letra', { exact: true }).selectOption('bottom');
    await page.getByLabel('Mostrar título de la canción').uncheck();
    await expect.poll(async () => {
      const p = (await page.evaluate(() => window.studioTest.savedProjects()))[0].settings;
      return [p.text.fontSize, p.text.color, p.text.position, p.showTitle];
    }).toEqual([90, '#ff5500', 'bottom', false]);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Audio y vídeo', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: '¿Salir del proyecto?' })).not.toBeVisible();
    await page.goBack();
    const dialog = page.getByRole('dialog', { name: '¿Salir del proyecto?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Seguir editando' }).click();
    await page.getByRole('button', { name: 'Ver proyecto', exact: true }).click();
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Vista previa del proyecto' })).not.toBeVisible();
    await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: 'Volver a proyectos', exact: true }).click();
    await dialog.getByRole('button', { name: 'Salir del proyecto', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'SonCeibe Studio', exact: true })).toBeVisible();
    await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
    await page.getByRole('button', { name: 'Estilo', exact: true }).click();
    await expect(page.getByLabel('Tamaño de la letra', { exact: true })).toHaveValue('90');
    await expect(page.getByLabel('Color de la letra', { exact: true })).toHaveValue('#ff5500');
    await expect(page.getByLabel('Posición de la letra', { exact: true })).toHaveValue('bottom');
    await expect(page.getByLabel('Mostrar título de la canción')).not.toBeChecked();
    await page.screenshot({ path: 'test-results/mobile-text-controls.png' });
  });
});

test('Open project starts in the remembered workspace and imports the selected file', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.studioTest.seed();
    const request = indexedDB.open('sonceibe-studio-workspace-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('handles', { keyPath: 'userId' });
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = reject; });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put({ userId: 'owner', handle: { kind: 'directory', name: 'Mis proyectos Studio' }, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(); tx.onerror = reject;
    }); db.close();
  });
  await page.addInitScript(() => {
    const pickerWindow = window as Window & { pickerStartFolder?: string; showOpenFilePicker?: (options: { startIn?: { name?: string } }) => Promise<{ getFile(): Promise<File> }[]> };
    pickerWindow.showOpenFilePicker = async options => {
      pickerWindow.pickerStartFolder = options.startIn?.name;
      const project = (await window.studioTest.savedProjects())[0];
      project.id = 'opened-from-folder'; project.settings.title = 'Desde carpeta preferida';
      project.settings.audioName = ''; project.settings.audioUrl = ''; project.settings.audioDuration = 0;
      return [{ getFile: async () => new File([JSON.stringify({ format: 'sonceibe-studio', version: 1, project, audioDataUrl: null })], 'preferido.scs', { type: 'application/json' }) }];
    };
  });
  await page.goto('/?ui');
  await page.getByRole('button', { name: 'Abrir proyecto .scs' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { pickerStartFolder?: string }).pickerStartFolder)).toBe('Mis proyectos Studio');
  await expect(page.getByText('Desde carpeta preferida', { exact: true }).first()).toBeVisible();
});
