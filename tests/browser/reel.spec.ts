import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
});

test('Reels saves the range and cover, exports only the fragment and preserves the original', async ({ page }) => {
  await page.getByRole('button', { name: 'Seleccionar Reel', exact: true }).click();
  const ruler = page.getByRole('slider', { name: 'Cursor de reproducción', exact: true });
  await ruler.click({ position: { x: 40, y: 12 } });
  await page.getByRole('button', { name: 'Marcar inicio aquí' }).click();
  await ruler.click({ position: { x: 80, y: 12 } });
  await page.getByRole('button', { name: 'Marcar fin aquí' }).click();
  await expect(page.getByRole('slider', { name: 'Inicio de Reel', exact: true })).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByRole('slider', { name: 'Final de Reel', exact: true })).toHaveAttribute('aria-valuenow', '4');
  await page.screenshot({ path: 'test-results/reel-timeline.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Crear Reel', exact: true }).click();
  await expect(page.getByLabel('Inicio (segundos)')).toHaveCount(0);
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
  await expect(page.getByRole('slider', { name: 'Inicio de Reel', exact: true })).toHaveAttribute('aria-valuenow', '2');
  await page.getByRole('button', { name: 'Crear Reel', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Descargar portada' })).toBeVisible();

});


test('timeline Reel handles drag after scroll, support fine keys and undo', async ({ page }) => {
  await page.getByRole('button', { name: 'Seleccionar Reel', exact: true }).click();
  await page.locator('.studio-timeline-scroll').evaluate(el => el.scrollLeft = 200);
  const end = page.getByRole('slider', { name: 'Final de Reel', exact: true });
  const box = (await end.boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + 12); await page.mouse.down();
  await page.mouse.move(box.x + 104, box.y + 12, { steps: 8 }); await page.mouse.up();
  await expect(end).toHaveAttribute('aria-valuenow', '35');
  await end.focus(); await page.keyboard.press('Alt+ArrowLeft');
  await expect(end).toHaveAttribute('aria-valuenow', '34.99');
  await page.keyboard.press('Control+z');
  await expect(end).toHaveAttribute('aria-valuenow', '35');
  await page.keyboard.press('Control+z');
  await expect(end).toHaveAttribute('aria-valuenow', '30');
  await page.locator('.studio-timeline-scroll').evaluate(el => el.scrollLeft = 1000);
  const area = (await page.locator('.studio-timeline-scroll').boundingBox())!;
  const ruler = (await page.getByRole('slider', { name: 'Cursor de reproducción', exact: true }).boundingBox())!;
  await page.mouse.click(area.x + 400, ruler.y + 12);
  await page.getByRole('button', { name: 'Marcar inicio aquí' }).click();
  await expect(page.getByRole('slider', { name: 'Inicio de Reel', exact: true })).toHaveAttribute('aria-valuenow', '70');
  await expect(end).toHaveAttribute('aria-valuenow', '100');
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
