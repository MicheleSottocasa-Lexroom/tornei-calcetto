/**
 * Alias applicativi comodi, derivati da `database.types.ts`.
 * Importa da qui i tipi di dominio: `import type { Tournament, Match } from '@/types'`.
 */
import type { Database } from './database.types';

export type { Database, Json } from './database.types';

/* ---- Righe tabelle (Row) ---- */
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Tournament = Database['public']['Tables']['tournaments']['Row'];
export type Team = Database['public']['Tables']['teams']['Row'];
export type TeamMember = Database['public']['Tables']['team_members']['Row'];
export type Group = Database['public']['Tables']['groups']['Row'];
export type GroupTeam = Database['public']['Tables']['group_teams']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type MatchEvent = Database['public']['Tables']['match_events']['Row'];
export type PushSubscriptionRow =
  Database['public']['Tables']['push_subscriptions']['Row'];

/* ---- Insert / Update utili alle mutation delle feature ---- */
export type TournamentInsert = Database['public']['Tables']['tournaments']['Insert'];
export type TournamentUpdate = Database['public']['Tables']['tournaments']['Update'];
export type TeamInsert = Database['public']['Tables']['teams']['Insert'];
export type TeamUpdate = Database['public']['Tables']['teams']['Update'];
export type TeamMemberInsert = Database['public']['Tables']['team_members']['Insert'];
export type MatchUpdate = Database['public']['Tables']['matches']['Update'];
export type MatchEventInsert = Database['public']['Tables']['match_events']['Insert'];

/* ---- Viste ---- */
export type StandingRow = Database['public']['Views']['standings_ranked']['Row'];
export type TopScorerRow = Database['public']['Views']['top_scorers']['Row'];

/* ---- Enum ---- */
export type TournamentFormat = Database['public']['Enums']['tournament_format'];
export type TournamentStatus = Database['public']['Enums']['tournament_status'];
export type TeamStatus = Database['public']['Enums']['team_status'];
export type MemberRole = Database['public']['Enums']['member_role'];
export type MatchStage = Database['public']['Enums']['match_stage'];
export type MatchStatus = Database['public']['Enums']['match_status'];
export type MatchEventType = Database['public']['Enums']['match_event_type'];

/* ---- Aggregati compositi comodi per la UI ---- */
export interface TeamWithMembers extends Team {
  members: (TeamMember & { profile: Profile | null })[];
}

export interface MatchWithTeams extends Match {
  home_team: Team | null;
  away_team: Team | null;
}
