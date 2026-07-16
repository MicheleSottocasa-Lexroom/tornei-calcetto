/**
 * Tipi TypeScript scritti a mano che rispecchiano lo schema Postgres/Supabase
 * definito nel piano (supabase/migrations/0001..0004).
 *
 * Compatibile con `supabase-js`: `createClient<Database>(...)`.
 * Quando lo schema verrà applicato, questi tipi possono essere rigenerati con
 * `supabase gen types typescript` e sostituiti mantenendo lo stesso export `Database`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      tournaments: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          format: Database['public']['Enums']['tournament_format'];
          config: Json;
          status: Database['public']['Enums']['tournament_status'];
          created_by: string | null;
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          format: Database['public']['Enums']['tournament_format'];
          config?: Json;
          status?: Database['public']['Enums']['tournament_status'];
          created_by?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          format?: Database['public']['Enums']['tournament_format'];
          config?: Json;
          status?: Database['public']['Enums']['tournament_status'];
          created_by?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          tournament_id: string;
          name: string;
          captain_id: string | null;
          seed: number | null;
          status: Database['public']['Enums']['team_status'];
          pending: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          name: string;
          captain_id?: string | null;
          seed?: number | null;
          status?: Database['public']['Enums']['team_status'];
          pending?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          name?: string;
          captain_id?: string | null;
          seed?: number | null;
          status?: Database['public']['Enums']['team_status'];
          pending?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          tournament_id: string;
          profile_id: string;
          role: Database['public']['Enums']['member_role'];
          shirt_number: number | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          tournament_id?: string;
          profile_id: string;
          role?: Database['public']['Enums']['member_role'];
          shirt_number?: number | null;
          joined_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          tournament_id?: string;
          profile_id?: string;
          role?: Database['public']['Enums']['member_role'];
          shirt_number?: number | null;
          joined_at?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          tournament_id: string;
          name: string;
          position: number;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          name: string;
          position?: number;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      group_teams: {
        Row: {
          group_id: string;
          team_id: string;
        };
        Insert: {
          group_id: string;
          team_id: string;
        };
        Update: {
          group_id?: string;
          team_id?: string;
        };
        Relationships: [];
      };
      tournament_availability: {
        Row: {
          id: string;
          tournament_id: string;
          starts_at: string;
          ends_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          starts_at: string;
          ends_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          starts_at?: string;
          ends_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          tournament_id: string;
          group_id: string | null;
          stage: Database['public']['Enums']['match_stage'];
          round: number | null;
          round_name: string | null;
          bracket_position: number | null;
          leg: number;
          home_team_id: string | null;
          away_team_id: string | null;
          home_score: number | null;
          away_score: number | null;
          home_penalties: number | null;
          away_penalties: number | null;
          winner_team_id: string | null;
          next_match_id: string | null;
          next_match_slot: number | null;
          loser_next_match_id: string | null;
          loser_next_match_slot: number | null;
          status: Database['public']['Enums']['match_status'];
          scheduled_at: string | null;
          venue: string | null;
          reminder_sent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          group_id?: string | null;
          stage: Database['public']['Enums']['match_stage'];
          round?: number | null;
          round_name?: string | null;
          bracket_position?: number | null;
          leg?: number;
          home_team_id?: string | null;
          away_team_id?: string | null;
          home_score?: number | null;
          away_score?: number | null;
          home_penalties?: number | null;
          away_penalties?: number | null;
          winner_team_id?: string | null;
          next_match_id?: string | null;
          next_match_slot?: number | null;
          loser_next_match_id?: string | null;
          loser_next_match_slot?: number | null;
          status?: Database['public']['Enums']['match_status'];
          scheduled_at?: string | null;
          venue?: string | null;
          reminder_sent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          group_id?: string | null;
          stage?: Database['public']['Enums']['match_stage'];
          round?: number | null;
          round_name?: string | null;
          bracket_position?: number | null;
          leg?: number;
          home_team_id?: string | null;
          away_team_id?: string | null;
          home_score?: number | null;
          away_score?: number | null;
          home_penalties?: number | null;
          away_penalties?: number | null;
          winner_team_id?: string | null;
          next_match_id?: string | null;
          next_match_slot?: number | null;
          loser_next_match_id?: string | null;
          loser_next_match_slot?: number | null;
          status?: Database['public']['Enums']['match_status'];
          scheduled_at?: string | null;
          venue?: string | null;
          reminder_sent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      match_events: {
        Row: {
          id: string;
          match_id: string;
          tournament_id: string;
          team_id: string | null;
          player_id: string | null;
          event_type: Database['public']['Enums']['match_event_type'];
          minute: number | null;
          assist_player_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          tournament_id?: string;
          team_id?: string | null;
          player_id?: string | null;
          event_type: Database['public']['Enums']['match_event_type'];
          minute?: number | null;
          assist_player_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          tournament_id?: string;
          team_id?: string | null;
          player_id?: string | null;
          event_type?: Database['public']['Enums']['match_event_type'];
          minute?: number | null;
          assist_player_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      admin_allowlist: {
        Row: {
          email: string;
        };
        Insert: {
          email: string;
        };
        Update: {
          email?: string;
        };
        Relationships: [];
      };
      team_participants: {
        Row: {
          id: string;
          team_id: string;
          tournament_id: string;
          full_name: string;
          email: string | null;
          profile_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          tournament_id?: string;
          full_name: string;
          email?: string | null;
          profile_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          tournament_id?: string;
          full_name?: string;
          email?: string | null;
          profile_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      standings_ranked: {
        Row: {
          tournament_id: string;
          group_id: string | null;
          team_id: string;
          team_name: string;
          played: number;
          won: number;
          drawn: number;
          lost: number;
          goals_for: number;
          goals_against: number;
          goal_difference: number;
          points: number;
          position: number;
        };
        Relationships: [];
      };
      top_scorers: {
        Row: {
          tournament_id: string;
          player_id: string;
          player_name: string | null;
          team_id: string | null;
          team_name: string | null;
          goals: number;
          assists: number;
          own_goals: number;
          yellow_cards: number;
          red_cards: number;
          mvp_awards: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      generate_round_robin: {
        Args: {
          p_tournament_id: string;
          p_group_id?: string | null;
        };
        Returns: undefined;
      };
      generate_bracket: {
        Args: {
          p_tournament_id: string;
        };
        Returns: undefined;
      };
      generate_playoff: {
        Args: {
          p_tournament_id: string;
        };
        Returns: undefined;
      };
      claim_team_participant: {
        Args: {
          p_participant_id: string;
        };
        Returns: undefined;
      };
      leave_team: {
        Args: {
          p_team_id: string;
        };
        Returns: undefined;
      };
      delete_tournament: {
        Args: {
          p_tournament_id: string;
        };
        Returns: undefined;
      };
      transfer_captaincy: {
        Args: {
          p_team_id: string;
          p_new_captain: string;
        };
        Returns: undefined;
      };
      auto_schedule_matches: {
        Args: {
          p_tournament_id: string;
          p_start: string;
          p_per_hour?: number;
        };
        Returns: undefined;
      };
      accept_team_candidacy: {
        Args: {
          p_team_id: string;
        };
        Returns: undefined;
      };
      auto_schedule_from_windows: {
        Args: {
          p_tournament_id: string;
        };
        Returns: number;
      };
    };
    Enums: {
      tournament_format: 'round_robin' | 'knockout' | 'groups_playoff' | 'league';
      tournament_status:
        | 'draft'
        | 'registration_open'
        | 'in_progress'
        | 'completed'
        | 'archived';
      team_status: 'registered' | 'confirmed' | 'withdrawn';
      member_role: 'captain' | 'player';
      match_stage: 'round_robin' | 'group' | 'knockout' | 'league';
      match_status: 'scheduled' | 'live' | 'finished' | 'walkover' | 'cancelled';
      match_event_type:
        | 'goal'
        | 'penalty_goal'
        | 'own_goal'
        | 'assist'
        | 'yellow_card'
        | 'red_card'
        | 'mvp';
    };
    CompositeTypes: Record<never, never>;
  };
}
