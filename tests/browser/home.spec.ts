import { expect, test } from '@playwright/test';

test('home focuses on starting or continuing projects and removes catalogue and tutorials', async ({ page }) => {
  await page.goto('/?ui');
  await expect(page.getByRole('heading', { name: 'SonCeibe Studio', exact: true })).toBeVisible();
  await expect(page.getByText('Empieza con una canción, tus fotos o un vídeo del móvil.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estilos preparados' })).toHaveCount(0);
  await expect(page.getByText(/Tutoriales/)).toHaveCount(0);
  await expect(page.getByText('Artista desconocido')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tu próximo vídeo empieza aquí' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo Proyecto', exact: true }).click();
  await page.getByLabel('Título de la canción (opcional)').fill('Mi nuevo vídeo');
  await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  await expect(page.locator('.studio-editor-shell')).toBeVisible();
});
for (const artist of ['', 'Artista desconocido', 'Son Ceibe']) {
  test(`project card opens the saved editor directly and handles artist ${artist || 'empty'}`, async ({ page }) => {
    await page.goto('/'); await page.evaluate(artist => window.studioTest.seed(artist), artist); await page.goto('/?ui');
    await expect(page.getByText('Artista desconocido', { exact: true })).toHaveCount(0);
    if (artist === 'Son Ceibe') await expect(page.getByText('Son Ceibe', { exact: true })).toBeVisible();
    const project = page.getByRole('button', { name: 'Abrir Prueba Studio', exact: true });
    await expect(project).toBeVisible();
    await page.getByRole('button', { name: 'Opciones de Prueba Studio', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Duplicar proyecto' })).toBeVisible();
    await expect(page.locator('.studio-editor-shell')).toHaveCount(0); await page.keyboard.press('Escape');
    await project.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.studio-editor-shell')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Letra 1', exact: true })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Guardar proyecto .scs', exact: true })).toBeVisible();
  });
}
test('home is compact and its project thumbnail opens the editor with one click', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
  const project = page.getByRole('button', { name: 'Abrir Prueba Studio', exact: true });
  await expect(project).toBeVisible();
  await page.screenshot({ path: 'test-results/home-desktop.png' });
  await project.click({ position: { x: 30, y: 30 } });
  await expect(page.locator('.studio-editor-shell')).toBeVisible();
});
test.describe('phone home', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('summary and projects fit the phone and a card opens the saved mobile editor', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
    await expect(page.getByRole('button', { name: 'Abrir Prueba Studio', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByText('Artista desconocido')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/home-mobile.png' });
    await page.getByRole('button', { name: 'Abrir Prueba Studio', exact: true }).click();
    await expect(page.locator('.mobile-studio-wizard')).toBeVisible();
    await expect(page.getByText('Prueba Studio', { exact: true })).toBeVisible();
  });
});
