import { describe, it, expect } from 'vitest';
import {
  generateRoundRobin,
  type RoundRobinMatch,
} from '@/lib/tournament/roundRobin';

/** Chiave canonica di una coppia (indipendente da casa/trasferta). */
const pairKey = (m: RoundRobinMatch) =>
  [m.homeId, m.awayId].sort().join('|');

const teams = (n: number) =>
  Array.from({ length: n }, (_, i) => `t${i + 1}`);

describe('generateRoundRobin', () => {
  it('richiede almeno 2 squadre', () => {
    expect(() => generateRoundRobin([])).toThrow();
    expect(() => generateRoundRobin(['t1'])).toThrow();
  });

  it('4 squadre: 3 turni, 6 partite, ogni coppia una volta', () => {
    const matches = generateRoundRobin(teams(4));
    expect(matches).toHaveLength(6); // C(4,2)

    const rounds = new Set(matches.map((m) => m.round));
    expect([...rounds].sort((a, b) => a - b)).toEqual([1, 2, 3]);

    // 2 partite per turno
    for (const r of rounds) {
      expect(matches.filter((m) => m.round === r)).toHaveLength(2);
    }

    // ogni coppia esattamente una volta, nessuna squadra contro se stessa
    const pairs = matches.map(pairKey);
    expect(new Set(pairs).size).toBe(6);
    for (const m of matches) expect(m.homeId).not.toBe(m.awayId);

    // tutte in andata
    expect(matches.every((m) => m.leg === 1)).toBe(true);
  });

  it('6 squadre: 5 turni, 15 partite, ogni coppia una volta', () => {
    const matches = generateRoundRobin(teams(6));
    expect(matches).toHaveLength(15); // C(6,2)
    expect(new Set(matches.map((m) => m.round)).size).toBe(5);
    for (let r = 1; r <= 5; r++) {
      expect(matches.filter((m) => m.round === r)).toHaveLength(3);
    }
    expect(new Set(matches.map(pairKey)).size).toBe(15);
  });

  it('8 squadre: 7 turni, 28 partite', () => {
    const matches = generateRoundRobin(teams(8));
    expect(matches).toHaveLength(28); // C(8,2)
    expect(new Set(matches.map((m) => m.round)).size).toBe(7);
    for (let r = 1; r <= 7; r++) {
      expect(matches.filter((m) => m.round === r)).toHaveLength(4);
    }
    expect(new Set(matches.map(pairKey)).size).toBe(28);
  });

  it('5 squadre (dispari): bye, 10 partite, ogni squadra 4 partite e 1 riposo', () => {
    const ids = teams(5);
    const matches = generateRoundRobin(ids);
    expect(matches).toHaveLength(10); // C(5,2)

    // 5 turni; in ogni turno una squadra riposa -> 2 partite per turno
    expect(new Set(matches.map((m) => m.round)).size).toBe(5);
    for (let r = 1; r <= 5; r++) {
      expect(matches.filter((m) => m.round === r)).toHaveLength(2);
    }

    // nessun BYE tra gli id reali
    for (const m of matches) {
      expect(ids).toContain(m.homeId);
      expect(ids).toContain(m.awayId);
    }

    // ogni squadra gioca 4 partite (una contro ciascun'altra) e riposa 1 turno
    for (const id of ids) {
      const played = matches.filter(
        (m) => m.homeId === id || m.awayId === id,
      );
      expect(played).toHaveLength(4);
      const roundsPlayed = new Set(played.map((m) => m.round));
      expect(roundsPlayed.size).toBe(4); // manca 1 turno = riposo
    }

    expect(new Set(matches.map(pairKey)).size).toBe(10);
  });

  it('doppio girone (4 squadre): 12 partite, ogni coppia due volte con casa/trasferta invertite', () => {
    const matches = generateRoundRobin(teams(4), { doubleRound: true });
    expect(matches).toHaveLength(12); // 2 * C(4,2)

    // 6 turni totali: 1-3 andata, 4-6 ritorno
    expect(new Set(matches.map((m) => m.round)).size).toBe(6);
    expect(matches.filter((m) => m.leg === 1)).toHaveLength(6);
    expect(matches.filter((m) => m.leg === 2)).toHaveLength(6);
    expect(Math.max(...matches.map((m) => m.round))).toBe(6);

    // ogni coppia appare due volte, una per leg, con casa/trasferta invertite
    const byPair = new Map<string, RoundRobinMatch[]>();
    for (const m of matches) {
      const k = pairKey(m);
      byPair.set(k, [...(byPair.get(k) ?? []), m]);
    }
    expect(byPair.size).toBe(6);
    for (const meetings of byPair.values()) {
      expect(meetings).toHaveLength(2);
      const legs = meetings.map((m) => m.leg).sort();
      expect(legs).toEqual([1, 2]);
      const [g1, g2] = meetings;
      // stessi contendenti, casa/trasferta scambiate
      expect(g1.homeId).toBe(g2.awayId);
      expect(g1.awayId).toBe(g2.homeId);
    }
  });

  it('doppio girone (5 squadre dispari): 20 partite', () => {
    const matches = generateRoundRobin(teams(5), { doubleRound: true });
    expect(matches).toHaveLength(20); // 2 * C(5,2)
    expect(matches.filter((m) => m.leg === 1)).toHaveLength(10);
    expect(matches.filter((m) => m.leg === 2)).toHaveLength(10);
  });
});
