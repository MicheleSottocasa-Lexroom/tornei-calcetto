/**
 * Classifica di un girone (implementazione TS di riferimento).
 *
 * Rispecchia le viste SQL `standings` / `standings_ranked`
 * (supabase/migrations/0002_views.sql): in produzione la classifica è una
 * vista lato DB; questa versione serve a verificare la correttezza con unit
 * test ed è utile anche lato client per ricalcolare in tempo reale.
 *
 * Tie-break (come `standings_ranked`): punti desc, differenza reti desc,
 * gol fatti desc, vittorie desc, infine team_id asc (deterministico).
 * Contano solo le partite concluse (`finished`/`walkover`) delle fasi a punti
 * (`round_robin`, `group`, `league`); i knockout sono esclusi.
 */

export interface StandingTeamInput {
  teamId: string;
  teamName: string;
  /** Girone di appartenenza; null/undefined per round_robin e campionato. */
  groupId?: string | null;
}

export interface StandingMatchInput {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  /** Se presente, contano solo 'finished'/'walkover'. */
  status?: string;
  /** Se presente, i knockout vengono esclusi. */
  stage?: string;
}

export interface PointsConfig {
  win: number;
  draw: number;
  loss: number;
}

export interface StandingRowComputed {
  teamId: string;
  teamName: string;
  groupId: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Posizione 1-based all'interno del girone. */
  position: number;
}

export const DEFAULT_POINTS: PointsConfig = { win: 3, draw: 1, loss: 0 };

const COUNTED_STAGES = new Set(['round_robin', 'group', 'league']);
const COUNTED_STATUSES = new Set(['finished', 'walkover']);

/**
 * Calcola la classifica ordinata a partire da squadre e partite concluse.
 * Le squadre senza partite compaiono comunque con valori a zero.
 */
export function computeStandings(
  teams: StandingTeamInput[],
  finishedMatches: StandingMatchInput[],
  points: PointsConfig = DEFAULT_POINTS,
): StandingRowComputed[] {
  const rows = new Map<string, StandingRowComputed>();
  for (const t of teams) {
    rows.set(t.teamId, {
      teamId: t.teamId,
      teamName: t.teamName,
      groupId: t.groupId ?? null,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      position: 0,
    });
  }

  for (const m of finishedMatches) {
    if (m.status !== undefined && !COUNTED_STATUSES.has(m.status)) continue;
    if (m.stage !== undefined && !COUNTED_STAGES.has(m.stage)) continue;
    if (m.homeTeamId === null || m.awayTeamId === null) continue;
    if (m.homeScore === null || m.awayScore === null) continue;

    accumulate(rows.get(m.homeTeamId), m.homeScore, m.awayScore, points);
    accumulate(rows.get(m.awayTeamId), m.awayScore, m.homeScore, points);
  }

  // Partiziona per girone, ordina con i tie-break e assegna la posizione.
  const partitions = new Map<string, StandingRowComputed[]>();
  for (const row of rows.values()) {
    const key = row.groupId ?? '';
    const part = partitions.get(key);
    if (part) part.push(row);
    else partitions.set(key, [row]);
  }

  const result: StandingRowComputed[] = [];
  for (const key of [...partitions.keys()].sort()) {
    const part = partitions.get(key)!;
    part.sort(compareStandings);
    part.forEach((row, i) => {
      row.position = i + 1;
    });
    result.push(...part);
  }

  return result;
}

function accumulate(
  row: StandingRowComputed | undefined,
  goalsFor: number,
  goalsAgainst: number,
  points: PointsConfig,
): void {
  if (!row) return;
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.won += 1;
    row.points += points.win;
  } else if (goalsFor === goalsAgainst) {
    row.drawn += 1;
    row.points += points.draw;
  } else {
    row.lost += 1;
    row.points += points.loss;
  }
}

function compareStandings(
  a: StandingRowComputed,
  b: StandingRowComputed,
): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference)
    return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  if (b.won !== a.won) return b.won - a.won;
  if (a.teamId < b.teamId) return -1;
  if (a.teamId > b.teamId) return 1;
  return 0;
}
