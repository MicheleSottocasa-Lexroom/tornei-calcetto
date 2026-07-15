-- 0002_views.sql — classifiche e marcatori come viste (security_invoker)

create or replace view tournament_team_slots as
  select g.tournament_id, gt.team_id, g.id as group_id
  from group_teams gt join groups g on g.id = gt.group_id
  union all
  select t.tournament_id, t.id as team_id, null::uuid as group_id
  from teams t
  where t.status <> 'withdrawn'
    and not exists (select 1 from group_teams gt2 where gt2.team_id = t.id);
alter view tournament_team_slots set (security_invoker = on);

create or replace view match_team_results as
  select m.tournament_id, m.group_id, m.home_team_id as team_id, m.home_score as gf, m.away_score as ga
  from matches m
  where m.status in ('finished','walkover') and m.stage in ('round_robin','group','league')
    and m.home_team_id is not null and m.away_team_id is not null
  union all
  select m.tournament_id, m.group_id, m.away_team_id, m.away_score, m.home_score
  from matches m
  where m.status in ('finished','walkover') and m.stage in ('round_robin','group','league')
    and m.home_team_id is not null and m.away_team_id is not null;
alter view match_team_results set (security_invoker = on);

create or replace view standings as
  select s.tournament_id, s.group_id, s.team_id,
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
  left join match_team_results r on r.team_id = s.team_id and r.tournament_id = s.tournament_id
    and r.group_id is not distinct from s.group_id
  group by s.tournament_id, s.group_id, s.team_id, t.config;
alter view standings set (security_invoker = on);

create or replace view standings_ranked as
  select st.*, row_number() over (
    partition by st.tournament_id, st.group_id
    order by st.points desc, st.goal_difference desc, st.goals_for desc, st.won desc, st.team_id
  ) as position
  from standings st;
alter view standings_ranked set (security_invoker = on);

create or replace view top_scorers as
  select e.tournament_id, e.player_id, p.full_name,
    count(*) filter (where e.event_type in ('goal','penalty_goal')) as goals,
    count(*) filter (where e.event_type = 'assist') as assists,
    count(*) filter (where e.event_type = 'own_goal') as own_goals,
    count(*) filter (where e.event_type = 'yellow_card') as yellow_cards,
    count(*) filter (where e.event_type = 'red_card') as red_cards,
    count(*) filter (where e.event_type = 'mvp') as mvp_awards
  from match_events e join profiles p on p.id = e.player_id
  where e.player_id is not null
  group by e.tournament_id, e.player_id, p.full_name;
alter view top_scorers set (security_invoker = on);
