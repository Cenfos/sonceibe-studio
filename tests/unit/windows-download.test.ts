import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/download/windows/route';
const { get, currentStudioUser } = vi.hoisted(() => ({ get: vi.fn(), currentStudioUser: vi.fn() }));
vi.mock('@vercel/blob', () => ({ get }));
vi.mock('../../lib/studio-auth-server', () => ({ currentStudioUser }));
afterEach(() => vi.resetAllMocks());
function request(authenticated = false) {
  currentStudioUser.mockResolvedValue(authenticated ? { id: 'verified-user' } : null);
  return new NextRequest('https://studio.example/download/windows');
}
it('requires login before touching installer storage', async () => {
  const response = await GET(request());
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toContain('/access?next=%2Fdownload%2Fwindows');
  expect(get).not.toHaveBeenCalled();
});
it('downloads with a verified session without exposing storage credentials', async () => {
  get.mockResolvedValue({ statusCode: 200, stream: new Response('installer').body });
  const response = await GET(request(true));
  expect(response.status).toBe(200);
  expect(response.headers.get('content-disposition')).toContain('SonCeibe-Studio-Setup.exe');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.text()).toBe('installer');
});
it('reports missing releases and storage failures without leaking details', async () => {
  get.mockResolvedValue(null);
  expect((await GET(request(true))).status).toBe(503);
  get.mockRejectedValue(new Error('private storage detail'));
  const response = await GET(request(true));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain('private storage detail');
});

