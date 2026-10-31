import { redirect } from 'next/navigation';
import { StudioClient } from '@/components/studio-client';
import { currentStudioUser } from '@/lib/studio-auth-server';

export default async function Home() {
  const user = await currentStudioUser();
  if (!user) redirect('/access');
  return <StudioClient userId={user.id} />;
}

