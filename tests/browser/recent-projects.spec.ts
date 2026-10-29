import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function seedFive(page: Page, backedUp: number[] = []) {
  await page.goto('/');
  await page.evaluate(() => window.studioTest.seed());
  await page.evaluate(async backedUp => {
    const key = 'sonceibe-projects-v2:owner';
    const original = JSON.parse(localStorage.getItem(key)!)[0];
    const audio = await window.studioTest.getProjectAudio('owner', 'fixture');
    const projects = Array.from({ length: 5 }, (_, index) => ({
      id: `recent-${5 - index}`, settings: { ...structuredClone(original.settings), title: `Proyecto ${5 - index}`, updatedAt: Date.now() + 5 - index },
    }));
    if (audio) await window.studioTest.saveProjectAudio('owner', 'recent-1', audio);
    const copies = Object.fromEntries(projects.filter(project => backedUp.includes(Number(project.id.split('-')[1]))).map(project => [project.id, { updatedAt: project.settings.updatedAt, savedAt: Date.now() }]));
    await window.studioTest.saveRecentProjects(key, projects, copies);
    localStorage.removeItem(key);
  }, backedUp);
  await page.goto('/?ui');
  await expect(page.getByRole('heading', { name: 'Proyecto 1', exact: true })).toBeVisible();
}

async function createSixth(page: Page) {
  await page.getByRole('button', { name: 'Nuevo Proyecto', exact: true }).click();
  await page.getByLabel('Título de la canción (opcional)').fill('Sexto proyecto');
  await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
}

test('the sixth project can be cancelled and never silently evicts unsaved work', async ({ page }) => {
  await seedFive(page);
  await createSixth(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Proyecto 1');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect((await page.evaluate(() => window.studioTest.savedProjects())).map(project => project.id)).toContain('recent-1');
  await expect(page.getByRole('heading', { name: 'Proyecto 1', exact: true })).toBeVisible();
  await createSixth(page);
  await dialog.getByRole('button', { name: 'Descartar cambios y retirar de recientes', exact: true }).click();
  await expect(page.locator('.studio-project-title')).toHaveText('Sexto proyecto');
  await expect.poll(() => page.evaluate(async () => (await window.studioTest.savedProjects()).length)).toBe(5);
  expect((await page.evaluate(() => window.studioTest.savedProjects())).some(project => project.id === 'recent-1')).toBe(false);
  await expect.poll(() => page.evaluate(async () => (await window.studioTest.getProjectAudio('owner', 'recent-1')) === null)).toBe(true);
});

test('a confirmed current copy can leave recent projects and its PC folder is preserved', async ({ page }) => {
  await seedFive(page, [1]);
  // Use an actual browser filesystem handle as the connected PC-folder stand-in.
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const app = await root.getDirectoryHandle('SonCeibe Studio', { create: true });
    const users = await app.getDirectoryHandle('users', { create: true });
    const owner = await users.getDirectoryHandle('owner', { create: true });
    const projects = await owner.getDirectoryHandle('projects', { create: true });
    const old = await projects.getDirectoryHandle('recent-1', { create: true });
    const file = await old.getFileHandle('project.json', { create: true });
    const writable = await file.createWritable(); await writable.write('KEEP THIS PC COPY'); await writable.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('sonceibe-studio-workspace-v1', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('handles', 'readwrite');
        tx.objectStore('handles').put({ userId: 'owner', handle: root, updatedAt: Date.now() });
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await createSixth(page);
  await expect(page.locator('.studio-project-title')).toHaveText('Sexto proyecto');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => (await window.studioTest.getProjectAudio('owner', 'recent-1')) === null)).toBe(true);
  expect(await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const app = await root.getDirectoryHandle('SonCeibe Studio');
    const users = await app.getDirectoryHandle('users'); const owner = await users.getDirectoryHandle('owner');
    const projects = await owner.getDirectoryHandle('projects'); const old = await projects.getDirectoryHandle('recent-1');
    return (await (await old.getFileHandle('project.json')).getFile()).text();
  })).toBe('KEEP THIS PC COPY');
});

test('download confirmation protects the oldest project and the saved file reopens with audio and photos', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
  await seedFive(page, [2]);
  await createSixth(page);
  let downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar .scs y retirar de recientes', exact: true }).click();
  await downloading;
  await page.getByRole('button', { name: 'Volver sin confirmar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conservar cinco proyectos recientes', exact: true })).toBeVisible();
  expect((await page.evaluate(() => window.studioTest.savedProjects())).some(project => project.id === 'recent-1')).toBe(true);
  downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar .scs y retirar de recientes', exact: true }).click();
  const downloaded = await downloading;
  const bytes = await readFile((await downloaded.path())!);
  const copy = JSON.parse(bytes.toString());
  expect(copy.project.settings.title).toBe('Proyecto 1');
  expect(copy.project.settings.background.photoClips[0].url).toMatch(/^data:image/);
  expect(copy.audioDataUrl).toMatch(/^data:audio/);
  await page.getByRole('button', { name: 'Sí, guardé la copia', exact: true }).click();
  await expect(page.locator('.studio-project-title')).toHaveText('Sexto proyecto');
  await page.getByRole('button', { name: 'Volver al inicio de SonCeibe Studio', exact: true }).click();
  await page.locator('input[accept=".scs,application/json"]').setInputFiles({ name: downloaded.suggestedFilename(), mimeType: 'application/json', buffer: bytes });
  await expect(page.locator('.studio-project-title')).toHaveText('Proyecto 1');
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled();
  const projects = await page.evaluate(() => window.studioTest.savedProjects());
  expect(projects).toHaveLength(5);
  expect(projects[0].settings.background.photoClips?.[0].placement).toEqual({ x: 25, y: 75, scale: 65 });
  expect(await page.evaluate(async id => (await window.studioTest.getProjectAudio('owner', id))!.size, projects[0].id)).toBeGreaterThan(1000);
});

test('saving to a chosen file marks only that revision and edits require a new copy', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => ({ createWritable: async () => ({ write: async () => {}, close: async () => {} }) }) });
  });
  await seedFive(page);
  await page.getByRole('heading', { name: 'Proyecto 1', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar proyecto .scs', exact: true }).click();
  await expect(page.getByText('Copia guardada en tu equipo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await page.getByRole('switch', { name: 'Mostrar título en el vídeo', exact: true }).click();
  await expect(page.getByText('Sólo en este navegador', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver al inicio de SonCeibe Studio', exact: true }).click();
  await createSixth(page);
  await expect(page.getByRole('dialog')).toContainText('Proyecto 1');
});
