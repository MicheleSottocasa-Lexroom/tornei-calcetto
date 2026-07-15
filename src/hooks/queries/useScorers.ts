import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TopScorerRow } from '@/types';

/** Marcatori di un torneo, letti dalla vista `top_scorers`. */
export function useTopScorers(tournamentId: string | undefined) {
  return useQuery<TopScorerRow[]>({
    queryKey: ['tournament', tournamentId, 'scorers'],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('top_scorers')
        .select('*')
        .eq('tournament_id', tournamentId!)
        .order('goals', { ascending: false })
        .order('assists', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
