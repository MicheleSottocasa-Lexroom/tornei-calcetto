import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Match } from '@/types';

/** Tutte le partite di un torneo, ordinate per stage/round/orario. */
export function useMatches(tournamentId: string | undefined) {
  return useQuery<Match[]>({
    queryKey: ['tournament', tournamentId, 'matches'],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId!)
        .order('round', { ascending: true, nullsFirst: true })
        .order('bracket_position', { ascending: true, nullsFirst: true })
        .order('scheduled_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
