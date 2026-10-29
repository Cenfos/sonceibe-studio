import { afterEach, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/studio-auth/login/route';
import { createStudioSession, readStudioSession } from '../../lib/studio-auth-server';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  globalThis.__sonceibeStudioLoginAttempts?.clear();
});

it('rejects tampered and expired sessions', () => {
  vi.stubEnv('STUDIO_ACCESS_CODES', 'owner=unit-test-access-code');
  vi.useFakeTimers();
  const token = createStudioSession('owner');
  expect(readStudioSession(token)?.u).toBe('owner');
  expect(readStudioSession(`${token}tampered`)).toBeNull();
  vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);
  expect(readStudioSession(token)).toBeNull();
});

it('retains a fifteen-minute login block after its ten-minute counting window expires', async () => {
  vi.stubEnv('STUDIO_ACCESS_CODES', 'owner=unit-test-access-code');
  vi.useFakeTimers();
  const login = async () => {
    const response = POST(new Request('http://localhost/api/studio-auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.40' },
      body: JSON.stringify({ code: 'incorrect' }),
    }));
    await vi.advanceTimersByTimeAsync(1500);
    return response;
  };
  for (let i = 0; i < 4; i++) expect((await login()).status).toBe(401);
  expect((await login()).status).toBe(429);
  vi.advanceTimersByTime(11 * 60 * 1000);
  expect((await login()).status).toBe(429);
  vi.advanceTimersByTime(5 * 60 * 1000);
  expect((await login()).status).toBe(401);
});
