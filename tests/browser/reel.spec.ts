import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
});

test('Reels saves the range and cover, exports only the fragment and preserves the original', async ({ page }) => {
  await page.getByRole('button', { name: 'Reels', exact: true }).click();
  await page.getByLabel('Inicio (segundos)').fill('2');
  await page.getByLabel('Fin (segundos)').fill('4');
  await page.getByLabel('Portada del Reel').setInputFiles({ name: 'cover.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="108" height="192"><rect width="108" height="192" fill="red"/></svg>') });
  await expect(page.getByRole('link', { name: 'Descargar portada' })).toBeVisible();
  await page.screenshot({ path: 'test-results/reel-desktop.png' });
  await page.getByRole('button', { name: 'Crear Reel MP4' }).click();
  await expect(page.getByRole('link', { name: 'Descargar Reel', exact: true })).toBeVisible({ timeout: 30000 });
  const video = page.locator('[role="dialog"] video');
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.duration)).toBeGreaterThan(1.5);
  expect(await video.evaluate((el: HTMLVideoElement) => el.duration)).toBeLessThan(3);
  expect(await video.evaluate((el: HTMLVideoElement) => [el.videoWidth, el.videoHeight])).toEqual([1080, 1920]);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sonceibe-projects-v2:owner')!)[0].settings.reel?.end)).toBe(4);
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('sonceibe-projects-v2:owner')!)[0].settings);
  expect(settings.audioDuration).toBe(120); expect(settings.lyrics[1].end).toBe(120);
  expect(settings.background.photoClips).toHaveLength(1);
  await page.reload(); await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Reels', exact: true }).click();
  await expect(page.getByLabel('Inicio (segundos)')).toHaveValue('2');
  await expect(page.getByRole('link', { name: 'Descargar portada' })).toBeVisible();
  await page.getByLabel('Fin (segundos)').fill('1');
  await expect(page.getByRole('button', { name: 'Crear Reel MP4' })).toBeDisabled();
});

test('clear preset produces an empty background and can be undone', async ({ page }) => {
  await page.getByRole('button', { name: 'Sin estilo · fondo vacío', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sonceibe-projects-v2:owner')!)[0].settings.background.type)).toBe('color');
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sonceibe-projects-v2:owner')!)[0].settings.background.type)).toBe('images');
});

test.describe('phone', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test('mobile exposes Reels and does not restore a cleared style on export', async ({ page }) => {
  await page.getByRole('button', { name: /Fotos o estilo/ }).click();
  await page.getByRole('button', { name: 'Sin estilo · fondo vacío', exact: true }).click();
  await page.getByRole('button', { name: /Rock Galego/ }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sonceibe-projects-v2:owner')!)[0].settings.visualStyle)).toBe('rock-galego');
  await page.getByRole('button', { name: 'Sin estilo · fondo vacío', exact: true }).click();
  await page.getByRole('button', { name: 'Vídeo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reels', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reels', exact: true }).click();
  await page.screenshot({ path: 'test-results/reel-mobile.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Crear MP4 para móvil', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sonceibe-projects-v2:owner')!)[0].settings.visualStyle)).toBe('default');
});

});
