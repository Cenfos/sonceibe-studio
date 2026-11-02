import AccessForm from './access-form';
import { safeDestination } from '@/lib/studio-auth-server';

export default async function AccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const token = typeof params.token_hash === 'string' ? params.token_hash : '';
  return <AccessForm initialToken={token} initialType={params.type === 'recovery' ? 'recovery' : 'email'}
    initialMode={token ? 'confirm' : params.mode === 'update' ? 'update' : 'login'}
    destination={safeDestination(typeof params.next === 'string' ? params.next : null)} />;
}
