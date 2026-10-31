import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, authClient, isStudioAccessConfigured, safeDestination, setAuthCookies } from '@/lib/studio-auth-server';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith('/api/studio-auth/')) return NextResponse.next();
  let session = null;
  let authenticated = false;
  if (isStudioAccessConfigured()) {
    const client = authClient();
    const access = request.cookies.get(ACCESS_COOKIE)?.value;
    if (access) {
      const { data } = await client.auth.getUser(access);
      authenticated = Boolean(data.user?.email_confirmed_at);
    }
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    if (!authenticated && refresh) {
      const { data } = await client.auth.refreshSession({ refresh_token: refresh });
      session = data.session;
      authenticated = Boolean(data.user?.email_confirmed_at && session);
      if (authenticated && session) request.cookies.set(ACCESS_COOKIE, session.access_token);
    }
  }
  let response: NextResponse;
  if (path !== '/access' && !authenticated) {
    const url = new URL('/access', request.url);
    if (path === '/download/windows') url.searchParams.set('next', path);
    response = NextResponse.redirect(url);
  } else if (path === '/access' && authenticated && !request.nextUrl.searchParams.has('token_hash') && request.nextUrl.searchParams.get('mode') !== 'update') {
    response = NextResponse.redirect(new URL(safeDestination(request.nextUrl.searchParams.get('next')), request.url));
  } else response = NextResponse.next({ request: { headers: request.headers } });
  if (session) setAuthCookies(response, session);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)'],
};

