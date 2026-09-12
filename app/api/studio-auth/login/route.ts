import { NextResponse } from 'next/server';
import {
  STUDIO_SESSION_COOKIE,
  createStudioSession,
  isStudioAccessConfigured,
  studioSessionMaxAge,
  userForAccessCode,
} from '@/lib/studio-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const STALE_ENTRY_MS = 60 * 60 * 1000;

type LoginAttempt = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
  lastSeenAt: number;
};

declare global {
  // Reutiliza el contador mientras la instancia serverless siga activa.
  // En una futura versión con muchos usuarios se puede sustituir por Redis/Vercel Firewall.
  // eslint-disable-next-line no-var
  var __sonceibeStudioLoginAttempts: Map<string, LoginAttempt> | undefined;
}

const loginAttempts =
  globalThis.__sonceibeStudioLoginAttempts ?? new Map<string, LoginAttempt>();

globalThis.__sonceibeStudioLoginAttempts = loginAttempts;

function clientKey(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const forwardedIp = forwardedFor?.split(',')[0]?.trim();
  return forwardedIp || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function cleanupAttempts(now: number) {
  for (const [key, attempt] of loginAttempts) {
    if (now - attempt.lastSeenAt > STALE_ENTRY_MS && attempt.blockedUntil <= now) {
      loginAttempts.delete(key);
    }
  }
}

function currentAttempt(key: string, now: number): LoginAttempt {
  const existing = loginAttempts.get(key);

  if (!existing || now - existing.windowStartedAt > ATTEMPT_WINDOW_MS) {
    const fresh: LoginAttempt = {
      failures: 0,
      windowStartedAt: now,
      blockedUntil: 0,
      lastSeenAt: now,
    };
    loginAttempts.set(key, fresh);
    return fresh;
  }

  existing.lastSeenAt = now;
  return existing;
}

function blockedSeconds(key: string, now: number): number {
  const attempt = currentAttempt(key, now);
  if (attempt.blockedUntil <= now) return 0;
  return Math.max(1, Math.ceil((attempt.blockedUntil - now) / 1000));
}

function registerFailure(key: string, now: number): number {
  const attempt = currentAttempt(key, now);
  attempt.failures += 1;
  attempt.lastSeenAt = now;

  if (attempt.failures >= MAX_FAILED_ATTEMPTS) {
    attempt.blockedUntil = now + BLOCK_MS;
    return Math.ceil(BLOCK_MS / 1000);
  }

  return 0;
}

function clearFailures(key: string) {
  loginAttempts.delete(key);
}

async function smallFailureDelay(failures: number) {
  // Ralentiza intentos automatizados sin penalizar demasiado un error humano.
  const delayMs = Math.min(1200, 250 + failures * 150);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function rateLimitedResponse(retryAfter: number) {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return NextResponse.json(
    {
      ok: false,
      error: `Demasiados intentos incorrectos. Prueba de nuevo en ${minutes} min.`,
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function POST(request: Request) {
  if (!isStudioAccessConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      const response = NextResponse.json({ ok: true, userId: 'owner' });
      response.cookies.set({
        name: STUDIO_SESSION_COOKIE,
        value: createStudioSession('owner'),
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: studioSessionMaxAge,
      });
      return response;
    }

    return NextResponse.json(
      { ok: false, error: 'El acceso privado todavía no está configurado.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const key = clientKey(request);
  const now = Date.now();
  cleanupAttempts(now);

  const retryAfter = blockedSeconds(key, now);
  if (retryAfter > 0) {
    return rateLimitedResponse(retryAfter);
  }

  let code = '';
  try {
    const body = (await request.json()) as { code?: unknown };
    code = typeof body.code === 'string' ? body.code.trim() : '';
  } catch {
    // Respuesta uniforme para entradas no válidas.
  }

  const userId = code ? userForAccessCode(code) : null;
  if (!userId) {
    const attempt = currentAttempt(key, now);
    const newlyBlockedFor = registerFailure(key, now);
    await smallFailureDelay(attempt.failures);

    if (newlyBlockedFor > 0) {
      return rateLimitedResponse(newlyBlockedFor);
    }

    return NextResponse.json(
      { ok: false, error: 'Código de acceso incorrecto.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  clearFailures(key);

  const response = NextResponse.json(
    { ok: true, userId },
    { headers: { 'Cache-Control': 'no-store' } }
  );
  response.cookies.set({
    name: STUDIO_SESSION_COOKIE,
    value: createStudioSession(userId),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: studioSessionMaxAge,
  });
  return response;
}
