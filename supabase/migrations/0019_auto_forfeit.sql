-- 0019_auto_forfeit.sql
-- Sostituisce la vecchia automazione (auto 'live' + auto 'finished' a -10 min).
-- Nuova regola: all'orario di INIZIO della partita successiva, se la partita
-- corrente non è ancora "finita con un punteggio", diventa persa a tavolino
-- (walkover) di default per ENTRAMBE le squadre (both no-show => -2 a testa).
-- Non tocca knockout, l'ultima partita (nessuna successiva), né gli stati
-- 'walkover'/'cancelled'/'finished con punteggio' già impostati.
create or replace function update_match_statuses() returns void
language plpgsql security definer set search_path = public as $$
begin
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
    and s.status in ('scheduled', 'live')          -- non ancora "finita con punteggio"
    and s.next_at is not null                       -- esiste una partita successiva
    and s.next_at > s.scheduled_at
    and now() >= s.next_at;                          -- è scoccato il suo orario di inizio
end $$;
