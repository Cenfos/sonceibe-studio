import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
});

test('shows the account on home and editor and updates the name in both', async ({ page }) => {
  await page.getByRole('button', { name: 'Cuenta: Ana Studio', exact: true }).click();
  await expect(page.getByText('ana@example.com', { exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Cambiar nombre' }).click();
  await page.route('**/studio/api/studio-auth/update-name', async route => {
    expect(route.request().postDataJSON()).toEqual({ name: 'Ana nueva' });
    await route.fulfill({ json: { ok: true, name: 'Ana nueva', message: 'Nombre actualizado.' } });
  });
  await page.getByLabel('Nombre de la cuenta').fill('Ana nueva');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Nombre actualizado' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cuenta: Ana nueva', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Cuenta: Ana nueva', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Cambiar contraseña' })).toBeVisible();
  await expect(page.getByText('ana@example.com', { exact: true })).toBeVisible();
});

test('validates repeated password, shows errors, and confirms a successful account password change', async ({ page }) => {
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Cuenta: Ana Studio', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cambiar contraseña' }).click();
  let requests = 0;
  await page.route('**/studio/api/studio-auth/change-password', async route => {
    requests++;
    await route.fulfill(requests === 1 ? { status: 400, json: { error: 'La contraseña actual no es correcta.' } } : { json: { ok: true, message: 'Contraseña actualizada. Tu sesión sigue abierta.' } });
  });
  await page.getByLabel('Contraseña actual', { exact: true }).fill('wrong-password');
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('new-password');
  await page.getByLabel('Repite la nueva contraseña').fill('mismatch-password');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Las contraseñas no coinciden.');
  expect(requests).toBe(0);
  await page.getByLabel('Repite la nueva contraseña').fill('new-password');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('actual no es correcta');
  await page.getByLabel('Contraseña actual', { exact: true }).fill('correct-password');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Contraseña actualizada' })).toBeVisible();
  await expect(page.getByLabel('Contraseña actual', { exact: true })).toHaveValue('');
});

test('offers account management in the mobile editor and closes the session', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Cuenta: Ana Studio', exact: true }).click();
  await expect(page.getByText('ana@example.com', { exact: true })).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'tests/.generated/account-mobile.png', fullPage: true });
  await page.route('**/studio/api/studio-auth/logout', route => route.fulfill({ json: { ok: true } }));
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/studio\/access$/);
});
