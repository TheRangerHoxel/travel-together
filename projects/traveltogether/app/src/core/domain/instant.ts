// Lettura degli istanti, senza Date.
//
// core/ non puo' usare Date ne' Date.now() (lo impone il lint), quindi la forma
// canonica si riconosce con una regex e la si converte con aritmetica intera.
//
// Sta in domain/ e non in usecases/ perche' T04 ("data di partenza nel passato")
// avra' bisogno dello stesso parser: due implementazioni della stessa regola in
// due punti e' il modo in cui divergono — la stessa lezione gia' scritta per
// makeTrip e le regole di creazione di T04.

/**
 * Forma canonica, la stessa che `Clock.now()` promette di produrre:
 * `YYYY-MM-DDTHH:MM:SS(.sss)?Z`.
 *
 * La `Z` e' **obbligatoria** e un offset come `+01:00` viene rifiutato. Non e'
 * pignoleria: il dominio confronta gli istanti come stringhe, e il confronto
 * lessicografico coincide con quello cronologico solo a offset uguale.
 * `2026-11-03T07:00:00+01:00` e `2026-11-03T06:00:00Z` sono lo stesso istante e
 * due stringhe diverse — accettarli entrambi darebbe risposte plausibili e
 * sbagliate. I millisecondi sono opzionali perche' un istante scritto a mano
 * (seed di T17, fixture) spesso non li ha.
 */
const ISTANTE_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/;

export interface Instant {
  /** La parte data, `YYYY-MM-DD`. Confrontabile come stringa. */
  readonly date: string;
  /** Millisecondi dall'inizio del giorno UTC. Intero, 0..86_399_999. */
  readonly millisOfDay: number;
}

/**
 * Converte un istante nella forma canonica. Ritorna `null` se la forma non e'
 * quella: un valore non riconosciuto non viene indovinato.
 *
 * **Si ferma al giorno, deliberatamente.** Il vincolo "data diversa -> nessun
 * match" impone l'uguaglianza della parte data *prima* del calcolo della
 * finestra, quindi la distanza fra due istanti si ottiene dai soli millisecondi
 * nel giorno: niente aritmetica di calendario, niente anni bisestili, niente
 * epoca. Conseguenza dichiarata e messa sotto test: **una finestra che scavalca
 * la mezzanotte UTC non esiste** — le 23:50Z e le 00:10Z del giorno dopo non sono
 * un match nemmeno con trenta minuti di tolleranza.
 *
 * Per lo stesso motivo non si verifica la validita' di calendario: `2026-02-31`
 * passa il controllo di intervallo. Nessun conto attraversa i giorni, quindi non
 * cambierebbe nessun risultato.
 *
 * Nota su UTC: una partenza alle 00:30 ora italiana cade il **giorno prima** in
 * UTC. Per trasferte che partono di mattina e' irrilevante, ma e' il genere di
 * cosa che non si vede se le fixture usano solo orari diurni.
 */
export function parseUtcInstant(value: string): Instant | null {
  const m = ISTANTE_UTC.exec(value);
  if (!m) return null;

  const [, anno, mese, giorno, ore, minuti, secondi, millis] = m;

  // noUncheckedIndexedAccess: i gruppi sono tipati come string | undefined anche
  // quando la regex garantisce che ci siano. Si controlla invece di forzare.
  if (!anno || !mese || !giorno || !ore || !minuti || !secondi) return null;

  const mm = Number(mese);
  const gg = Number(giorno);
  const hh = Number(ore);
  const min = Number(minuti);
  const ss = Number(secondi);
  const ms = millis ? Number(millis) : 0;

  if (mm < 1 || mm > 12) return null;
  if (gg < 1 || gg > 31) return null;
  if (hh > 23 || min > 59 || ss > 59) return null;

  return {
    date: `${anno}-${mese}-${giorno}`,
    millisOfDay: ((hh * 60 + min) * 60 + ss) * 1000 + ms,
  };
}
