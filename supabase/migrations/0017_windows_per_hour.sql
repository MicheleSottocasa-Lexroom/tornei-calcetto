-- 0017_windows_per_hour.sql
-- La generazione nelle finestre accetta "partite per ora" (default 2): la durata
-- dello slot è 60/p_per_hour minuti (2/h -> 30', 3/h -> 20', 4/h -> 15').
-- La firma cambia (nuovo parametro) => drop + create.
drop function if exists auto_schedule_from_windows(uuid, boolean);
create function auto_schedule_from_windows(
  p_tournament_id uuid,
  p_only_scheduled boolean default true,
  p_per_hour int default 2
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_slot_minutes int;
  v_slots timestamptz[] := array[]::timestamptz[];
  v_win record;
  v_slot timestamptz;
  v_match record;
  v_total int;
  v_count int := 0;
begin
  perform assert_admin();
  if p_per_hour < 1 then
    p_per_hour := 1;
  elsif p_per_hour > 60 then
    p_per_hour := 60;
  end if;
  v_slot_minutes := 60 / p_per_hour;  -- sempre >= 1: nessun rischio di loop infinito

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
grant execute on function auto_schedule_from_windows(uuid, boolean, int) to authenticated;
