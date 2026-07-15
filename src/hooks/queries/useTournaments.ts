import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tournament } from '@/types';

/** Elenco di tutti i tornei (ordinati per data di inizio, più recenti prima). */
export function useTournaments() {
  return useQuery<Tournament[]>({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('starts_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Dettaglio di un singolo torneo. */
export function useTournament(id: string | undefined) {
  return useQuery<Tournament | null>({
    queryKey: ['tournament', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
