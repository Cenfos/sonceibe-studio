import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const base = 'https://www.sonceibe.es';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/studio', '/studio/access', '/studio/access?mode=callback']) {
    const response = await page.goto(base + path);
    assert.equal(response.status(), 200, path);
    await page.getByRole('heading', { name: 'Entra en tu Studio' }).waitFor();
    assert.equal(new URL(page.url()).origin, base);
  }
  // Exercise the real callback navigation with synthetic credentials. No real
  // email is sent and no account password is changed by this browser check.
  let exchanges = 0;
  await page.route('**/studio/api/studio-auth/complete-session', async route => {
    const body = route.request().postDataJSON();
    assert.equal(body.access_token, 'synthetic-access');
    assert.equal(body.refresh_token, 'synthetic-refresh');
    assert.equal(body.type, 'recovery');
    exchanges++;
    await route.fulfill({ json: { ok: true, recovery: true } });
  });
  await page.goto(base + '/studio#access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery');
  await page.getByRole('heading', { name: 'Elige una nueva contraseña' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/studio/access');
  assert.equal(new URL(page.url()).hash, '');
  assert.equal(exchanges, 1);
  await page.unroute('**/studio/api/studio-auth/complete-session');
  // The actual public API must accept the public origin and validate the body.
  const status = await page.evaluate(async () => {
    const response = await fetch('/studio/api/studio-auth/complete-session', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    const data = await response.json();
    return { status: response.status, error: data.error };
  });
  assert.equal(status.status, 400);
  assert.match(status.error, /incompleto/);
  await page.goto(base + '/studio/access#error=access_denied&error_code=otp_expired');
  await page.getByRole('alert').filter({ hasText: 'caducado' }).waitFor();
  assert.equal(new URL(page.url()).hash, '');
  assert.deepEqual(errors, []);
  console.log('PASS: public Studio routes, assets/hydration, root recovery callback, token removal, expired-link UI, and real API origin/body validation. Session exchange mocked; no real email or password change.');
} finally {
  await browser.close();
}
