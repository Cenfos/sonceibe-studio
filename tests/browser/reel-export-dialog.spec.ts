import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('exports the saved Reel directly and keeps full-song export available', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.studioTest.seed();
    const key = 'sonceibe-projects-v2:owner';
    const projects = JSON.parse(localStorage.getItem(key)!);
    projects[0].settings.editingTarget = 'reel';
    projects[0].settings.reel = { start: 2, end: 4, coverUrl: '', showLyrics: true, showTitle: true, lyricsMode: 'custom', lyricsText: 'REEL GUARDADO', lyrics: [{ id: 'reel-line', text: 'REEL GUARDADO', start: 0, end: 2 }] };
    localStorage.setItem(key, JSON.stringify(projects));
  });
  await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Reel seleccionado', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByLabel('Resumen de exportación del Reel')).toContainText('2.0 s');
  await dialog.getByRole('button', { name: 'Canción completa', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Crear MP4 móvil 9:16', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: /PC \/ TV/ }).click();
  await expect(dialog.getByRole('button', { name: 'Canción completa', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: 'Crear MP4 PC 16:9', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Reel seleccionado', exact: true }).click();
  const downloadReady = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Crear Reel MP4', exact: true }).click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toContain('-reel');
  const bytes = await readFile((await download.path())!);
  expect(bytes.length).toBeGreaterThan(1000);
  const metadata = await page.evaluate(async base64 => {
    const data = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
    const video = document.createElement('video');
    try {
      await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('Invalid MP4')); video.src = url; });
      return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
    } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
  }, bytes.toString('base64'));
  expect(metadata.width).toBe(1080);
  expect(metadata.height).toBe(1920);
  expect(metadata.duration).toBeGreaterThan(1.8);
  expect(metadata.duration).toBeLessThan(2.5);
  await expect(dialog.getByText('Vídeo guardado correctamente')).toBeVisible();
});
