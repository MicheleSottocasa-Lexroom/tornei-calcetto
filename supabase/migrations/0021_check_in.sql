-- 0021_check_in.sql
-- Check-in di squadra a partita "live": ogni squadra sfidante conferma la
-- presenza. All'orario di inizio della partita successiva l'auto-tavolino usa i
-- check-in: chi non ha fatto check-in è assente (-2); se entrambe hanno fatto
-- check-in la partita NON viene forzata (l'admin inserisce il risultato).
-- Visibilità dei check-in limitata alle due squadre sfidanti (+ admin).

create table if not exists match_check_ins (
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  checked_in_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  primary key (match_id, team_id)
);
create index if not exists idx_check_ins_tournament on match_check_ins(tournament_id);

-- L'utente è membro di una delle due squadre della partita?
create or replace function is_match_challenger(p_match_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches m
    join team_members tm
      on tm.team_id = m.home_team_id or tm.team_id = m.away_team_id
    where m.id = p_match_id and tm.profile_id = auth.uid()
  );
$$;

alter table match_check_ins enable row level security;
drop policy if exists ci_read on match_check_ins;
create policy ci_read on match_check_ins for select to authenticated
  using (is_admin() or is_match_challenger(match_id));
-- Nessuna scrittura diretta: si passa dall'RPC (security definer).

-- RPC: la squadra dell'utente fa il check-in (solo a partita 'live').
create or replace function check_in_match(p_match_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
  v_tid uuid;
  v_status match_status;
begin
  select tournament_id, status into v_tid, v_status from matches where id = p_match_id;
  if not found then raise exception 'Partita non trovata'; end if;
  if v_status <> 'live' then
    raise exception 'Il check-in è possibile solo a partita in corso';
  end if;

  select tm.team_id into v_team
  from matches m
  join team_members tm on tm.team_id = m.home_team_id or tm.team_id = m.away_team_id
  where m.id = p_match_id and tm.profile_id = auth.uid()
  limit 1;
  if v_team is null then
    raise exception 'Non fai parte delle squadre di questa partita';
  end if;

  insert into match_check_ins(match_id, team_id, tournament_id, checked_in_by)
  values (p_match_id, v_team, v_tid, auth.uid())
  on conflict (match_id, team_id) do nothing;
  return v_team;
end $$;
revoke execute on function check_in_match(uuid) from public;
grant execute on function check_in_match(uuid) to authenticated;

-- Realtime: pubblica i check-in (aggiornamento live tra le sfidanti).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'match_check_ins'
    ) then
      alter publication supabase_realtime add table public.match_check_ins;
    end if;
  end if;
end $$;

-- Auto-stato: l'auto-tavolino ora è guidato dai check-in.
create or replace function update_match_statuses() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- 1) Auto-tavolino all'inizio della partita successiva, in base ai check-in.
  with sched as (
    select m.id, m.status, m.scheduled_at,
      lead(m.scheduled_at) over (
        partition by m.tournament_id order by m.scheduled_at, m.id
      ) as next_at,
      exists (
        select 1 from match_check_ins c
        where c.match_id = m.id and c.team_id = m.home_team_id
      ) as home_in,
      exists (
        select 1 from match_check_ins c
        where c.match_id = m.id and c.team_id = m.away_team_id
      ) as away_in
    from matches m
    join tournaments tr on tr.id = m.tournament_id and tr.status = 'in_progress'
    where m.scheduled_at is not null and m.stage <> 'knockout'
  )
  update matches x
  set status = 'walkover',
      home_no_show = not s.home_in,
      away_no_show = not s.away_in
  from sched s
  where x.id = s.id
    and s.status in ('scheduled', 'live')
    and s.next_at is not null
    and s.next_at > s.scheduled_at
    and now() >= s.next_at
    and not (s.home_in and s.away_in);   -- entrambe presenti: nessun tavolino

  -- 2) Auto "in corso": scoccato l'orario di inizio.
  update matches x
  set status = 'live'
  from tournaments tr
  where tr.id = x.tournament_id
    and tr.status = 'in_progress'
    and x.status = 'scheduled'
    and x.scheduled_at is not null
    and now() >= x.scheduled_at
    and x.home_team_id is not null
    and x.away_team_id is not null;
end $$;
