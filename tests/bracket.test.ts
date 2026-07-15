import { describe, it, expect } from 'vitest';
import {
  buildBracket,
  bracketSeedOrder,
  bracketRoundName,
  type BracketMatch,
} from '@/lib/tournament/bracket';

const teams = (n: number) =>
  Array.from({ length: n }, (_, i) => `s${i + 1}`);

const at = (ms: BracketMatch[], round: number, pos: number) =>
  ms.find((m) => m.round === round && m.bracketPosition === pos)!;

describe('bracketSeedOrder', () => {
  it('produce l\'ordine di semina standard', () => {
    expect(bracketSeedOrder(2)).toEqual([1, 2]);
    expect(bracketSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(bracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(bracketSeedOrder(16)).toEqual([
      1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11,
    ]);
  });
});

describe('bracketRoundName', () => {
  it('nomina i turni in italiano', () => {
    expect(bracketRoundName(3, 3)).toBe('Finale');
    expect(bracketRoundName(2, 3)).toBe('Semifinale');
    expect(bracketRoundName(1, 3)).toBe('Quarti');
    expect(bracketRoundName(1, 4)).toBe('Ottavi');
    expect(bracketRoundName(1, 5)).toBe('Sedicesimi');
    expect(bracketRoundName(1, 6)).toBe('Turno 1');
  });
});

describe('buildBracket', () => {
  it('richiede almeno 2 squadre', () => {
    expect(() => buildBracket([])).toThrow();
    expect(() => buildBracket(['s1'])).toThrow();
  });

  it('2 squadre: una sola finale', () => {
    const ms = buildBracket(teams(2));
    expect(ms).toHaveLength(1);
    const f = ms[0];
    expect(f.round).toBe(1);
    expect(f.roundName).toBe('Finale');
    expect(f.homeId).toBe('s1');
    expect(f.awayId).toBe('s2');
    expect(f.nextRound).toBeNull();
    expect(f.status).toBe('scheduled');
  });

  it('4 squadre (potenza di 2): 2 turni, semine 1-4 / 2-3, nessun bye', () => {
    const ms = buildBracket(teams(4));
    expect(ms).toHaveLength(3); // 2 semifinali + 1 finale
    expect(ms.filter((m) => m.round === 1)).toHaveLength(2);
    expect(ms.filter((m) => m.round === 2)).toHaveLength(1);

    // accoppiamenti: (1 vs 4) e (2 vs 3)
    expect(at(ms, 1, 0).homeId).toBe('s1');
    expect(at(ms, 1, 0).awayId).toBe('s4');
    expect(at(ms, 1, 1).homeId).toBe('s2');
    expect(at(ms, 1, 1).awayId).toBe('s3');

    // nessun bye
    expect(ms.every((m) => m.status === 'scheduled')).toBe(true);

    // collegamento verso la finale
    expect(at(ms, 1, 0).nextRound).toBe(2);
    expect(at(ms, 1, 0).nextPosition).toBe(0);
    expect(at(ms, 1, 0).nextSlot).toBe(1);
    expect(at(ms, 1, 1).nextSlot).toBe(2);
    expect(at(ms, 2, 0).nextRound).toBeNull();

    // la finale parte con entrambi gli slot TBD
    expect(at(ms, 2, 0).homeId).toBeNull();
    expect(at(ms, 2, 0).awayId).toBeNull();
  });

  it('8 squadre: 3 turni, accoppiamenti standard dei quarti', () => {
    const ms = buildBracket(teams(8));
    expect(ms.filter((m) => m.round === 1)).toHaveLength(4);
    expect(ms.filter((m) => m.round === 2)).toHaveLength(2);
    expect(ms.filter((m) => m.round === 3)).toHaveLength(1);

    expect(ms.filter((m) => m.round === 1).map((m) => m.roundName)[0]).toBe(
      'Quarti',
    );

    // coppie del primo turno: (1,8)(4,5)(2,7)(3,6)
    const pairs = [0, 1, 2, 3].map((p) => [at(ms, 1, p).homeId, at(ms, 1, p).awayId]);
    expect(pairs).toEqual([
      ['s1', 's8'],
      ['s4', 's5'],
      ['s2', 's7'],
      ['s3', 's6'],
    ]);
    expect(ms.every((m) => m.status === 'scheduled')).toBe(true);
  });

  it('linkage coerente per ogni partita non finale', () => {
    const ms = buildBracket(teams(8));
    const rounds = Math.max(...ms.map((m) => m.round));
    for (const m of ms) {
      if (m.round === rounds) {
        expect(m.nextRound).toBeNull();
      } else {
        expect(m.nextRound).toBe(m.round + 1);
        expect(m.nextPosition).toBe(Math.floor(m.bracketPosition / 2));
        expect(m.nextSlot).toBe(1 + (m.bracketPosition % 2));
      }
    }
  });

  it('5 squadre: size 8, 3 bye alle teste di serie migliori con avanzamento', () => {
    const ms = buildBracket(teams(5));
    // dimensione 8 -> 3 turni
    expect(ms.filter((m) => m.round === 1)).toHaveLength(4);

    // 3 bye (walkover) nel primo turno
    const byes = ms.filter((m) => m.round === 1 && m.status === 'walkover');
    expect(byes).toHaveLength(3); // size(8) - n(5)

    // seed order [1,8,4,5,2,7,3,6] con n=5 -> null dove seed>5
    // coppie: (s1,-)(s4,s5)(s2,-)(s3,-)
    expect(at(ms, 1, 0).homeId).toBe('s1');
    expect(at(ms, 1, 0).awayId).toBeNull();
    expect(at(ms, 1, 0).winnerId).toBe('s1');
    expect(at(ms, 1, 1).homeId).toBe('s4');
    expect(at(ms, 1, 1).awayId).toBe('s5');
    expect(at(ms, 1, 1).status).toBe('scheduled');
    expect(at(ms, 1, 2).homeId).toBe('s2');
    expect(at(ms, 1, 2).awayId).toBeNull();
    expect(at(ms, 1, 3).homeId).toBe('s3');
    expect(at(ms, 1, 3).awayId).toBeNull();

    // i vincitori dei bye avanzano in semifinale
    // semifinale 0 = winner(0) casa, winner(1) ospite
    expect(at(ms, 2, 0).homeId).toBe('s1'); // bye avanzato
    expect(at(ms, 2, 0).awayId).toBeNull(); // dipende da s4/s5
    // semifinale 1 = winner(2) casa, winner(3) ospite (entrambi bye)
    expect(at(ms, 2, 1).homeId).toBe('s2');
    expect(at(ms, 2, 1).awayId).toBe('s3');
  });

  it('6 squadre: size 8, 2 bye', () => {
    const ms = buildBracket(teams(6));
    const byes = ms.filter((m) => m.round === 1 && m.status === 'walkover');
    expect(byes).toHaveLength(2); // 8 - 6

    // seed order [1,8,4,5,2,7,3,6], n=6 -> seed 7 e 8 = null
    // coppie: (s1,-)(s4,s5)(s2,-)(s3,s6)
    expect(at(ms, 1, 0).awayId).toBeNull();
    expect(at(ms, 1, 0).winnerId).toBe('s1');
    expect(at(ms, 1, 2).awayId).toBeNull();
    expect(at(ms, 1, 2).winnerId).toBe('s2');
    expect(at(ms, 1, 1).awayId).toBe('s5');
    expect(at(ms, 1, 3).awayId).toBe('s6');

    // teste di serie con bye promosse in semifinale
    expect(at(ms, 2, 0).homeId).toBe('s1');
    expect(at(ms, 2, 1).homeId).toBe('s2');
  });

  it('finale 3°/4° posto opzionale (4 squadre)', () => {
    const ms = buildBracket(teams(4), { thirdPlace: true });
    const third = ms.find((m) => m.roundName === 'Finale 3/4');
    expect(third).toBeDefined();
    expect(third!.round).toBe(2);
    expect(third!.bracketPosition).toBe(1);

    // le semifinali indirizzano i perdenti alla finale 3/4
    for (const semi of ms.filter((m) => m.round === 1)) {
      expect(semi.loserNextRound).toBe(2);
      expect(semi.loserNextPosition).toBe(1);
      expect(semi.loserNextSlot).toBe(1 + (semi.bracketPosition % 2));
    }
  });
});
