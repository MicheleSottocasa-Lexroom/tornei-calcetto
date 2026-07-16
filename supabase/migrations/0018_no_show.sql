-- 0018_no_show.sql
-- Mancata presentazione (a tavolino): si registra chi non si è presentato.
--   * una squadra assente  -> vince l'altra (a tavolino), l'assente -2 punti
--   * entrambe assenti      -> nessun vincitore, entrambe -2 punti
-- Stato usato: 'walkover'. La classifica sottrae 2 punti per ogni mancata
-- presentazione e conta l'esito (vittoria/sconfitta) senza bisogno di un
-- punteggio. La 'cancelled' resta neutra (non conteggiata).

alter table matches add column if not exists home_no_show boolean not null default false;
alter table matches add column if not exists away_no_show boolean not null default false;

-- Vincitore: per il walkover da mancata presentazione vince chi si è presentato.
create or replace function set_match_winner() returns trigger language plpgsql as $$
begin
  new.winner_team_id := null;
  if new.status in ('finished','walkover') and new.home_team_id is not null and new.away_team_id is not null then
    if new.status = 'walkover' and (new.home_no_show or new.away_no_show) then
      if new.away_no_show and not new.home_no_show then
        new.winner_team_id := new.home_team_id;
      elsif new.home_no_show and not new.away_no_show then
        new.winner_team_id := new.away_team_id;
      else
        new.winner_team_id := null;  -- entrambe assenti
      end if;
    elsif new.home_score > new.away_score then new.winner_team_id := new.home_team_id;
    elsif new.away_score > new.home_score then new.winner_team_id := new.away_team_id;
    elsif new.home_penalties is not null and new.away_penalties is not null and new.home_penalties is distinct from new.away_penalties then
      new.winner_team_id := case when new.home_penalties > new.away_penalties then new.home_team_id else new.away_team_id end;
    end if;
  end if;
  return new;
end $$;

-- Propaga il vincitore anche quando cambiano i flag di mancata presentazione.
drop trigger if exists trg_advance_winner on matches;
create trigger trg_advance_winner after insert or update of
  status, home_score, away_score, home_penalties, away_penalties, home_no_show, away_no_show
  on matches for each row execute function advance_winner();

-- Viste classifica: outcome esplicito (vinta/pari/persa) + penalità punti.
drop view if exists standings_ranked;
drop view if exists standings;
drop view if exists match_team_results;

create view match_team_results as
  with counted as (
    select m.tournament_id, m.group_id, m.home_team_id, m.away_team_id,
      m.home_score, m.away_score, m.home_no_show, m.away_no_show,
      (m.status = 'walkover' and (m.home_no_show or m.away_no_show)) as by_no_show
    from matches m
    where m.stage in ('round_robin','group','league')
      and m.home_team_id is not null and m.away_team_id is not null
      and (
        (m.status = 'finished' and m.home_score is not null and m.away_score is not null)
        or (m.status = 'walkover' and (m.home_no_show or m.away_no_show))
        or (m.status = 'walkover' and m.home_score is not null and m.away_score is not null)
      )
  )
  select tournament_id, group_id, home_team_id as team_id,
    case when by_no_show then 0 else home_score end as gf,
    case when by_no_show then 0 else away_score end as ga,
    case when by_no_show then (case when away_no_show and not home_no_show then 1 else 0 end)
         else (case when home_score > away_score then 1 else 0 end) end as won,
    case when by_no_show then 0
         else (case when home_score = away_score then 1 else 0 end) end as drawn,
    case when by_no_show then (case when home_no_show then 1 else 0 end)
         else (case when home_score < away_score then 1 else 0 end) end as lost,
    case when by_no_show and home_no_show then 2 else 0 end as penalty
  from counted
  union all
  select tournament_id, group_id, away_team_id as team_id,
    case when by_no_show then 0 else away_score end as gf,
    case when by_no_show then 0 else home_score end as ga,
    case when by_no_show then (case when home_no_show and not away_no_show then 1 else 0 end)
         else (case when away_score > home_score then 1 else 0 end) end as won,
    case when by_no_show then 0
         else (case when away_score = home_score then 1 else 0 end) end as drawn,
    case when by_no_show then (case when away_no_show then 1 else 0 end)
         else (case when away_score < home_score then 1 else 0 end) end as lost,
    case when by_no_show and away_no_show then 2 else 0 end as penalty
  from counted;
alter view match_team_results set (security_invoker = on);

create view standings as
  select s.tournament_id, s.group_id, s.team_id,
    tt.name as team_name,
    count(r.team_id) as played,
    coalesce(sum(r.won),0) as won,
    coalesce(sum(r.drawn),0) as drawn,
    coalesce(sum(r.lost),0) as lost,
    coalesce(sum(r.gf),0) as goals_for,
    coalesce(sum(r.ga),0) as goals_against,
    coalesce(sum(r.gf - r.ga),0) as goal_difference,
    coalesce(sum(r.won),0) * coalesce((t.config->'points'->>'win')::int,3)
    + coalesce(sum(r.drawn),0) * coalesce((t.config->'points'->>'draw')::int,1)
    + coalesce(sum(r.lost),0) * coalesce((t.config->'points'->>'loss')::int,0)
    - coalesce(sum(r.penalty),0) as points
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
