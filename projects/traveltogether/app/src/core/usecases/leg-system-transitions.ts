// Transizioni di stato fatte dal SISTEMA su una tratta (resolvedBy: 'system').
//
// Due funzioni distinte e inverse, non un dispatcher che guardi i posti e scelga:
// il ramo "posti > 0, reintegra" dentro acceptRequest sarebbe irraggiungibile (per
// esistere una riga `system` i posti devono essere stati a 0, e perche' un'accettazione
// lasci posti > 0 devono essere stati >= 2), cioe' codice che nessun test puo'
// distinguere da un no-op.
//
// - rejectRemainingPending: l'ultimo posto e' stato accettato, le altre `pending`
//   della STESSA tratta vengono chiuse dal sistema. Chiamata da acceptRequest.
// - restoreSystemRejected: un posto e' tornato, le righe chiuse dal sistema tornano
//   `pending`. Chiamata da cancelRequest.
//
// Nessuna delle due tocca i posti. Quello che non e' `pending` (o, per il reintegro,
// non e' `rejected` DAL SISTEMA) non viene letto come candidato: `cancelled` e
// `rejected/owner` sono decisioni di una persona e non si disfano da sole.

import {
  type LegDirection,
  type MatchRequest,
  type MatchRequestError,
  type MatchRequestId,
  type NoteConfig,
  type Result,
  type TripId,
  err,
  makeMatchRequest,
  ok,
} from '../domain';
import type { MatchRequestRepository, RepositoryError } from '../ports';
import type { CascadeConfig } from './cascade-config';

export interface LegRef {
  readonly tripId: TripId;
  readonly direction: LegDirection;
}

/** Una riga che il sistema non e' riuscito a trasformare, e perche'. */
export interface UnclosedRequest {
  readonly id: MatchRequestId;
  readonly cause: RepositoryError | MatchRequestError;
}

/**
 * Esito incompleto di una transizione di sistema. Le righe in `done` sono state
 * scritte; quelle in `unclosed` no, e restano come erano. Non e' un errore
 * dell'azione dell'utente che l'ha innescata: quella e' gia' riuscita.
 */
export type SystemTransitionError =
  | { readonly kind: 'list-failed'; readonly cause: RepositoryError }
  | {
      readonly kind: 'incomplete';
      readonly done: readonly MatchRequestId[];
      readonly unclosed: readonly UnclosedRequest[];
    };

interface Transizione {
  readonly seleziona: (riga: MatchRequest) => boolean;
  readonly trasforma: (riga: MatchRequest) => MatchRequest;
}

/**
 * Applica la transizione a ogni riga selezionata della tratta, una `save` per riga.
 * Prosegue dopo un fallimento: chiudere piu' righe possibile e' meglio che fermarsi
 * alla prima, e l'elenco `unclosed` dice esattamente cosa manca.
 */
async function applicaATratta(
  tratta: LegRef,
  requests: MatchRequestRepository,
  noteConfig: NoteConfig,
  transizione: Transizione
): Promise<Result<readonly MatchRequestId[], SystemTransitionError>> {
  const elenco = await requests.listByLeg(tratta.tripId, tratta.direction);
  if (!elenco.ok) return err({ kind: 'list-failed', cause: elenco.error });

  const done: MatchRequestId[] = [];
  const unclosed: UnclosedRequest[] = [];

  for (const riga of elenco.value.filter(transizione.seleziona)) {
    const costruita = makeMatchRequest(transizione.trasforma(riga), noteConfig);
    if (!costruita.ok) {
      unclosed.push({ id: riga.id, cause: costruita.error });
      continue;
    }
    const salvata = await requests.save(costruita.value);
    if (salvata.ok) done.push(riga.id);
    else unclosed.push({ id: riga.id, cause: salvata.error });
  }

  if (unclosed.length > 0) return err({ kind: 'incomplete', done, unclosed });
  return ok(done);
}

/**
 * Rifiuta (resolvedBy 'system', nota automatica) tutte le `pending` della tratta.
 * Si chiama DOPO aver scritto l'accettazione che ha consumato l'ultimo posto: la
 * riga accettata non e' piu' `pending` e quindi non viene toccata. Le `pending`
 * dell'altra tratta della stessa trasferta non sono lette.
 *
 * Ritorna gli id chiusi, nell'ordine di lettura.
 */
export function rejectRemainingPending(
  tratta: LegRef,
  deps: { readonly requests: MatchRequestRepository },
  config: NoteConfig & CascadeConfig
): Promise<Result<readonly MatchRequestId[], SystemTransitionError>> {
  return applicaATratta(tratta, deps.requests, config, {
    seleziona: (riga) => riga.status === 'pending',
    trasforma: (riga) => ({
      ...riga,
      status: 'rejected',
      resolutionNote: config.autoRejectNote,
      resolvedBy: 'system',
    }),
  });
}

/**
 * Riporta a `pending` le righe che il SISTEMA aveva rifiutato su quella tratta, con
 * lo stesso id e la risoluzione azzerata.
 *
 * Lo stato d'arrivo e' `pending` e NON `accepted`, e non si toccano i posti: tornano
 * candidati tutti, e sceglie chi offre l'auto. Nessun ordine di precedenza da
 * inventare. Un `rejected` con `resolvedBy: 'owner'` e' una decisione di una
 * persona: e' proprio per distinguerlo che `resolvedBy` non e' un campo diagnostico.
 */
export function restoreSystemRejected(
  tratta: LegRef,
  deps: { readonly requests: MatchRequestRepository },
  noteConfig: NoteConfig
): Promise<Result<readonly MatchRequestId[], SystemTransitionError>> {
  return applicaATratta(tratta, deps.requests, noteConfig, {
    seleziona: (riga) => riga.status === 'rejected' && riga.resolvedBy === 'system',
    trasforma: (riga) => ({ ...riga, status: 'pending', resolutionNote: null, resolvedBy: null }),
  });
}
