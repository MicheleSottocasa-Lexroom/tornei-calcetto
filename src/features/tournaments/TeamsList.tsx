import { Badge, Card } from '@/components/ui';
import type { BadgeProps } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { TeamParticipant, TeamStatus, TeamWithMembers } from '@/types';
import { TeamRoster } from './TeamRoster';

type Tone = NonNullable<BadgeProps['tone']>;

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
        const count = participants.length > 0 ? participants.length : team.members.length;

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
              <div className="flex shrink-0 items-center gap-2">
                {team.pending && <Badge tone="warning">In attesa</Badge>}
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>
            </div>

            <TeamRoster team={team} participants={participants} />
          </Card>
        );
      })}
    </div>
  );
}
