-- 0016_only_scheduled.sql
-- Opzione "aggiorna solo le partite in programma": rigenerazione del calendario
-- e assegnazione orari possono limitarsi alle partite 'scheduled', lasciando
-- invariate quelle in ogni altro stato (live/finished/walkover/cancelled).
-- I tre RPC cambiano firma (nuovo parametro finale con default) => drop + create.

/* -------------------------------------------------------------------------- */
/* Reschedule lineare                                                         */
/* -------------------------------------------------------------------------- */
drop function if exists auto_schedule_matches(uuid, timestamptz, int);
create function auto_schedule_matches(
  p_tournament_id uuid,
  p_start timestamptz,
  p_per_hour int default 2,
  p_only_scheduled boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_interval interval;
begin
  perform assert_admin();
  if p_per_hour < 1 then p_per_hour := 1; end if;
  v_interval := make_interval(mins => (60 / p_per_hour));

  with ordered as (
    select id,
      (row_number() over (
        order by round, coalesce(bracket_position, 0), created_at
      ) - 1)::int as rn
    from matches
    where tournament_id = p_tournament_id
      and (p_only_scheduled = false or status = 'scheduled')
  )
  update matches m
  set scheduled_at = p_start + (o.rn * v_interval)
  from ordered o
  where m.id = o.id;
end $$;
grant execute on function auto_schedule_matches(uuid, timestamptz, int, boolean) to authenticated;

/* -------------------------------------------------------------------------- */
/* Reschedule nelle finestre                                                  */
/* -------------------------------------------------------------------------- */
drop function if exists auto_schedule_from_windows(uuid);
create function auto_schedule_from_windows(
  p_tournament_id uuid,
  p_only_scheduled boolean default true
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_slot_minutes constant int := 30;
  v_slots timestamptz[] := array[]::timestamptz[];
  v_win record;
  v_slot timestamptz;
  v_match record;
  v_total int;
  v_count int := 0;
begin
  perform assert_admin();

  if not exists (select 1 from tournaments where id = p_tournament_id) then
    raise exception 'Torneo non trovato';
  end if;
  if not exists (
    select 1 from tournament_availability where tournament_id = p_tournament_id
  ) then
    raise exception 'Nessuna finestra di disponibilità impostata';
  end if;

  for v_win in
    select starts_at, ends_at from tournament_availability
    where tournament_id = p_tournament_id order by starts_at
  loop
    v_slot := v_win.starts_at;
    while v_slot < v_win.ends_at loop
      v_slots := array_append(v_slots, v_slot);
      v_slot := v_slot + make_interval(mins => v_slot_minutes);
    end loop;
  end loop;
  v_total := coalesce(array_length(v_slots, 1), 0);

  for v_match in
    select m.id,
      row_number() over (
        order by m.round, coalesce(m.bracket_position, 0), m.created_at
      ) as rn
    from matches m
    where m.tournament_id = p_tournament_id
      and (p_only_scheduled = false or m.status = 'scheduled')
  loop
    if v_match.rn <= v_total then
      update matches set scheduled_at = v_slots[v_match.rn] where id = v_match.id;
      v_count := v_count + 1;
    else
      update matches set scheduled_at = null where id = v_match.id;
    end if;
  end loop;

  return v_count;
end $$;
grant execute on function auto_schedule_from_windows(uuid, boolean) to authenticated;

/* -------------------------------------------------------------------------- */
/* Rigenerazione girone all'italiana / campionato                             */
/* -------------------------------------------------------------------------- */
drop function if exists generate_round_robin(uuid, uuid);
create function generate_round_robin(
  p_tournament_id uuid,
  p_group_id uuid default null,
  p_only_scheduled boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  ids uuid[]; arr uuid[]; n int; half int; r int; i int; a uuid; b uuid;
  v_stage match_stage; double_round boolean; legs int; lg int; round_offset int;
  v_base_round int := 0;
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

  if p_only_scheduled then
    -- Preserva le partite non 'scheduled' (giocate/live): elimina solo quelle
    -- in programma e riparti numerando le giornate dopo quelle mantenute.
    delete from matches where tournament_id = p_tournament_id and stage = v_stage
      and (group_id is not distinct from p_group_id) and status = 'scheduled';
    select coalesce(max(round), 0) into v_base_round from matches
      where tournament_id = p_tournament_id and stage = v_stage
        and (group_id is not distinct from p_group_id);
  else
    delete from matches where tournament_id = p_tournament_id and stage = v_stage
      and (group_id is not distinct from p_group_id);
  end if;

  legs := case when double_round then 2 else 1 end;
  for lg in 1..legs loop
    arr := ids;
    round_offset := v_base_round + (lg - 1) * (n - 1);
    for r in 0..(n - 2) loop
      for i in 0..(half - 1) loop
        a := arr[i + 1]; b := arr[n - i];
        if a is not null and b is not null then
          -- In modalità preserve salta le sfide già coperte da una partita mantenuta.
          if p_only_scheduled and exists (
            select 1 from matches m
            where m.tournament_id = p_tournament_id and m.stage = v_stage
              and (m.group_id is not distinct from p_group_id)
              and m.status <> 'scheduled' and m.leg = lg
              and ((m.home_team_id = a and m.away_team_id = b)
                or (m.home_team_id = b and m.away_team_id = a))
          ) then
            continue;
          end if;
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
revoke execute on function generate_round_robin(uuid, uuid, boolean) from public;
grant execute on function generate_round_robin(uuid, uuid, boolean) to authenticated;
