// Il motore di matching — il cuore del prodotto.
//
// Funzione pura: nessun I/O, nessuna rete, nessun orologio, nessuna mutazione
// degli input. Stessi input, stesso output, sempre. E' questa proprieta' che
// rende il pezzo di maggior valore anche quello verificabile al 100%.

import type {
  MatchRequest,
  MatchRequestStatus,
  Result,
  SeatOffer,
  TripRequest,
} from '../domain';
import { err, legDirectionRank, ok, utcInstantParts } from '../domain';
import type { MatchConfig } from './match-config';

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
  /**
   * Lo stato della candidatura del richiedente su QUESTA tratta, oppure `null` se
   * non si e' mai candidato. Le candidature `pending`, `accepted` e `rejected`
   * non fanno sparire l'offerta: tornano marcate, cosi' la lista puo' mostrarle
   * come gia' richieste o rifiutate. Una `cancelled` NON marca: l'offerta risulta
   * candidabile, come se la riga non ci fosse. Non entra nel punteggio.
   */
  readonly requestStatus: MatchRequestStatus | null;
}

export type MatchError = { readonly kind: 'invalid-tolerance'; readonly toleranceMinutes: number };

/**
 * Le offerte compatibili con la richiesta, ordinate dalla migliore alla peggiore.
 *
 * **Precondizione:** le coppie (`tripId`, `direction`) delle offerte sono distinte.
 * L'ordine totale usa l'identita' di tratta come ultima chiave, quindi due offerte
 * con la stessa coppia tornerebbero a dipendere dall'ordine di input. E' garantito
 * dalla proiezione che le produce (`listOpenOffers` emette una offerta per tratta,
 * e la tratta e' unica per costruzione), ma va dichiarato.
 *
 * Ritorna `err` quando la domanda stessa non ha senso — tolleranza incoerente —
 * invece di una lista vuota: "nessun collega compatibile" e "non ho potuto
 * cercare" sono due risposte diverse, e confonderle significa mostrare in demo
 * uno stato vuoto plausibile al posto di un errore. Un istante malformato non e'
 * piu' un caso: la garanzia e' passata al tipo `UtcInstant`.
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

  const istanteRichiesto = utcInstantParts(richiesta.departureAt);

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
    // L'istante e' un `UtcInstant`: la sua validita' e' garantita dal tipo, quindi
    // qui non c'e' un ramo "illeggibile" da omettere in silenzio.
    const istanteOfferto = utcInstantParts(offerta.departureAt);
    if (istanteOfferto.date !== istanteRichiesto.date) continue;

    const millisApart = Math.abs(istanteOfferto.millisOfDay - istanteRichiesto.millisOfDay);
    // Confine INCLUSO: con tolleranza 30, trenta minuti esatti sono un match.
    if (millisApart > finestra) continue;

    // --- Vincoli duri: disponibilita' e identita' ---
    // PRECEDENZA DICHIARATA, perche' due criteri di T04b tirano in direzioni
    // opposte e l'ordine di queste righe decide quale vince: "posti esauriti ->
    // nessun match" (vincolo duro di T03, non emendato) precede "la candidatura
    // marca invece di filtrare". Conseguenza: chi ha una candidatura accepted
    // sull'ultimo posto NON vede piu' quell'offerta in lista, perche' la tratta e'
    // a zero. E' deliberato: il criterio emendato dice di non omettere *a causa
    // della candidatura*, e qui si omette per i posti. La vista di chi si e'
    // candidato e' listByRequester (T13), non questa lista.
    if (offerta.seatsAvailable <= 0) continue;
    if (offerta.ownerId === richiesta.requesterId) continue;

    // --- Stato della candidatura: marca, non filtra ---
    // La corrispondenza e' per TRATTA (tripId + direction) e per richiedente: una
    // candidatura di un altro collega, su un'altra trasferta o sull'altra tratta
    // della stessa trasferta non marca niente. `cancelled` non conta come riga.
    const requestStatus =
      candidature.find(
        (c) =>
          c.tripId === offerta.tripId &&
          c.direction === offerta.direction &&
          c.requesterId === richiesta.requesterId &&
          c.status !== 'cancelled'
      )?.status ?? null;

    const sameOwnerPlant = offerta.ownerPlantId === richiesta.requesterPlantId;

    risultati.push({
      offer: offerta,
      score: finestra - millisApart + (sameOwnerPlant ? bonusPlant : 0),
      millisApart,
      sameOwnerPlant,
      requestStatus,
    });
  }

  // Si ordina l'array costruito qui, mai quello in ingresso: `offerte` e'
  // readonly nel tipo, ma `sort` muta in place e un array congelato farebbe
  // sollevare a runtime.
  //
  // Ordine TOTALE, non semplicemente stabile: a parita' di punteggio decide
  // l'identita' di tratta. Un sort stabile conserverebbe l'ordine di input, cioe' ne
  // dipenderebbe — e il criterio chiede l'opposto. Su Postgres, poi, l'ordine
  // delle righe senza ORDER BY non e' garantito: senza ultima chiave la lista si
  // riordinerebbe fra due aperture della stessa schermata.
  risultati.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Identita' di tratta in DUE passaggi (tripId, poi rango della direzione) e non
    // tripId da solo: una trasferta con rientro produce due offerte con lo stesso
    // tripId, e con un'unica chiave su tripId il comparatore tornerebbe 0 fra loro.
    // Due passaggi invece di legKey: nessuna precondizione sul contenuto degli id.
    if (a.offer.tripId !== b.offer.tripId) return a.offer.tripId < b.offer.tripId ? -1 : 1;
    return legDirectionRank(a.offer.direction) - legDirectionRank(b.offer.direction);
  });

  return ok(risultati);
}
