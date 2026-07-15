import { Avatar } from '@/components/ui';
import type { TopScorerRow } from '@/types';

export interface ScorersTableProps {
  scorers: TopScorerRow[];
}

/** Classifica marcatori: gol, assist e cartellini per giocatore. */
export function ScorersTable({ scorers }: ScorersTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[440px] border-collapse text-sm">
        <thead>
          <tr className="bg-card/60 text-xs uppercase text-muted-foreground">
            <th className="px-2 py-2 text-center font-medium">#</th>
            <th className="px-2 py-2 text-left font-medium">Giocatore</th>
            <th
              title="Gol"
              className="px-2 py-2 text-center font-semibold text-foreground"
            >
              Gol
            </th>
            <th title="Assist" className="px-2 py-2 text-center font-medium">
              Assist
            </th>
            <th title="Ammonizioni" className="px-2 py-2 text-center font-medium">
              Amm
            </th>
            <th title="Espulsioni" className="px-2 py-2 text-center font-medium">
              Esp
            </th>
          </tr>
        </thead>
        <tbody>
          {scorers.map((s, i) => (
            <tr key={s.player_id} className="border-t border-border">
              <td className="px-2 py-2 text-center text-muted-foreground">{i + 1}</td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <Avatar name={s.player_name} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {s.player_name ?? 'Giocatore'}
                    </div>
                    {s.team_name && (
                      <div className="truncate text-xs text-muted-foreground">
                        {s.team_name}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-2 py-2 text-center text-base font-bold text-primary">
                {s.goals}
              </td>
              <td className="px-2 py-2 text-center text-muted-foreground">{s.assists}</td>
              <td className="px-2 py-2 text-center text-muted-foreground">
                {s.yellow_cards}
              </td>
              <td className="px-2 py-2 text-center text-muted-foreground">
                {s.red_cards}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
