import { NextRequest, NextResponse } from 'next/server';
import {
  STUDIO_SESSION_COOKIE,
  isStudioAccessConfigured,
  readStudioSession,
} from '@/lib/studio-auth-server';

export const runtime = 'nodejs';

export function GET(request: NextRequest) {
  if (!isStudioAccessConfigured() && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({ authenticated: true, userId: 'owner' });
  }

  const token = request.cookies.get(STUDIO_SESSION_COOKIE)?.value;
  const session = readStudioSession(token);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, userId: session.u });
}
