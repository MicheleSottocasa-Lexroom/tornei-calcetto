-- 0012_auto_schedule.sql
-- Assegna automaticamente data/ora alle partite di un torneo a partire da un
-- istante, con al massimo p_per_hour partite per ora (default 2 -> una ogni 30').
-- Ordine: giornata (round), poi posizione tabellone, poi creazione.
create or replace function auto_schedule_matches(
  p_tournament_id uuid,
  p_start timestamptz,
  p_per_hour int default 2
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
  )
  update matches m
  set scheduled_at = p_start + (o.rn * v_interval)
  from ordered o
  where m.id = o.id;
end $$;

grant execute on function auto_schedule_matches(uuid, timestamptz, int) to authenticated;
