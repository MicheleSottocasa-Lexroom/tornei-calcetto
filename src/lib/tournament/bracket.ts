/**
 * Tabellone a eliminazione diretta (implementazione TS di riferimento).
 *
 * Rispecchia la funzione SQL `_build_bracket` / `generate_bracket`
 * (supabase/migrations/0003_engine.sql): in produzione la app usa le RPC,
 * questa versione serve a verificare la correttezza con unit test.
 *
 * Regole:
 * - la dimensione del tabellone è la potenza di 2 successiva a `n` squadre;
 * - i "bye" (byes = size - n) vengono assegnati alle teste di serie migliori
 *   secondo l'ordine di semina standard (`bracketSeedOrder`);
 * - una partita del primo turno con un solo contendente è un bye
 *   (status `walkover`): la squadra presente avanza automaticamente al turno
 *   successivo;
 * - il collegamento tra turni è espresso da (nextRound, nextPosition, nextSlot)
 *   invece che da un id (che in DB è generato a runtime).
 */

export interface BracketMatch {
  /** Turno 1-based (1 = primo turno; l'ultimo è la finale). */
  round: number;
  /** Posizione nel turno, 0-based. */
  bracketPosition: number;
  /** Nome del turno in italiano (Finale, Semifinale, Quarti, ...). */
  roundName: string;
  /** Squadra di casa: null se ancora da determinare (TBD). */
  homeId: string | null;
  /** Squadra ospite: null se ancora da determinare o bye. */
  awayId: string | null;
  status: 'scheduled' | 'walkover';
  /** Vincitore già noto (solo per i bye del primo turno). */
  winnerId: string | null;
  /** Turno della partita che riceve il vincitore (null per la finale). */
  nextRound: number | null;
  /** Posizione della partita che riceve il vincitore. */
  nextPosition: number | null;
  /** Slot destinazione del vincitore: 1 = casa, 2 = ospite. */
  nextSlot: 1 | 2 | null;
  /** Turno della finale 3°/4° posto per il perdente (semifinali). */
  loserNextRound: number | null;
  loserNextPosition: number | null;
  loserNextSlot: 1 | 2 | null;
}

export interface BracketOptions {
  /** Aggiunge la finale 3°/4° posto (richiede almeno 2 turni). */
  thirdPlace?: boolean;
}

/**
 * Ordine di semina standard per un tabellone di dimensione `size`
 * (potenza di 2). Es. size 4 -> [1,4,2,3]; size 8 -> [1,8,4,5,2,7,3,6].
 * Le teste di serie migliori vengono separate il più possibile.
 */
export function bracketSeedOrder(size: number): number[] {
  let order = [1];
  let m = 1;
  while (m < size) {
    const next: number[] = [];
    for (const x of order) {
      next.push(x);
      next.push(2 * m + 1 - x);
    }
    order = next;
    m *= 2;
  }
  return order;
}

/** Nome del turno dato il turno e il numero totale di turni. */
export function bracketRoundName(round: number, total: number): string {
  switch (total - round) {
    case 0:
      return 'Finale';
    case 1:
      return 'Semifinale';
    case 2:
      return 'Quarti';
    case 3:
      return 'Ottavi';
    case 4:
      return 'Sedicesimi';
    default:
      return `Turno ${round}`;
  }
}

/**
 * Costruisce il tabellone a partire da un elenco di id già ordinati per
 * testa di serie (il primo è la testa di serie n.1).
 *
 * @throws se le squadre sono meno di 2
 */
export function buildBracket(
  seedOrderedIds: string[],
  options: BracketOptions = {},
): BracketMatch[] {
  const n = seedOrderedIds.length;
  if (n < 2) {
    throw new Error('Servono almeno 2 squadre per il tabellone');
  }

  // Dimensione = potenza di 2 successiva a n; byes = size - n.
  let size = 1;
  while (size < n) size *= 2;
  const rounds = Math.round(Math.log2(size));

  // Piazzamento delle squadre negli slot del primo turno secondo la semina.
  const order = bracketSeedOrder(size);
  const seeded: (string | null)[] = order.map((x) =>
    x <= n ? seedOrderedIds[x - 1] : null,
  );

  // Genera gli "shell" di tutti i turni con il collegamento al turno seguente.
  const matches: BracketMatch[] = [];
  let slots = size / 2;
  for (let r = 1; r <= rounds; r++) {
    const isLast = r === rounds;
    for (let p = 0; p < slots; p++) {
      matches.push({
        round: r,
        bracketPosition: p,
        roundName: bracketRoundName(r, rounds),
        homeId: null,
        awayId: null,
        status: 'scheduled',
        winnerId: null,
        nextRound: isLast ? null : r + 1,
        nextPosition: isLast ? null : Math.floor(p / 2),
        nextSlot: isLast ? null : ((1 + (p % 2)) as 1 | 2),
        loserNextRound: null,
        loserNextPosition: null,
        loserNextSlot: null,
      });
    }
    slots = Math.floor(slots / 2);
  }

  const find = (round: number, pos: number): BracketMatch =>
    matches.find((m) => m.round === round && m.bracketPosition === pos)!;

  // Accoppiamenti del primo turno.
  for (let p = 0; p < size / 2; p++) {
    const m = find(1, p);
    m.homeId = seeded[2 * p];
    m.awayId = seeded[2 * p + 1];
  }

  // Gestione bye: partita del primo turno con un solo contendente ->
  // walkover, la squadra presente avanza al turno successivo.
  for (let p = 0; p < size / 2; p++) {
    const m = find(1, p);
    const hasHome = m.homeId !== null;
    const hasAway = m.awayId !== null;
    if (hasHome !== hasAway) {
      m.status = 'walkover';
      m.winnerId = m.homeId ?? m.awayId;
      if (m.nextRound !== null && m.nextPosition !== null) {
        const nm = find(m.nextRound, m.nextPosition);
        if (m.nextSlot === 1) nm.homeId = m.winnerId;
        else nm.awayId = m.winnerId;
      }
    }
  }

  // Finale 3°/4° posto opzionale: i perdenti delle semifinali confluiscono qui.
  const thirdPlace = options.thirdPlace ?? false;
  if (thirdPlace && rounds >= 2) {
    matches.push({
      round: rounds,
      bracketPosition: 1,
      roundName: 'Finale 3/4',
      homeId: null,
      awayId: null,
      status: 'scheduled',
      winnerId: null,
      nextRound: null,
      nextPosition: null,
      nextSlot: null,
      loserNextRound: null,
      loserNextPosition: null,
      loserNextSlot: null,
    });
    for (const semi of matches.filter((m) => m.round === rounds - 1)) {
      semi.loserNextRound = rounds;
      semi.loserNextPosition = 1;
      semi.loserNextSlot = (1 + (semi.bracketPosition % 2)) as 1 | 2;
    }
  }

  return matches;
}
