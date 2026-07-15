import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import type { Match, Team } from '@/types';

export interface BracketProps {
  matches: Match[];
  teamsById: Map<string, Team>;
}

interface RoundColumn {
  round: number;
  label: string;
  matches: Match[];
}

/**
 * Tabellone a eliminazione: una colonna per turno letta da
 * `round` / `bracket_position`. I turni sono etichettati in base alla
 * distanza dalla finale.
 */
export function Bracket({ matches, teamsById }: BracketProps) {
  const columns = useMemo<RoundColumn[]>(() => {
    const ko = matches.filter((m) => m.stage === 'knockout');
    const byRound = new Map<number, Match[]>();
    for (const m of ko) {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    }
    const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);
    const maxRound = rounds.length ? rounds[rounds.length - 1] : 0;
    return rounds.map((r) => ({
      round: r,
      label: roundLabel(r, maxRound),
      matches: byRound
        .get(r)!
        .sort((a, b) => (a.bracket_position ?? 0) - (b.bracket_position ?? 0)),
    }));
  }, [matches]);

  if (columns.length === 0) return null;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-4">
        {columns.map((col) => (
          <div key={col.round} className="flex min-w-[200px] flex-col gap-3">
            <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-primary-400">
              {col.label}
            </h3>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {col.matches.map((m) => (
                <BracketMatch
                  key={m.id}
                  match={m}
                  teamsById={teamsById}
                  columnLabel={col.label}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatch({
  match,
  teamsById,
  columnLabel,
}: {
  match: Match;
  teamsById: Map<string, Team>;
  columnLabel: string;
}) {
  const showScore =
    match.status === 'finished' ||
    match.status === 'live' ||
    match.status === 'walkover';
  const hasPens =
    match.home_penalties != null && match.away_penalties != null;
  const caption =
    match.round_name && match.round_name !== columnLabel ? match.round_name : null;

  return (
    <div className="rounded-lg border border-surface-800 bg-surface-800/40 p-2">
      {caption && (
        <div className="mb-1 text-center text-[10px] uppercase text-surface-500">
          {caption}
        </div>
      )}
      <BracketSlot
        name={teamName(match.home_team_id, teamsById)}
        score={showScore ? match.home_score : null}
        pens={hasPens ? match.home_penalties : null}
        winner={isWinner(match, match.home_team_id)}
      />
      <div className="my-1 border-t border-surface-800/70" />
      <BracketSlot
        name={teamName(match.away_team_id, teamsById)}
        score={showScore ? match.away_score : null}
        pens={hasPens ? match.away_penalties : null}
        winner={isWinner(match, match.away_team_id)}
      />
    </div>
  );
}

function BracketSlot({
  name,
  score,
  pens,
  winner,
}: {
  name: string;
  score: number | null;
  pens: number | null;
  winner: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2',
        winner ? 'text-surface-50' : 'text-surface-300',
      )}
    >
      <span className={cn('truncate text-sm', winner && 'font-bold')}>{name}</span>
      <span className="flex shrink-0 items-center gap-1">
        {pens != null && (
          <span className="text-[10px] text-surface-500">({pens})</span>
        )}
        <span
          className={cn(
            'w-5 text-right text-sm tabular-nums',
            winner ? 'font-bold text-primary-400' : 'text-surface-400',
          )}
        >
          {score ?? '–'}
        </span>
      </span>
    </div>
  );
}

function teamName(id: string | null, teamsById: Map<string, Team>): string {
  if (!id) return 'Da definire';
  return teamsById.get(id)?.name ?? 'Squadra';
}

function isWinner(match: Match, teamId: string | null): boolean {
  return !!teamId && !!match.winner_team_id && match.winner_team_id === teamId;
}

function roundLabel(round: number, maxRound: number): string {
  const distance = maxRound - round;
  switch (distance) {
    case 0:
      return 'Finale';
    case 1:
      return 'Semifinali';
    case 2:
      return 'Quarti di finale';
    case 3:
      return 'Ottavi di finale';
    case 4:
      return 'Sedicesimi di finale';
    default:
      return `Turno ${round}`;
  }
}
