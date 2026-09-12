import { NextResponse } from 'next/server';
import { STUDIO_SESSION_COOKIE } from '@/lib/studio-auth-server';

export const runtime = 'nodejs';

export function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: STUDIO_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
