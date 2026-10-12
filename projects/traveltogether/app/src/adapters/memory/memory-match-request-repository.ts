// MatchRequestRepository in RAM.

import type {
  MatchRequest,
  MatchRequestId,
  ProfileId,
  Result,
  TripId,
} from '../../core/domain';
import { err, ok } from '../../core/domain';
import type { MatchRequestRepository, RepositoryError } from '../../core/ports';

export class MemoryMatchRequestRepository implements MatchRequestRepository {
  private readonly richieste = new Map<MatchRequestId, MatchRequest>();

  async save(request: MatchRequest): Promise<Result<MatchRequest, RepositoryError>> {
    this.richieste.set(request.id, { ...request });
    return ok({ ...request });
  }

  /**
   * Non valida il record riletto, a differenza di `MemoryTripRepository.findById`.
   * Non e' una dimenticanza: `MatchRequest` non ha invarianti ne' un costruttore
   * che li faccia rispettare (T01), quindi non c'e' nulla da validare. Se un
   * giorno ne acquistasse — per esempio uno stato che vincola le transizioni —
   * questo e' il punto da allineare.
   */
  async findById(id: MatchRequestId): Promise<Result<MatchRequest, RepositoryError>> {
    const trovata = this.richieste.get(id);
    if (!trovata) {
      return err({ kind: 'not-found', id });
    }
    return ok({ ...trovata });
  }

  async listByTrip(tripId: TripId): Promise<Result<readonly MatchRequest[], RepositoryError>> {
    return ok(
      [...this.richieste.values()].filter((r) => r.tripId === tripId).map((r) => ({ ...r }))
    );
  }

  async listByRequester(
    requesterId: ProfileId
  ): Promise<Result<readonly MatchRequest[], RepositoryError>> {
    return ok(
      [...this.richieste.values()]
        .filter((r) => r.requesterId === requesterId)
        .map((r) => ({ ...r }))
    );
  }

  async findByTripAndRequester(
    tripId: TripId,
    requesterId: ProfileId
  ): Promise<Result<MatchRequest | null, RepositoryError>> {
    const trovata = [...this.richieste.values()].find(
      (r) => r.tripId === tripId && r.requesterId === requesterId
    );
    return ok(trovata ? { ...trovata } : null);
  }
}
