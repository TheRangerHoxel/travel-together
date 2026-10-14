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
  type TripId,
  err,
  makeMatchRequest,
  ok,
} from '../domain';
import type { MatchRequestRepository, RepositoryError, TripRepository } from '../ports';

export interface RequestSeatInput {
  /** Lo genera chi chiama. Se esiste una `cancelled` si riusa il SUO id e questo viene ignorato. */
  readonly id: MatchRequestId;
  readonly tripId: TripId;
  readonly direction: LegDirection;
  readonly requesterId: ProfileId;
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
  | { readonly kind: 'storage-failed'; readonly cause: RepositoryError };

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

  if (esistente.value !== null && esistente.value.status !== 'cancelled') {
    return err({
      kind: 'already-requested',
      status: esistente.value.status,
      resolvedBy: esistente.value.resolvedBy,
    });
  }

  const costruita = makeMatchRequest(
    {
      id: esistente.value !== null ? esistente.value.id : input.id,
      tripId: input.tripId,
      direction: input.direction,
      requesterId: input.requesterId,
      status: 'pending',
      requestNote: input.requestNote,
      resolutionNote: null,
      resolvedBy: null,
    },
    noteConfig
  );
  if (!costruita.ok) return err({ kind: 'request-invalid', violation: costruita.error });

  const salvata = await deps.requests.save(costruita.value);
  if (!salvata.ok) return err({ kind: 'storage-failed', cause: salvata.error });

  return ok(salvata.value);
}
