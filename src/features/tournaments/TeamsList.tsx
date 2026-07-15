import { Avatar, Badge, Card } from '@/components/ui';
import type { BadgeProps } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { TeamParticipant, TeamStatus, TeamWithMembers } from '@/types';

type Tone = NonNullable<BadgeProps['tone']>;
type Member = TeamWithMembers['members'][number];

const STATUS_META: Record<TeamStatus, { label: string; tone: Tone }> = {
  registered: { label: 'Iscritta', tone: 'default' },
  confirmed: { label: 'Confermata', tone: 'success' },
  withdrawn: { label: 'Ritirata', tone: 'danger' },
};

export interface TeamsListProps {
  teams: TeamWithMembers[];
  /** Partecipanti (nomi liberi) per squadra: se presenti, sono la rosa mostrata. */
  participantsByTeam?: Map<string, TeamParticipant[]>;
}

/** Elenco squadre del torneo con la relativa rosa (partecipanti o membri). */
export function TeamsList({ teams, participantsByTeam }: TeamsListProps) {
  return (
    <div className="space-y-3">
      {teams.map((team) => {
        const meta = STATUS_META[team.status];
        const withdrawn = team.status === 'withdrawn';
        const participants = participantsByTeam?.get(team.id) ?? [];
        const useParticipants = participants.length > 0;
        const members = [...team.members].sort(sortMembers);
        const count = useParticipants ? participants.length : members.length;

        return (
          <Card key={team.id} className={cn(withdrawn && 'opacity-60')}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {team.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {count} {count === 1 ? 'partecipante' : 'partecipanti'}
                </p>
              </div>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>

            {count === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun partecipante in rosa.</p>
            ) : useParticipants ? (
              <ul className="space-y-2">
                {participants.map((p) => {
                  const isCaptain = !!p.profile_id && p.profile_id === team.captain_id;
                  return (
                    <li key={p.id} className="flex items-center gap-3">
                      <Avatar name={p.full_name} size="sm" />
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-sm text-foreground">
                          {p.full_name}
                        </span>
                        {isCaptain && <Badge tone="primary">Capitano</Badge>}
                        {!p.profile_id && <Badge tone="default">In attesa</Badge>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => {
                  const displayName =
                    m.profile?.full_name ?? m.profile?.email ?? 'Giocatore';
                  return (
                    <li key={m.id} className="flex items-center gap-3">
                      <Avatar src={m.profile?.avatar_url} name={displayName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm text-foreground">
                            {displayName}
                          </span>
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
            )}
          </Card>
        );
      })}
    </div>
  );
}

function sortMembers(a: Member, b: Member): number {
  if (a.role !== b.role) return a.role === 'captain' ? -1 : 1;
  const na = a.profile?.full_name ?? a.profile?.email ?? '';
  const nb = b.profile?.full_name ?? b.profile?.email ?? '';
  return na.localeCompare(nb);
}
