import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { handleAuth } from '../../lib/studio-auth-actions';
import { currentStudioUser, ACCESS_COOKIE, REFRESH_COOKIE } from '../../lib/studio-auth-server';
import { proxy } from '../../proxy';
const { auth, jar } = vi.hoisted(() => ({
  auth: { signUp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn(), verifyOtp: vi.fn(), getUser: vi.fn(), setSession: vi.fn(), updateUser: vi.fn(), refreshSession: vi.fn(), admin: { signOut: vi.fn() } },
  jar: new Map<string, string>(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined }) }));
const user = { id: 'uuid-user', email_confirmed_at: '2026-10-31', user_metadata: { name: 'Ana' } };
const session = { access_token: 'valid-access', refresh_token: 'valid-refresh', expires_in: 3600 };
beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'public-key');
  auth.getUser.mockResolvedValue({ data: { user } });
  auth.admin.signOut.mockResolvedValue({ error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); jar.clear(); });
function request(body: object, origin = 'https://studio.example') {
  return new Request('https://studio.example/api/studio-auth/test', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
it('fails closed with no provider configuration and rejects cross-origin requests', async () => {
  expect((await handleAuth(request({}, 'https://attacker.example'), 'login')).status).toBe(403);
  vi.stubEnv('SUPABASE_URL', '');
  expect((await handleAuth(request({}), 'login')).status).toBe(503);
  expect(await currentStudioUser()).toBeNull();
});
it('validates registration and creates a profile without logging an unverified user in', async () => {
  expect((await handleAuth(request({ name: 'Ana', email: 'a@example.com', password: 'short' }), 'signup')).status).toBe(400);
  expect(auth.signUp).not.toHaveBeenCalled();
  auth.signUp.mockResolvedValue({ error: null });
  const response = await handleAuth(request({ name: ' Ana ', email: 'ANA@example.com', password: 'long-password' }), 'signup');
  expect(response.status).toBe(200);
  expect(response.cookies.get(ACCESS_COOKIE)).toBeUndefined();
  expect(auth.signUp).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'long-password', options: { data: { name: 'Ana' } } });
});
it('uses provider-verified identities and secure HTTP-only cookies rather than legacy codes', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  auth.signInWithPassword.mockResolvedValue({ data: { session, user }, error: null });
  const response = await handleAuth(request({ email: 'a@example.com', password: 'long-password' }), 'login');
  expect(response.cookies.get(ACCESS_COOKIE)?.value).toBe('valid-access');
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')).toContain('Secure');
  expect(response.cookies.get('sonceibe-studio-session')?.value).toBe('');
  expect((await handleAuth(request({ code: 'old-owner-code' }), 'login')).status).toBe(400);
});
it('rejects unconfirmed users even if provider email confirmation was accidentally disabled', async () => {
  auth.signInWithPassword.mockResolvedValue({ data: { session, user: { ...user, email_confirmed_at: null } }, error: null });
  expect((await handleAuth(request({ email: 'a@example.com', password: 'long-password' }), 'login')).status).toBe(401);
});
it('hides account existence in recovery responses and preserves provider throttling', async () => {
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  const response = await handleAuth(request({ email: 'missing@example.com' }), 'recover');
  expect(response.status).toBe(200);
  expect((await response.json()).message).toContain('Si existe');
  auth.resetPasswordForEmail.mockResolvedValue({ error: { status: 429 } });
  expect((await handleAuth(request({ email: 'a@example.com' }), 'recover')).status).toBe(429);
});
it('rejects expired recovery links and accepts a verified one-time recovery token', async () => {
  auth.verifyOtp.mockResolvedValue({ data: {}, error: { status: 403 } });
  expect((await handleAuth(request({ token_hash: 'expired', type: 'recovery' }), 'confirm')).status).toBe(400);
  auth.verifyOtp.mockResolvedValue({ data: { session, user }, error: null });
  const response = await handleAuth(request({ token_hash: 'valid', type: 'recovery' }), 'confirm');
  expect((await response.json()).recovery).toBe(true);
  expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe('valid-refresh');
});
it('requires a verified session to change password and clears sessions after success', async () => {
  expect((await handleAuth(request({ password: 'new-password' }), 'update-password')).status).toBe(401);
  expect(auth.updateUser).not.toHaveBeenCalled();
  jar.set(ACCESS_COOKIE, session.access_token); jar.set(REFRESH_COOKIE, session.refresh_token);
  auth.setSession.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  const response = await handleAuth(request({ password: 'new-password' }), 'update-password');
  expect(response.status).toBe(200);
  expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
  expect(auth.admin.signOut).toHaveBeenCalledWith(session.access_token, 'global');
  expect(response.cookies.get(REFRESH_COOKIE)?.maxAge).toBe(0);
});
it('rejects legacy and forged cookies in the server guard', async () => {
  jar.set('sonceibe-studio-session', 'old-signed-token');
  expect(await currentStudioUser()).toBeNull();
  jar.set(ACCESS_COOKIE, 'forged');
  auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
  expect(await currentStudioUser()).toBeNull();
});
it('refreshes expired sessions and carries cookies into the downstream request', async () => {
  auth.getUser.mockResolvedValue({ data: { user: null } });
  auth.refreshSession.mockResolvedValue({ data: { user, session } });
  const response = await proxy(new NextRequest('https://studio.example/', { headers: { cookie: 'studio-refresh=valid-refresh' } }));
  expect(response.cookies.get(ACCESS_COOKIE)?.value).toBe(session.access_token);
  expect(response.headers.get('x-middleware-request-cookie')).toContain('studio-access=valid-access');
});
it('preserves download destinations and rejects external return URLs', async () => {
  const anonymous = await proxy(new NextRequest('https://studio.example/studio/download/windows'));
  expect(anonymous.headers.get('location')).toBe('https://studio.example/studio/access?next=%2Fdownload%2Fwindows');
  for (const [next, target] of [['/download/windows', '/studio/download/windows'], ['https://other.example', '/studio']]) {
    const response = await proxy(new NextRequest('https://studio.example/studio/access?next=' + encodeURIComponent(next), { headers: { cookie: 'studio-access=valid-access' } }));
    expect(response.headers.get('location')).toBe('https://studio.example' + target);
  }
});
it('keeps confirmation and password update pages reachable when already signed in', async () => {
  for (const query of ['?token_hash=token&type=recovery', '?mode=update']) {
    const response = await proxy(new NextRequest('https://studio.example/studio/access' + query, { headers: { cookie: 'studio-access=valid-access' } }));
    expect(response.headers.get('location')).toBeNull();
  }
});
it('clears both cookies and revokes the current session on logout', async () => {
  jar.set(ACCESS_COOKIE, session.access_token);
  const response = await handleAuth(request({}), 'logout');
  expect(auth.admin.signOut).toHaveBeenCalledWith(session.access_token, 'local');
  expect(response.cookies.get(ACCESS_COOKIE)?.maxAge).toBe(0);
  expect(response.cookies.get(REFRESH_COOKIE)?.maxAge).toBe(0);
});

it('keeps redirects on the public website when Vercel rewrites to Studio', async () => {
  const response = await proxy(new NextRequest('https://sonceibe-studio.vercel.app/studio/download/windows', {
    headers: { 'x-forwarded-host': 'www.sonceibe.es' },
  }));
  expect(response.headers.get('location')).toBe('https://www.sonceibe.es/studio/access?next=%2Fdownload%2Fwindows');
});

it('accepts the public website origin behind a rewrite and rejects other origins', async () => {
  auth.signInWithPassword.mockResolvedValue({ data: { session, user }, error: null });
  const call = (origin: string) => handleAuth(new Request('https://sonceibe-studio.vercel.app/studio/api/studio-auth/login', {
    method: 'POST', headers: { origin, host: 'sonceibe-studio.vercel.app', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@example.com', password: 'long-password' }),
  }), 'login');
  const response = await call('https://www.sonceibe.es');
  expect(response.status).toBe(200);
  expect(response.cookies.get(ACCESS_COOKIE)?.path).toBe('/studio');
  expect((await call('https://attacker.example')).status).toBe(403);
});

