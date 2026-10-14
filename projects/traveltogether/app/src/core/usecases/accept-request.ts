// Accettazione di una candidatura da parte di chi offre il posto. Se consuma
// l'ultimo posto della tratta, chiude le altre `pending` di quella tratta
// (leg-system-transitions.ts).
//
// ORDINE DELLE SCRITTURE: prima `adjustLegSeats(-1)`, poi `save` dello stato.
// Il decremento e' l'unica operazione con ammissione atomica (il port la definisce
// relativa e con limiti [0, seatsTotal]): se due accettazioni arrivano sull'ultimo
// posto, una sola lo ottiene. Scrivere prima lo stato e poi decrementare, o leggere
// i posti e decidere in codice, riaprirebbe la finestra in cui l'ultimo posto viene
// venduto due volte. Il prezzo e' una compensazione se la `save` fallisce dopo il
// decremento; l'esito e' dichiarato nell'errore.

import {
  type MatchRequest,
  type MatchRequestError,
  type MatchRequestId,
  type MatchRequestStatus,
  type NoteConfig,
  type ProfileId,
  type Result,
  type TripId,
  err,
  makeMatchRequest,
  ok,
} from '../domain';
import type { MatchRequestRepository, RepositoryError, TripRepository } from '../ports';
import type { CascadeConfig } from './cascade-config';
import { type SystemTransitionError, rejectRemainingPending } from './leg-system-transitions';
import { type SeatCompensation, undoSeatAdjustment } from './seat-compensation';

export interface AcceptRequestInput {
  readonly requestId: MatchRequestId;
  /** Chi agisce. Entra dall'input e non dal SessionGateway. */
  readonly actorId: ProfileId;
}

export interface AcceptRequestDeps {
  readonly trips: TripRepository;
  readonly requests: MatchRequestRepository;
}

/** Note e testo della cascata: entrambi iniettati, nessuno dei due vive nel codice. */
export type AcceptRequestConfig = NoteConfig & CascadeConfig;

/**
 * Esito di un'accettazione riuscita. `autoRejected` sono gli id chiusi dalla cascata:
 * esposti perche' la cascata sia asseribile dall'esterno invece che dedotta rileggendo
 * le altre righe. `cascadeFailure` e' non-null se la cascata e' rimasta a meta': l'accettazione
 * resta valida (il successo dell'utente non si ritira per un effetto collaterale
 * incompleto) e l'errore elenca le righe non chiuse.
 */
export interface AcceptRequestOutcome {
  readonly request: MatchRequest;
  readonly autoRejected: readonly MatchRequestId[];
  readonly cascadeFailure: SystemTransitionError | null;
}

export type AcceptRequestError =
  | { readonly kind: 'request-not-found'; readonly requestId: MatchRequestId }
  | { readonly kind: 'trip-not-found'; readonly tripId: TripId }
  | { readonly kind: 'not-trip-owner'; readonly actorId: ProfileId }
  /** Si accetta solo una `pending`: `from` e' lo stato trovato. */
  | { readonly kind: 'invalid-transition'; readonly from: MatchRequestStatus }
  | { readonly kind: 'leg-not-found' }
  /** Il decremento e' stato rifiutato dal port: la tratta e' a zero. Lo stato non e' stato scritto. */
  | { readonly kind: 'no-seats-available'; readonly cause: RepositoryError }
  | { readonly kind: 'request-invalid'; readonly violation: MatchRequestError }
  /** Errore prima di qualunque scrittura. */
  | { readonly kind: 'storage-failed'; readonly cause: RepositoryError }
  /**
   * La `save` e' fallita DOPO un decremento riuscito. `compensation` dice se il
   * posto e' stato restituito: se `restored` e' false i posti sono sfasati di uno.
   */
  | {
      readonly kind: 'save-failed-after-decrement';
      readonly cause: RepositoryError;
      readonly compensation: SeatCompensation;
    };

export async function acceptRequest(
  input: AcceptRequestInput,
  deps: AcceptRequestDeps,
  config: AcceptRequestConfig
): Promise<Result<AcceptRequestOutcome, AcceptRequestError>> {
  const trovata = await deps.requests.findById(input.requestId);
  if (!trovata.ok) {
    if (trovata.error.kind === 'not-found') {
      return err({ kind: 'request-not-found', requestId: input.requestId });
    }
    return err({ kind: 'storage-failed', cause: trovata.error });
  }
  const richiesta = trovata.value;

  const trasferta = await deps.trips.findById(richiesta.tripId);
  if (!trasferta.ok) {
    if (trasferta.error.kind === 'not-found') {
      return err({ kind: 'trip-not-found', tripId: richiesta.tripId });
    }
    return err({ kind: 'storage-failed', cause: trasferta.error });
  }

  if (trasferta.value.ownerId !== input.actorId) {
    return err({ kind: 'not-trip-owner', actorId: input.actorId });
  }

  // Una `accepted` ha gia' il suo decremento: accettarla di nuovo lo ripeterebbe.
  if (richiesta.status !== 'pending') {
    return err({ kind: 'invalid-transition', from: richiesta.status });
  }

  // Si costruisce PRIMA di toccare i posti: un rifiuto del dominio dopo il
  // decremento costringerebbe a una compensazione evitabile.
  const costruita = makeMatchRequest({ ...richiesta, status: 'accepted' }, config);
  if (!costruita.ok) return err({ kind: 'request-invalid', violation: costruita.error });

  const decremento = await deps.trips.adjustLegSeats(richiesta.tripId, richiesta.direction, -1);
  if (!decremento.ok) {
    if (decremento.error.kind === 'not-found') return err({ kind: 'leg-not-found' });
    // Fuori da [0, seatsTotal] con -1 significa zero posti.
    if (decremento.error.kind === 'invalid-record') {
      return err({ kind: 'no-seats-available', cause: decremento.error });
    }
    return err({ kind: 'storage-failed', cause: decremento.error });
  }

  const salvata = await deps.requests.save(costruita.value);
  if (!salvata.ok) {
    const compensation = await undoSeatAdjustment(
      deps.trips,
      richiesta.tripId,
      richiesta.direction,
      -1
    );
    return err({ kind: 'save-failed-after-decrement', cause: salvata.error, compensation });
  }

  // La cascata scatta solo se QUESTA accettazione ha consumato l'ultimo posto: con
  // posti residui nessun'altra candidatura e' stata danneggiata. Si guarda il valore
  // ritornato dal decremento atomico, non una rilettura.
  if (decremento.value.seatsAvailable > 0) {
    return ok({ request: salvata.value, autoRejected: [], cascadeFailure: null });
  }

  const cascata = await rejectRemainingPending(
    { tripId: richiesta.tripId, direction: richiesta.direction },
    { requests: deps.requests },
    config
  );
  if (!cascata.ok) {
    const chiuse = cascata.error.kind === 'incomplete' ? cascata.error.done : [];
    return ok({ request: salvata.value, autoRejected: chiuse, cascadeFailure: cascata.error });
  }
  return ok({ request: salvata.value, autoRejected: cascata.value, cascadeFailure: null });
}
