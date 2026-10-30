import { expect, test } from '@playwright/test';

test('video soundtrack can be kept, muted, replaced, or mixed with a song', async ({ page }) => {
  await page.goto('/'); const report = await page.evaluate(() => window.studioTest.videoMixFixture());
  expect(report.original.original).toBeGreaterThan(0.08); expect(report.original.song).toBeLessThan(0.005);
  expect(report.replaced.song).toBeGreaterThan(0.08); expect(report.replaced.original).toBeLessThan(0.005);
  expect(report.mixed.original).toBeGreaterThan(0.04); expect(report.mixed.song).toBeGreaterThan(0.04);
  expect(report.silent.original + report.silent.song).toBe(0);
  for (const result of Object.values(report)) expect(result.duration).toBeCloseTo(2.3, 2);
});
test('MP4 export uses moving source frames from the trimmed interval and includes the song', async ({ page }) => {
  await page.goto('/'); const report = await page.evaluate(() => window.studioTest.videoExportFixture());
  expect(report.size).toBeGreaterThan(10000); expect(report.duration).toBeGreaterThan(2.1); expect(report.duration).toBeLessThan(3.1);
  expect(report.audioTracks).toBe(1);
  expect(report.frames[0][0]).toBeGreaterThan(150); expect(report.frames[0][1]).toBeLessThan(80);
  expect(report.frames[1][1]).toBeGreaterThan(150); expect(report.frames[1][0]).toBeLessThan(80);
});
test('portable project and duplicate preserve source video, trim and framing', async ({ page }) => {
  await page.goto('/'); const report = await page.evaluate(() => window.studioTest.videoPersistenceFixture());
  expect(report.restoredSize).toBe(report.sourceSize); expect(report.copiedSize).toBe(report.sourceSize);
  expect(report.copyKey).not.toBe(report.sourceKey); expect(report.audio).toBeNull();
  expect(report.bg.videoStart).toBe(0.5); expect(report.bg.videoEnd).toBe(2.8); expect(report.bg.videoMuted).toBe(true);
  expect(report.bg.videoPlacement).toEqual({ scale: 120, x: 30, y: 70, fit: 'cover' });
});
test('video-only project restores, plays, trims and exposes background controls', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => window.studioTest.seedVideo()); await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Vídeo del móvil', exact: true }).click();
  await page.getByRole('button', { name: 'Formato', exact: true }).click();
  await expect(page.getByLabel('Inicio del vídeo', { exact: true })).toHaveValue('0.5');
  await expect(page.getByLabel('Final del vídeo', { exact: true })).toHaveValue('2.8');
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.getByLabel('Mantener sonido original', { exact: true }).uncheck();
  await page.getByLabel('Inicio del vídeo', { exact: true }).fill('1');
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled();
  await page.reload(); await page.getByRole('heading', { name: 'Vídeo del móvil', exact: true }).click();
  await page.getByRole('button', { name: 'Formato', exact: true }).click();
  await expect(page.getByLabel('Inicio del vídeo', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('Mantener sonido original', { exact: true })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/video-background-desktop.png' });
});

test.describe('phone video background', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('video controls fit the phone and support original sound without a separate song', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => window.studioTest.seedVideo()); await page.goto('/?ui');
    await page.getByRole('heading', { name: 'Vídeo del móvil', exact: true }).click();
    await expect(page.getByLabel('Inicio del vídeo', { exact: true })).toHaveValue('0.5');
    await expect(page.getByLabel('Mantener sonido original', { exact: true })).toBeChecked();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel('Mantener sonido original', { exact: true }).uncheck();
    await expect(page.getByLabel('Mantener sonido original', { exact: true })).not.toBeChecked();
    await page.screenshot({ path: 'test-results/video-background-mobile.png' });
  });
});
