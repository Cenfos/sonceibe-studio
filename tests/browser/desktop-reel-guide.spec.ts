import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
});

test('desktop Reel stays in the editor, preserves edits and exports from its inline guide', async ({ page }) => {
  await page.getByRole('button', { name: 'Reel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const guide = page.getByRole('region', { name: 'Creación guiada de vídeo' });
  await expect(guide.getByText('Tu Reel o vídeo corto, paso a paso')).toBeVisible();
  await guide.getByLabel('Inicio del fragmento (segundos)', { exact: true }).fill('40');
  await guide.getByLabel('Fin del fragmento (segundos)', { exact: true }).fill('42');
  await expect(page.getByRole('slider', { name: 'Inicio de Reel', exact: true })).toHaveAttribute('aria-valuenow', '40');
  await guide.getByRole('button', { name: '3. Letra', exact: true }).click();
  await guide.getByRole('button', { name: 'Letra sólo para este Reel', exact: true }).click();
  await guide.getByLabel('Frases del Reel', { exact: true }).fill('Sólo en el fragmento');
  await guide.getByRole('button', { name: 'Preparar frases', exact: true }).click();
  await guide.getByRole('button', { name: '2. Fragmento', exact: true }).click();
  await guide.getByLabel('Mostrar letra en el Reel', { exact: true }).uncheck();
  await guide.getByRole('button', { name: '6. Exportar', exact: true }).click();
  await expect(guide).toContainText('40.0–42.0 s');
  await guide.getByRole('button', { name: 'Revisar y exportar Reel', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Exportar contenido' });
  await expect(dialog.getByRole('button', { name: 'Reel seleccionado', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Revisar Reel en el editor', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(guide.getByLabel('Inicio del fragmento (segundos)', { exact: true })).toHaveValue('40');
  await page.screenshot({ path: 'test-results/desktop-reel-inline-guide.png' });
  await guide.getByRole('button', { name: '6. Exportar', exact: true }).click();
  await guide.getByRole('button', { name: 'Revisar y exportar Reel', exact: true }).click();
  const ready = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Crear Reel MP4', exact: true }).click();
  expect((await ready).suggestedFilename()).toContain('-reel');
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'PC', exact: true }).click();
  await page.getByRole('button', { name: 'Guía paso a paso', exact: true }).click();
  await expect(guide.getByRole('button', { name: '5. Exportar', exact: true })).toBeVisible();
  expect((await page.evaluate(() => window.studioTest.savedProjects()))[0].settings.lyrics[0].text).toBe('Primera frase');
});

test('mobile retains the simplified Reel dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await page.getByRole('button', { name: 'Reels', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reel de Instagram' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('navigation', { name: 'Pasos del Reel' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Ajustar manualmente', exact: true })).toHaveCount(0);
});
