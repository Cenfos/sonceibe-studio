import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://sonceibe.es', { waitUntil: 'domcontentloaded' }); console.log('Homepage loaded');
  const studio = page.getByRole('navigation', { name: 'Principal', exact: true }).getByRole('link', { name: 'Studio', exact: true });
  await studio.waitFor();
  assert.equal(await studio.getAttribute('href'), '/studio');
  await studio.click(); console.log('Studio clicked');
  await page.getByRole('heading', { name: 'Entra en tu Studio' }).waitFor();
  assert.equal(new URL(page.url()).origin, 'https://www.sonceibe.es');
  assert.equal(new URL(page.url()).pathname, '/studio/access');
  await page.getByRole('button', { name: /Aún no tienes cuenta/ }).click();
  await page.getByLabel('Nombre', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Volver a entrar' }).click();
  const status = await page.evaluate(async () => {
    const result = await fetch('/studio/api/studio-auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'studio-check@example.com', password: 'incorrect-test-password' }),
    });
    return result.status;
  });
  assert.equal(status, 401); console.log('Login API passed');
  await page.goto('https://www.sonceibe.es/studio/access?token_hash=invalid-test-token&type=recovery', { waitUntil: 'domcontentloaded' }); console.log('Recovery loaded');
  await page.getByRole('button', { name: 'Continuar', exact: true }).waitFor();
  await page.waitForURL('https://www.sonceibe.es/studio/access');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: /caducado|utilizado/ }).waitFor();
  await page.screenshot({ path: 'tests/.generated/studio-domain.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Live domain passed: website menu, public /studio login, JS hydration, API origin validation and invalid recovery-token handling.');
} finally { await browser.close(); }

