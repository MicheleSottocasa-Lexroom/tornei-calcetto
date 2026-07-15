-- 0005_push_triggers.sql
-- Notifiche push lato DB:
--   (a) trigger su matches: quando lo stato passa a 'finished'/'walkover' invia il risultato
--       chiamando la Edge Function send-push (via pg_net);
--   (b) istruzioni (in coda) per schedulare send-reminders ogni 5 minuti con pg_cron.
--
-- I segreti (URL della function + shared secret) sono letti da Supabase Vault, NON hardcodati.

-- 1) Estensione pg_net (chiamate HTTP dal DB). Disponibile su Supabase.
create extension if not exists pg_net with schema extensions;

-- 2) Configurazione via Vault. Esegui UNA VOLTA dal SQL editor sostituendo i valori reali:
--
--    select vault.create_secret(
--      'https://<project-ref>.supabase.co/functions/v1/send-push', 'send_push_url');
--    select vault.create_secret('<SEND_PUSH_SHARED_SECRET>', 'send_push_secret');
--    -- Per i promemoria (usata dal cron piu' in basso):
--    select vault.create_secret(
--      'https://<project-ref>.supabase.co/functions/v1/send-reminders', 'send_reminders_url');
--
--    -- Per aggiornare un valore in seguito:
--    -- select vault.update_secret(
--    --   (select id from vault.secrets where name = 'send_push_url'), 'nuovo-valore');
--
-- Se i segreti non sono presenti, il trigger esce silenziosamente (nessun errore).

-- 3) Funzione trigger: partita conclusa -> POST a send-push con il risultato.
create or replace function public.notify_match_finished()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url        text;
  v_secret     text;
  v_home       text;
  v_away       text;
  v_user_ids   uuid[];
  v_body       text;
begin
  -- Solo alla transizione verso uno stato "concluso".
  if new.status not in ('finished', 'walkover') then
    return new;
  end if;
  if old.status is not distinct from new.status then
    return new;
  end if;

  -- Configurazione dal Vault; senza di essa non si invia nulla.
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'send_push_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'send_push_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;

  select name into v_home from public.teams where id = new.home_team_id;
  select name into v_away from public.teams where id = new.away_team_id;

  -- Destinatari: i giocatori delle due squadre coinvolte.
  select array_agg(distinct tm.profile_id)
    into v_user_ids
    from public.team_members tm
   where tm.team_id in (new.home_team_id, new.away_team_id);

  -- Nessun giocatore da avvisare: esci.
  if v_user_ids is null or array_length(v_user_ids, 1) is null then
    return new;
  end if;

  v_body := coalesce(v_home, 'Casa') || ' ' || coalesce(new.home_score, 0) || ' - '
            || coalesce(new.away_score, 0) || ' ' || coalesce(v_away, 'Ospiti');

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-shared-secret', v_secret
               ),
    body    := jsonb_build_object(
                 'userIds', to_jsonb(v_user_ids),
                 'title',   'Risultato finale',
                 'body',    v_body,
                 'url',     '/tornei/' || new.tournament_id::text || '/calendario',
                 'tag',     'match-' || new.id::text
               )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_match_finished on public.matches;
create trigger trg_notify_match_finished
  after update of status on public.matches
  for each row
  execute function public.notify_match_finished();

-- ---------------------------------------------------------------------------
-- 4) PROMEMORIA PARTITE (send-reminders) — pg_cron ogni 5 minuti.
--    Esegui UNA VOLTA dal SQL editor (pg_cron va abilitato da Dashboard ->
--    Database -> Extensions, oppure con la create extension qui sotto).
--
--    create extension if not exists pg_cron;
--
--    select cron.schedule(
--      'send-reminders',        -- nome del job
--      '*/5 * * * *',           -- ogni 5 minuti
--      $cron$
--        select net.http_post(
--          url     := (select decrypted_secret from vault.decrypted_secrets
--                        where name = 'send_reminders_url'),
--          headers := jsonb_build_object(
--                       'Content-Type', 'application/json',
--                       'x-shared-secret',
--                       (select decrypted_secret from vault.decrypted_secrets
--                          where name = 'send_push_secret')
--                     ),
--          body    := '{}'::jsonb
--        );
--      $cron$
--    );
--
--    -- Per rimuovere il job:  select cron.unschedule('send-reminders');
--
-- 5) ALTERNATIVA UI (invece del trigger al punto 3): Supabase Dashboard ->
--    Database -> Webhooks -> "Create a new hook":
--      - Table: matches, Events: UPDATE
--      - Type: HTTP Request -> POST all'URL della function send-push
--      - Header: x-shared-secret = <SEND_PUSH_SHARED_SECRET>
--    In tal caso il filtro sullo stato "finished" va gestito nella function.
-- ---------------------------------------------------------------------------
