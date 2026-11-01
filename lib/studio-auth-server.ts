import { createClient, type Session } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { STUDIO_BASE_PATH, studioPath } from './studio-paths';

export const ACCESS_COOKIE = 'studio-access';
export const REFRESH_COOKIE = 'studio-refresh';
export function isStudioAccessConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}
export function authClient(access?: string) {
  if (!isStudioAccessConfigured()) throw new Error('Auth is not configured');
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(access ? { global: { headers: { Authorization: `Bearer ${access}` } } } : {}),
  });
}
export function setAuthCookies(response: NextResponse, session: Session | null) {
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: STUDIO_BASE_PATH };
  response.cookies.set(ACCESS_COOKIE, session?.access_token ?? '', { ...options, maxAge: session ? session.expires_in : 0 });
  response.cookies.set(REFRESH_COOKIE, session?.refresh_token ?? '', { ...options, maxAge: session ? 60 * 60 * 24 * 30 : 0 });
  response.cookies.set('sonceibe-studio-session', '', { ...options, maxAge: 0 });
}
export async function currentStudioUser() {
  if (!isStudioAccessConfigured()) return null;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const { data, error } = await authClient().auth.getUser(token);
  return error || !data.user?.email_confirmed_at ? null : data.user;
}
export function safeDestination(value: string | null) {
  return value === '/download/windows' || value === studioPath('/download/windows') ? studioPath('/download/windows') : studioPath();
}

