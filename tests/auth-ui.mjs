import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:4180';
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/studio');
  assert.equal(new URL(page.url()).pathname, '/studio/access');
  await page.getByRole('button', { name: /Aún no tienes cuenta/ }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Ana');
  await page.getByLabel('Correo electrónico').fill('ana@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('password123');
  await page.getByLabel('Repite la contraseña').fill('different123');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'no coinciden' }).waitFor();
  await page.getByLabel('Repite la contraseña').fill('password123');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'todavía no está disponible' }).waitFor();
  // Exercise UI response handling separately from the not-yet-configured provider.
  await page.route('**/studio/api/studio-auth/signup', route => route.fulfill({ json: { ok: true, message: 'Revisa tu correo para confirmar tu cuenta.' } }));
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Revisa tu correo' }).waitFor();
  await page.getByRole('button', { name: 'Volver a entrar' }).click();
  await page.getByRole('button', { name: 'He olvidado mi contraseña' }).click();
  await page.route('**/studio/api/studio-auth/recover', route => route.fulfill({ json: { ok: true, message: 'Si existe una cuenta, recibirás un enlace.' } }));
  await page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click();
  await page.getByRole('status').waitFor();
  await page.goto(base + '/studio/access?token_hash=test-token&type=recovery');
  await page.getByRole('button', { name: 'Continuar', exact: true }).waitFor();
  assert.equal(new URL(page.url()).search, '');
  await page.route('**/studio/api/studio-auth/confirm', route => route.fulfill({ json: { ok: true, recovery: true } }));
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('heading', { name: 'Elige una nueva contraseña' }).waitFor();
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('new-password123');
  await page.getByLabel('Repite la contraseña').fill('new-password123');
  await page.route('**/studio/api/studio-auth/update-password', route => route.fulfill({ json: { ok: true, message: 'Contraseña actualizada.' } }));
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await page.getByRole('heading', { name: 'Entra en tu Studio' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Aún no tienes cuenta/ }).click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: 'tests/.generated/auth-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Auth UI passed: guards, validation, unavailable provider, signup/recovery/reset responses, mobile layout. Provider responses mocked after unavailable-provider check.');
} finally { await browser.close(); }

