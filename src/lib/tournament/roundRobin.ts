/**
 * Girone all'italiana — metodo del cerchio (implementazione TS di riferimento).
 *
 * Rispecchia la RPC SQL `generate_round_robin` (supabase/migrations/0003_engine.sql):
 * in produzione la app usa la RPC; questa versione serve a verificare la
 * correttezza dell'algoritmo con unit test e come utility lato client.
 *
 * Regole:
 * - numero dispari di squadre -> si aggiunge un "riposo" (BYE); la squadra
 *   accoppiata al BYE salta il turno (nessuna partita generata);
 * - la casa/trasferta si alterna a ogni turno per bilanciare;
 * - `doubleRound` -> secondo girone di ritorno (leg = 2) con casa/trasferta
 *   invertite rispetto all'andata.
 */

export interface RoundRobinMatch {
  /** Numero di turno progressivo (1-based); il ritorno continua la numerazione. */
  round: number;
  /** 1 = andata, 2 = ritorno. */
  leg: number;
  homeId: string;
  awayId: string;
}

export interface RoundRobinOptions {
  /** Genera anche il girone di ritorno con casa/trasferta invertite. */
  doubleRound?: boolean;
}

/**
 * Genera il calendario di un girone all'italiana.
 *
 * @param teamIds elenco degli id squadra (ordine = ordine di semina)
 * @throws se le squadre sono meno di 2
 */
export function generateRoundRobin(
  teamIds: string[],
  options: RoundRobinOptions = {},
): RoundRobinMatch[] {
  const doubleRound = options.doubleRound ?? false;

  if (teamIds.length < 2) {
    throw new Error('Servono almeno 2 squadre');
  }

  // Con numero dispari si aggiunge un segnaposto BYE (null): la squadra
  // accoppiata al BYE riposa in quel turno.
  const ids: (string | null)[] = [...teamIds];
  if (ids.length % 2 === 1) ids.push(null);

  const n = ids.length;
  const half = n / 2;
  const legs = doubleRound ? 2 : 1;
  const matches: RoundRobinMatch[] = [];

  for (let lg = 1; lg <= legs; lg++) {
    // Ad ogni girone si riparte dall'ordine iniziale.
    let arr = [...ids];
    const roundOffset = (lg - 1) * (n - 1);

    for (let r = 0; r <= n - 2; r++) {
      for (let i = 0; i <= half - 1; i++) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        if (a !== null && b !== null) {
          const round = roundOffset + r + 1;
          // Alterna casa/trasferta per turno; il ritorno inverte la parità.
          if ((r + lg) % 2 === 0) {
            matches.push({ round, leg: lg, homeId: a, awayId: b });
          } else {
            matches.push({ round, leg: lg, homeId: b, awayId: a });
          }
        }
      }
      // Rotazione del cerchio: si fissa il primo elemento e si ruotano gli altri.
      // [a0, a1, ..., a_{n-1}] -> [a0, a_{n-1}, a1, ..., a_{n-2}]
      arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
    }
  }

  return matches;
}
