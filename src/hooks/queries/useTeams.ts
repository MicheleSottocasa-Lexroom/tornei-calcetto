import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Profile, Team, TeamMember, TeamWithMembers } from '@/types';

/**
 * Squadre di un torneo con le rispettive rose (team_members) e i profili dei giocatori.
 * Le tre letture vengono unite lato client per rimanere completamente tipizzate.
 */
export function useTeams(tournamentId: string | undefined) {
  return useQuery<TeamWithMembers[]>({
    queryKey: ['tournament', tournamentId, 'teams'],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', tournamentId!)
        .order('name', { ascending: true });
      if (teamsError) throw teamsError;
      if (!teams || teams.length === 0) return [];

      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('tournament_id', tournamentId!);
      if (membersError) throw membersError;

      const profileIds = Array.from(
        new Set((members ?? []).map((m) => m.profile_id)),
      );

      let profilesById = new Map<string, Profile>();
      if (profileIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', profileIds);
        if (profilesError) throw profilesError;
        profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));
      }

      const membersByTeam = new Map<string, TeamMember[]>();
      for (const m of members ?? []) {
        const list = membersByTeam.get(m.team_id) ?? [];
        list.push(m);
        membersByTeam.set(m.team_id, list);
      }

      return (teams as Team[]).map((team) => ({
        ...team,
        members: (membersByTeam.get(team.id) ?? []).map((m) => ({
          ...m,
          profile: profilesById.get(m.profile_id) ?? null,
        })),
      }));
    },
  });
}
