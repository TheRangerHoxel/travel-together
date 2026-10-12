// MatchRequestRepository — persistenza delle candidature.

import type { MatchRequest, MatchRequestId, ProfileId, Result, TripId } from '../domain';
import type { RepositoryError } from './repository-error';

export interface MatchRequestRepository {
  /**
   * Scrive la candidatura. Semantica **upsert**, come `TripRepository.save`:
   * salvare due volte lo stesso `id` sostituisce la versione precedente.
   *
   * Non e' un dettaglio: T05 fa transitare una candidatura da `pending` ad
   * `accepted` salvando lo stesso id, e su quel meccanismo poggia il criterio
   * "una richiesta gia' accepted non puo' essere accettata di nuovo".
   */
  save(request: MatchRequest): Promise<Result<MatchRequest, RepositoryError>>;

  findById(id: MatchRequestId): Promise<Result<MatchRequest, RepositoryError>>;

  /** Le candidature ricevute da un'offerta: serve a chi offre posti (T14). */
  listByTrip(tripId: TripId): Promise<Result<readonly MatchRequest[], RepositoryError>>;

  /** Le candidature inviate da un collega: serve al suo stato "in attesa" (T13). */
  listByRequester(requesterId: ProfileId): Promise<Result<readonly MatchRequest[], RepositoryError>>;

  /**
   * La candidatura di un collega su una specifica offerta, se esiste.
   *
   * Esiste come metodo a se' perche' la doppia candidatura e' un vincolo duro sia
   * del matching (T03) sia di requestSeat (T05): cercarla scorrendo listByTrip
   * funzionerebbe, ma lascerebbe la regola implicita nel codice di chi chiama.
   */
  findByTripAndRequester(
    tripId: TripId,
    requesterId: ProfileId
  ): Promise<Result<MatchRequest | null, RepositoryError>>;
}
