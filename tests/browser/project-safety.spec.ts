import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.studioTest.seed());
});

test('damaged storage remains untouched until its original is downloaded and a valid backup restored', async ({ page }) => {
  await page.evaluate(() => {
    const key = 'sonceibe-projects-v2:owner';
    localStorage.setItem(`${key}:backup`, localStorage.getItem(key)!);
    localStorage.setItem(key, '{original dañado');
  });
  await page.goto('/?ui');
  await expect(page.getByRole('heading', { name: 'Tus datos necesitan recuperación' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restaurar copia válida' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('sonceibe-projects-v2:owner'))).toBe('{original dañado');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar datos originales' }).click();
  expect((await downloaded).suggestedFilename()).toBe('sonceibe-datos-para-recuperar.json');
  await page.getByRole('button', { name: 'Restaurar copia válida' }).click();
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Prueba Studio', exact: true })).toBeVisible();
});

test('malformed imports leave the saved project unchanged', async ({ page }) => {
  await page.goto('/?ui');
  const before = await page.evaluate(() => window.studioTest.savedProjects());
  const rejected = page.waitForEvent('console', { predicate: message => message.type() === 'error' && message.text().includes('Project import failed:') });
  await page.locator('input[accept=".scs,application/json"]').setInputFiles({
    name: 'broken.scs', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'sonceibe-studio', version: 1, project: { id: 'bad', settings: { title: 'Daño', lyrics: 'invalid' } } })),
  });
  expect((await rejected).text()).toContain('El proyecto contiene ajustes o recursos no válidos. El original se conserva.');
  expect(await page.evaluate(() => window.studioTest.savedProjects())).toEqual(before);
});

test('export defaults to the selected Reel and full-song export requires choosing that scope', async ({ page }) => {
  await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Reel', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Inicio (segundos)').fill('40');
  await dialog.getByLabel('Fin (segundos)').fill('45');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Editando Reel · 40.0–45.0 s · 5.0 s', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Reel seleccionado', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByText('Vas a crear un Reel:', { exact: false })).toContainText('40.0–45.0 s · 5.0 s');
  await expect(dialog.getByRole('button', { name: 'Crear MP4 móvil 9:16', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Canción completa', exact: true }).click();
  await expect(dialog.getByText('Vas a crear el vídeo de la canción completa:', { exact: false })).toContainText('120.0 s');
  await expect(dialog.getByRole('button', { name: 'Crear MP4 móvil 9:16', exact: true })).toBeVisible();
});

test('unfinished video upload and fabricated preferences are absent', async ({ page }) => {
  await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Fondo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Subir video', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Más opciones', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('GPU activada', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Notificaciones', { exact: true })).toHaveCount(0);
  await expect(page.getByText('0.1.0', { exact: true })).toBeVisible();
});
