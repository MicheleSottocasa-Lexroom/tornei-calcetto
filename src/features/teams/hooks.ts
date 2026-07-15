import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import type {
  MemberRole,
  Profile,
  Team,
  TeamInsert,
  TeamMember,
  TeamMemberInsert,
  Tournament,
} from '@/types';

/** queryKey delle squadre di un torneo, coerente con la Fondazione. */
const teamsKey = (tournamentId: string) =>
  ['tournament', tournamentId, 'teams'] as const;

/**
 * Traduce gli errori più comuni di Postgres/Supabase in messaggi italiani
 * comprensibili per l'utente finale.
 */
export function teamErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === '23505') {
    // Violazione di vincolo unique.
    if (e.message?.includes('team_members')) {
      return 'Questo giocatore è già iscritto a una squadra in questo torneo.';
    }
    if (e.message?.includes('teams')) {
      return 'Esiste già una squadra con questo nome in questo torneo.';
    }
    return 'Iscrizione già presente.';
  }
  if (e?.code === '42501') {
    return 'Non hai i permessi per eseguire questa operazione.';
  }
  return e?.message ?? 'Si è verificato un errore. Riprova.';
}

/* -------------------------------------------------------------------------- */
/* Mutation                                                                    */
/* -------------------------------------------------------------------------- */

export interface CreateTeamInput {
  name: string;
  /** Numero di maglia del capitano (opzionale). */
  shirtNumber?: number | null;
}

/**
 * Crea una nuova squadra: l'utente diventa `created_by` e `captain_id`,
 * poi viene inserito nella rosa come `captain`.
 */
export function useCreateTeam(tournamentId: string) {
  const queryClient = useQueryClient();
  const { user } = useSession();

  return useMutation<Team, unknown, CreateTeamInput>({
    mutationFn: async ({ name, shirtNumber }) => {
      if (!user) throw new Error('Devi accedere per creare una squadra.');

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          tournament_id: tournamentId,
          name: name.trim(),
          created_by: user.id,
          captain_id: user.id,
        } satisfies TeamInsert)
        .select()
        .single();
      if (teamError) throw teamError;

      const { error: memberError } = await supabase.from('team_members').insert({
        team_id: team.id,
        profile_id: user.id,
        role: 'captain',
        shirt_number: shirtNumber ?? null,
      } satisfies TeamMemberInsert);
      if (memberError) {
        // Rollback best-effort della squadra orfana (potrebbe fallire per RLS,
        // in tal caso resterà da ripulire lato admin).
        await supabase.from('teams').delete().eq('id', team.id);
        throw memberError;
      }

      return team as Team;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamsKey(tournamentId) });
    },
  });
}

export interface JoinTeamInput {
  teamId: string;
  shirtNumber?: number | null;
}

/** L'utente autenticato si auto-iscrive come giocatore a una squadra esistente. */
export function useJoinTeam(tournamentId: string) {
  const queryClient = useQueryClient();
  const { user } = useSession();

  return useMutation<void, unknown, JoinTeamInput>({
    mutationFn: async ({ teamId, shirtNumber }) => {
      if (!user) throw new Error('Devi accedere per unirti a una squadra.');
      const { error } = await supabase.from('team_members').insert({
        team_id: teamId,
        profile_id: user.id,
        role: 'player',
        shirt_number: shirtNumber ?? null,
      } satisfies TeamMemberInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamsKey(tournamentId) });
    },
  });
}

export interface AddTeamMemberInput {
  teamId: string;
  profileId: string;
  shirtNumber?: number | null;
  role?: MemberRole;
}

/** Il capitano (o admin) aggiunge un giocatore alla rosa. */
export function useAddTeamMember(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, AddTeamMemberInput>({
    mutationFn: async ({ teamId, profileId, shirtNumber, role }) => {
      const { error } = await supabase.from('team_members').insert({
        team_id: teamId,
        profile_id: profileId,
        role: role ?? 'player',
        shirt_number: shirtNumber ?? null,
      } satisfies TeamMemberInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamsKey(tournamentId) });
    },
  });
}

/**
 * Rimuove un membro dalla rosa (per id di `team_members`).
 * Consentito a capitano, admin o all'utente stesso (RLS).
 */
export function useRemoveTeamMember(tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, string>({
    mutationFn: async (memberId) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamsKey(tournamentId) });
    },
  });
}

export interface UpdateProfileInput {
  full_name?: string | null;
  avatar_url?: string | null;
}

/** Aggiorna i dati del profilo dell'utente autenticato. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useSession();

  return useMutation<Profile, unknown, UpdateProfileInput>({
    mutationFn: async (input) => {
      if (!user) throw new Error('Devi accedere per modificare il profilo.');
      const patch: UpdateProfileInput = {};
      if (input.full_name !== undefined) patch.full_name = input.full_name;
      if (input.avatar_url !== undefined) patch.avatar_url = input.avatar_url;

      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Query di lettura ausiliarie della feature                                   */
/* -------------------------------------------------------------------------- */

/**
 * Tutti i profili (per il selettore giocatori del capitano).
 * Sorgente unica condivisa con l'area admin: stessa queryKey ['profiles','all']
 * e stesso queryFn/ordinamento, per evitare due sorgenti di verità sulla cache.
 */
export { useProfiles } from '@/features/admin/hooks';

export interface MyTeamEntry {
  membership: TeamMember;
  team: Team;
  tournament: Tournament | null;
}

/** Squadre a cui appartiene l'utente autenticato, con il relativo torneo. */
export function useMyTeams() {
  const { user } = useSession();

  return useQuery<MyTeamEntry[]>({
    queryKey: ['my-teams', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('profile_id', user!.id);
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      const teamIds = Array.from(new Set(members.map((m) => m.team_id)));
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds);
      if (teamsError) throw teamsError;
      const teamsById = new Map((teams ?? []).map((t) => [t.id, t as Team]));

      const tournamentIds = Array.from(
        new Set((teams ?? []).map((t) => t.tournament_id)),
      );
      let tournamentsById = new Map<string, Tournament>();
      if (tournamentIds.length > 0) {
        const { data: tournaments, error: tournamentsError } = await supabase
          .from('tournaments')
          .select('*')
          .in('id', tournamentIds);
        if (tournamentsError) throw tournamentsError;
        tournamentsById = new Map(
          (tournaments ?? []).map((t) => [t.id, t as Tournament]),
        );
      }

      return (members as TeamMember[])
        .map((membership) => {
          const team = teamsById.get(membership.team_id);
          if (!team) return null;
          return {
            membership,
            team,
            tournament: tournamentsById.get(team.tournament_id) ?? null,
          } satisfies MyTeamEntry;
        })
        .filter((entry): entry is MyTeamEntry => entry !== null);
    },
  });
}
