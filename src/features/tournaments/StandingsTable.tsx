import { useMemo } from 'react';
import type { StandingRow } from '@/types';

const GROUP_LETTERS = 'ABCDEFGH';

export interface StandingsTableProps {
  standings: StandingRow[];
}

interface StandingsGroup {
  id: string;
  label: string | null;
  rows: StandingRow[];
}

/**
 * Tabella classifica. Se le righe contengono un `group_id` (formato gironi),
 * viene raggruppata per girone; altrimenti mostra un'unica tabella.
 */
export function StandingsTable({ standings }: StandingsTableProps) {
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
            <h3 className="text-sm font-semibold text-primary-400">{g.label}</h3>
          )}
          <StandingsGroupTable rows={g.rows} />
        </div>
      ))}
    </div>
  );
}

function StandingsGroupTable({ rows }: { rows: StandingRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-800">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface-800/60 text-xs uppercase text-surface-400">
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
              className="px-2 py-2 text-center font-semibold text-surface-200"
            >
              Pt
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team_id} className="border-t border-surface-800">
              <td className="px-2 py-2 text-center text-surface-400">{r.position}</td>
              <td className="px-2 py-2 text-left font-medium text-surface-100">
                {r.team_name}
              </td>
              <td className="px-2 py-2 text-center text-surface-300">{r.played}</td>
              <td className="px-2 py-2 text-center text-surface-300">{r.won}</td>
              <td className="px-2 py-2 text-center text-surface-300">{r.drawn}</td>
              <td className="px-2 py-2 text-center text-surface-300">{r.lost}</td>
              <td className="px-2 py-2 text-center text-surface-300">{r.goals_for}</td>
              <td className="px-2 py-2 text-center text-surface-300">
                {r.goals_against}
              </td>
              <td className="px-2 py-2 text-center text-surface-300">
                {formatDiff(r.goal_difference)}
              </td>
              <td className="px-2 py-2 text-center font-bold text-primary-400">
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
