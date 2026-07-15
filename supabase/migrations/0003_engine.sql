-- 0003_engine.sql — helper di sicurezza, trigger avanzamento, RPC generazione

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function assert_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin if not is_admin() then raise exception 'Operazione riservata agli amministratori'; end if; end $$;

create or replace function is_team_captain(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where team_id = p_team and profile_id = auth.uid() and role = 'captain');
$$;

create or replace function tournament_registration_open(p_t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tournaments where id = p_t and status = 'registration_open');
$$;

-- Nome turno knockout
create or replace function bracket_round_name(p_round int, p_total int) returns text
language sql immutable as $$
  select case p_total - p_round
    when 0 then 'Finale' when 1 then 'Semifinale' when 2 then 'Quarti'
    when 3 then 'Ottavi' when 4 then 'Sedicesimi' else 'Turno ' || p_round end;
$$;

-- Ordine di piazzamento standard del tabellone per una dimensione potenza-di-2
create or replace function bracket_seed_order(p_size int) returns int[]
language plpgsql immutable as $$
declare o int[] := array[1]; m int := 1; nx int[]; x int;
begin
  while m < p_size loop
    nx := '{}';
    foreach x in array o loop nx := nx || x; nx := nx || (2*m + 1 - x); end loop;
    o := nx; m := m * 2;
  end loop;
  return o;
end $$;

-- Calcolo vincitore (punteggio, poi rigori)
create or replace function set_match_winner() returns trigger language plpgsql as $$
begin
  new.winner_team_id := null;
  if new.status in ('finished','walkover') and new.home_team_id is not null and new.away_team_id is not null then
    if new.home_score > new.away_score then new.winner_team_id := new.home_team_id;
    elsif new.away_score > new.home_score then new.winner_team_id := new.away_team_id;
    elsif new.home_penalties is not null and new.away_penalties is not null and new.home_penalties is distinct from new.away_penalties then
      new.winner_team_id := case when new.home_penalties > new.away_penalties then new.home_team_id else new.away_team_id end;
    end if;
  end if;
  return new;
end $$;
create trigger trg_set_match_winner before insert or update on matches for each row execute function set_match_winner();

-- Avanzamento vincitore (e perdente per finale 3/4) nel tabellone
create or replace function advance_winner() returns trigger language plpgsql as $$
declare target uuid := new.next_match_id; loser uuid;
begin
  if new.stage <> 'knockout' then return new; end if;
  if tg_op = 'UPDATE' and new.winner_team_id is not distinct from old.winner_team_id then return new; end if;
  if target is not null then
    if exists (select 1 from matches m where m.id = target and m.status in ('live','finished','walkover')) then
      raise notice 'Partita a valle gia iniziata: azzerarla prima di modificare.';
    elsif new.winner_team_id is not null then
      if new.next_match_slot = 1 then update matches set home_team_id = new.winner_team_id where id = target;
      elsif new.next_match_slot = 2 then update matches set away_team_id = new.winner_team_id where id = target;
      end if;
    end if;
  end if;
  if new.loser_next_match_id is not null and new.winner_team_id is not null then
    loser := case when new.winner_team_id = new.home_team_id then new.away_team_id else new.home_team_id end;
    if new.loser_next_match_slot = 1 then update matches set home_team_id = loser where id = new.loser_next_match_id;
    elsif new.loser_next_match_slot = 2 then update matches set away_team_id = loser where id = new.loser_next_match_id;
    end if;
  end if;
  return new;
end $$;
create trigger trg_advance_winner after insert or update of status, home_score, away_score, home_penalties, away_penalties
  on matches for each row execute function advance_winner();

-- Generazione girone all italiana (metodo del cerchio); usata anche per league e per ogni girone
create or replace function generate_round_robin(p_tournament_id uuid, p_group_id uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  ids uuid[]; arr uuid[]; n int; half int; r int; i int; a uuid; b uuid;
  v_stage match_stage; double_round boolean; legs int; lg int; round_offset int;
begin
  perform assert_admin();
  select case when p_group_id is not null then 'group'::match_stage
    when t.format = 'league' then 'league'::match_stage else 'round_robin'::match_stage end
    into v_stage from tournaments t where t.id = p_tournament_id;
  double_round := coalesce((select (config->'round_robin'->>'double_round')::boolean from tournaments where id = p_tournament_id), false);
  if p_group_id is not null then
    select array_agg(gt.team_id order by tm.seed nulls last, tm.created_at) into ids
      from group_teams gt join teams tm on tm.id = gt.team_id where gt.group_id = p_group_id and tm.status <> 'withdrawn';
  else
    select array_agg(tm.id order by tm.seed nulls last, tm.created_at) into ids from teams tm
      where tm.tournament_id = p_tournament_id and tm.status <> 'withdrawn'
        and not exists (select 1 from group_teams g where g.team_id = tm.id);
  end if;
  n := coalesce(array_length(ids,1),0);
  if n < 2 then raise exception 'Servono almeno 2 squadre'; end if;
  if n % 2 = 1 then ids := ids || null::uuid; n := n + 1; end if;
  half := n / 2;
  delete from matches where tournament_id = p_tournament_id and stage = v_stage
    and (group_id is not distinct from p_group_id);
  legs := case when double_round then 2 else 1 end;
  for lg in 1..legs loop
    arr := ids;
    round_offset := (lg - 1) * (n - 1);
    for r in 0..(n - 2) loop
      for i in 0..(half - 1) loop
        a := arr[i + 1]; b := arr[n - i];
        if a is not null and b is not null then
          if ((r + lg) % 2) = 0 then
            insert into matches(tournament_id, group_id, stage, round, leg, home_team_id, away_team_id, status)
            values(p_tournament_id, p_group_id, v_stage, round_offset + r + 1, lg, a, b, 'scheduled');
          else
            insert into matches(tournament_id, group_id, stage, round, leg, home_team_id, away_team_id, status)
            values(p_tournament_id, p_group_id, v_stage, round_offset + r + 1, lg, b, a, 'scheduled');
          end if;
        end if;
      end loop;
      arr := arr[1:1] || arr[n:n] || arr[2:n-1];
    end loop;
  end loop;
end $$;

-- Costruzione tabellone da un elenco ordinato per teste di serie
create or replace function _build_bracket(p_tournament_id uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare n int; size int; rounds int; tmp int; ord int[]; seeded uuid[]; r int; p int; slots int; x int; third boolean;
begin
  perform assert_admin();
  n := coalesce(array_length(p_ids,1),0);
  if n < 2 then raise exception 'Servono almeno 2 squadre per il tabellone'; end if;
  size := 1; while size < n loop size := size * 2; end loop;
  rounds := 0; tmp := size; while tmp > 1 loop rounds := rounds + 1; tmp := tmp / 2; end loop;
  delete from matches where tournament_id = p_tournament_id and stage = 'knockout';
  ord := bracket_seed_order(size);
  seeded := '{}';
  foreach x in array ord loop
    if x <= n then seeded := seeded || p_ids[x]; else seeded := seeded || null::uuid; end if;
  end loop;
  slots := size / 2;
  for r in 1..rounds loop
    for p in 0..(slots - 1) loop
      insert into matches(tournament_id, stage, round, bracket_position, status, round_name)
      values(p_tournament_id, 'knockout', r, p, 'scheduled', bracket_round_name(r, rounds));
    end loop;
    slots := slots / 2;
  end loop;
  update matches c set next_match_id = nm.id, next_match_slot = 1 + (c.bracket_position % 2)
    from matches nm
    where c.tournament_id = p_tournament_id and nm.tournament_id = p_tournament_id
      and c.stage = 'knockout' and nm.stage = 'knockout'
      and nm.round = c.round + 1 and nm.bracket_position = c.bracket_position / 2;
  for p in 0..(size/2 - 1) loop
    update matches set home_team_id = seeded[2*p + 1], away_team_id = seeded[2*p + 2]
    where tournament_id = p_tournament_id and stage = 'knockout' and round = 1 and bracket_position = p;
  end loop;
  update matches set status = 'walkover',
    home_score = case when home_team_id is not null then 1 else 0 end,
    away_score = case when away_team_id is not null then 1 else 0 end
  where tournament_id = p_tournament_id and stage = 'knockout' and round = 1
    and (home_team_id is null) <> (away_team_id is null);
  third := coalesce((select (config->'knockout'->>'third_place')::boolean from tournaments where id = p_tournament_id), false);
  if third and rounds >= 2 then
    insert into matches(tournament_id, stage, round, bracket_position, status, round_name)
    values(p_tournament_id, 'knockout', rounds, 1, 'scheduled', 'Finale 3/4');
    update matches semi set
      loser_next_match_id = (select id from matches where tournament_id = p_tournament_id and stage = 'knockout' and round = rounds and bracket_position = 1),
      loser_next_match_slot = 1 + (semi.bracket_position % 2)
    where semi.tournament_id = p_tournament_id and semi.stage = 'knockout' and semi.round = rounds - 1;
  end if;
end $$;

create or replace function generate_bracket(p_tournament_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  perform assert_admin();
  select array_agg(id order by seed nulls last, created_at) into ids
    from teams where tournament_id = p_tournament_id and status <> 'withdrawn';
  perform _build_bracket(p_tournament_id, ids);
end $$;

create or replace function generate_playoff(p_tournament_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ids uuid[]; adv int; incomplete int;
begin
  perform assert_admin();
  select count(*) into incomplete from matches where tournament_id = p_tournament_id and stage = 'group'
    and status not in ('finished','walkover','cancelled');
  if incomplete > 0 then raise exception 'Ci sono ancora partite dei gironi da completare'; end if;
  adv := coalesce((select (config->'groups'->>'advance_per_group')::int from tournaments where id = p_tournament_id), 2);
  select array_agg(sr.team_id order by sr.position, g.position) into ids
    from standings_ranked sr join groups g on g.id = sr.group_id
    where sr.tournament_id = p_tournament_id and sr.position <= adv;
  perform _build_bracket(p_tournament_id, ids);
end $$;

-- Hardening EXECUTE (difesa in profondità). Di default Postgres concede EXECUTE
-- a PUBLIC su ogni funzione: qui lo revochiamo e riassegnamo solo dove serve.
-- _build_bracket è SOLO interna (invocata da generate_bracket/generate_playoff,
-- SECURITY DEFINER): nessun ruolo PostgREST deve poterla chiamare direttamente.
revoke execute on function _build_bracket(uuid, uuid[]) from public;
-- Le RPC engine restano invocabili dagli utenti autenticati (assert_admin le
-- protegge internamente), ma non più da anon.
revoke execute on function generate_round_robin(uuid, uuid) from public;
grant  execute on function generate_round_robin(uuid, uuid) to authenticated;
revoke execute on function generate_bracket(uuid) from public;
grant  execute on function generate_bracket(uuid) to authenticated;
revoke execute on function generate_playoff(uuid) from public;
grant  execute on function generate_playoff(uuid) to authenticated;
