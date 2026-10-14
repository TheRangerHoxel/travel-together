// Annullamento di una candidatura da parte di chi l'ha fatta.
//
// Solo il richiedente: neppure chi offre il posto puo' annullare, per lui esiste il
// rifiuto. Da `pending` non c'e' nulla da restituire; da `accepted` il posto torna
// (+1) e la nota e' obbligatoria, perche' chi offre aveva contato su quel posto.
//
// Stesso ordine di acceptRequest: prima il passo atomico sui posti, poi `save`. Qui
// conta anche per un altro motivo: un +1 che sfonda `seatsTotal` e' rifiutato dal
// port, e in quel caso non deve restare una riga `cancelled` senza posto restituito.

import {
  type MatchRequest,
  type MatchRequestError,
  type MatchRequestId,
  type MatchRequestStatus,
  type NoteConfig,
  type ProfileId,
  type Result,
  err,
  makeMatchRequest,
  ok,
} from '../domain';
import type { MatchRequestRepository, RepositoryError, TripRepository } from '../ports';
import { type SystemTransitionError, restoreSystemRejected } from './leg-system-transitions';
import { type SeatCompensation, undoSeatAdjustment } from './seat-compensation';

export interface CancelRequestInput {
  readonly requestId: MatchRequestId;
  /** Chi agisce. Entra dall'input e non dal SessionGateway. */
  readonly actorId: ProfileId;
  /**
   * Obbligatoria se la candidatura e' `accepted`. Su una `pending` e' facoltativa,
   * ma se passata viene conservata (con `resolvedBy: 'requester'`): non richiesta
   * non significa vietata.
   */
  readonly resolutionNote: string | null;
}

export interface CancelRequestDeps {
  readonly trips: TripRepository;
  readonly requests: MatchRequestRepository;
}

/**
 * Esito di un annullamento riuscito. `restored` elenca gli id tornati `pending`,
 * come `autoRejected` in acceptRequest. Decisione: lo si elenca per simmetria e
 * perche' e' l'unico modo di sapere chi e' tornato in coda senza rileggere la
 * tratta (chi offre l'auto dovra' essere avvisato che ha di nuovo da scegliere), e
 * perche' rende il reintegro asseribile dall'esterno. `restoreFailure` e' non-null
 * se il reintegro e' rimasto a meta': l'annullamento resta valido.
 */
export interface CancelRequestOutcome {
  readonly request: MatchRequest;
  readonly restored: readonly MatchRequestId[];
  readonly restoreFailure: SystemTransitionError | null;
}

export type CancelRequestError =
  | { readonly kind: 'request-not-found'; readonly requestId: MatchRequestId }
  | { readonly kind: 'not-requester'; readonly actorId: ProfileId }
  /** Si annulla `pending` o `accepted`: `from` e' lo stato trovato. */
  | { readonly kind: 'invalid-transition'; readonly from: MatchRequestStatus }
  | { readonly kind: 'resolution-note-required' }
  | { readonly kind: 'request-invalid'; readonly violation: MatchRequestError }
  | { readonly kind: 'leg-not-found' }
  /** Il +1 uscirebbe da [0, seatsTotal]: dato incoerente, nulla e' stato scritto. */
  | { readonly kind: 'seat-restore-rejected'; readonly cause: RepositoryError }
  | { readonly kind: 'storage-failed'; readonly cause: RepositoryError }
  /** La `save` e' fallita DOPO un +1 riuscito; `compensation` dice se e' stato annullato. */
  | {
      readonly kind: 'save-failed-after-restore';
      readonly cause: RepositoryError;
      readonly compensation: SeatCompensation;
    };

export async function cancelRequest(
  input: CancelRequestInput,
  deps: CancelRequestDeps,
  noteConfig: NoteConfig
): Promise<Result<CancelRequestOutcome, CancelRequestError>> {
  const trovata = await deps.requests.findById(input.requestId);
  if (!trovata.ok) {
    if (trovata.error.kind === 'not-found') {
      return err({ kind: 'request-not-found', requestId: input.requestId });
    }
    return err({ kind: 'storage-failed', cause: trovata.error });
  }
  const richiesta = trovata.value;

  if (richiesta.requesterId !== input.actorId) {
    return err({ kind: 'not-requester', actorId: input.actorId });
  }

  if (richiesta.status !== 'pending' && richiesta.status !== 'accepted') {
    return err({ kind: 'invalid-transition', from: richiesta.status });
  }
  const restituisceIlPosto = richiesta.status === 'accepted';

  if (restituisceIlPosto && input.resolutionNote === null) {
    return err({ kind: 'resolution-note-required' });
  }

  const costruita = makeMatchRequest(
    {
      ...richiesta,
      status: 'cancelled',
      resolutionNote: input.resolutionNote,
      resolvedBy: input.resolutionNote === null ? null : 'requester',
    },
    noteConfig
  );
  if (!costruita.ok) return err({ kind: 'request-invalid', violation: costruita.error });

  let postiDopo: number | null = null;
  if (restituisceIlPosto) {
    const incremento = await deps.trips.adjustLegSeats(richiesta.tripId, richiesta.direction, 1);
    if (!incremento.ok) {
      if (incremento.error.kind === 'not-found') return err({ kind: 'leg-not-found' });
      if (incremento.error.kind === 'invalid-record') {
        return err({ kind: 'seat-restore-rejected', cause: incremento.error });
      }
      return err({ kind: 'storage-failed', cause: incremento.error });
    }
    postiDopo = incremento.value.seatsAvailable;
  }

  const salvata = await deps.requests.save(costruita.value);
  if (!salvata.ok) {
    if (!restituisceIlPosto) return err({ kind: 'storage-failed', cause: salvata.error });
    const compensation = await undoSeatAdjustment(
      deps.trips,
      richiesta.tripId,
      richiesta.direction,
      1
    );
    return err({ kind: 'save-failed-after-restore', cause: salvata.error, compensation });
  }

  // Il reintegro scatta sul PASSAGGIO dei posti sopra zero (0 -> 1), non
  // sull'annullamento in se': una `pending` annullata non cambia i posti, quindi non
  // lo innesca anche se esistono righe `system`.
  //
  // Un +1 che porta i posti da 1 a 2 (o oltre) non reintegra, e nessun test lo
  // asserisce come no-op: nel caso normale in quello stato non esiste alcuna riga
  // `system` su questa tratta. Una riga `system` nasce solo quando un'accettazione
  // porta i posti a 0, e finche' i posti restano a 0 nessun'altra transizione
  // la tocca; quando salgono sopra zero e' proprio questo passaggio a reintegrarla.
  //
  // ECCEZIONE, perche' "per costruzione" sarebbe piu' assoluto del vero: se un
  // reintegro precedente e' rimasto INCOMPLETO (`restoreFailure` con `unclosed`),
  // una riga `system` sopravvive su una tratta che ha gia' un posto libero, e un
  // secondo annullamento (1 -> 2) non la reintegra. Non e' un difetto di
  // correttezza — la riga e' elencata in `unclosed`, quindi chi chiama sa di dover
  // ritentare, e il recupero e' un nuovo passaggio sopra zero — ma lo stato e'
  // raggiungibile, e dichiararlo impossibile qui sarebbe un'informazione falsa nel
  // posto dove la si va a cercare.
  if (postiDopo !== 1) {
    return ok({ request: salvata.value, restored: [], restoreFailure: null });
  }

  const reintegro = await restoreSystemRejected(
    { tripId: richiesta.tripId, direction: richiesta.direction },
    { requests: deps.requests },
    noteConfig
  );
  if (!reintegro.ok) {
    const fatte = reintegro.error.kind === 'incomplete' ? reintegro.error.done : [];
    return ok({ request: salvata.value, restored: fatte, restoreFailure: reintegro.error });
  }
  return ok({ request: salvata.value, restored: reintegro.value, restoreFailure: null });
}
