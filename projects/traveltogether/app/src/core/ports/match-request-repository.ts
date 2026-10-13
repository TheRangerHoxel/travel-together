// MatchRequestRepository — persistenza delle candidature.

import type {
  LegDirection,
  MatchRequest,
  MatchRequestId,
  ProfileId,
  Result,
  TripId,
} from '../domain';
import type { RepositoryError } from './repository-error';

export interface MatchRequestRepository {
  /**
   * Scrive la candidatura. Semantica **upsert**, come `TripRepository.save`:
   * salvare due volte lo stesso `id` sostituisce la versione precedente.
   *
   * Non e' un dettaglio: T05 fa transitare una candidatura da `pending` ad
   * `accepted` salvando lo stesso id, e su quel meccanismo poggia il criterio
   * "una richiesta gia' accepted non puo' essere accettata di nuovo". Per lo
   * stesso motivo ricandidarsi dopo un annullamento riusa la stessa riga:
   * `cancelled` -> `pending` con lo stesso id, non una riga nuova.
   *
   * Valida con `makeMatchRequest` **prima** di scrivere e ritorna `invalid-record`
   * se non regge, lasciando lo storage intatto.
   */
  save(request: MatchRequest): Promise<Result<MatchRequest, RepositoryError>>;

  findById(id: MatchRequestId): Promise<Result<MatchRequest, RepositoryError>>;

  /**
   * Le candidature ricevute da UNA tratta di un'offerta: serve a chi offre posti
   * (T14).
   *
   * E' per tratta e non per trasferta perche' i criteri di T14 parlano di posti e
   * di esaurimento, che sono per tratta, e perche' la cascata di auto-rifiuto di
   * T05 deve leggere le `pending` di *quella* tratta: leggere quelle dell'intera
   * trasferta rifiuterebbe candidature sul ritorno quando si esaurisce l'andata.
   */
  listByLeg(
    tripId: TripId,
    direction: LegDirection
  ): Promise<Result<readonly MatchRequest[], RepositoryError>>;

  /** Le candidature inviate da un collega: serve al suo stato "in attesa" (T13). */
  listByRequester(requesterId: ProfileId): Promise<Result<readonly MatchRequest[], RepositoryError>>;

  /**
   * La candidatura di un collega su una specifica TRATTA, se esiste.
   *
   * Esiste come metodo a se' perche' la doppia candidatura e' un vincolo duro sia
   * del matching (T03) sia di requestSeat (T05): cercarla scorrendo listByLeg
   * funzionerebbe, ma lascerebbe la regola implicita nel codice di chi chiama.
   *
   * E' per tratta perche' lo stesso collega puo' candidarsi sia sull'andata sia
   * sul ritorno della stessa trasferta: sono due candidature distinte, non una
   * doppia. Interrogata sul ritorno, non restituisce quella dell'andata.
   */
  findByLegAndRequester(
    tripId: TripId,
    direction: LegDirection,
    requesterId: ProfileId
  ): Promise<Result<MatchRequest | null, RepositoryError>>;
}
