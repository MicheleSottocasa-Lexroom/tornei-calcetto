-- 0020_auto_live_and_forfeit.sql
-- Reintroduce l'auto "in corso" mantenendo l'auto-tavolino (0019).
--   1) scoccato l'orario di inizio della partita       -> 'live'
--   2) scoccato l'orario di inizio della SUCCESSIVA,
--      se non è "finita con un punteggio"               -> 'walkover' (entrambe no-show)
-- Solo tornei in_progress. La (1) vale per ogni stage ma solo con entrambe le
-- squadre note; la (2) esclude il knockout e l'ultima partita.
create or replace function update_match_statuses() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- 1) Auto-tavolino (prima, così una partita scaduta non passa da 'live').
  with sched as (
    select m.id, m.status, m.scheduled_at,
      lead(m.scheduled_at) over (
        partition by m.tournament_id order by m.scheduled_at, m.id
      ) as next_at
    from matches m
    join tournaments tr on tr.id = m.tournament_id and tr.status = 'in_progress'
    where m.scheduled_at is not null and m.stage <> 'knockout'
  )
  update matches x
  set status = 'walkover',
      home_no_show = true,
      away_no_show = true
  from sched s
  where x.id = s.id
    and s.status in ('scheduled', 'live')
    and s.next_at is not null
    and s.next_at > s.scheduled_at
    and now() >= s.next_at;

  -- 2) Auto "in corso": scoccato l'orario di inizio, se ancora in programma.
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
