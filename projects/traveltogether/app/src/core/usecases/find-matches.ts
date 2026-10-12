// Il motore di matching — il cuore del prodotto.
//
// Funzione pura: nessun I/O, nessuna rete, nessun orologio, nessuna mutazione
// degli input. Stessi input, stesso output, sempre. E' questa proprieta' che
// rende il pezzo di maggior valore anche quello verificabile al 100%.

import type { MatchRequest, Result, SeatOffer, TripRequest } from '../domain';
import { err, ok, parseUtcInstant } from '../domain';
import type { MatchConfig } from './match-config';

/** Gli stati di una candidatura che impediscono di riproporre quell'offerta. */
const STATI_BLOCCANTI: readonly MatchRequest['status'][] = ['pending', 'accepted'];

const MILLIS_PER_MINUTO = 60_000;

export interface ScoredMatch {
  /** L'offerta, per reference: non si copia cio' che non si trasforma. */
  readonly offer: SeatOffer;
  /** Intero. Piu' alto = match migliore. **Guida l'ordine**, non lo accompagna. */
  readonly score: number;
  /** Distanza assoluta fra gli orari di partenza, in millisecondi interi. */
  readonly millisApart: number;
  /** Se chi offre appartiene allo stesso stabilimento di chi cerca. */
  readonly sameOwnerPlant: boolean;
}

export type MatchError =
  | { readonly kind: 'invalid-request-departure-at'; readonly value: string }
  | { readonly kind: 'invalid-tolerance'; readonly toleranceMinutes: number };

/**
 * Le offerte compatibili con la richiesta, ordinate dalla migliore alla peggiore.
 *
 * **Precondizione:** i `tripId` delle offerte sono distinti. L'ordine totale usa
 * `tripId` come ultima chiave, quindi due offerte con lo stesso id tornerebbero a
 * dipendere dall'ordine di input. E' garantito dalla proiezione che le produce
 * (`listOpenOffers` legge uno storage indicizzato per id), ma va dichiarato.
 *
 * Ritorna `err` quando la domanda stessa non ha senso — istante malformato,
 * tolleranza incoerente — invece di una lista vuota: "nessun collega compatibile"
 * e "non ho potuto cercare" sono due risposte diverse, e confonderle significa
 * mostrare in demo uno stato vuoto plausibile al posto di un errore.
 */
export function findMatches(
  richiesta: TripRequest,
  offerte: readonly SeatOffer[],
  candidature: readonly MatchRequest[],
  config: MatchConfig
): Result<readonly ScoredMatch[], MatchError> {
  const { toleranceMinutes } = config;

  // Si valida prima di usarla: un NaN qui non solleverebbe nulla, farebbe
  // semplicemente fallire ogni confronto e sparire tutti i match in silenzio.
  if (!Number.isInteger(toleranceMinutes) || toleranceMinutes < 0) {
    return err({ kind: 'invalid-tolerance', toleranceMinutes });
  }

  const istanteRichiesto = parseUtcInstant(richiesta.departureAt);
  if (!istanteRichiesto) {
    return err({ kind: 'invalid-request-departure-at', value: richiesta.departureAt });
  }

  const finestra = toleranceMinutes * MILLIS_PER_MINUTO;

  // Dominanza per costruzione, non somma pesata. Il bonus di plant e' derivato
  // dalla finestra e vale un millisecondo piu' del massimo che la vicinanza possa
  // valere: cosi' il peggior match con lo stesso stabilimento batte sempre il
  // migliore con stabilimento diverso, che e' ciò che il criterio dice senza
  // condizioni. Se il bonus fosse configurabile, abbassarlo invertirebbe la
  // semantica del criterio con tutti i test verdi.
  const bonusPlant = finestra + 1;

  const risultati: ScoredMatch[] = [];

  for (const offerta of offerte) {
    // --- Vincoli duri: tratta ---
    if (offerta.fromPlantId !== richiesta.fromPlantId) continue;
    if (offerta.toPlantId !== richiesta.toPlantId) continue;

    // --- Vincoli duri: tempo ---
    const istanteOfferto = parseUtcInstant(offerta.departureAt);
    // Un'offerta con un istante illeggibile si omette: e' un dato incoerente di
    // una riga, e far fallire l'intera ricerca per quella riga sarebbe un degrado
    // sproporzionato. Stessa scelta dell'inner join in listOpenOffers.
    if (!istanteOfferto) continue;
    if (istanteOfferto.date !== istanteRichiesto.date) continue;

    const millisApart = Math.abs(istanteOfferto.millisOfDay - istanteRichiesto.millisOfDay);
    // Confine INCLUSO: con tolleranza 30, trenta minuti esatti sono un match.
    if (millisApart > finestra) continue;

    // --- Vincoli duri: disponibilita' e identita' ---
    if (offerta.seatsAvailable <= 0) continue;
    if (offerta.ownerId === richiesta.requesterId) continue;

    // --- Vincoli duri: candidature gia' in corso ---
    // Si filtra su tripId E requesterId: una candidatura di un altro collega, o su
    // un'altra offerta, non deve nascondere nulla a chi sta cercando.
    const giaCandidato = candidature.some(
      (c) =>
        c.tripId === offerta.tripId &&
        c.requesterId === richiesta.requesterId &&
        STATI_BLOCCANTI.includes(c.status)
    );
    if (giaCandidato) continue;

    const sameOwnerPlant = offerta.ownerPlantId === richiesta.requesterPlantId;

    risultati.push({
      offer: offerta,
      score: finestra - millisApart + (sameOwnerPlant ? bonusPlant : 0),
      millisApart,
      sameOwnerPlant,
    });
  }

  // Si ordina l'array costruito qui, mai quello in ingresso: `offerte` e'
  // readonly nel tipo, ma `sort` muta in place e un array congelato farebbe
  // sollevare a runtime.
  //
  // Ordine TOTALE, non semplicemente stabile: a parita' di punteggio decide il
  // tripId. Un sort stabile conserverebbe l'ordine di input, cioe' ne
  // dipenderebbe — e il criterio chiede l'opposto. Su Postgres, poi, l'ordine
  // delle righe senza ORDER BY non e' garantito: senza ultima chiave la lista si
  // riordinerebbe fra due aperture della stessa schermata.
  risultati.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.offer.tripId < b.offer.tripId ? -1 : a.offer.tripId > b.offer.tripId ? 1 : 0;
  });

  return ok(risultati);
}
