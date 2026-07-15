/**
 * Mutation e query di supporto dell'AREA ADMIN.
 *
 * Regole del contratto Frontend:
 * - NON si toccano i file query della Fondazione: qui vivono SOLO le mutation
 *   (e alcune letture di supporto non coperte dagli hook condivisi).
 * - Ogni mutation invalida le queryKey pertinenti secondo la convenzione:
 *   ["tournaments"], ["tournament", id], ["tournament", id, "matches"|"standings"|"scorers"|"teams"|"groups"].
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  Group,
  Json,
  Match,
  MatchEvent,
  MatchEventType,
  MatchStage,
  MatchStatus,
  Profile,
  Tournament,
  TournamentFormat,
  TournamentStatus,
} from '@/types';

/* ------------------------------------------------------------------ */
/* Tipi di configurazione torneo                                       */
/* ------------------------------------------------------------------ */

export interface TournamentConfig {
  points: { win: number; draw: number; loss: number };
  round_robin: { double_round: boolean };
  groups: { num_groups: number; advance_per_group: number };
  knockout: { seeding: 'seeded' | 'random'; legs: number; third_place: boolean };
  /** Se true: niente calendario generato, le partite si aggiungono a mano. */
  manual_matches: boolean;
}

export interface CreateTournamentInput {
  name: string;
  description?: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  config: TournamentConfig;
}

/** Bozza di evento partita gestita nel form risultati (id assente = nuovo). */
export interface MatchEventDraft {
  id?: string;
  event_type: MatchEventType;
  team_id: string | null;
  player_id: string | null;
  assist_player_id: string | null;
  minute: number | null;
}

/* ------------------------------------------------------------------ */
/* Letture di supporto (gironi, profili, eventi partita)               */
/* ------------------------------------------------------------------ */

export interface GroupWithTeamIds extends Group {
  team_ids: string[];
}

/** Gironi di un torneo con l'elenco degli id squadra assegnati. */
export function useGroups(tournamentId: string | undefined) {
  return useQuery<GroupWithTeamIds[]>({
    queryKey: ['tournament', tournamentId, 'groups'],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data: groups, error } = await supabase
        .from('groups')
        .select('*')
        .eq('tournament_id', tournamentId!)
        .order('position', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      if (!groups || groups.length === 0) return [];

      const groupIds = groups.map((g) => g.id);
      const { data: links, error: linksError } = await supabase
        .from('group_teams')
        .select('*')
        .in('group_id', groupIds);
      if (linksError) throw linksError;

      const byGroup = new Map<string, string[]>();
      for (const link of links ?? []) {
        const list = byGroup.get(link.group_id) ?? [];
        list.push(link.team_id);
        byGroup.set(link.group_id, list);
      }

      return groups.map((g) => ({ ...g, team_ids: byGroup.get(g.id) ?? [] }));
    },
  });
}

/** Elenco di tutti i profili (per assegnare giocatori alle squadre). */
export function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: ['profiles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true, nullsFirst: false })
        .order('email', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Eventi (gol, cartellini, mvp…) di una singola partita. */
export function useMatchEvents(matchId: string | undefined) {
  return useQuery<MatchEvent[]>({
    queryKey: ['match', matchId, 'events'],
    enabled: !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', matchId!)
        .order('minute', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Utility interne                                                     */
/* ------------------------------------------------------------------ */

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Tornei                                                              */
/* ------------------------------------------------------------------ */

/** Crea un nuovo torneo e ritorna la riga inserita. */
export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation<Tournament, Error, CreateTournamentInput>({
    mutationFn: async (input) => {
      const uid = await currentUserId();
      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          name: input.name,
          description: input.description ?? null,
          format: input.format,
          status: input.status,
          starts_at: input.starts_at ?? null,
          ends_at: input.ends_at ?? null,
          config: input.config as unknown as Json,
          created_by: uid,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['tournaments'] });
      qc.invalidateQueries({ queryKey: ['tournament', t.id] });
    },
  });
}

export interface UpdateTournamentInput {
  id: string;
  name?: string;
  description?: string | null;
  format?: TournamentFormat;
  status?: TournamentStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  config?: TournamentConfig;
}

/** Aggiorna un torneo (stato, config, date…). */
export function useUpdateTournament() {
  const qc = useQueryClient();
  return useMutation<Tournament, Error, UpdateTournamentInput>({
    mutationFn: async ({ id, config, ...rest }) => {
      const { data, error } = await supabase
        .from('tournaments')
        .update({
          ...rest,
          ...(config ? { config: config as unknown as Json } : {}),
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['tournaments'] });
      qc.invalidateQueries({ queryKey: ['tournament', t.id] });
    },
  });
}

export interface CreateMatchInput {
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  stage?: MatchStage;
  round?: number;
  homeScore?: number | null;
  awayScore?: number | null;
  scheduledAt?: string | null;
  venue?: string | null;
}

/**
 * Crea manualmente una singola partita (gestione manuale, senza calendario).
 * Se sono presenti entrambi i punteggi la partita è già "conclusa" e conta in classifica.
 */
export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation<Match, Error, CreateMatchInput>({
    mutationFn: async (input) => {
      const bothScores = input.homeScore != null && input.awayScore != null;
      const { data, error } = await supabase
        .from('matches')
        .insert({
          tournament_id: input.tournamentId,
          home_team_id: input.homeTeamId,
          away_team_id: input.awayTeamId,
          stage: input.stage ?? 'league',
          round: input.round ?? 1,
          home_score: input.homeScore ?? null,
          away_score: input.awayScore ?? null,
          status: bothScores ? 'finished' : 'scheduled',
          scheduled_at: input.scheduledAt ?? null,
          venue: input.venue ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_m, { tournamentId }) => {
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'matches'] });
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'standings'] });
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'scorers'] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Generazione calendario / tabellone / playoff (RPC lato DB)          */
/* ------------------------------------------------------------------ */

function invalidateTournamentData(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ['tournament', id, 'matches'] });
  qc.invalidateQueries({ queryKey: ['tournament', id, 'standings'] });
  qc.invalidateQueries({ queryKey: ['tournament', id, 'scorers'] });
}

export interface GenerateScheduleInput {
  tournamentId: string;
  /** Se valorizzato genera il calendario del singolo girone (groups_playoff). */
  groupId?: string | null;
}

/** Girone all'italiana / campionato (RPC generate_round_robin). */
export function useGenerateSchedule() {
  const qc = useQueryClient();
  return useMutation<void, Error, GenerateScheduleInput>({
    mutationFn: async ({ tournamentId, groupId }) => {
      const { error } = await supabase.rpc('generate_round_robin', {
        p_tournament_id: tournamentId,
        p_group_id: groupId ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { tournamentId }) => invalidateTournamentData(qc, tournamentId),
  });
}

/** Tabellone a eliminazione diretta (RPC generate_bracket). */
export function useGenerateBracket() {
  const qc = useQueryClient();
  return useMutation<void, Error, { tournamentId: string }>({
    mutationFn: async ({ tournamentId }) => {
      const { error } = await supabase.rpc('generate_bracket', {
        p_tournament_id: tournamentId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { tournamentId }) => invalidateTournamentData(qc, tournamentId),
  });
}

/** Playoff dopo i gironi (RPC generate_playoff). */
export function useGeneratePlayoff() {
  const qc = useQueryClient();
  return useMutation<void, Error, { tournamentId: string }>({
    mutationFn: async ({ tournamentId }) => {
      const { error } = await supabase.rpc('generate_playoff', {
        p_tournament_id: tournamentId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { tournamentId }) => invalidateTournamentData(qc, tournamentId),
  });
}

/* ------------------------------------------------------------------ */
/* Gironi (groups / group_teams)                                       */
/* ------------------------------------------------------------------ */

export interface CreateGroupInput {
  tournamentId: string;
  name: string;
  position?: number;
}

/** Crea un girone in un torneo groups_playoff. */
export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation<Group, Error, CreateGroupInput>({
    mutationFn: async ({ tournamentId, name, position }) => {
      const { data, error } = await supabase
        .from('groups')
        .insert({ tournament_id: tournamentId, name, position: position ?? 0 })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_g, { tournamentId }) =>
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'groups'] }),
  });
}

/** Elimina un girone (e, a cascata, le relative assegnazioni). */
export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation<void, Error, { groupId: string; tournamentId: string }>({
    mutationFn: async ({ groupId }) => {
      const { error } = await supabase.from('groups').delete().eq('id', groupId);
      if (error) throw error;
    },
    onSuccess: (_d, { tournamentId }) =>
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'groups'] }),
  });
}

export interface AssignTeamToGroupInput {
  tournamentId: string;
  groupId: string;
  teamId: string;
}

/** Assegna una squadra a un girone (un girone solo per squadra: rimuove eventuali precedenti). */
export function useAssignTeamToGroup() {
  const qc = useQueryClient();
  return useMutation<void, Error, AssignTeamToGroupInput>({
    mutationFn: async ({ teamId, groupId }) => {
      // Unica istruzione atomica: grazie al vincolo unique(team_id) l'upsert
      // sposta la squadra nel nuovo girone (INSERT ... ON CONFLICT DO UPDATE),
      // evitando la finestra incoerente di un delete+insert separati.
      const { error } = await supabase
        .from('group_teams')
        .upsert({ group_id: groupId, team_id: teamId }, { onConflict: 'team_id' });
      if (error) throw error;
    },
    onSuccess: (_d, { tournamentId }) =>
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'groups'] }),
  });
}

/** Rimuove una squadra da un girone. */
export function useRemoveTeamFromGroup() {
  const qc = useQueryClient();
  return useMutation<void, Error, { tournamentId: string; teamId: string }>({
    mutationFn: async ({ teamId }) => {
      const { error } = await supabase
        .from('group_teams')
        .delete()
        .eq('team_id', teamId);
      if (error) throw error;
    },
    onSuccess: (_d, { tournamentId }) =>
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'groups'] }),
  });
}

/* ------------------------------------------------------------------ */
/* Calendario: orario / campo della partita                            */
/* ------------------------------------------------------------------ */

export interface UpdateMatchScheduleInput {
  tournamentId: string;
  matchId: string;
  scheduled_at: string | null;
  venue: string | null;
}

/** Imposta data/ora e campo di una partita. */
export function useUpdateMatchSchedule() {
  const qc = useQueryClient();
  return useMutation<void, Error, UpdateMatchScheduleInput>({
    mutationFn: async ({ matchId, scheduled_at, venue }) => {
      const { error } = await supabase
        .from('matches')
        .update({ scheduled_at, venue })
        .eq('id', matchId);
      if (error) throw error;
    },
    onSuccess: (_d, { tournamentId }) =>
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'matches'] }),
  });
}

/* ------------------------------------------------------------------ */
/* Risultati + marcatori                                               */
/* ------------------------------------------------------------------ */

export interface SaveMatchResultInput {
  tournamentId: string;
  matchId: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  /** Elenco completo (desiderato) degli eventi della partita. */
  events: MatchEventDraft[];
}

/**
 * Aggiorna il punteggio/stato della partita e SINCRONIZZA gli eventi:
 * inserisce i nuovi, elimina quelli rimossi, lascia intatti quelli invariati.
 */
export function useSaveMatchResult() {
  const qc = useQueryClient();
  return useMutation<Match, Error, SaveMatchResultInput>({
    mutationFn: async (input) => {
      const uid = await currentUserId();

      // 1) aggiorna la partita
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .update({
          status: input.status,
          home_score: input.home_score,
          away_score: input.away_score,
          home_penalties: input.home_penalties,
          away_penalties: input.away_penalties,
        })
        .eq('id', input.matchId)
        .select('*')
        .single();
      if (matchError) throw matchError;

      // 2) diff degli eventi rispetto a quelli già presenti
      const { data: existing, error: existingError } = await supabase
        .from('match_events')
        .select('id')
        .eq('match_id', input.matchId);
      if (existingError) throw existingError;

      const keepIds = new Set(
        input.events.map((e) => e.id).filter((id): id is string => !!id),
      );
      const toDelete = (existing ?? [])
        .map((e) => e.id)
        .filter((id) => !keepIds.has(id));
      const toInsert = input.events.filter((e) => !e.id);

      // NB: le tre scritture non sono in un'unica transazione. Inseriamo PRIMA
      // di eliminare: se l'insert fallisce, i vecchi eventi non sono ancora stati
      // cancellati (nessuna perdita di dati; al più restano eventi non desiderati
      // che verranno ripuliti al prossimo salvataggio riuscito).
      if (toInsert.length > 0) {
        const rows = toInsert.map((e) => ({
          match_id: input.matchId,
          tournament_id: input.tournamentId,
          team_id: e.team_id,
          player_id: e.player_id,
          event_type: e.event_type,
          minute: e.minute,
          assist_player_id: e.assist_player_id,
          created_by: uid,
        }));
        const { error } = await supabase.from('match_events').insert(rows);
        if (error) throw error;
      }

      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('match_events')
          .delete()
          .in('id', toDelete);
        if (error) throw error;
      }

      return match;
    },
    onSuccess: (_m, { tournamentId, matchId }) => {
      invalidateTournamentData(qc, tournamentId);
      qc.invalidateQueries({ queryKey: ['match', matchId, 'events'] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Squadre e rose                                                      */
/* ------------------------------------------------------------------ */

export interface CreateTeamInput {
  tournamentId: string;
  name: string;
  captainId?: string | null;
}

/** Crea una squadra in un torneo. */
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation<void, Error, CreateTeamInput>({
    mutationFn: async ({ tournamentId, name, captainId }) => {
      const uid = await currentUserId();
      const { error } = await supabase.from('teams').insert({
        tournament_id: tournamentId,
        name,
        captain_id: captainId ?? null,
        created_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: (_d, { tournamentId }) =>
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'teams'] }),
  });
}

export interface UpdateTeamInput {
  tournamentId: string;
  teamId: string;
  name?: string;
  status?: 'registered' | 'confirmed' | 'withdrawn';
  captain_id?: string | null;
  seed?: number | null;
}

/** Rinomina / ritira / conferma una squadra (o ne imposta il seed). */
export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation<void, Error, UpdateTeamInput>({
    mutationFn: async ({ teamId, tournamentId: _tid, ...rest }) => {
      void _tid;
      const { error } = await supabase.from('teams').update(rest).eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: (_d, { tournamentId }) => {
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'teams'] });
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'standings'] });
    },
  });
}

export interface AddTeamMemberInput {
  tournamentId: string;
  teamId: string;
  profileId: string;
  role?: 'captain' | 'player';
  shirtNumber?: number | null;
}

/** Aggiunge un giocatore alla rosa di una squadra. */
export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation<void, Error, AddTeamMemberInput>({
    mutationFn: async ({ tournamentId, teamId, profileId, role, shirtNumber }) => {
      const { error } = await supabase.from('team_members').insert({
        team_id: teamId,
        tournament_id: tournamentId,
        profile_id: profileId,
        role: role ?? 'player',
        shirt_number: shirtNumber ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, { tournamentId }) =>
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'teams'] }),
  });
}

/** Rimuove un giocatore da una rosa. */
export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation<void, Error, { tournamentId: string; memberId: string }>({
    mutationFn: async ({ memberId }) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: (_d, { tournamentId }) =>
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'teams'] }),
  });
}

export interface SetCaptainInput {
  tournamentId: string;
  teamId: string;
  /** Membro (team_members.id) da promuovere a capitano. */
  memberId: string;
  /** Profilo del membro (per aggiornare teams.captain_id). */
  profileId: string;
}

/** Promuove un membro a capitano, retrocedendo l'eventuale capitano precedente. */
export function useSetCaptain() {
  const qc = useQueryClient();
  return useMutation<void, Error, SetCaptainInput>({
    mutationFn: async ({ teamId, memberId, profileId }) => {
      // retrocedi i capitani attuali (vincolo: un solo capitano per squadra)
      const { error: demoteError } = await supabase
        .from('team_members')
        .update({ role: 'player' })
        .eq('team_id', teamId)
        .eq('role', 'captain');
      if (demoteError) throw demoteError;

      const { error: promoteError } = await supabase
        .from('team_members')
        .update({ role: 'captain' })
        .eq('id', memberId);
      if (promoteError) throw promoteError;

      const { error: teamError } = await supabase
        .from('teams')
        .update({ captain_id: profileId })
        .eq('id', teamId);
      if (teamError) throw teamError;
    },
    onSuccess: (_d, { tournamentId }) =>
      qc.invalidateQueries({ queryKey: ['tournament', tournamentId, 'teams'] }),
  });
}
