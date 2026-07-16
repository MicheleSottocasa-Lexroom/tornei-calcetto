import { Avatar, Badge } from '@/components/ui';
import type { TeamParticipant, TeamWithMembers } from '@/types';

type Member = TeamWithMembers['members'][number];

export interface TeamRosterProps {
  team: TeamWithMembers;
  /** Partecipanti (nomi liberi); se presenti sono la rosa mostrata. */
  participants?: TeamParticipant[];
}

/** Rosa di una squadra: partecipanti (nomi liberi) se presenti, altrimenti i membri. */
export function TeamRoster({ team, participants = [] }: TeamRosterProps) {
  const useParticipants = participants.length > 0;
  const members = [...team.members].sort(sortMembers);
  const count = useParticipants ? participants.length : members.length;

  if (count === 0) {
    return <p className="text-sm text-muted-foreground">Nessun partecipante in rosa.</p>;
  }

  if (useParticipants) {
    return (
      <ul className="space-y-2">
        {participants.map((p) => {
          const isCaptain = !!p.profile_id && p.profile_id === team.captain_id;
          return (
            <li key={p.id} className="flex items-center gap-3">
              <Avatar name={p.full_name} size="sm" />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm text-foreground">{p.full_name}</span>
                {isCaptain && <Badge tone="primary">Capitano</Badge>}
                {!p.profile_id && <Badge tone="default">In attesa</Badge>}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-2">
      {members.map((m) => {
        const displayName = m.profile?.full_name ?? m.profile?.email ?? 'Giocatore';
        return (
          <li key={m.id} className="flex items-center gap-3">
            <Avatar src={m.profile?.avatar_url} name={displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm text-foreground">{displayName}</span>
                {m.role === 'captain' && <Badge tone="primary">Capitano</Badge>}
              </div>
            </div>
            {m.shirt_number != null && (
              <span className="shrink-0 text-sm font-semibold text-muted-foreground">
                #{m.shirt_number}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function sortMembers(a: Member, b: Member): number {
  if (a.role !== b.role) return a.role === 'captain' ? -1 : 1;
  const na = a.profile?.full_name ?? a.profile?.email ?? '';
  const nb = b.profile?.full_name ?? b.profile?.email ?? '';
  return na.localeCompare(nb);
}
