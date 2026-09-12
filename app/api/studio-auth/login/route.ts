import { NextResponse } from 'next/server';
import {
  STUDIO_SESSION_COOKIE,
  createStudioSession,
  isStudioAccessConfigured,
  studioSessionMaxAge,
  userForAccessCode,
} from '@/lib/studio-auth-server';

export const runtime = 'nodejs';

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
      { status: 503 }
    );
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
    return NextResponse.json({ ok: false, error: 'Código de acceso incorrecto.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, userId });
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
