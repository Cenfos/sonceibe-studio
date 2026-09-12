import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'sonceibe-studio-session';

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function validSession(token: string | undefined, rawCodes: string): Promise<boolean> {
  if (!token) return false;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return false;

  try {
    const encoder = new TextEncoder();
    const keyBytes = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(`sonceibe-studio:${rawCodes}`)
    );
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureOk = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(signature),
      encoder.encode(encoded)
    );
    if (!signatureOk) return false;

    const payloadBytes = decodeBase64Url(encoded);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as { u?: string; e?: number };
    return Boolean(payload.u && payload.e && payload.e >= Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const rawCodes = process.env.STUDIO_ACCESS_CODES?.trim() ?? '';
  const isAccessPage = request.nextUrl.pathname === '/access';

  // Local development remains frictionless until an access-code variable is set.
  if (!rawCodes && process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  const authenticated = rawCodes
    ? await validSession(request.cookies.get(COOKIE_NAME)?.value, rawCodes)
    : false;

  if (isAccessPage) {
    if (authenticated) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  if (!authenticated) {
    return NextResponse.redirect(new URL('/access', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/studio-auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)'],
};
