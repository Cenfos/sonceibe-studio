import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/download/windows/route';
import { createStudioSession, STUDIO_SESSION_COOKIE } from '../../lib/studio-auth-server';
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@vercel/blob', () => ({ get }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
function request(authenticated = false) {
  vi.stubEnv('STUDIO_ACCESS_CODES', 'owner=test-code');
  return new NextRequest('https://studio.example/download/windows', {
    headers: authenticated ? { cookie: `${STUDIO_SESSION_COOKIE}=${createStudioSession('owner')}` } : {},
  });
}
it('requires login before touching installer storage', async () => {
  const response = await GET(request());
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toContain('/access?next=%2Fdownload%2Fwindows');
  expect(get).not.toHaveBeenCalled();
});
it('downloads directly with an existing session without exposing storage credentials', async () => {
  get.mockResolvedValue({ statusCode: 200, stream: new Response('installer').body });
  const response = await GET(request(true));
  expect(response.status).toBe(200);
  expect(response.headers.get('content-disposition')).toContain('SonCeibe-Studio-Setup.exe');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('location')).toBeNull();
  expect(await response.text()).toBe('installer');
  expect(get).toHaveBeenCalledWith('windows/SonCeibe-Studio-Setup.exe', { access: 'private', useCache: false });
});
it('reports missing releases and storage failures without leaking details', async () => {
  get.mockResolvedValue(null);
  expect((await GET(request(true))).status).toBe(503);
  get.mockRejectedValue(new Error('private storage detail'));
  const response = await GET(request(true));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain('private storage detail');
});

it('middleware preserves the download destination through login and rejects external return URLs', async () => {
  const { middleware } = await import('../../middleware');
  const anonymous = request();
  const redirect = await middleware(anonymous);
  expect(redirect.headers.get('location')).toBe('https://studio.example/access?next=%2Fdownload%2Fwindows');
  const token = createStudioSession('owner');
  const headers = { cookie: `${STUDIO_SESSION_COOKIE}=${token}` };
  const resume = await middleware(new NextRequest('https://studio.example/access?next=%2Fdownload%2Fwindows', { headers }));
  expect(resume.headers.get('location')).toBe('https://studio.example/download/windows');
  const external = await middleware(new NextRequest('https://studio.example/access?next=https://other.example', { headers }));
  expect(external.headers.get('location')).toBe('https://studio.example/');
});
