import { expect, test } from '@playwright/test';

test('image adjustments reach the encoded MP4', async ({ page }) => {
  await page.goto('/');
  const report = await page.evaluate(() => window.studioTest.videoExportFixture(true));
  expect(report.audioTracks).toBe(1);
  for (const pixel of report.frames) {
    expect(Math.abs(pixel[0] - pixel[1])).toBeLessThan(8);
    expect(Math.abs(pixel[1] - pixel[2])).toBeLessThan(8);
    expect(pixel[0]).toBeGreaterThan(15);
  }
});

test('video image adjustments and export quality persist and reset', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => window.studioTest.seedVideo()); await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Vídeo del móvil', exact: true }).click();
  await page.getByRole('button', { name: 'Formato', exact: true }).click();
  const brightness = page.getByLabel('Brillo del vídeo', { exact: true });
  await brightness.fill('125');
  await page.getByLabel('Nitidez del vídeo', { exact: true }).fill('20');
  await expect.poll(async () => {
    const projects = await page.evaluate(() => window.studioTest.savedProjects());
    return projects[0].settings.background.videoAdjustments?.sharpness;
  }).toBe(20);
  await page.reload(); await page.getByRole('heading', { name: 'Vídeo del móvil', exact: true }).click();
  await page.getByRole('button', { name: 'Formato', exact: true }).click();
  await expect(brightness).toHaveValue('125');
  await expect(page.getByLabel('Nitidez del vídeo', { exact: true })).toHaveValue('20');
  await page.getByRole('button', { name: 'Restablecer imagen', exact: true }).click();
  await expect(brightness).toHaveValue('100');
  await expect(page.getByLabel('Nitidez del vídeo', { exact: true })).toHaveValue('0');
  await expect(page.getByRole('button', { name: 'Reel', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Reel', exact: true }).click();
  await page.getByRole('button', { name: '3. Exportar', exact: true }).click();
  const quality = page.getByRole('dialog').getByLabel('Calidad del MP4', { exact: true });
  await expect(quality).toHaveValue('balanced');
  await quality.selectOption('light'); await expect(quality).toHaveValue('light');
  await quality.selectOption('high');
  await expect.poll(async () => {
    const projects = await page.evaluate(() => window.studioTest.savedProjects());
    return projects[0].settings.exportConfig.quality;
  }).toBe('high');
});
