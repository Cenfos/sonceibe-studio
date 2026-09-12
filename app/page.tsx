import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { StudioClient } from '@/components/studio-client';
import {
  STUDIO_SESSION_COOKIE,
  isStudioAccessConfigured,
  readStudioSession,
} from '@/lib/studio-auth-server';

export default function Home() {
  const configured = isStudioAccessConfigured();
  const token = cookies().get(STUDIO_SESSION_COOKIE)?.value;
  const session = configured ? readStudioSession(token) : null;
  const userId = session?.u || (!configured && process.env.NODE_ENV !== 'production' ? 'owner' : null);

  if (!userId) redirect('/access');

  return <StudioClient userId={userId} />;
}
