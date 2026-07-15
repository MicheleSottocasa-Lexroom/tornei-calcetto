import { useMemo, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import type { TeamWithMembers } from '@/types';
import {
  useAddTeamMember,
  useProfiles,
  useRemoveTeamMember,
  teamErrorMessage,
} from './hooks';

export interface RosterEditorProps {
  team: TeamWithMembers;
  tournamentId: string;
  /** Se true mostra i controlli di gestione (solo capitano/admin a iscrizioni aperte). */
  canManage: boolean;
  /** Profili già iscritti a una squadra del torneo (da escludere dall'aggiunta). */
  takenProfileIds: Set<string>;
}

export function RosterEditor({
  team,
  tournamentId,
  canManage,
  takenProfileIds,
}: RosterEditorProps) {
  const { data: profiles, isLoading: profilesLoading } = useProfiles();
  const addMember = useAddTeamMember(tournamentId);
  const removeMember = useRemoveTeamMember(tournamentId);

  const [profileId, setProfileId] = useState('');
  const [shirt, setShirt] = useState('');

  const eligible = useMemo(
    () => (profiles ?? []).filter((p) => !takenProfileIds.has(p.id)),
    [profiles, takenProfileIds],
  );

  const members = useMemo(
    () =>
      [...team.members].sort((a, b) => {
        if (a.role !== b.role) return a.role === 'captain' ? -1 : 1;
        const an = a.profile?.full_name ?? a.profile?.email ?? '';
        const bn = b.profile?.full_name ?? b.profile?.email ?? '';
        return an.localeCompare(bn);
      }),
    [team.members],
  );

  const onAdd = async () => {
    if (!profileId) return;
    try {
      await addMember.mutateAsync({
        teamId: team.id,
        profileId,
        shirtNumber: shirt ? Number(shirt) : null,
      });
      setProfileId('');
      setShirt('');
    } catch {
      // Errore mostrato tramite addMember.error.
    }
  };

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2">
            <Avatar
              src={m.profile?.avatar_url}
              name={m.profile?.full_name ?? m.profile?.email}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {m.profile?.full_name ?? m.profile?.email ?? 'Giocatore'}
              </p>
              {m.shirt_number != null && (
                <p className="text-xs text-muted-foreground">Maglia #{m.shirt_number}</p>
              )}
            </div>
            {m.role === 'captain' ? (
              <Badge tone="primary">Capitano</Badge>
            ) : canManage ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Rimuovi giocatore"
                onClick={() => removeMember.mutate(m.id)}
                loading={removeMember.isPending && removeMember.variables === m.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <UserPlus className="h-4 w-4 text-primary" />
            Aggiungi giocatore
          </p>

          {profilesLoading ? (
            <Spinner size="sm" label="Caricamento giocatori…" />
          ) : eligible.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nessun giocatore disponibile: tutti gli utenti sono già iscritti a una
              squadra di questo torneo.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                aria-label="Seleziona giocatore"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="sm:flex-1"
              >
                <option value="">Seleziona un giocatore…</option>
                {eligible.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={0}
                max={99}
                placeholder="N. maglia"
                aria-label="Numero di maglia"
                value={shirt}
                onChange={(e) => setShirt(e.target.value)}
                className="sm:w-28"
              />
              <Button
                onClick={() => void onAdd()}
                disabled={!profileId}
                loading={addMember.isPending}
              >
                Aggiungi
              </Button>
            </div>
          )}

          {addMember.isError && (
            <p className="text-sm text-destructive">{teamErrorMessage(addMember.error)}</p>
          )}
          {removeMember.isError && (
            <p className="text-sm text-destructive">
              {teamErrorMessage(removeMember.error)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
