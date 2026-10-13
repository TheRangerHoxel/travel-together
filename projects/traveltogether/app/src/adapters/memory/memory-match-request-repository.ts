// MatchRequestRepository in RAM.

import type {
  LegDirection,
  MatchRequest,
  MatchRequestId,
  NoteConfig,
  ProfileId,
  Result,
  TripId,
} from '../../core/domain';
import { err, makeMatchRequest, ok } from '../../core/domain';
import type { MatchRequestRepository, RepositoryError } from '../../core/ports';

export class MemoryMatchRequestRepository implements MatchRequestRepository {
  private readonly richieste = new Map<MatchRequestId, MatchRequest>();

  /** Il limite delle note arriva dall'esterno: l'adapter non legge config/ da solo. */
  constructor(private readonly noteConfig: NoteConfig) {}

  async save(request: MatchRequest): Promise<Result<MatchRequest, RepositoryError>> {
    // Validazione PRIMA della scrittura: un record rifiutato non lascia traccia.
    // core/domain/match-request.ts prescrive che ogni adapter passi di qui.
    const valida = makeMatchRequest(request, this.noteConfig);
    if (!valida.ok) {
      return err({ kind: 'invalid-record', id: request.id, detail: valida.error.kind });
    }

    this.richieste.set(request.id, { ...request });
    return ok({ ...request });
  }

  async findById(id: MatchRequestId): Promise<Result<MatchRequest, RepositoryError>> {
    const trovata = this.richieste.get(id);
    if (!trovata) {
      return err({ kind: 'not-found', id });
    }

    // Anche in lettura, come MemoryTripRepository.findById: un record invalido che
    // arriva dallo storage non deve entrare in circolo nel dominio.
    const valida = makeMatchRequest(trovata, this.noteConfig);
    if (!valida.ok) {
      return err({ kind: 'invalid-record', id, detail: valida.error.kind });
    }
    return ok({ ...trovata });
  }

  async listByLeg(
    tripId: TripId,
    direction: LegDirection
  ): Promise<Result<readonly MatchRequest[], RepositoryError>> {
    // Le liste non validano riga per riga: vedi la nota su invalid-record.
    return ok(
      [...this.richieste.values()]
        .filter((r) => r.tripId === tripId && r.direction === direction)
        .map((r) => ({ ...r }))
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

  async findByLegAndRequester(
    tripId: TripId,
    direction: LegDirection,
    requesterId: ProfileId
  ): Promise<Result<MatchRequest | null, RepositoryError>> {
    const trovata = [...this.richieste.values()].find(
      (r) => r.tripId === tripId && r.direction === direction && r.requesterId === requesterId
    );
    return ok(trovata ? { ...trovata } : null);
  }
}
