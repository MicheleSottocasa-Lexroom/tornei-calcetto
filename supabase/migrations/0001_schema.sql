-- 0001_schema.sql — enums, tabelle, indici, trigger di utilita
create extension if not exists pgcrypto;

create type tournament_format as enum ('round_robin','knockout','groups_playoff','league');
create type tournament_status as enum ('draft','registration_open','in_progress','completed','archived');
create type team_status       as enum ('registered','confirmed','withdrawn');
create type member_role       as enum ('captain','player');
create type match_stage       as enum ('round_robin','group','knockout','league');
create type match_status      as enum ('scheduled','live','finished','walkover','cancelled');
create type match_event_type  as enum ('goal','penalty_goal','own_goal','assist','yellow_card','red_card','mvp');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  format tournament_format not null,
  config jsonb not null default '{}'::jsonb,
  status tournament_status not null default 'draft',
  created_by uuid references profiles(id),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  captain_id uuid references profiles(id),
  seed int,
  status team_status not null default 'registered',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (tournament_id, name)
);

create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role member_role not null default 'player',
  shirt_number int,
  joined_at timestamptz not null default now(),
  unique (team_id, profile_id),
  unique (tournament_id, profile_id)
);
create unique index team_one_captain on team_members(team_id) where role = 'captain';

create table groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  position int not null default 0,
  unique (tournament_id, name)
);

create table group_teams (
  group_id uuid not null references groups(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  primary key (group_id, team_id),
  unique (team_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  stage match_stage not null,
  round int not null default 1,
  round_name text,
  bracket_position int,
  leg int not null default 1,
  home_team_id uuid references teams(id) on delete restrict,
  away_team_id uuid references teams(id) on delete restrict,
  home_score int,
  away_score int,
  home_penalties int,
  away_penalties int,
  winner_team_id uuid references teams(id) on delete restrict,
  next_match_id uuid references matches(id) on delete set null,
  next_match_slot smallint check (next_match_slot in (1,2)),
  loser_next_match_id uuid references matches(id) on delete set null,
  loser_next_match_slot smallint check (loser_next_match_slot in (1,2)),
  status match_status not null default 'scheduled',
  scheduled_at timestamptz,
  venue text,
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid references profiles(id) on delete set null,
  event_type match_event_type not null,
  minute int,
  assist_player_id uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index on teams(tournament_id);
create index on team_members(team_id);
create index on team_members(profile_id);
create index on matches(tournament_id, stage, round);
create index on matches(next_match_id);
create index on matches(group_id);
create index on match_events(tournament_id, player_id, event_type);
create index on match_events(match_id);

-- updated_at automatico
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger trg_tournaments_updated before update on tournaments for each row execute function set_updated_at();
create trigger trg_matches_updated before update on matches for each row execute function set_updated_at();

-- team_members.tournament_id derivato dalla squadra (anti-spoofing)
create or replace function fill_team_member_tournament() returns trigger language plpgsql as $$
begin
  select tournament_id into new.tournament_id from teams where id = new.team_id;
  return new;
end $$;
create trigger trg_fill_tm_tournament before insert on team_members for each row execute function fill_team_member_tournament();

-- validazione match_events: tournament_id derivato e team coerente con la partita
create or replace function validate_match_event() returns trigger language plpgsql as $$
begin
  select tournament_id into new.tournament_id from matches where id = new.match_id;
  if not exists (select 1 from matches m where m.id = new.match_id and (m.home_team_id = new.team_id or m.away_team_id = new.team_id)) then
    raise exception 'La squadra dell''evento non partecipa a questa partita';
  end if;
  return new;
end $$;
create trigger trg_validate_match_event before insert or update on match_events for each row execute function validate_match_event();
