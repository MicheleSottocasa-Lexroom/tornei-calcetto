import { describe, it, expect } from 'vitest';
import {
  computeStandings,
  DEFAULT_POINTS,
  type StandingMatchInput,
  type StandingTeamInput,
} from '@/lib/tournament/standings';

const team = (id: string): StandingTeamInput => ({
  teamId: id,
  teamName: id.toUpperCase(),
});

const m = (
  homeTeamId: string,
  homeScore: number,
  awayScore: number,
  awayTeamId: string,
): StandingMatchInput => ({
  homeTeamId,
  awayTeamId,
  homeScore,
  awayScore,
  status: 'finished',
  stage: 'round_robin',
});

const byId = (rows: ReturnType<typeof computeStandings>) =>
  new Map(rows.map((r) => [r.teamId, r]));

describe('computeStandings', () => {
  it('calcola punti, gol, DR e posizioni con tie-break sulla DR', () => {
    const teams = [team('a'), team('b'), team('c'), team('d')];
    const matches = [
      m('a', 3, 1, 'b'),
      m('a', 2, 0, 'c'),
      m('a', 1, 1, 'd'),
      m('b', 2, 2, 'c'),
      m('b', 4, 0, 'd'),
      m('c', 1, 0, 'd'),
    ];
    const rows = computeStandings(teams, matches);
    const t = byId(rows);

    expect(t.get('a')).toMatchObject({
      played: 3,
      won: 2,
      drawn: 1,
      lost: 0,
      goalsFor: 6,
      goalsAgainst: 2,
      goalDifference: 4,
      points: 7,
      position: 1,
    });
    expect(t.get('b')).toMatchObject({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      goalsFor: 7,
      goalsAgainst: 5,
      goalDifference: 2,
      points: 4,
      position: 2,
    });
    expect(t.get('c')).toMatchObject({
      goalDifference: -1,
      points: 4,
      position: 3, // stessi punti di B ma DR peggiore
    });
    expect(t.get('d')).toMatchObject({ points: 1, position: 4 });

    // l'array è restituito già ordinato per posizione
    expect(rows.map((r) => r.teamId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a parità totale ordina per team_id (deterministico)', () => {
    const rows = computeStandings([team('e'), team('f')], [m('e', 1, 1, 'f')]);
    // entrambe: 1pt, DR 0, GF 1, 0 vittorie -> vince team_id minore
    expect(rows.map((r) => r.teamId)).toEqual(['e', 'f']);
    expect(rows[0].position).toBe(1);
    expect(rows[1].position).toBe(2);
  });

  it('tie-break a cascata: DR, poi GF, poi vittorie', () => {
    // x e y: stessi punti (3). x DR +1, y DR +3 -> y sopra per DR
    // z e w: stessi punti (3) e stessa DR (+2), ma z GF 5 vs w GF 2 -> z per GF
    const teams = [team('x'), team('y'), team('z'), team('w')];
    const matches: StandingMatchInput[] = [
      { homeTeamId: 'x', awayTeamId: 'y', homeScore: 0, awayScore: 0, status: 'finished', stage: 'group' },
    ];
    // costruiamo risultati "sintetici" contro avversari fittizi non in classifica
    // (verranno ignorati perché non presenti tra le squadre)
    const push = (id: string, gf: number, ga: number) =>
      matches.push({ homeTeamId: id, awayTeamId: 'ghost', homeScore: gf, awayScore: ga, status: 'finished', stage: 'group' });
    // ripuliamo il match iniziale: ricominciamo da vuoto
    matches.length = 0;
    push('x', 2, 1); // DR +1, 1 vittoria
    push('y', 4, 1); // DR +3, 1 vittoria
    push('z', 5, 3); // DR +2, GF 5
    push('w', 3, 1); // DR +2, GF 3

    const rows = computeStandings(teams, matches);
    // tutte 3 punti (1 vittoria a testa); ordine: y(+3), z(+2,GF5), w(+2,GF3), x(+1)
    expect(rows.map((r) => r.teamId)).toEqual(['y', 'z', 'w', 'x']);
  });

  it('le squadre senza partite compaiono con valori a zero', () => {
    const rows = computeStandings([team('a'), team('b')], []);
    for (const r of rows) {
      expect(r).toMatchObject({ played: 0, points: 0, goalDifference: 0 });
    }
    // ordine deterministico per team_id
    expect(rows.map((r) => r.teamId)).toEqual(['a', 'b']);
    expect(rows.map((r) => r.position)).toEqual([1, 2]);
  });

  it('rispetta una configurazione punti personalizzata', () => {
    const rows = computeStandings(
      [team('a'), team('b')],
      [m('a', 1, 0, 'b')],
      { win: 2, draw: 1, loss: 0 },
    );
    const t = byId(rows);
    expect(t.get('a')!.points).toBe(2); // vittoria = 2
    expect(t.get('b')!.points).toBe(0);
    expect(DEFAULT_POINTS).toEqual({ win: 3, draw: 1, loss: 0 });
  });

  it('esclude knockout e partite non concluse', () => {
    const teams = [team('a'), team('b')];
    const matches: StandingMatchInput[] = [
      { homeTeamId: 'a', awayTeamId: 'b', homeScore: 5, awayScore: 0, status: 'scheduled', stage: 'round_robin' },
      { homeTeamId: 'a', awayTeamId: 'b', homeScore: 3, awayScore: 0, status: 'finished', stage: 'knockout' },
      { homeTeamId: 'a', awayTeamId: 'b', homeScore: 1, awayScore: 0, status: 'finished', stage: 'round_robin' },
    ];
    const rows = computeStandings(teams, matches);
    const t = byId(rows);
    // conta solo l'ultima partita (round_robin, finished)
    expect(t.get('a')).toMatchObject({ played: 1, points: 3, goalsFor: 1 });
    expect(t.get('b')).toMatchObject({ played: 1, points: 0 });
  });

  it('conta i walkover come partite valide', () => {
    const rows = computeStandings(
      [team('a'), team('b')],
      [{ homeTeamId: 'a', awayTeamId: 'b', homeScore: 3, awayScore: 0, status: 'walkover', stage: 'group' }],
    );
    const t = byId(rows);
    expect(t.get('a')).toMatchObject({ played: 1, won: 1, points: 3 });
  });

  it('partiziona per girone assegnando posizioni indipendenti', () => {
    const teams: StandingTeamInput[] = [
      { teamId: 'a1', teamName: 'A1', groupId: 'g1' },
      { teamId: 'a2', teamName: 'A2', groupId: 'g1' },
      { teamId: 'b1', teamName: 'B1', groupId: 'g2' },
      { teamId: 'b2', teamName: 'B2', groupId: 'g2' },
    ];
    const matches: StandingMatchInput[] = [
      { homeTeamId: 'a1', awayTeamId: 'a2', homeScore: 2, awayScore: 0, status: 'finished', stage: 'group' },
      { homeTeamId: 'b2', awayTeamId: 'b1', homeScore: 1, awayScore: 0, status: 'finished', stage: 'group' },
    ];
    const rows = computeStandings(teams, matches);
    const t = byId(rows);
    // ogni girone ha il suo 1° e 2°
    expect(t.get('a1')!.position).toBe(1);
    expect(t.get('a2')!.position).toBe(2);
    expect(t.get('b2')!.position).toBe(1);
    expect(t.get('b1')!.position).toBe(2);
  });
});
