import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui';
import type { StandingRow, TeamParticipant, TeamWithMembers } from '@/types';
import { TeamRoster } from './TeamRoster';

const GROUP_LETTERS = 'ABCDEFGH';

export interface StandingsTableProps {
  standings: StandingRow[];
  /** Se presenti, i nomi diventano cliccabili e aprono la rosa. */
  teamsById?: Map<string, TeamWithMembers>;
  participantsByTeam?: Map<string, TeamParticipant[]>;
}

interface StandingsGroup {
  id: string;
  label: string | null;
  rows: StandingRow[];
}

/**
 * Tabella classifica. Se le righe contengono un `group_id` (formato gironi),
 * viene raggruppata per girone; altrimenti mostra un'unica tabella.
 * Cliccando sul nome di una squadra (se `teamsById` è fornito) si apre la rosa.
 */
export function StandingsTable({
  standings,
  teamsById,
  participantsByTeam,
}: StandingsTableProps) {
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const openTeam = openTeamId ? teamsById?.get(openTeamId) ?? null : null;

  const onTeamClick =
    teamsById != null
      ? (teamId: string) => {
          if (teamsById.has(teamId)) setOpenTeamId(teamId);
        }
      : undefined;

  const groups = useMemo<StandingsGroup[]>(() => {
    const hasGroups = standings.some((r) => r.group_id != null);
    if (!hasGroups) {
      return [{ id: 'single', label: null, rows: standings }];
    }
    const order: string[] = [];
    const byId = new Map<string, StandingRow[]>();
    for (const r of standings) {
      const gid = r.group_id ?? '__none__';
      if (!byId.has(gid)) {
        byId.set(gid, []);
        order.push(gid);
      }
      byId.get(gid)!.push(r);
    }
    return order.map((gid, i) => ({
      id: gid,
      label:
        gid === '__none__'
          ? 'Altre squadre'
          : `Girone ${GROUP_LETTERS[i] ?? i + 1}`,
      rows: byId.get(gid)!,
    }));
  }, [standings]);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.id} className="space-y-2">
          {g.label && (
            <h3 className="text-sm font-semibold text-primary">{g.label}</h3>
          )}
          <StandingsGroupTable rows={g.rows} onTeamClick={onTeamClick} />
        </div>
      ))}

      {openTeam && (
        <Modal open onClose={() => setOpenTeamId(null)} title={openTeam.name}>
          <TeamRoster
            team={openTeam}
            participants={participantsByTeam?.get(openTeam.id)}
          />
        </Modal>
      )}
    </div>
  );
}

function StandingsGroupTable({
  rows,
  onTeamClick,
}: {
  rows: StandingRow[];
  onTeamClick?: (teamId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="bg-card/60 text-xs uppercase text-muted-foreground">
            <th className="px-2 py-2 text-center font-medium">#</th>
            <th className="px-2 py-2 text-left font-medium">Squadra</th>
            <th title="Giocate" className="px-2 py-2 text-center font-medium">
              G
            </th>
            <th title="Vinte" className="px-2 py-2 text-center font-medium">
              V
            </th>
            <th title="Pareggiate" className="px-2 py-2 text-center font-medium">
              N
            </th>
            <th title="Perse" className="px-2 py-2 text-center font-medium">
              P
            </th>
            <th title="Gol fatti" className="px-2 py-2 text-center font-medium">
              GF
            </th>
            <th title="Gol subiti" className="px-2 py-2 text-center font-medium">
              GS
            </th>
            <th title="Differenza reti" className="px-2 py-2 text-center font-medium">
              DR
            </th>
            <th
              title="Punti"
              className="px-2 py-2 text-center font-semibold text-foreground"
            >
              Pt
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team_id} className="border-t border-border">
              <td className="px-2 py-2 text-center text-muted-foreground">{r.position}</td>
              <td className="px-2 py-2 text-left font-medium text-foreground">
                {onTeamClick && r.team_id ? (
                  <button
                    type="button"
                    onClick={() => onTeamClick(r.team_id!)}
                    className="text-left hover:underline focus:underline focus:outline-none"
                  >
                    {r.team_name}
                  </button>
                ) : (
                  r.team_name
                )}
              </td>
              <td className="px-2 py-2 text-center text-muted-foreground">{r.played}</td>
              <td className="px-2 py-2 text-center text-muted-foreground">{r.won}</td>
              <td className="px-2 py-2 text-center text-muted-foreground">{r.drawn}</td>
              <td className="px-2 py-2 text-center text-muted-foreground">{r.lost}</td>
              <td className="px-2 py-2 text-center text-muted-foreground">{r.goals_for}</td>
              <td className="px-2 py-2 text-center text-muted-foreground">
                {r.goals_against}
              </td>
              <td className="px-2 py-2 text-center text-muted-foreground">
                {formatDiff(r.goal_difference)}
              </td>
              <td className="px-2 py-2 text-center font-bold text-primary">
                {r.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDiff(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
