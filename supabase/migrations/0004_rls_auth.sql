-- 0004_rls_auth.sql — RLS, allowlist admin, provisioning utenti

create table admin_allowlist (email text primary key);
insert into admin_allowlist(email) values ('michele.sottocasa@lexroom.ai') on conflict do nothing;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Difesa in profondità: consenti il provisioning SOLO agli account @lexroom.ai.
  -- L'hint `hd` lato OAuth e la consent screen "Internal" non sono un confine di
  -- sicurezza affidabile; qui blocchiamo a livello DB la creazione del profilo
  -- (e quindi del login) per email fuori dominio.
  if new.email is null or lower(new.email) not like '%@lexroom.ai' then
    raise exception 'Registrazione consentita solo agli account @lexroom.ai';
  end if;
  insert into profiles (id, email, full_name, avatar_url, is_admin)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    exists (select 1 from admin_allowlist a where a.email = new.email))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Blocca auto-promozione ad admin e la modifica dell'email dal profilo
-- (l'email deve restare allineata ad auth.users, usata dall'allowlist admin).
create or replace function guard_is_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin and not is_admin() then new.is_admin := old.is_admin; end if;
  if new.email is distinct from old.email then new.email := old.email; end if;
  return new;
end $$;
create trigger trg_guard_is_admin before update on profiles for each row execute function guard_is_admin();

alter table profiles enable row level security;
alter table tournaments enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table groups enable row level security;
alter table group_teams enable row level security;
alter table matches enable row level security;
alter table match_events enable row level security;
alter table push_subscriptions enable row level security;
alter table admin_allowlist enable row level security;

create policy p_read on profiles for select to authenticated using (true);
create policy p_selfup on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy p_admin on profiles for all to authenticated using (is_admin()) with check (is_admin());


create policy t_read on tournaments for select to authenticated using (true);
create policy t_admin on tournaments for all to authenticated using (is_admin()) with check (is_admin());
create policy t_creator_edit on tournaments for update to authenticated using (created_by = auth.uid() and status = 'draft') with check (created_by = auth.uid());

create policy tm_read on teams for select to authenticated using (true);
create policy tm_register on teams for insert to authenticated with check (created_by = auth.uid() and tournament_registration_open(tournament_id));
create policy tm_manage on teams for update to authenticated using (is_admin() or is_team_captain(id)) with check (is_admin() or is_team_captain(id));
create policy tm_delete on teams for delete to authenticated using (is_admin() or is_team_captain(id));

create policy mem_read on team_members for select to authenticated using (true);
create policy mem_captain_add on team_members for insert to authenticated with check (is_admin() or is_team_captain(team_id));
-- Auto-iscrizione consentita SOLO come giocatore e SOLO a torneo con iscrizioni
-- aperte. Il ruolo 'captain' NON è auto-assegnabile (evita takeover del capitano
-- su squadre altrui): si diventa capitani via mem_captain_add o mem_creator_captain.
create policy mem_self_join on team_members for insert to authenticated with check (
  profile_id = auth.uid()
  and role = 'player'
  and tournament_registration_open((select tournament_id from teams where id = team_id))
);
-- Il creatore della squadra può inserire sé stesso come primo capitano.
create policy mem_creator_captain on team_members for insert to authenticated with check (
  profile_id = auth.uid()
  and role = 'captain'
  and exists (select 1 from teams t where t.id = team_id and t.created_by = auth.uid())
);
create policy mem_remove on team_members for delete to authenticated using (is_admin() or is_team_captain(team_id) or profile_id = auth.uid());

create policy grp_read on groups for select to authenticated using (true);
create policy grp_admin on groups for all to authenticated using (is_admin()) with check (is_admin());
create policy gt_read on group_teams for select to authenticated using (true);
create policy gt_admin on group_teams for all to authenticated using (is_admin()) with check (is_admin());

create policy mt_read on matches for select to authenticated using (true);
create policy mt_admin on matches for all to authenticated using (is_admin()) with check (is_admin());

create policy me_read on match_events for select to authenticated using (true);
create policy me_admin on match_events for all to authenticated using (is_admin()) with check (is_admin());

create policy ps_own on push_subscriptions for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy al_admin on admin_allowlist for all to authenticated using (is_admin()) with check (is_admin());

-- Realtime: pubblica matches e match_events se la publication esiste
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matches') then
      alter publication supabase_realtime add table public.matches;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='match_events') then
      alter publication supabase_realtime add table public.match_events;
    end if;
  end if;
end $$;
