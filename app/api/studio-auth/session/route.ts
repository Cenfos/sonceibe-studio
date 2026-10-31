import { NextResponse } from 'next/server';
import { currentStudioUser } from '@/lib/studio-auth-server';
export const runtime = 'nodejs';
export async function GET() {
  const user = await currentStudioUser();
  return NextResponse.json(user ? { authenticated: true, userId: user.id, name: user.user_metadata.name } : { authenticated: false }, {
    status: user ? 200 : 401, headers: { 'Cache-Control': 'private, no-store' },
  });
}

