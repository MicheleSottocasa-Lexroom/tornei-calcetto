import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { StandingRow } from '@/types';

/** Classifica di un torneo, letta dalla vista `standings_ranked` (già ordinata). */
export function useStandings(tournamentId: string | undefined) {
  return useQuery<StandingRow[]>({
    queryKey: ['tournament', tournamentId, 'standings'],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('standings_ranked')
        .select('*')
        .eq('tournament_id', tournamentId!)
        .order('group_id', { ascending: true, nullsFirst: true })
        .order('position', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
