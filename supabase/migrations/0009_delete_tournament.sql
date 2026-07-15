-- 0009_delete_tournament.sql
-- Eliminazione di un torneo (solo admin). Elimina PRIMA le partite (evita il
-- vincolo on delete restrict matches->teams), poi il torneo: il cascade rimuove
-- squadre, membri, partecipanti, gironi e assegnazioni.
create or replace function delete_tournament(p_tournament_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  delete from matches where tournament_id = p_tournament_id; -- cascade su match_events
  delete from tournaments where id = p_tournament_id;        -- cascade su teams/membri/partecipanti/gironi
end $$;

grant execute on function delete_tournament(uuid) to authenticated;
