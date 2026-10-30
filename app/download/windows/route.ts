import { NextRequest, NextResponse } from 'next/server';
import { STUDIO_SESSION_COOKIE, readStudioSession } from '@/lib/studio-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  // Download access always requires a real session, including development.
  if (!readStudioSession(request.cookies.get(STUDIO_SESSION_COOKIE)?.value)) {
    const response = NextResponse.redirect(new URL('/access?next=%2Fdownload%2Fwindows', request.url));
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
  try {
    const { get } = await import('@vercel/blob');
    const installer = await get('windows/SonCeibe-Studio-Setup.exe', { access: 'private', useCache: false });
    if (!installer || installer.statusCode !== 200) {
      return new NextResponse('El instalador de Windows todavía no está disponible.', { status: 503, headers });
    }
    return new NextResponse(installer.stream, {
      headers: {
        ...headers,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="SonCeibe-Studio-Setup.exe"',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('No se pudo descargar el instalador. Vuelve a intentarlo más tarde.', { status: 502, headers });
  }
}
