-- 0013_team_candidacy.sql
-- Candidatura: iscrizione a torneo IN CORSO, in attesa di approvazione admin.
-- Le squadre "pending" non entrano in classifica finché non vengono accettate;
-- all'accettazione (round_robin/league) si aggiunge il loro calendario in coda,
-- senza toccare le partite esistenti, con orari automatici.

-- 1) Flag candidatura non ancora accettata.
alter table teams add column if not exists pending boolean not null default false;

-- 2) Escludi le squadre pending dagli slot di classifica (ricrea le viste dipendenti).
drop view if exists standings_ranked;
drop view if exists standings;
drop view if exists tournament_team_slots;

create view tournament_team_slots as
  select g.tournament_id, gt.team_id, g.id as group_id
  from group_teams gt join groups g on g.id = gt.group_id
  union all
  select t.tournament_id, t.id as team_id, null::uuid as group_id
  from teams t
  where t.status <> 'withdrawn' and t.pending = false
    and not exists (select 1 from group_teams gt2 where gt2.team_id = t.id);
alter view tournament_team_slots set (security_invoker = on);

create view standings as
  select s.tournament_id, s.group_id, s.team_id,
    tt.name as team_name,
    count(r.team_id) as played,
    count(*) filter (where r.gf > r.ga) as won,
    count(*) filter (where r.gf = r.ga) as drawn,
    count(*) filter (where r.gf < r.ga) as lost,
    coalesce(sum(r.gf),0) as goals_for,
    coalesce(sum(r.ga),0) as goals_against,
    coalesce(sum(r.gf - r.ga),0) as goal_difference,
    count(*) filter (where r.gf > r.ga) * coalesce((t.config->'points'->>'win')::int,3)
    + count(*) filter (where r.gf = r.ga) * coalesce((t.config->'points'->>'draw')::int,1)
    + count(*) filter (where r.gf < r.ga) * coalesce((t.config->'points'->>'loss')::int,0) as points
  from tournament_team_slots s
  join tournaments t on t.id = s.tournament_id
  join teams tt on tt.id = s.team_id
  left join match_team_results r on r.team_id = s.team_id and r.tournament_id = s.tournament_id
    and r.group_id is not distinct from s.group_id
  group by s.tournament_id, s.group_id, s.team_id, tt.name, t.config;
alter view standings set (security_invoker = on);

create view standings_ranked as
  select st.*, row_number() over (
    partition by st.tournament_id, st.group_id
    order by st.points desc, st.goal_difference desc, st.goals_for desc, st.won desc, st.team_id
  ) as position
  from standings st;
alter view standings_ranked set (security_invoker = on);

-- 3) Consenti l'iscrizione anche a torneo in corso (oltre che a iscrizioni aperte).
drop policy if exists tm_register on teams;
create policy tm_register on teams for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from tournaments
      where id = tournament_id and status in ('registration_open', 'in_progress')
    )
  );

-- 4) Accetta una candidatura: conferma la squadra e (per round_robin/league)
--    aggiunge le sue partite in coda con orari automatici (30' l'una).
create or replace function accept_team_candidacy(p_team_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid;
  v_fmt tournament_format;
  v_stage match_stage;
  v_round int;
  v_time timestamptz;
  o record;
begin
  perform assert_admin();

  select tournament_id into v_tid from teams where id = p_team_id;
  if not found then raise exception 'Squadra non trovata'; end if;

  update teams set pending = false, status = 'confirmed' where id = p_team_id;

  select format into v_fmt from tournaments where id = v_tid;

  if v_fmt in ('round_robin', 'league') then
    v_stage := case when v_fmt = 'league' then 'league'::match_stage
                    else 'round_robin'::match_stage end;
    select coalesce(max(round), 0) into v_round
      from matches where tournament_id = v_tid and stage = v_stage;
    select coalesce(max(scheduled_at), now()) into v_time
      from matches where tournament_id = v_tid;

    for o in
      select t.id from teams t
      where t.tournament_id = v_tid and t.id <> p_team_id
        and t.status <> 'withdrawn' and t.pending = false
        and not exists (
          select 1 from matches m
          where m.tournament_id = v_tid
            and ((m.home_team_id = p_team_id and m.away_team_id = t.id)
              or (m.home_team_id = t.id and m.away_team_id = p_team_id)))
      order by t.created_at
    loop
      v_round := v_round + 1;
      v_time := v_time + interval '30 minutes';
      insert into matches(tournament_id, stage, round, home_team_id, away_team_id, status, scheduled_at)
      values (v_tid, v_stage, v_round, p_team_id, o.id, 'scheduled', v_time);
    end loop;
  end if;
end $$;

grant execute on function accept_team_candidacy(uuid) to authenticated;
