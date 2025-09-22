import { createClient } from '@/utils/supabase/client';
import { useCallback } from 'react';

export const useAuthenticatedFetch = () => {
  const supabase = createClient();

  const authenticatedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers = new Headers(options.headers);
      if (session) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      return response;
    },
    [supabase]
  );

  return authenticatedFetch;
};
