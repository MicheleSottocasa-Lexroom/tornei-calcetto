import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import type {
  MatchCheckIn,
  MemberRole,
  Profile,
  Team,
  TeamInsert,
  TeamMember,
  TeamMemberInsert,
  TeamParticipant,
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

export interface ParticipantInput {
  full_name: string;
  email?: string | null;
}

export interface CreateTeamInput {
  name: string;
  /** Numero di maglia del capitano (opzionale). */
  shirtNumber?: number | null;
  /** Partecipanti (max 3). Il primo è il capitano (l'utente stesso). */
  participants: ParticipantInput[];
  /** true = candidatura a torneo in corso (in attesa di approvazione admin). */
  pending?: boolean;
}

/**
 * Crea una nuova squadra: l'utente diventa `created_by` e `captain_id`,
 * viene inserito nella rosa come `captain` e vengono registrati i partecipanti
 * (nomi liberi + email facoltativa). Il primo partecipante è il capitano
 * (auto-associato); gli altri restano da reclamare al login.
 */
export function useCreateTeam(tournamentId: string) {
  const queryClient = useQueryClient();
  const { user } = useSession();

  return useMutation<Team, unknown, CreateTeamInput>({
    mutationFn: async ({ name, shirtNumber, participants, pending }) => {
      if (!user) throw new Error('Devi accedere per creare una squadra.');

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          tournament_id: tournamentId,
          name: name.trim(),
          created_by: user.id,
          captain_id: user.id,
          pending: pending ?? false,
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
        await supabase.from('teams').delete().eq('id', team.id);
        throw memberError;
      }

      const captainEmail = user.email?.toLowerCase() ?? null;
      const rows = participants
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.full_name.trim().length > 0)
        .map(({ p, i }) => {
          const email = p.email?.trim() ? p.email.trim().toLowerCase() : null;
          const isCaptain = i === 0 || (!!captainEmail && email === captainEmail);
          return {
            team_id: team.id,
            tournament_id: tournamentId,
            full_name: p.full_name.trim(),
            email,
            profile_id: isCaptain ? user.id : null,
            created_by: user.id,
          };
        });

      if (rows.length > 0) {
        const { error: partError } = await supabase.from('team_participants').insert(rows);
        if (partError) {
          // Rollback: elimina la squadra (cascade su membri e partecipanti).
          await supabase.from('teams').delete().eq('id', team.id);
          throw partError;
        }
      }

      return team as Team;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamsKey(tournamentId) });
      void queryClient.invalidateQueries({
        queryKey: ['tournament', tournamentId, 'participants'],
      });
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

export interface RenameTeamInput {
  teamId: string;
  name: string;
}

/** Il capitano (o admin) rinomina la propria squadra. */
export function useRenameTeam() {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, RenameTeamInput>({
    mutationFn: async ({ teamId, name }) => {
      const { error } = await supabase
        .from('teams')
        .update({ name: name.trim() })
        .eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      void queryClient.invalidateQueries({ queryKey: ['tournament'] });
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

/* -------------------------------------------------------------------------- */
/* Partecipanti squadra + claim al login                                       */
/* -------------------------------------------------------------------------- */

/** Partecipanti (nomi liberi) di tutte le squadre di un torneo. */
export function useTeamParticipants(tournamentId: string | undefined) {
  return useQuery<TeamParticipant[]>({
    queryKey: ['tournament', tournamentId, 'participants'],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_participants')
        .select('*')
        .eq('tournament_id', tournamentId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface PendingClaim {
  participant: TeamParticipant;
  teamName: string;
  tournamentName: string;
}

/**
 * Partecipanti non ancora associati che corrispondono al nome/cognome o
 * all'email dell'utente autenticato (da proporre come "claim" al login).
 */
export function usePendingClaims() {
  const { user, profile } = useSession();
  const email = user?.email?.toLowerCase() ?? null;
  const name = profile?.full_name?.trim() ?? null;

  return useQuery<PendingClaim[]>({
    queryKey: ['pending-claims', user?.id, name],
    enabled: !!user,
    queryFn: async () => {
      const byId = new Map<string, TeamParticipant>();

      if (email) {
        const { data, error } = await supabase
          .from('team_participants')
          .select('*')
          .is('profile_id', null)
          .ilike('email', email);
        if (error) throw error;
        for (const p of data ?? []) byId.set(p.id, p);
      }
      if (name) {
        const { data, error } = await supabase
          .from('team_participants')
          .select('*')
          .is('profile_id', null)
          .ilike('full_name', name);
        if (error) throw error;
        for (const p of data ?? []) byId.set(p.id, p);
      }

      const participants = [...byId.values()];
      if (participants.length === 0) return [];

      const teamIds = [...new Set(participants.map((p) => p.team_id))];
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, tournament_id')
        .in('id', teamIds);
      const teamsById = new Map((teams ?? []).map((t) => [t.id, t]));

      const tournamentIds = [...new Set((teams ?? []).map((t) => t.tournament_id))];
      let tournamentsById = new Map<string, { id: string; name: string }>();
      if (tournamentIds.length > 0) {
        const { data: tournaments } = await supabase
          .from('tournaments')
          .select('id, name')
          .in('id', tournamentIds);
        tournamentsById = new Map((tournaments ?? []).map((t) => [t.id, t]));
      }

      return participants.map((participant) => {
        const team = teamsById.get(participant.team_id);
        return {
          participant,
          teamName: team?.name ?? 'Squadra',
          tournamentName: team
            ? tournamentsById.get(team.tournament_id)?.name ?? ''
            : '',
        } satisfies PendingClaim;
      });
    },
  });
}

/** Reclama un partecipante: associa la squadra al profilo dell'utente. */
export function useClaimParticipant() {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: async (participantId) => {
      const { error } = await supabase.rpc('claim_team_participant', {
        p_participant_id: participantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pending-claims'] });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      void queryClient.invalidateQueries({ queryKey: ['tournament'] });
    },
  });
}

/**
 * Esce da una squadra: rimuove la membership e rilascia il claim del partecipante.
 * Un capitano unico membro scioglie la squadra; con altri membri deve prima passare
 * la fascia (l'RPC solleva un errore chiaro).
 */
export function useLeaveTeam() {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, { teamId: string }>({
    mutationFn: async ({ teamId }) => {
      const { error } = await supabase.rpc('leave_team', { p_team_id: teamId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      void queryClient.invalidateQueries({ queryKey: ['pending-claims'] });
      void queryClient.invalidateQueries({ queryKey: ['tournament'] });
    },
  });
}

/** Passa la fascia di capitano a un altro membro della squadra. */
export function useTransferCaptaincy(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, { teamId: string; newCaptainId: string }>({
    mutationFn: async ({ teamId, newCaptainId }) => {
      const { error } = await supabase.rpc('transfer_captaincy', {
        p_team_id: teamId,
        p_new_captain: newCaptainId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamsKey(tournamentId) });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Check-in presenze (partite live)                                    */
/* ------------------------------------------------------------------ */

/**
 * Check-in delle squadre per le partite del torneo. La RLS restituisce solo i
 * check-in delle partite in cui l'utente gioca (o tutte, se admin): quindi il
 * dato è visibile solo alle squadre sfidanti.
 */
export function useMatchCheckIns(tournamentId: string | undefined) {
  return useQuery<MatchCheckIn[]>({
    queryKey: ['tournament', tournamentId, 'checkins'],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_check_ins')
        .select('*')
        .eq('tournament_id', tournamentId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** La squadra dell'utente fa il check-in a una partita live (RPC check_in_match). */
export function useCheckInMatch() {
  const queryClient = useQueryClient();
  return useMutation<string, Error, { tournamentId: string; matchId: string }>({
    mutationFn: async ({ matchId }) => {
      const { data, error } = await supabase.rpc('check_in_match', {
        p_match_id: matchId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, { tournamentId }) => {
      void queryClient.invalidateQueries({
        queryKey: ['tournament', tournamentId, 'checkins'],
      });
    },
  });
}
