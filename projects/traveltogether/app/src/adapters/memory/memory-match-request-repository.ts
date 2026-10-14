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
import { err, makeMatchRequest, ok, validateMatchRequestStructure } from '../../core/domain';
import type { MatchRequestRepository, RepositoryError } from '../../core/ports';

export class MemoryMatchRequestRepository implements MatchRequestRepository {
  private readonly richieste = new Map<MatchRequestId, MatchRequest>();

  /** Il limite delle note arriva dall'esterno: l'adapter non legge config/ da solo. */
  constructor(private readonly noteConfig: NoteConfig) {}

  /**
   * Scrive **senza validare**. Non e' nel port, e non lo sara' mai.
   *
   * Serve a riprodurre l'unico stato che `save` rende altrimenti irraggiungibile:
   * lo storage che contiene gia' una candidatura strutturalmente invalida (una
   * migrazione mal fatta, una query eseguita a mano). Senza questo, il ramo
   * `invalid-record` in lettura sarebbe codice non verificabile. Stesso precedente
   * di `MemoryTripRepository.seminaGrezzo`.
   *
   * **Non usarlo per caricare dati.** Il seed dimostrativo di T17 deve passare da
   * `save`: usare questa porta sul retro perche' e' piu' diretta scavalcherebbe
   * proprio il confine di validazione che `save` esiste per presidiare.
   */
  seminaGrezzo(request: MatchRequest): void {
    this.richieste.set(request.id, { ...request });
  }
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
    // arriva dallo storage non deve entrare in circolo nel dominio. Ma solo la
    // STRUTTURA: il limite delle note vale in scrittura. Una nota scritta sotto un
    // limite piu' alto non e' corrotta quando il limite scende.
    const valida = validateMatchRequestStructure(trovata);
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
