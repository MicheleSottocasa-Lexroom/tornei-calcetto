-- 0008_leave_team.sql
-- Uscita da una squadra: rimuove la membership e rilascia l'eventuale claim del
-- partecipante (profile_id -> null). Un capitano unico membro scioglie la squadra;
-- un capitano con altri membri deve prima passare la fascia.
create or replace function leave_team(p_team_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role member_role;
  v_count int;
begin
  select role into v_role from team_members
    where team_id = p_team_id and profile_id = auth.uid();
  if not found then
    raise exception 'Non fai parte di questa squadra';
  end if;

  select count(*) into v_count from team_members where team_id = p_team_id;

  if v_role = 'captain' then
    if v_count > 1 then
      raise exception 'Sei il capitano: passa prima la fascia a un altro giocatore per uscire.';
    end if;
    -- Capitano unico membro: elimina la squadra (cascade su membri e partecipanti).
    delete from teams where id = p_team_id;
    return;
  end if;

  delete from team_members where team_id = p_team_id and profile_id = auth.uid();
  update team_participants set profile_id = null
    where team_id = p_team_id and profile_id = auth.uid();
end $$;

grant execute on function leave_team(uuid) to authenticated;
