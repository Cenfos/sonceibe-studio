import { handleAuth } from '@/lib/studio-auth-actions';
export const runtime = 'nodejs';
export const POST = (request: Request) => handleAuth(request, 'logout');

