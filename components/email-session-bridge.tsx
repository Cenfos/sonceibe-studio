'use client';

import { useEffect } from 'react';
import { studioPath } from '@/lib/studio-paths';

// Supabase's default templates return to the Site URL, including when signed in.
export function EmailSessionBridge() {
  useEffect(() => {
    const handleFragment = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      if (window.location.pathname === studioPath('/access')) return;
      if (fragment.has('access_token') || fragment.has('error')) {
        window.location.replace(studioPath('/access?mode=callback') + window.location.hash);
      }
    };
    handleFragment();
    window.addEventListener('hashchange', handleFragment);
    return () => window.removeEventListener('hashchange', handleFragment);
  }, []);
  return null;
}
