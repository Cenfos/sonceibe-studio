import { expect, test } from '@playwright/test';

for (const width of [320, 390]) {
  test.describe(`mobile menu at ${width}px`, () => {
    test.use({ hasTouch: true, viewport: { width, height: 844 } });
    test('Back closes only the open menu and preserves the current project step', async ({ page }) => {
      await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
      await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
      await page.getByRole('button', { name: 'Estilo', exact: true }).click();
      const menuButton = page.getByRole('button', { name: 'Menú del proyecto', exact: true });
      await menuButton.click(); await expect(page.getByRole('menu')).toBeVisible();
      await page.goBack();
      await expect(page.getByRole('menu')).not.toBeVisible();
      await expect(page.getByRole('heading', { name: 'Estilo', exact: true })).toBeVisible();
      await expect(page.getByRole('dialog', { name: '¿Salir del proyecto?' })).not.toBeVisible();
      await expect(menuButton).toBeFocused();
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Audio y vídeo', exact: true })).toBeVisible();
      await menuButton.click(); await page.goBack();
      await expect(page.getByRole('menu')).not.toBeVisible();
      await expect(page.getByRole('dialog', { name: '¿Salir del proyecto?' })).not.toBeVisible();
      await page.goBack();
      await expect(page.getByRole('dialog', { name: '¿Salir del proyecto?' })).toBeVisible();
    });
    test('keeps the header separate and opens project, video, history and account actions', async ({ page }) => {
      await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
      await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
      const menuButton = page.getByRole('button', { name: 'Menú del proyecto', exact: true });
      const home = await page.getByRole('button', { name: 'Volver a proyectos', exact: true }).boundingBox();
      const menu = await menuButton.boundingBox();
      expect(home!.x + home!.width).toBeLessThan(menu!.x);
      expect(menu!.x + menu!.width).toBeLessThanOrEqual(width);
      await expect(page.getByRole('button', { name: 'Guardar proyecto .scs', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Abrir MP4 guardado', exact: true })).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.querySelector('.mobile-studio-wizard')!.scrollWidth <= innerWidth)).toBe(true);
      await menuButton.click();
      await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
      await expect(page.getByRole('menuitem', { name: 'Guardar proyecto .scs', exact: true })).toBeInViewport();
      await expect(page.getByRole('menuitem', { name: 'Compartir o descargar MP4', exact: true })).toBeInViewport();
      await expect(page.getByText('ana@example.com', { exact: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true })).toBeInViewport();
      await page.screenshot({ path: `test-results/mobile-menu-${width}.png` });
      await page.getByRole('menuitem', { name: 'Compartir o descargar MP4', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Vídeo de la canción completa' })).toBeVisible();
      await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await menuButton.click();
      await page.getByRole('menuitem', { name: 'Versiones locales', exact: true }).click();
      const versions = page.getByRole('dialog', { name: 'Versiones locales', exact: true });
      await expect(versions).toBeVisible();
      await expect(versions.getByRole('button', { name: 'Guardar versión ahora', exact: true })).toBeEnabled();
      await versions.getByRole('button', { name: 'Close', exact: true }).click();
      await menuButton.click();
      await page.getByRole('menuitem', { name: 'Cambiar nombre', exact: true }).click();
      await expect(page.getByLabel('Nombre de la cuenta')).toBeVisible();
      await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await expect(menuButton).toBeEnabled();
    });
  });
}
