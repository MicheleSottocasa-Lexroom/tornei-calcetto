-- 0010_transfer_captaincy.sql
-- Passaggio della fascia di capitano a un altro membro della squadra.
-- Consentito al capitano attuale (o admin). Il vecchio capitano resta in rosa
-- come giocatore. security definer per gestire in sicurezza gli update dei ruoli.
create or replace function transfer_captaincy(p_team_id uuid, p_new_captain uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or exists (
    select 1 from team_members
    where team_id = p_team_id and profile_id = auth.uid() and role = 'captain'
  )) then
    raise exception 'Solo il capitano puo passare la fascia';
  end if;

  if not exists (
    select 1 from team_members where team_id = p_team_id and profile_id = p_new_captain
  ) then
    raise exception 'Il nuovo capitano deve far parte della squadra';
  end if;

  -- prima azzera i capitani (vincolo: un solo capitano per squadra), poi promuove
  update team_members set role = 'player' where team_id = p_team_id and role = 'captain';
  update team_members set role = 'captain'
    where team_id = p_team_id and profile_id = p_new_captain;
  update teams set captain_id = p_new_captain where id = p_team_id;
end $$;

grant execute on function transfer_captaincy(uuid, uuid) to authenticated;
