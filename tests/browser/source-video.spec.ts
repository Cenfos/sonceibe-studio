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

for (const style of [false, true]) {
  test(`phone footage Reel creates and downloads the selected MP4${style ? ' with a prepared style' : ''}`, async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => window.studioTest.seedVideo()); await page.goto('/?ui');
    await page.getByRole('heading', { name: 'Vídeo del móvil', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled();
    if (style) {
      await page.getByRole('button', { name: 'Estilo', exact: true }).click();
      await page.getByRole('button', { name: /Rústico · Ramas/ }).click();
      await page.screenshot({ path: 'test-results/video-style-border-only.png' });
    }
    await page.getByRole('button', { name: 'Reel', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Inicio (segundos)').fill('0.3');
    await dialog.getByLabel('Fin (segundos)').fill('1.8');
    await dialog.getByRole('button', { name: '3. Exportar', exact: true }).click();
    await dialog.getByRole('button', { name: 'Crear Reel MP4', exact: true }).click();
    await expect(dialog.getByRole('link', { name: 'Descargar Reel', exact: true })).toBeVisible({ timeout: 25000 });
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    const video = dialog.locator('video');
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.duration)).toBeGreaterThan(1.3);
    expect(await video.evaluate((el: HTMLVideoElement) => el.duration)).toBeLessThan(2.2);
    expect(await video.evaluate((el: HTMLVideoElement) => [el.videoWidth, el.videoHeight])).toEqual([1080, 1920]);
    const download = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'Descargar Reel', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/reel.*\.mp4$/);
  });
}

test('every prepared video style keeps the center transparent, with its border and logo', async ({ page }) => {
  await page.goto('/'); const reports = await page.evaluate(() => window.studioTest.videoStylesFixture());
  expect(reports.length).toBeGreaterThan(7);
  for (const report of reports) {
    expect(report.videoUrl, report.id).toBe(true);
    expect(report.centers[0][0], report.id).toBeGreaterThan(180); expect(report.centers[0][1], report.id).toBeLessThan(60);
    expect(report.centers[1][1], report.id).toBeGreaterThan(170); expect(report.centers[1][0], report.id).toBeLessThan(60);
    expect(report.legacyCenter, report.id).toEqual(report.centers[1]);
    expect(report.edgeDifferences, report.id).toBeGreaterThan(30); expect(report.logos, report.id).toBeGreaterThan(0);
  }
});

test('video Reel exports and downloads without media-element captureStream or an ended listener', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'captureStream', { configurable: true, value: undefined });
    Object.defineProperty(HTMLMediaElement.prototype, 'mozCaptureStream', { configurable: true, value: undefined });
    const add = HTMLMediaElement.prototype.addEventListener;
    HTMLMediaElement.prototype.addEventListener = function(this: HTMLMediaElement, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
      if (type !== 'ended') add.call(this, type, listener, options);
    } as typeof add;
  });
  await page.goto('/'); await page.evaluate(() => window.studioTest.seedVideo()); await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Vídeo del móvil', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Reel', exact: true }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Inicio (segundos)').fill('0.3'); await dialog.getByLabel('Fin (segundos)').fill('1.8');
  await dialog.getByRole('button', { name: '3. Exportar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Crear Reel MP4', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Descargar Reel', exact: true })).toBeVisible({ timeout: 25000 });
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  const soundUrl = await dialog.locator('video').getAttribute('src');
  expect(await page.evaluate(url => window.studioTest.videoSoundRms(url!), soundUrl)).toBeGreaterThan(0.025);
  const download = page.waitForEvent('download'); await dialog.getByRole('link', { name: 'Descargar Reel', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/reel.*\.mp4$/);
});

test.describe('phone video Reel regression', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('prepared style preserves footage and the trimmed Reel downloads with original sound', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'captureStream', { configurable: true, value: undefined });
      Object.defineProperty(HTMLMediaElement.prototype, 'mozCaptureStream', { configurable: true, value: undefined });
    });
    await page.goto('/'); await page.evaluate(() => window.studioTest.seedVideo()); await page.goto('/?ui');
    await page.getByRole('heading', { name: 'Vídeo del móvil', exact: true }).click();
    await page.getByRole('button', { name: 'Estilo', exact: true }).click();
    await page.getByRole('button', { name: /Papel e Tinta/ }).click();
    await expect.poll(() => page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.visualStyle)).toBe('papel-e-tinta');
    const saved = await page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings);
    expect(saved.background.type).toBe('video'); expect(saved.background.videoUrl).toContain('source-video/');
    expect(saved.background.videoStart).toBe(0.5); expect(saved.background.videoEnd).toBe(2.8);
    expect(saved.background.videoMuted).not.toBe(true); expect(saved.background.overlay).toBe(0);
    await page.getByRole('button', { name: 'Vídeo', exact: true }).click();
    await page.getByRole('button', { name: 'Reels', exact: true }).click(); const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Inicio (segundos)').fill('0.3'); await dialog.getByLabel('Fin (segundos)').fill('1.8');
    await dialog.getByRole('button', { name: '3. Exportar', exact: true }).click();
    await dialog.getByRole('button', { name: 'Crear Reel MP4', exact: true }).click();
    await expect(dialog.getByRole('link', { name: 'Descargar Reel', exact: true })).toBeVisible({ timeout: 25000 });
    const soundUrl = await dialog.locator('video').getAttribute('src');
    expect(await page.evaluate(url => window.studioTest.videoSoundRms(url!), soundUrl)).toBeGreaterThan(0.025);
    await expect(dialog.getByRole('link', { name: 'Descargar Reel', exact: true })).toBeInViewport();
    await page.screenshot({ path: 'test-results/video-reel-phone-export.png' });
    const download = page.waitForEvent('download'); await dialog.getByRole('link', { name: 'Descargar Reel', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/reel.*\.mp4$/);
  });
});

test('a previously saved empty video Reel recovers after the soundtrack is ready', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => window.studioTest.seedVideo(true)); await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Vídeo del móvil', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Reel', exact: true });
  await expect(trigger).toBeEnabled(); await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Inicio (segundos)')).toHaveValue('0');
  await expect.poll(() => dialog.getByLabel('Fin (segundos)').inputValue()).not.toBe('0');
  await dialog.getByLabel('Fin (segundos)').fill('1.5');
  await dialog.getByRole('button', { name: '3. Exportar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Crear Reel MP4', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Descargar Reel', exact: true })).toBeVisible({ timeout: 25000 });
});
