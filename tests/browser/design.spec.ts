import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
});

test('format contains photos and style contains a single preset picker which preserves the montage', async ({ page }) => {
  const guide = page.getByRole('region', { name: 'Creación guiada de vídeo' });
  await guide.getByRole('button', { name: '3. Formato', exact: true }).click();
  await expect(page.getByRole('button', { name: /Rústico · Ramas/ })).toHaveCount(0);
  await guide.getByLabel('Fotos múltiples', { exact: true }).setInputFiles([
    { name: 'one.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>') },
    { name: 'two.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="green"/></svg>') },
  ]);
  await expect.poll(() => page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.background.images.length)).toBe(3);
  const background = await page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.background);
  await guide.getByRole('button', { name: '4. Estilo', exact: true }).click();
  await expect(page.getByLabel('Fotos múltiples', { exact: true })).toHaveCount(0);
  const rustic = page.getByRole('button', { name: /Rústico · Ramas/ });
  await expect(rustic).toHaveCount(1);
  await rustic.click();
  await expect(rustic).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.visualStyle)).toBe('rustico-ramas');
  const saved = await page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.background);
  expect(saved.type).toBe('images'); expect(saved.images).toEqual(background.images);
  expect(saved.imageClips).toEqual(background.imageClips); expect(saved.photoClips).toEqual(background.photoClips);
  // The manual tools also show one section at a time.
  await page.getByRole('button', { name: 'Formato', exact: true }).click();
  await expect(rustic).toHaveCount(0);
  await expect(page.getByLabel('Fotos múltiples', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Estilo', exact: true }).click();
  await expect(rustic).toHaveCount(1);
  await page.reload(); await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Estilo', exact: true }).click();
  await expect(rustic).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Sin estilo · fondo vacío', exact: true }).click();
  await rustic.click();
  await page.locator('.studio-preview-stage canvas').screenshot({ path: 'test-results/rustic-style-preview.png' });
});

test.describe('mobile design sections', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('photos and styles have separate steps and the new frame works with existing photos', async ({ page }) => {
    await page.getByRole('button', { name: 'Formato', exact: true }).click();
    await expect(page.getByRole('button', { name: /Rústico · Ramas/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Añadir más fotos', exact: true })).toBeVisible();
    const background = await page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.background);
    await page.getByRole('button', { name: 'Estilo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Añadir más fotos', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /Rústico · Ramas/ }).click();
    await expect.poll(() => page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.visualStyle)).toBe('rustico-ramas');
    const saved = await page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.background);
    expect(saved.type).toBe('images'); expect(saved.images).toEqual(background.images); expect(saved.photoClips).toEqual(background.photoClips);
    await page.getByRole('button', { name: 'Vídeo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Crear MP4 para móvil', exact: true })).toBeVisible();
  });
});
