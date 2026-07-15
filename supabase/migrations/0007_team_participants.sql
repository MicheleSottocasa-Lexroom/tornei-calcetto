-- 0007_team_participants.sql
-- Partecipanti della squadra inseriti a testo libero in fase di iscrizione
-- (nome + email facoltativa). Possono non essere ancora utenti registrati:
-- al primo accesso l'utente puo "reclamare" (claim) il partecipante che
-- corrisponde al suo nome/cognome o email, associandosi alla squadra.

create table team_participants (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  full_name text not null,
  email text,
  profile_id uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index on team_participants(team_id);
create index on team_participants(tournament_id);
create index on team_participants(profile_id);
create index team_participants_email_lower on team_participants (lower(email));
create index team_participants_name_lower on team_participants (lower(full_name));

-- tournament_id derivato dalla squadra (anti-spoofing), come team_members
create or replace function fill_team_participant_tournament() returns trigger
language plpgsql as $$
begin
  select tournament_id into new.tournament_id from teams where id = new.team_id;
  return new;
end $$;
create trigger trg_fill_tp_tournament before insert on team_participants
for each row execute function fill_team_participant_tournament();

alter table team_participants enable row level security;

create policy tp_read on team_participants for select to authenticated using (true);
create policy tp_insert on team_participants for insert to authenticated
  with check (is_admin() or is_team_captain(team_id));
create policy tp_update on team_participants for update to authenticated
  using (is_admin() or is_team_captain(team_id) or profile_id = auth.uid())
  with check (is_admin() or is_team_captain(team_id) or profile_id = auth.uid());
create policy tp_delete on team_participants for delete to authenticated
  using (is_admin() or is_team_captain(team_id) or profile_id = auth.uid());

-- Claim: l'utente reclama un partecipante che corrisponde al suo nome/email.
-- SECURITY DEFINER: verifica la corrispondenza lato server e associa la squadra
-- al profilo (crea la riga in team_members se non gia iscritto in quel torneo).
create or replace function claim_team_participant(p_participant_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  tp team_participants%rowtype;
  me profiles%rowtype;
begin
  select * into tp from team_participants where id = p_participant_id;
  if not found then raise exception 'Partecipante non trovato'; end if;
  if tp.profile_id is not null then raise exception 'Partecipante gia associato'; end if;

  select * into me from profiles where id = auth.uid();
  if not found then raise exception 'Profilo non trovato'; end if;

  if not (
    (tp.email is not null and lower(tp.email) = lower(me.email))
    or (me.full_name is not null and lower(tp.full_name) = lower(me.full_name))
  ) then
    raise exception 'Il partecipante non corrisponde al tuo nome o alla tua email';
  end if;

  update team_participants set profile_id = me.id where id = p_participant_id;

  insert into team_members (team_id, profile_id, role)
  values (tp.team_id, me.id, 'player')
  on conflict do nothing;
end $$;

grant execute on function claim_team_participant(uuid) to authenticated;
