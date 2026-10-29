import { expect, test } from '@playwright/test';
import type { Project } from '../../lib/types';

test.beforeEach(async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
});

test('duplicate from home keeps audio after deleting the original', async ({ page }) => {
  await page.getByRole('button', { name: 'Opciones de Prueba Studio', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Duplicar proyecto' }).click();
  await expect(page.getByRole('heading', { name: 'Prueba Studio — copia', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Opciones de Prueba Studio', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Eliminar', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prueba Studio', exact: true })).toHaveCount(0);
  await page.reload();
  const result = await page.evaluate(async () => {
    const projects = (await window.studioTest.savedProjects()) as Project[];
    const audio = await window.studioTest.getProjectAudio('owner', projects[0].id);
    return { count: projects.length, id: projects[0].id, bytes: audio?.size, photo: projects[0].settings.background.photoClips?.[0] };
  });
  expect(result.count).toBe(1); expect(result.id).not.toBe('fixture'); expect(result.bytes).toBeGreaterThan(1000);
  expect(result.photo?.placement).toEqual({ x: 25, y: 75, scale: 65 });
});

test('one drag is one undo; versions survive reload and restore', async ({ page }) => {
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  const lyric = page.getByRole('group', { name: 'Letra 1', exact: true });
  await lyric.scrollIntoViewIfNeeded();
  await expect(lyric).toBeVisible();
  const box = (await lyric.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 15); await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 15, { steps: 10 }); await page.mouse.up();
  await expect(page.getByRole('spinbutton', { name: 'Inicio de selección' })).toHaveValue('4');
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('spinbutton', { name: 'Inicio de selección' })).toHaveValue('2');
  await lyric.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('spinbutton', { name: 'Inicio de selección' })).toHaveValue('2.1');
  await page.getByRole('button', { name: 'Versiones locales' }).click();
  await expect(page.getByText('Antes de editar la letra', { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Versiones locales' }).click();
  await page.getByRole('button', { name: 'Restaurar', exact: true }).first().click();
  await expect.poll(async () => page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.lyrics[0].start)).toBe(2);
  const versions = await page.evaluate(() => window.studioTest.listSnapshots('sonceibe-projects-v2:owner', 'fixture'));
  expect(versions[0].reason).toBe('Antes de restaurar una versión');
  expect(versions[0].settings.lyrics[0].start).toBe(2.1);
});

test('keyboard edges, photo intervals, zoom, and ruler after horizontal scrolling', async ({ page }) => {
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('slider', { name: 'Final de Foto puntual 1', exact: true }).focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(page.getByRole('spinbutton', { name: 'Final de selección' })).toHaveValue('9.99');
  await page.getByRole('slider', { name: 'Inicio de Imagen múltiple 1', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('spinbutton', { name: 'Inicio de selección' })).toHaveValue('1.1');
  await page.locator('.studio-timeline-scroll').evaluate(element => element.scrollLeft = 500);
  const scrollBox = (await page.locator('.studio-timeline-scroll').boundingBox())!;
  const ruler = page.getByRole('slider', { name: 'Cursor de reproducción', exact: true });
  const rulerBox = (await ruler.boundingBox())!;
  await page.mouse.click(scrollBox.x + 100, rulerBox.y + 10);
  await expect(ruler).toHaveAttribute('aria-valuenow', '30');
  await page.getByRole('button', { name: 'Acercar timeline' }).click();
  await expect(page.getByRole('slider', { name: 'Zoom horizontal' })).toHaveValue('30');
  await page.getByRole('button', { name: 'Ver todo', exact: true }).click();
  expect(await page.locator('.studio-timeline-scroll').evaluate(element => element.scrollLeft)).toBe(0);
  await page.screenshot({ path: 'tests/.generated/editor.png', fullPage: true });
});

test('photo border snaps to an existing playhead; cancellation does not edit the project', async ({ page }) => {
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('slider', { name: 'Cursor de reproducción', exact: true }).scrollIntoViewIfNeeded();
  const ruler = (await page.getByRole('slider', { name: 'Cursor de reproducción', exact: true }).boundingBox())!;
  await page.mouse.click(ruler.x + 120, ruler.y + 10); // 6 s at 20 px/s
  const edge = (await page.getByRole('slider', { name: 'Final de Imagen múltiple 1', exact: true }).boundingBox())!;
  await page.mouse.move(edge.x + edge.width / 2, edge.y + 10); await page.mouse.down();
  await page.mouse.move(edge.x + edge.width / 2 + 18, edge.y + 10, { steps: 5 }); await page.mouse.up();
  await expect(page.getByRole('spinbutton', { name: 'Final de selección' })).toHaveValue('6');
  const photo = (await page.getByRole('group', { name: 'Foto puntual 1', exact: true }).boundingBox())!;
  await page.mouse.move(photo.x + 15, photo.y + 15); await page.mouse.down();
  await page.mouse.move(photo.x + 55, photo.y + 15, { steps: 5 }); await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.getByRole('spinbutton', { name: 'Inicio de selección' })).toHaveValue('7');
});


test('new project uses an in-page form when browser prompts are unsupported', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
  await page.getByRole('button', { name: 'Nuevo Proyecto', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SonCeibe Studio', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByLabel('Título de la canción (opcional)').fill('Mi canción nueva');
  await page.getByLabel('Título de la canción (opcional)').press('Enter');
  await expect(page.locator('.studio-project-title')).toHaveText('Mi canción nueva');
  await expect(page.getByRole('button', { name: 'Reel', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});


test('desktop preview uses full height with format controls in the inspector and player beside it', async ({ page }) => {
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  const inspector = page.locator('.studio-properties-panel');
  await expect(inspector.getByRole('button', { name: 'PC', exact: true })).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Móvil', exact: true })).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Reel', exact: true })).toBeVisible();
  await expect(page.locator('.studio-preview-header')).toHaveCount(0);
  const canvas = page.locator('.studio-preview-stage canvas');
  const portrait = (await canvas.boundingBox())!;
  const player = (await page.getByRole('complementary', { name: 'Reproductor', exact: true }).boundingBox())!;
  expect(portrait.y).toBeLessThan(85);
  expect(portrait.height).toBeGreaterThan(500);
  expect(player.x).toBeGreaterThanOrEqual(portrait.x + portrait.width);
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Detener', exact: true }).click();
  await expect(page.getByLabel('Tiempo de reproducción')).toHaveText('00:00:00');
  await page.screenshot({ path: 'tests/.generated/preview-portrait.png', animations: 'disabled' });
  await inspector.getByRole('button', { name: 'PC', exact: true }).click();
  await expect(inspector.getByRole('button', { name: 'PC', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const landscape = (await canvas.boundingBox())!;
  expect(landscape.width).toBeGreaterThan(landscape.height);
  const landscapePlayer = (await page.getByRole('complementary', { name: 'Reproductor', exact: true }).boundingBox())!;
  expect(landscapePlayer.x).toBeGreaterThanOrEqual(landscape.x + landscape.width);
  await page.screenshot({ path: 'tests/.generated/preview-landscape.png', animations: 'disabled' });
  await inspector.getByRole('button', { name: 'Reel', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Reel de Instagram');
});


test('desktop workspace scrolls to compact timeline and has a single Reel entry', async ({ page }) => {
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reels', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reel', exact: true })).toHaveCount(1);
  const workspace = page.locator('.studio-workspace-scroll');
  expect(await workspace.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  const timeline = page.getByRole('region', { name: 'Línea de tiempo', exact: true });
  expect((await timeline.boundingBox())!.y).toBeGreaterThanOrEqual(990);
  const canvas = (await page.locator('.studio-preview-stage canvas').boundingBox())!;
  expect(canvas.height).toBeGreaterThan(800);
  if (await page.locator('details').filter({ has: page.getByText('Vista y edición', { exact: true }) }).getAttribute('open') === null) await page.getByText('Vista y edición', { exact: true }).click();
  await page.getByRole('button', { name: 'Ver línea de tiempo ↓', exact: true }).click();
  await expect.poll(() => workspace.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  await timeline.scrollIntoViewIfNeeded();
  const labels = page.locator('.studio-timeline-labels > div');
  expect((await labels.nth(1).boundingBox())!.height).toBe(28);
  await page.getByRole('button', { name: 'Seleccionar Reel', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Inicio de Reel', exact: true })).toBeVisible();
});


test('timeline divider resizes the editor, supports keys and remembers the chosen split', async ({ page }) => {
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  const divider = page.getByRole('separator', { name: 'Ajustar altura de la línea de tiempo', exact: true });
  const editor = page.locator('.studio-main-workspace');
  await expect(divider).toBeInViewport();
  const initial = (await editor.boundingBox())!.height;
  const box = (await divider.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 260, { steps: 10 }); await page.mouse.up();
  await expect.poll(async () => (await editor.boundingBox())!.height).toBeLessThan(initial - 200);
  const resized = (await editor.boundingBox())!.height;
  await expect(page.getByRole('region', { name: 'Línea de tiempo', exact: true })).toBeInViewport();
  await divider.focus(); await page.keyboard.press('ArrowUp');
  await expect(divider).toHaveAttribute('aria-valuenow', String(resized - 32));
  const saved = (await editor.boundingBox())!.height;
  await page.reload(); await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await expect.poll(async () => (await editor.boundingBox())!.height).toBe(saved);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect.poll(async () => (await editor.boundingBox())!.height).toBeLessThan(saved);
  await divider.focus(); await page.keyboard.press('End');
  await expect.poll(async () => Number(await divider.getAttribute('aria-valuenow'))).toBe(Number(await divider.getAttribute('aria-valuemax')));
  await divider.dblclick();
  await expect.poll(async () => (await editor.boundingBox())!.height).toBeLessThan(Number(await divider.getAttribute('aria-valuemax')));
  await page.screenshot({ path: 'tests/.generated/timeline-resized.png', animations: 'disabled' });
});


test('timeline tracks stay between compact and double height without a lower gap', async ({ page }) => {
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  const divider = page.getByRole('separator', { name: 'Ajustar altura de la línea de tiempo', exact: true });
  await divider.focus(); await page.keyboard.press('Home');
  const maximum = Number(await divider.getAttribute('aria-valuemax'));
  const minimum = Number(await divider.getAttribute('aria-valuemin'));
  expect(minimum).toBeGreaterThanOrEqual(Math.floor(maximum / 2));
  await expect(divider).toHaveAttribute('aria-valuenow', String(minimum));
  await page.keyboard.press('ArrowUp');
  await expect(divider).toHaveAttribute('aria-valuenow', String(minimum));
  const timeline = page.getByRole('region', { name: 'Línea de tiempo', exact: true });
  await expect.poll(async () => (await page.locator('.studio-timeline-labels > div').nth(1).boundingBox())!.height).toBeGreaterThan(28);
  const row = (await page.locator('.studio-timeline-labels > div').nth(1).boundingBox())!.height;
  expect(row).toBeLessThanOrEqual(56);
  const bottom = await timeline.evaluate(el => el.getBoundingClientRect().bottom);
  expect(Math.abs(bottom - 1000)).toBeLessThan(3);
  await page.screenshot({ path: 'tests/.generated/timeline-half-expanded.png', animations: 'disabled' });
  await page.keyboard.press('End');
  await expect(divider).toHaveAttribute('aria-valuenow', String(maximum));
  expect((await timeline.boundingBox())!.y).toBeGreaterThanOrEqual(990);
  await divider.dblclick();
  await expect(timeline).toBeInViewport();
});
