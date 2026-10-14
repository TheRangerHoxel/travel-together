// Rifiuto di una candidatura da parte di chi offre il posto.
//
// Nessuna aritmetica sui posti: una `pending` non ha mai decrementato niente, quindi
// rifiutarla non ha nulla da restituire. Per questo `adjustLegSeats` non compare.

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

export interface RejectRequestInput {
  readonly requestId: MatchRequestId;
  /** Chi agisce. Entra dall'input e non dal SessionGateway: l'usecase non conosce la sessione. */
  readonly actorId: ProfileId;
  /** Obbligatoria: `null` e' rifiutato. Forma e lunghezza le verifica makeMatchRequest. */
  readonly resolutionNote: string | null;
}

export interface RejectRequestDeps {
  readonly trips: TripRepository;
  readonly requests: MatchRequestRepository;
}

export type RejectRequestError =
  | { readonly kind: 'request-not-found'; readonly requestId: MatchRequestId }
  | { readonly kind: 'trip-not-found'; readonly tripId: TripId }
  | { readonly kind: 'not-trip-owner'; readonly actorId: ProfileId }
  /** Si puo' rifiutare solo una `pending`: `from` e' lo stato in cui la riga e' stata trovata. */
  | { readonly kind: 'invalid-transition'; readonly from: MatchRequestStatus }
  | { readonly kind: 'resolution-note-required' }
  /** Nota vuota, di soli spazi o troppo lunga: la violazione originale e' conservata. */
  | { readonly kind: 'request-invalid'; readonly violation: MatchRequestError }
  | { readonly kind: 'storage-failed'; readonly cause: RepositoryError };

/**
 * L'identita' si verifica per prima: a un estraneo non si rivela in che stato e'
 * una candidatura che non lo riguarda. Ogni rifiuto avviene prima dell'unica
 * `save`, quindi nessun errore scrive.
 */
export async function rejectRequest(
  input: RejectRequestInput,
  deps: RejectRequestDeps,
  noteConfig: NoteConfig
): Promise<Result<MatchRequest, RejectRequestError>> {
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

  if (richiesta.status !== 'pending') {
    return err({ kind: 'invalid-transition', from: richiesta.status });
  }

  // L'obbligo di nota dipende dallo stato di partenza, che il costruttore di
  // dominio non conosce: lo impone l'usecase.
  if (input.resolutionNote === null) return err({ kind: 'resolution-note-required' });

  const costruita = makeMatchRequest(
    {
      ...richiesta,
      status: 'rejected',
      resolutionNote: input.resolutionNote,
      resolvedBy: 'owner',
    },
    noteConfig
  );
  if (!costruita.ok) return err({ kind: 'request-invalid', violation: costruita.error });

  const salvata = await deps.requests.save(costruita.value);
  if (!salvata.ok) return err({ kind: 'storage-failed', cause: salvata.error });

  return ok(salvata.value);
}
