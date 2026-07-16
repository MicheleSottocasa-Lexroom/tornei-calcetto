-- 0011_view_names.sql
-- Fix: le viste classifica/marcatori non esponevano i nomi attesi dalla UI.
--   standings   -> aggiunge team_name
--   top_scorers -> full_name rinominata in player_name + team_id/team_name
-- create or replace non basta (cambia l'ordine delle colonne): drop + recreate.

drop view if exists standings_ranked;
drop view if exists top_scorers;
drop view if exists standings;

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

create view top_scorers as
  select e.tournament_id, e.player_id,
    p.full_name as player_name,
    tm.team_id,
    t.name as team_name,
    count(*) filter (where e.event_type in ('goal','penalty_goal')) as goals,
    count(*) filter (where e.event_type = 'assist') as assists,
    count(*) filter (where e.event_type = 'own_goal') as own_goals,
    count(*) filter (where e.event_type = 'yellow_card') as yellow_cards,
    count(*) filter (where e.event_type = 'red_card') as red_cards,
    count(*) filter (where e.event_type = 'mvp') as mvp_awards
  from match_events e
  join profiles p on p.id = e.player_id
  left join team_members tm on tm.tournament_id = e.tournament_id and tm.profile_id = e.player_id
  left join teams t on t.id = tm.team_id
  where e.player_id is not null
  group by e.tournament_id, e.player_id, p.full_name, tm.team_id, t.name;
alter view top_scorers set (security_invoker = on);
