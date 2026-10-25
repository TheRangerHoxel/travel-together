// Candidatura a un posto di una tratta.
//
// Le regole di forma della nota sono di makeMatchRequest e qui non si ripetono: la
// violazione originale viene conservata nell'errore, come fa createTrip con
// 'trip-invariant-violated'.

import {
  type LegDirection,
  type MatchRequest,
  type MatchRequestError,
  type MatchRequestId,
  type MatchRequestStatus,
  type NoteConfig,
  type ProfileId,
  type ResolvedBy,
  type Result,
  type Trip,
  type TripId,
  type TripStatus,
  err,
  makeMatchRequest,
  ok,
  utcInstantParts,
} from '../domain';
import type { MatchRequestRepository, RepositoryError, TripRepository } from '../ports';

export interface RequestSeatInput {
  /** Lo genera chi chiama. Se esiste una `cancelled` si riusa il SUO id e questo viene ignorato. */
  readonly id: MatchRequestId;
  readonly tripId: TripId;
  readonly direction: LegDirection;
  readonly requesterId: ProfileId;
  /** La trasferta di chi si candida: chi si candida sa qual e' la propria. */
  readonly requesterTripId: TripId;
  readonly requestNote: string | null;
}

export interface RequestSeatDeps {
  readonly trips: TripRepository;
  readonly requests: MatchRequestRepository;
}

export type RequestSeatError =
  | { readonly kind: 'leg-not-found'; readonly tripId: TripId; readonly direction: LegDirection }
  /**
   * Esiste gia' una candidatura non annullata. Include `rejected`, anche con
   * `resolvedBy: 'system'`: il reintegro dopo un auto-rifiuto e' automatico e non
   * passa da qui, quindi una nuova richiesta sarebbe una seconda riga in coda.
   */
  | {
      readonly kind: 'already-requested';
      readonly status: MatchRequestStatus;
      readonly resolvedBy: ResolvedBy | null;
    }
  | { readonly kind: 'request-invalid'; readonly violation: MatchRequestError }
  /**
   * `requesterTripId` non e' una trasferta con cui ci si puo' candidare. UN solo
   * `kind` con un `reason` che discrimina, e non un `kind` per caso: per T13 i
   * casi sono lo stesso evento di schermata ("scegli un'altra trasferta") e
   * cambia solo la frase, che e' una tabella reason -> testo. Con `kind` distinti
   * ogni chiamante dovrebbe elencarli tutti per dare la stessa risposta; il
   * `switch` esaustivo sul `reason` resta, e il compilatore lo impone ugualmente.
   * Non e' `requester-trip-not-owned` di computePersonalStats: quella e' la difesa
   * lato lettura, questa lato scrittura, e i due errori non si sostituiscono.
   */
  | {
      readonly kind: 'requester-trip-invalid';
      readonly reason: Exclude<RequesterTripRejection, 'not-published'>;
      readonly requesterTripId: TripId;
    }
  /**
   * La trasferta e' del richiedente, senza auto, ma non `published`. La regola e'
   * "deve essere published", non "non deve essere cancelled": un nuovo valore di
   * `TripStatus` nasce rifiutato, non ammesso per dimenticanza. Porta lo stato
   * trovato perche' T13 dica "annullata" o "conclusa".
   */
  | {
      readonly kind: 'requester-trip-invalid';
      readonly reason: 'not-published';
      readonly status: TripStatus;
      readonly requesterTripId: TripId;
    }
  | { readonly kind: 'storage-failed'; readonly cause: RepositoryError };

/**
 * Perche' la trasferta indicata non va bene, in ordine di controllo: prima si
 * stabilisce se e' DEL richiedente, poi cosa e'. A chi indica la trasferta di un
 * altro non si dice se ha l'auto o in che stato e': sarebbero dettagli altrui.
 */
export type RequesterTripRejection =
  | 'not-found'
  | 'not-owned'
  | 'has-car'
  | 'not-published'
  | 'leg-incompatible';

/**
 * La trasferta dichiarata ha a che vedere con la tratta richiesta?
 *
 * Si confronta con la trasferta che OFFRE, non con la proiezione della tratta:
 * `listOpenOffers` proietta il rientro invertendo i plant dell'offerente e
 * prendendo `returnAt`, quindi per entrambe le direzioni il predicato e' lo stesso
 * - plant nello stesso ordine, stesso GIORNO del capo corrispondente
 * (`departureAt` per l'andata, `returnAt` per il rientro).
 *
 * LIMITI, da leggere prima di allentarlo:
 * - esclude le TAPPE INTERMEDIE, che il modello oggi non esprime: se un domani
 *   serviranno, e' questo vincolo da allentare;
 * - confronta il giorno (UTC) senza la finestra di tolleranza di `findMatches`,
 *   perche' `requestSeat` non ha `MatchConfig`: e' piu' lasco dei vincoli duri del
 *   matching, non piu' stretto, e non verifica l'orario;
 * - non verifica che la candidatura sia stata davvero proposta dall'app.
 */
function trasfertaCompatibile(dichiarata: Trip, offerente: Trip, direction: LegDirection): boolean {
  if (dichiarata.fromPlantId !== offerente.fromPlantId) return false;
  if (dichiarata.toPlantId !== offerente.toPlantId) return false;

  const capoDichiarata = direction === 'outbound' ? dichiarata.departureAt : dichiarata.returnAt;
  const capoOfferente = direction === 'outbound' ? offerente.departureAt : offerente.returnAt;
  // Rientro chiesto senza averne dichiarato uno (o tratta senza rientro): nessun giorno da confrontare.
  if (capoDichiarata === null || capoOfferente === null) return false;

  return utcInstantParts(capoDichiarata).date === utcInstantParts(capoOfferente).date;
}

function rifiutoTrasferta(
  reason: Exclude<RequesterTripRejection, 'not-published'>,
  requesterTripId: TripId
): Result<never, RequestSeatError> {
  return err({ kind: 'requester-trip-invalid', reason, requesterTripId });
}

/**
 * Crea (o riapre) una candidatura `pending`.
 *
 * Una `cancelled` esistente viene riusata con lo stesso id e riportata a `pending`
 * con la risoluzione azzerata: il port prevede un'unica riga per (tratta,
 * richiedente). NON si rifiuta per posti a zero: l'auto piena si gestisce con la
 * cascata, e la candidatura resta valida in coda.
 *
 * Nessun errore scrive: tutti i controlli precedono l'unica `save`.
 */
export async function requestSeat(
  input: RequestSeatInput,
  deps: RequestSeatDeps,
  noteConfig: NoteConfig
): Promise<Result<MatchRequest, RequestSeatError>> {
  // Su Postgres la foreign key composta rifiuterebbe comunque; qui l'errore e' tipizzato.
  const tratta = await deps.trips.findLeg(input.tripId, input.direction);
  if (!tratta.ok) {
    if (tratta.error.kind === 'not-found') {
      return err({ kind: 'leg-not-found', tripId: input.tripId, direction: input.direction });
    }
    return err({ kind: 'storage-failed', cause: tratta.error });
  }

  const esistente = await deps.requests.findByLegAndRequester(
    input.tripId,
    input.direction,
    input.requesterId
  );
  if (!esistente.ok) return err({ kind: 'storage-failed', cause: esistente.error });

  // Ordine: tratta, forma della candidatura, trasferta del richiedente, SOLO POI lo
  // stato della candidatura esistente.
  //
  // Perche' `already-requested` viene dopo i controlli di titolo, con la portata
  // ESATTA della protezione — una formulazione piu' forte di questa e' stata
  // corretta in review, perche' qualcuno la rileggerebbe come una garanzia:
  // la riga letta sopra e' la candidatura della persona NOMINATA nell'input
  // (`input.requesterId`), non di un terzo. L'argomento vale quindi solo nel modello
  // di minaccia in cui `requesterId` e' falsificabile — che e' quello reale di oggi,
  // perche' questo usecase non conosce la sessione e l'identita' gliela passa chi
  // chiama (limite dichiarato in T05; la RLS di T08 lo chiude lato DB).
  // E in quel modello la protezione e' PARZIALE, non totale: chi si spaccia per un
  // collega non legge piu' lo stato della sua candidatura indicando una trasferta
  // qualsiasi, ma lo legge ancora indicando una trasferta VALIDA di quel collega
  // (esistente, sua, senza auto, published). Questo ordine aggiunge un prerequisito
  // di conoscenza, non chiude la rivelazione: la chiusura e' la policy
  // `requester_id = auth.uid()` di T08, che lo schema applicato ha: vale quando le
  // chiamate passano da una sessione vera, non da questo usecase.
  //
  // La forma precede la lettura della trasferta perche' un id vuoto e' violazione del
  // dominio (`requester-trip-missing`), non una trasferta introvabile: rispondere
  // `not-found` a una stringa vuota direbbe che abbiamo cercato, e non e' vero.
  // Effetto collaterale, ora sotto test: una candidatura gia' presente E con nota
  // invalida risponde `request-invalid` anziche' `already-requested`.
  const costruita = makeMatchRequest(
    {
      id: esistente.value !== null ? esistente.value.id : input.id,
      tripId: input.tripId,
      direction: input.direction,
      requesterId: input.requesterId,
      requesterTripId: input.requesterTripId,
      status: 'pending',
      requestNote: input.requestNote,
      resolutionNote: null,
      resolvedBy: null,
    },
    noteConfig
  );
  if (!costruita.ok) return err({ kind: 'request-invalid', violation: costruita.error });

  const propria = await deps.trips.findById(input.requesterTripId);
  if (!propria.ok) {
    if (propria.error.kind === 'not-found') return rifiutoTrasferta('not-found', input.requesterTripId);
    return err({ kind: 'storage-failed', cause: propria.error });
  }
  // Titolo prima di tutto il resto (vedi RequesterTripRejection).
  if (propria.value.ownerId !== input.requesterId) {
    return rifiutoTrasferta('not-owned', input.requesterTripId);
  }
  // Chi ha noleggiato non si candida: conterebbe come auto evitata.
  if (propria.value.hasCar) return rifiutoTrasferta('has-car', input.requesterTripId);
  // Solo `published`: annullata o conclusa non si viaggia, non c'e' un posto da chiedere.
  // (T06 conta nei KPI le `completed`: la' sono viaggi avvenuti, qui si rifiuta di
  // candidarsi a un viaggio finito.) Regola in positivo: un nuovo stato nasce vietato.
  if (propria.value.status !== 'published') {
    return err({
      kind: 'requester-trip-invalid',
      reason: 'not-published',
      status: propria.value.status,
      requesterTripId: input.requesterTripId,
    });
  }

  // Compatibilita' con la tratta richiesta (T07d). Serve la trasferta che OFFRE:
  // `TripLeg` non ha plant ne' date. Dopo `not-published` e prima di
  // `already-requested`: riguarda la trasferta dichiarata, e a chi ne indica una
  // non idonea non si dice nulla sullo stato della candidatura esistente.
  const offerente = await deps.trips.findById(input.tripId);
  if (!offerente.ok) {
    // `findLeg` ha trovato la tratta ma la sua trasferta no: storage incoerente, non
    // un errore di chi chiede. `leg-not-found` direbbe il falso su cio' che manca.
    return err({ kind: 'storage-failed', cause: offerente.error });
  }
  if (!trasfertaCompatibile(propria.value, offerente.value, input.direction)) {
    return rifiutoTrasferta('leg-incompatible', input.requesterTripId);
  }

  if (esistente.value !== null && esistente.value.status !== 'cancelled') {
    return err({
      kind: 'already-requested',
      status: esistente.value.status,
      resolvedBy: esistente.value.resolvedBy,
    });
  }

  const salvata = await deps.requests.save(costruita.value);
  if (!salvata.ok) return err({ kind: 'storage-failed', cause: salvata.error });

  return ok(salvata.value);
}
