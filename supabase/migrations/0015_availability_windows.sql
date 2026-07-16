-- 0015_availability_windows.sql
-- Finestre di disponibilità oraria per torneo: giorni/fasce in cui si gioca.
-- L'auto-scheduling piazza le partite SOLO dentro queste finestre (slot da 30
-- min = max 2/ora). Aggiorna anche update_match_statuses con un tetto di durata
-- così una partita a fine finestra non resta "live" fino alla finestra dopo.

create table if not exists tournament_availability (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint availability_window_valid check (ends_at > starts_at)
);
create index if not exists idx_availability_tournament
  on tournament_availability (tournament_id, starts_at);

alter table tournament_availability enable row level security;

drop policy if exists av_read on tournament_availability;
create policy av_read on tournament_availability
  for select to authenticated using (true);

drop policy if exists av_write on tournament_availability;
create policy av_write on tournament_availability
  for all to authenticated using (is_admin()) with check (is_admin());

-- Assegna gli orari alle partite ancora da giocare riempiendo le finestre in
-- ordine cronologico, uno slot da 30 min per partita. Ritorna il numero di
-- partite a cui è stato assegnato un orario (le eccedenti restano senza data).
create or replace function auto_schedule_from_windows(p_tournament_id uuid)
returns int
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

  -- Genera gli slot (30 min) di tutte le finestre, in ordine cronologico.
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

  -- Assegna in ordine (giornata, posizione, creazione) alle partite 'scheduled'.
  for v_match in
    select m.id,
      row_number() over (
        order by m.round, coalesce(m.bracket_position, 0), m.created_at
      ) as rn
    from matches m
    where m.tournament_id = p_tournament_id and m.status = 'scheduled'
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
grant execute on function auto_schedule_from_windows(uuid) to authenticated;

-- Stato automatico: come 0014 ma con TETTO di durata (60 min). Una partita
-- diventa 'finished' 10 min prima della successiva OPPURE, se la successiva è
-- lontana (fine finestra / giorno dopo), al più tardi 60 min dopo l'inizio.
-- L'ultima partita in assoluto (nessuna successiva) resta 'live' finché non si
-- inserisce il risultato.
create or replace function update_match_statuses() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- 1) Concludi.
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
  set status = 'finished'
  from sched s
  where x.id = s.id
    and s.status in ('scheduled', 'live')
    and s.next_at is not null
    and s.next_at > s.scheduled_at
    and now() >= least(
      s.next_at - interval '10 minutes',
      s.scheduled_at + interval '60 minutes'
    );

  -- 2) In corso.
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
  set status = 'live'
  from sched s
  where x.id = s.id
    and s.status = 'scheduled'
    and now() >= s.scheduled_at
    and (
      s.next_at is null
      or s.next_at <= s.scheduled_at
      or now() < least(
        s.next_at - interval '10 minutes',
        s.scheduled_at + interval '60 minutes'
      )
    );
end $$;
