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
import type { MatchRequestRepository, RepositoryError, TripRepository } from '../../core/ports';
import { type CondizioniDiAmbiente, erroreDiGuasto, rifiutoDiPolicy } from './memory-conditions';

/**
 * Cio' che serve a questo adapter per comportarsi come lo storage vero: chi sta
 * chiamando e se lo storage risponde, e le trasferte per sapere di CHI e' una
 * trasferta (stesso precedente della join sui profili in `MemoryTripRepository`: si
 * passa dal port, non da uno store privato).
 */
export interface AmbienteDelloStorage {
  readonly condizioni: CondizioniDiAmbiente;
  readonly trips: TripRepository;
}

export class MemoryMatchRequestRepository implements MatchRequestRepository {
  private readonly richieste = new Map<MatchRequestId, MatchRequest>();

  /**
   * Il limite delle note arriva dall'esterno: l'adapter non legge config/ da solo.
   *
   * `ambiente` e' opzionale: assente = nessuna policy e nessun guasto. Cablato,
   * l'adapter impone le policy di T08 sulle scritture (vedi `verificaPolicy`) e
   * filtra le letture: una candidatura e' visibile al richiedente e all'owner della
   * trasferta, a nessun altro.
   */
  constructor(
    private readonly noteConfig: NoteConfig,
    private readonly ambiente?: AmbienteDelloStorage
  ) {}

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
    // Ordine dei controlli: validazione, guasto, identita', unicita'. A T09 la
    // validazione e' locale e precede la rete; il resto lo decide il DB.
    // core/domain/match-request.ts prescrive che ogni adapter passi di qui.
    const valida = makeMatchRequest(request, this.noteConfig);
    if (!valida.ok) {
      return err({ kind: 'invalid-record', id: request.id, detail: valida.error.kind });
    }

    if (this.ambiente) {
      const guasto = erroreDiGuasto(this.ambiente.condizioni);
      if (guasto) return err(guasto);

      const rifiuto = await this.verificaPolicy(request, this.ambiente);
      if (rifiuto) return err(rifiuto);
    }

    // Unicita' della coppia (tratta, richiedente), come un indice unico: guarda TUTTE
    // le righe, non solo quelle visibili a chi scrive. Lo stesso id e' l'upsert (la
    // ricandidatura); un id DIVERSO sulla stessa coppia e' rifiutato.
    const duplicata = [...this.richieste.values()].some(
      (r) =>
        r.id !== request.id &&
        r.tripId === request.tripId &&
        r.direction === request.direction &&
        r.requesterId === request.requesterId
    );
    if (duplicata) {
      return err({
        kind: 'invalid-record',
        id: request.id,
        detail: 'duplicate-requester-on-leg',
      });
    }

    this.richieste.set(request.id, { ...request });
    return ok({ ...request });
  }

  async findById(id: MatchRequestId): Promise<Result<MatchRequest, RepositoryError>> {
    const guasto = erroreDiGuasto(this.ambiente?.condizioni);
    if (guasto) return err(guasto);

    // Una riga che la policy non lascia vedere e' una riga che non c'e'.
    const trovata = this.richieste.get(id);
    if (!trovata || !(await this.visibile(trovata))) {
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
    const guasto = erroreDiGuasto(this.ambiente?.condizioni);
    if (guasto) return err(guasto);

    // Port di osservabilita': le righe che il dominio rifiuta si omettono, e oggi
    // l'omissione e' SILENZIOSA, perche' il canale per segnalarla non esiste ancora
    // (voce «Port di osservabilita'» di IDEAS.md, non schedulata).
    return ok(
      await this.visibiliEValide(
        [...this.richieste.values()].filter((r) => r.tripId === tripId && r.direction === direction)
      )
    );
  }

  async listByRequester(
    requesterId: ProfileId
  ): Promise<Result<readonly MatchRequest[], RepositoryError>> {
    const guasto = erroreDiGuasto(this.ambiente?.condizioni);
    if (guasto) return err(guasto);

    // Port di osservabilita': stessa omissione silenziosa di `listByLeg`, stessa voce
    // di IDEAS.md.
    return ok(
      await this.visibiliEValide([...this.richieste.values()].filter((r) => r.requesterId === requesterId))
    );
  }

  async findByLegAndRequester(
    tripId: TripId,
    direction: LegDirection,
    requesterId: ProfileId
  ): Promise<Result<MatchRequest | null, RepositoryError>> {
    const guasto = erroreDiGuasto(this.ambiente?.condizioni);
    if (guasto) return err(guasto);

    const trovata = [...this.richieste.values()].find(
      (r) => r.tripId === tripId && r.direction === direction && r.requesterId === requesterId
    );
    // Riga assente o non visibile a chi chiede: "non si e' ancora candidato".
    if (!trovata || !(await this.visibile(trovata))) return ok(null);

    // Lettura SINGOLA: una riga invalida e' `invalid-record`, non `null`. Un `null`
    // farebbe credere a requestSeat che il collega non si sia mai candidato, e ne
    // creerebbe una seconda sulla stessa coppia.
    const valida = validateMatchRequestStructure(trovata);
    if (!valida.ok) {
      return err({ kind: 'invalid-record', id: trovata.id, detail: valida.error.kind });
    }
    return ok({ ...trovata });
  }

  /** Le righe visibili a chi chiama e strutturalmente valide, copiate. */
  private async visibiliEValide(
    righe: readonly MatchRequest[]
  ): Promise<readonly MatchRequest[]> {
    const risultato: MatchRequest[] = [];
    for (const r of righe) {
      if (!(await this.visibile(r))) continue;
      if (!validateMatchRequestStructure(r).ok) continue;
      risultato.push({ ...r });
    }
    return risultato;
  }

  /**
   * La policy di LETTURA: una candidatura e' visibile al richiedente e all'owner
   * della trasferta, a nessun altro. Senza ambiente cablato la vedono tutti.
   */
  private async visibile(r: MatchRequest): Promise<boolean> {
    if (!this.ambiente) return true;
    const identita = this.ambiente.condizioni.identita;
    if (identita === null) return false;
    if (r.requesterId === identita) return true;
    return (await this.proprietarioDi(r.tripId, this.ambiente)) === identita;
  }

  private async proprietarioDi(
    tripId: TripId,
    ambiente: AmbienteDelloStorage
  ): Promise<ProfileId | null> {
    const trasferta = await ambiente.trips.findById(tripId);
    return trasferta.ok ? trasferta.value.ownerId : null;
  }

  /**
   * Le policy di SCRITTURA di T08 su `match_requests`. `null` = permessa.
   * Per una riga che esiste gia' valgono sia per la riga PRIMA della scrittura (USING)
   * sia per quella DOPO (WITH CHECK), come per un UPDATE o il DO UPDATE di un upsert.
   *
   * - la creazione solo dal richiedente;
   * - `pending` e `cancelled` solo dal richiedente della riga;
   * - `accepted` e `rejected` solo dall'owner della trasferta della tratta;
   * - in ogni caso `requesterTripId` e' una trasferta del richiedente.
   */
  private async verificaPolicy(
    request: MatchRequest,
    ambiente: AmbienteDelloStorage
  ): Promise<RepositoryError | null> {
    const identita = ambiente.condizioni.identita;
    if (identita === null) return rifiutoDiPolicy('nessuna identita\'');

    const esistente = this.richieste.get(request.id);
    if (!esistente && request.requesterId !== identita) {
      return rifiutoDiPolicy('la candidatura la crea solo il richiedente');
    }

    if (request.status === 'pending' || request.status === 'cancelled') {
      // Riga vecchia (USING) e riga nuova (WITH CHECK): il richiedente deve essere
      // lui prima e dopo, altrimenti potrebbe riassegnare la candidatura ad altri.
      if (identita !== request.requesterId || (esistente && identita !== esistente.requesterId)) {
        return rifiutoDiPolicy('pending e cancelled solo dal richiedente della riga');
      }
    } else {
      // Anche qui vecchia e nuova: l'owner della trasferta di prima e di dopo, altrimenti
      // potrebbe spostare su di se' una candidatura altrui e accettarla.
      if ((await this.proprietarioDi(request.tripId, ambiente)) !== identita) {
        return rifiutoDiPolicy('accepted e rejected solo dall\'owner della trasferta');
      }
      if (esistente && (await this.proprietarioDi(esistente.tripId, ambiente)) !== identita) {
        return rifiutoDiPolicy('la riga esistente e\' di una trasferta di un altro owner');
      }
    }

    const dellRichiedente = await ambiente.trips.findById(request.requesterTripId);
    if (!dellRichiedente.ok || dellRichiedente.value.ownerId !== request.requesterId) {
      return rifiutoDiPolicy('requesterTripId non e\' una trasferta del richiedente');
    }
    return null;
  }
}
