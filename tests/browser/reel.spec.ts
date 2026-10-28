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


test('guided Reel offers quick durations and keeps exact manual editing', async ({ page }) => {
  await page.getByRole('button', { name: 'Reel', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '15 segundos', exact: true }).click();
  await expect(dialog.getByLabel('Fin (segundos)')).toHaveValue('15');
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(dialog.getByLabel('Portada del Reel')).toBeVisible();
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(dialog.getByLabel('Resumen del Reel')).toContainText('15.0 s');
  await dialog.getByRole('button', { name: 'Ajustar manualmente' }).click();
  await dialog.getByLabel('Inicio (segundos)').fill('2');
  await dialog.getByLabel('Fin (segundos)').fill('7');
  await expect(dialog.getByLabel('Resumen del Reel')).toContainText('5.0 s');
  await dialog.getByRole('button', { name: 'Volver a la guía' }).click();
  await dialog.getByRole('button', { name: '1. Fragmento', exact: true }).click();
  await expect(dialog.getByLabel('Inicio (segundos)')).toHaveValue('2');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Seleccionar Reel', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider', { name: 'Inicio de Reel', exact: true })).toHaveAttribute('aria-valuenow', '2');
});

test('video guide allows manual editing and format selection', async ({ page }) => {
  const guide = page.getByRole('region', { name: 'Creación guiada de vídeo' });
  await guide.getByRole('button', { name: 'Editar manualmente' }).click();
  await expect(guide.getByRole('button', { name: '1. Audio' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fondo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sin estilo · fondo vacío', exact: true })).toBeVisible();
  await guide.getByRole('button', { name: 'Abrir guía' }).click();
  await guide.getByRole('button', { name: '2. Formato', exact: true }).click();
  await guide.getByRole('button', { name: 'Horizontal · 16:9' }).click();
  await expect(guide.getByRole('button', { name: 'Horizontal · 16:9' })).toHaveAttribute('aria-pressed', 'true');
  await guide.getByRole('button', { name: '4. Exportar', exact: true }).click();
  await guide.getByRole('button', { name: 'Revisar y exportar vídeo' }).click();
  await expect(page.getByRole('dialog')).toContainText('Duración completa');
});


test('Reel lyrics sync only the selected audio and persist separately from project lyrics', async ({ page }) => {
  await page.getByRole('button', { name: 'Reel', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Inicio (segundos)').fill('40');
  await dialog.getByLabel('Fin (segundos)').fill('43');
  await dialog.getByRole('button', { name: '2. Diseño', exact: true }).click();
  await dialog.getByRole('button', { name: 'Letra sólo para este Reel' }).click();
  await dialog.getByLabel('Frases del Reel', { exact: true }).fill('Frase exclusiva');
  await dialog.getByRole('button', { name: 'Preparar frases', exact: true }).click();
  await dialog.getByRole('button', { name: 'Sincronizar sólo este fragmento' }).click();
  await expect.poll(async () => parseFloat(await dialog.getByLabel('Posición de sincronización').innerText())).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: 'Marcar entrada de frase' }).click();
  await expect(dialog.getByRole('button', { name: 'Marcar final y terminar' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Sincronizar sólo este fragmento' })).toBeVisible({ timeout: 6000 });
  await dialog.getByRole('button', { name: '3. Exportar', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Crear Reel MP4', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Crear Reel MP4', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Descargar Reel', exact: true })).toBeVisible({ timeout: 30000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sonceibe-projects-v2:owner')!)[0].settings);
  expect(saved.lyrics[0].text).toBe('Primera frase');
  expect(saved.lyrics[1].start).toBe(110);
  expect(saved.reel.lyrics[0]).toMatchObject({ text: 'Frase exclusiva', end: 3 });
  expect(saved.reel.lyrics[0].start).toBeLessThan(3);
  await page.reload(); await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Reel', exact: true }).click();
  await dialog.getByRole('button', { name: '2. Diseño', exact: true }).click();
  await expect(dialog.getByLabel('Frases del Reel', { exact: true })).toHaveValue('Frase exclusiva');
  await dialog.getByRole('button', { name: 'Usar letra del proyecto' }).click();
  await expect(dialog.getByText('No hay letra sincronizada en este fragmento.', { exact: false })).toBeVisible();
});


test('boundary sliders seek audio and current-position buttons preserve an arbitrary Reel length', async ({ page }) => {
  await page.getByRole('button', { name: 'Reel', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Inicio (segundos)').fill('50');
  await dialog.getByRole('slider', { name: 'Mover inicio', exact: true }).press('ArrowRight');
  await dialog.getByRole('button', { name: 'Usar posición actual como inicio' }).click();
  await expect(dialog.getByLabel('Inicio (segundos)')).toHaveValue('50.01');
  await dialog.getByLabel('Fin (segundos)').fill('83.72');
  await dialog.getByRole('slider', { name: 'Mover fin', exact: true }).press('ArrowLeft');
  await dialog.getByRole('button', { name: 'Usar posición actual como fin' }).click();
  await expect(dialog.getByLabel('Fin (segundos)')).toHaveValue('83.71');
  await expect(dialog.getByText('Duración del Reel: 33.7 s', { exact: true })).toBeVisible();
  // Use a short arbitrary interval to check actual playback and MP4 duration.
  await dialog.getByLabel('Fin (segundos)').fill('52.71');
  await dialog.getByRole('button', { name: 'Usar posición actual como fin' }).click();
  await dialog.getByRole('button', { name: 'Escuchar y previsualizar fragmento' }).click();
  await expect(dialog.getByRole('button', { name: 'Parar fragmento', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Escuchar y previsualizar fragmento' })).toBeVisible({ timeout: 6000 });
  await dialog.getByRole('button', { name: '3. Exportar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Crear Reel MP4', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Descargar Reel', exact: true })).toBeVisible({ timeout: 30000 });
  const video = dialog.locator('video');
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.duration)).toBeGreaterThan(2.5);
  expect(await video.evaluate((el: HTMLVideoElement) => el.duration)).toBeLessThan(3);
});


test('guided and advanced Reel editing share lyrics, range and full-song selection', async ({ page }) => {
  await page.getByRole('button', { name: 'Reel', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Inicio (segundos)').fill('40');
  await dialog.getByLabel('Fin (segundos)').fill('45');
  await dialog.getByRole('button', { name: '2. Diseño', exact: true }).click();
  await dialog.getByRole('button', { name: 'Letra sólo para este Reel' }).click();
  await dialog.getByLabel('Frases del Reel', { exact: true }).fill('Letra desde la guía');
  await dialog.getByRole('button', { name: 'Preparar frases', exact: true }).click();
  await dialog.getByRole('button', { name: 'Abrir edición avanzada · Letra y línea de tiempo' }).click();
  await expect(page.getByRole('heading', { name: 'Editor avanzado · Letra del Reel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seleccionar Reel', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider', { name: 'Inicio de Reel', exact: true })).toHaveAttribute('aria-valuenow', '40');
  await page.getByLabel('Texto frase 1 del Reel').fill('Editada a mano');
  await page.getByLabel('Inicio frase 1 del Reel').fill('1');
  await page.getByLabel('Fin frase 1 del Reel').fill('4');
  await expect(page.getByRole('group', { name: 'Letra 1', exact: true })).toContainText('Editada a mano');
  await page.getByRole('button', { name: 'Volver a la guía del Reel', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '2. Diseño', exact: true }).click();
  await expect(dialog.getByLabel('Frases del Reel', { exact: true })).toHaveValue('Editada a mano');
  await dialog.getByText('Ajustar tiempos manualmente · segundos dentro del Reel').click();
  await expect(dialog.getByLabel('Inicio frase 1 del Reel')).toHaveValue('1');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Canción completa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Seleccionar Reel', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('slider', { name: 'Inicio de Reel', exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Letra 1', exact: true })).toContainText('Primera frase');
  await page.getByRole('button', { name: 'Reel · 40.0–45.0 s', exact: true }).click();
  await expect(page.getByLabel('Texto frase 1 del Reel')).toHaveValue('Editada a mano');
  await page.getByRole('button', { name: 'Ajustes avanzados del Reel', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Inicio (segundos)')).toHaveValue('40');
  await expect(dialog.getByLabel('Frases del Reel', { exact: true })).toHaveValue('Editada a mano');
  await dialog.getByLabel('Fin (segundos)').fill('46');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('slider', { name: 'Final de Reel', exact: true })).toHaveAttribute('aria-valuenow', '46');
  await page.reload(); await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Seleccionar Reel', exact: true })).toHaveAttribute('aria-pressed', 'true');
});


test.describe('simple mobile editing', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('Reels only exposes guided steps and retains its settings after reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Vídeo', exact: true }).click();
    await page.getByRole('button', { name: 'Reels', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('navigation', { name: 'Pasos del Reel' })).toBeVisible();
    await expect(page.getByRole('button', { name: /avanzad|Ajustar manualmente|Editar diseño a mano|Volver a la guía/ })).toHaveCount(0);
    await dialog.getByLabel('Inicio (segundos)').fill('40');
    await dialog.getByLabel('Fin (segundos)').fill('45');
    await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
    await dialog.getByRole('button', { name: 'Letra sólo para este Reel' }).click();
    await dialog.getByLabel('Frases del Reel', { exact: true }).fill('Frase desde el móvil');
    await dialog.getByRole('button', { name: 'Preparar frases', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Sincronizar sólo este fragmento' })).toBeVisible();
    await expect(dialog.getByText('Ajustar tiempos manualmente', { exact: false })).toHaveCount(0);
    await expect(dialog.getByLabel('Inicio frase 1 del Reel')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(dialog.getByLabel('Resumen del Reel')).toContainText('40.0–45.0');
    await page.keyboard.press('Escape');
    await page.reload(); await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
    await page.getByRole('button', { name: 'Vídeo', exact: true }).click();
    await page.getByRole('button', { name: 'Reels', exact: true }).click();
    await expect(dialog.getByLabel('Inicio (segundos)')).toHaveValue('40');
    await dialog.getByRole('button', { name: '2. Diseño', exact: true }).click();
    await expect(dialog.getByLabel('Frases del Reel', { exact: true })).toHaveValue('Frase desde el móvil');
    await page.screenshot({ path: 'test-results/reel-mobile-guided.png', animations: 'disabled' });
  });
});


test.describe('mobile music player', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('loaded music can be played, paused and stopped from any guided step', async ({ page }) => {
    const player = page.getByRole('region', { name: 'Escuchar proyecto', exact: true });
    await expect(player.getByRole('button', { name: 'Escuchar', exact: true })).toBeEnabled();
    await player.getByRole('button', { name: 'Escuchar', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
    await expect.poll(() => player.getByLabel('Tiempo de escucha').innerText()).not.toBe('0:00');
    await page.getByRole('button', { name: /Fotos o estilo/ }).click();
    await expect(player.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
    await player.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Escuchar', exact: true })).toBeVisible();
    await player.getByRole('button', { name: 'Detener música', exact: true }).click();
    await expect(player.getByLabel('Tiempo de escucha')).toHaveText('0:00');
    await page.getByRole('button', { name: 'Vídeo', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Escuchar', exact: true })).toBeInViewport();
    await page.screenshot({ path: 'test-results/mobile-music-player.png', animations: 'disabled' });
  });
});


test('audio stays usable when changing Reel, full song and responsive mobile view', async ({ page }) => {
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await expect.poll(() => page.getByLabel('Tiempo de reproducción').innerText()).not.toBe('00:00:00');
  await page.setViewportSize({ width: 390, height: 844 });
  const player = page.getByRole('region', { name: 'Escuchar proyecto', exact: true });
  await expect(player.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await player.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(player.getByRole('button', { name: 'Escuchar', exact: true })).toBeVisible();
  await player.getByRole('button', { name: 'Escuchar', exact: true }).click();
  const before = await player.getByLabel('Tiempo de escucha').innerText();
  await expect.poll(() => player.getByLabel('Tiempo de escucha').innerText()).not.toBe(before);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Detener', exact: true }).click();
  await page.getByRole('button', { name: 'Reel', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Inicio (segundos)').fill('40');
  await dialog.getByLabel('Fin (segundos)').fill('43');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Canción completa', exact: true }).click();
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect.poll(() => page.getByLabel('Tiempo de reproducción').innerText()).not.toBe('00:00:00');
  await page.getByRole('button', { name: 'Reel · 40.0–43.0 s', exact: true }).click();
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await expect.poll(() => page.getByLabel('Tiempo de reproducción').innerText()).not.toBe('00:40:00');
});
