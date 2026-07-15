import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Sottoscrive i cambiamenti realtime di un torneo (partite ed eventi) e invalida
 * le query TanStack pertinenti così classifica/calendario/marcatori si aggiornano live.
 * `removeChannel` in cleanup è obbligatorio per non lasciare connessioni orfane.
 */
export function useRealtimeTournament(tournamentId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tournamentId) return;

    const invalidate = () => {
      queryClient.invalidateQueries({
        queryKey: ['tournament', tournamentId, 'matches'],
      });
      queryClient.invalidateQueries({
        queryKey: ['tournament', tournamentId, 'standings'],
      });
      queryClient.invalidateQueries({
        queryKey: ['tournament', tournamentId, 'scorers'],
      });
    };

    const channel = supabase
      .channel(`tournament:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_events',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, queryClient]);
}
