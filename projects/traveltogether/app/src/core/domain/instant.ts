// L'istante normalizzato al confine, senza Date.
//
// core/ non puo' usare Date ne' Date.now() (lo impone il lint), quindi la forma si
// riconosce con una regex e la si converte con aritmetica intera.
//
// UN PUNTO SOLO. `normalizeUtcInstant` e' l'unico posto che legge una stringa
// grezza e decide se e' un istante. Lo chiamano solo i confini da cui una stringa
// entra (createTrip, da T09 l'adapter Supabase); tutti gli altri ricevono un
// `UtcInstant` e leggono data, millisecondi e ordine da funzioni totali.
//
// LA FORMA CANONICA e' `YYYY-MM-DDTHH:mm:ss.sssZ`: sempre i millisecondi, 24
// caratteri. La larghezza fissa e' l'unica proprieta' da cui segue che l'ordine
// lessicografico coincide con quello cronologico: `...T06:00:00Z` e
// `...T06:00:00.000Z` sono lo stesso istante e, come stringhe, si ordinerebbero al
// contrario (`Z` e' 0x5A, `.` e' 0x2E).

import { civilDayNumber } from './calendar';
import { type Result, err, ok } from './result';

declare const marchioUtc: unique symbol;

/**
 * Un istante gia' normalizzato: la stringa canonica di 24 caratteri. Il marchio e'
 * un `unique symbol`: una `string` qualunque, o un letterale d'oggetto, non e'
 * assegnabile. Si ottiene solo da `normalizeUtcInstant`.
 */
export type UtcInstant = string & { readonly [marchioUtc]: true };

export type UtcInstantError =
  /** Non ha la forma di un istante, o un campo e' fuori intervallo (mese 13, ora 24). */
  | { readonly kind: 'malformed-instant'; readonly value: string }
  /** Ha un offset diverso da `Z` e `+00:00`: non lo si converte, lo si rifiuta. */
  | { readonly kind: 'non-utc-offset'; readonly value: string }
  /** Forma e intervalli giusti, ma la data non esiste (`2026-02-31`). */
  | { readonly kind: 'impossible-date'; readonly value: string };

/**
 * Cio' che PostgREST produce (`+00:00`, da uno a sei decimali senza zeri finali) e
 * cio' che `toISOString()` produce (`Z`, tre decimali), piu' la `Z` senza decimali
 * delle fixture scritte a mano. Ogni altro offset e' catturato per essere
 * distinto da una stringa malformata.
 */
const ISTANTE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;

const LARGHEZZA_CANONICA = 24;

/**
 * Type predicate interno: l'unico punto in cui una stringa diventa `UtcInstant`,
 * senza `as`. Verifica la sola larghezza: vale solo sull'uscita costruita da
 * `normalizeUtcInstant` dopo la validazione, mai su una stringa qualunque.
 */
function haLarghezzaCanonica(valore: string): valore is UtcInstant {
  return valore.length === LARGHEZZA_CANONICA;
}

/**
 * Valida un istante grezzo e lo riporta alla forma canonica.
 *
 * Accetta `Z` e `+00:00`, con da zero a sei decimali; **tronca** oltre il
 * millisecondo (non arrotonda: `23:59:59.9999` porterebbe il riporto sul giorno,
 * sul mese e sull'anno, cioe' aritmetica di calendario per un millisecondo).
 * Rifiuta ogni altro offset, `-00:00` compreso (RFC 3339: offset locale ignoto).
 *
 * Gli errori portano il valore **grezzo**, quello che il chiamante ha mandato.
 */
export function normalizeUtcInstant(value: string): Result<UtcInstant, UtcInstantError> {
  const m = ISTANTE.exec(value);
  if (!m) return err({ kind: 'malformed-instant', value });

  const [, anno, mese, giorno, ore, minuti, secondi, decimali, offset] = m;

  // noUncheckedIndexedAccess: i gruppi sono tipati string | undefined anche quando
  // la regex garantisce che ci siano. Si controlla invece di forzare.
  if (!anno || !mese || !giorno || !ore || !minuti || !secondi || !offset) {
    return err({ kind: 'malformed-instant', value });
  }

  if (offset !== 'Z' && offset !== '+00:00') {
    return err({ kind: 'non-utc-offset', value });
  }

  const mm = Number(mese);
  const gg = Number(giorno);
  if (mm < 1 || mm > 12) return err({ kind: 'malformed-instant', value });
  if (gg < 1 || gg > 31) return err({ kind: 'malformed-instant', value });
  if (Number(ore) > 23 || Number(minuti) > 59 || Number(secondi) > 59) {
    return err({ kind: 'malformed-instant', value });
  }

  const data = `${anno}-${mese}-${giorno}`;
  if (civilDayNumber(data) === null) return err({ kind: 'impossible-date', value });

  const millis = (decimali ?? '').padEnd(3, '0').slice(0, 3);
  const canonico = `${data}T${ore}:${minuti}:${secondi}.${millis}Z`;

  if (!haLarghezzaCanonica(canonico)) return err({ kind: 'malformed-instant', value });
  return ok(canonico);
}

export interface InstantParts {
  /** La parte data, `YYYY-MM-DD`. Confrontabile come stringa. */
  readonly date: string;
  /** Millisecondi dall'inizio del giorno UTC. Intero, 0..86_399_999. */
  readonly millisOfDay: number;
}

/**
 * Data e millisecondi nel giorno di un istante normalizzato. **Totale**: il tipo
 * garantisce la forma, quindi non ha un caso di errore.
 *
 * Si ferma al giorno, deliberatamente. Il vincolo "data diversa -> nessun match"
 * impone l'uguaglianza della parte data *prima* del calcolo della finestra, quindi
 * la distanza fra due istanti si ottiene dai soli millisecondi nel giorno: niente
 * aritmetica di calendario, niente epoca. Conseguenza dichiarata e messa sotto
 * test: **una finestra che scavalca la mezzanotte UTC non esiste**.
 *
 * Nota su UTC: una partenza alle 00:30 ora italiana cade il **giorno prima** in
 * UTC.
 */
export function utcInstantParts(instant: UtcInstant): InstantParts {
  const ore = Number(instant.slice(11, 13));
  const minuti = Number(instant.slice(14, 16));
  const secondi = Number(instant.slice(17, 19));
  const millis = Number(instant.slice(20, 23));
  return {
    date: instant.slice(0, 10),
    millisOfDay: ((ore * 60 + minuti) * 60 + secondi) * 1000 + millis,
  };
}

/**
 * Confronto cronologico: negativo, zero o positivo. **Totale.** A larghezza fissa
 * il confronto lessicografico e' quello cronologico, senza eccezioni.
 */
export function compareUtcInstants(a: UtcInstant, b: UtcInstant): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
