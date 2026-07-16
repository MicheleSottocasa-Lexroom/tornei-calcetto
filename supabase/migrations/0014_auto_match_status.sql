-- 0014_auto_match_status.sql
-- Stato partite automatico in base all'orario (solo tornei in_progress, no knockout):
--   * scoccato lo scheduled_at            -> 'live'
--   * 10 minuti prima della successiva     -> 'finished'
-- Non tocca partite senza orario, l'ultima (nessuna successiva), né stati manuali
-- diversi da scheduled/live (walkover/cancelled/finished restano).

-- Push "risultato finale" solo se il punteggio è presente (niente spam 0-0 sugli auto-finish).
create or replace function public.notify_match_finished()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text; v_secret text; v_home text; v_away text; v_user_ids uuid[]; v_body text;
begin
  if new.status not in ('finished', 'walkover') then return new; end if;
  if old.status is not distinct from new.status then return new; end if;
  if new.home_score is null or new.away_score is null then return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'send_push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'send_push_secret';
  if v_url is null or v_secret is null then return new; end if;
  select name into v_home from public.teams where id = new.home_team_id;
  select name into v_away from public.teams where id = new.away_team_id;
  select array_agg(distinct tm.profile_id) into v_user_ids
    from public.team_members tm where tm.team_id in (new.home_team_id, new.away_team_id);
  if v_user_ids is null or array_length(v_user_ids, 1) is null then return new; end if;
  v_body := coalesce(v_home, 'Casa') || ' ' || coalesce(new.home_score, 0) || ' - '
            || coalesce(new.away_score, 0) || ' ' || coalesce(v_away, 'Ospiti');
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-shared-secret', v_secret),
    body := jsonb_build_object('userIds', to_jsonb(v_user_ids), 'title', 'Risultato finale',
      'body', v_body, 'url', '/tornei/' || new.tournament_id::text || '/calendario',
      'tag', 'match-' || new.id::text)
  );
  return new;
end $$;

-- Classifica: conta solo le partite con punteggio inserito. Cosi' un match
-- auto-concluso ma senza risultato non gonfia le "Giocate" ne' i pareggi.
create or replace view match_team_results as
  select m.tournament_id, m.group_id, m.home_team_id as team_id, m.home_score as gf, m.away_score as ga
  from matches m
  where m.status in ('finished', 'walkover') and m.stage in ('round_robin', 'group', 'league')
    and m.home_team_id is not null and m.away_team_id is not null
    and m.home_score is not null and m.away_score is not null
  union all
  select m.tournament_id, m.group_id, m.away_team_id, m.away_score, m.home_score
  from matches m
  where m.status in ('finished', 'walkover') and m.stage in ('round_robin', 'group', 'league')
    and m.home_team_id is not null and m.away_team_id is not null
    and m.home_score is not null and m.away_score is not null;
alter view match_team_results set (security_invoker = on);

-- Applica le transizioni di stato in base all'orario.
create or replace function update_match_statuses() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- 1) Concludi: 10 minuti prima della partita successiva.
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
    and now() >= s.next_at - interval '10 minutes';

  -- 2) In corso: orario raggiunto e non ancora conclusa.
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
      or now() < s.next_at - interval '10 minutes'
    );
end $$;

-- Cron ogni minuto.
create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule('update-statuses');
exception when others then
  null;
end $$;
select cron.schedule('update-statuses', '* * * * *', $cron$ select update_match_statuses(); $cron$);
