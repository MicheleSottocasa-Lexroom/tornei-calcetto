import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from './useSession';
import type { Profile } from '@/types';

/**
 * Legge il profilo dell'utente autenticato tramite TanStack Query (queryKey ['profile']).
 * `useSession()` espone già il profilo, ma questo hook è utile quando serve
 * lo stato di caricamento/refetch della sola query profilo.
 */
export function useProfile() {
  const { user } = useSession();

  return useQuery<Profile | null>({
    queryKey: ['profile'],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
