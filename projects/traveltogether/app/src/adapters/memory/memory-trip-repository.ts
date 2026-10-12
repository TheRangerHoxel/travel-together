// TripRepository in RAM.
//
// Non e' un artificio di test: e' la PROVA che l'inversione delle dipendenze
// funziona. Se il core gira interamente in memoria, allora non e' accoppiato
// alla rete — e se un giorno non ci riuscisse piu', il port sarebbe sbagliato.

import type { PlantId, ProfileId, Result, SeatOffer, Trip, TripId } from '../../core/domain';
import { err, makeTrip, ok } from '../../core/domain';
import type { ProfileRepository, RepositoryError, TripRepository } from '../../core/ports';

export class MemoryTripRepository implements TripRepository {
  private readonly trips = new Map<TripId, Trip>();

  /**
   * La fonte dei profili, per la join che ricava `ownerPlantId`.
   *
   * Si passa dal PORT e non da uno store privato: su Supabase la stessa
   * informazione viene da una join su `profiles`, quindi i due adapter fanno la
   * stessa operazione e la suite di contratto puo' verificarla su entrambi.
   */
  constructor(private readonly profiles: ProfileRepository) {}

  /**
   * Scrive **senza validare**. Non e' nel port, e non lo sara' mai.
   *
   * Serve a riprodurre l'unico stato che `save` rende altrimenti irraggiungibile:
   * lo storage che contiene gia' un record invalido, com'e' il caso di una
   * migrazione mal fatta o di una query eseguita a mano. Senza questo, il ramo
   * `invalid-record` in lettura sarebbe codice non verificabile.
   *
   * **Non usarlo per caricare dati.** Il seed dimostrativo di T17 deve passare da
   * `save`: usare questa porta sul retro perche' e' piu' diretta scavalcherebbe
   * proprio il confine di validazione che `save` esiste per presidiare.
   */
  seminaGrezzo(trip: Trip): void {
    this.trips.set(trip.id, { ...trip });
  }

  async save(trip: Trip): Promise<Result<Trip, RepositoryError>> {
    // Validazione PRIMA della scrittura, come dichiara il doc del port: un record
    // rifiutato non deve lasciare traccia. core/domain/trip.ts prescrive che ogni
    // adapter passi di qui.
    const valido = makeTrip(trip);
    if (!valido.ok) {
      return err({ kind: 'invalid-record', id: trip.id, detail: valido.error.kind });
    }

    // Copia difensiva: lo storage vero riceve dati, non riferimenti.
    this.trips.set(trip.id, { ...trip });
    return ok({ ...trip });
  }

  async findById(id: TripId): Promise<Result<Trip, RepositoryError>> {
    const trovato = this.trips.get(id);
    if (!trovato) {
      return err({ kind: 'not-found', id });
    }

    // Anche in lettura: un record invalido che arriva dallo storage non e' meno
    // invalido di uno scritto a mano, e non deve entrare in circolo nel dominio.
    const valido = makeTrip(trovato);
    if (!valido.ok) {
      return err({ kind: 'invalid-record', id, detail: valido.error.kind });
    }

    return ok({ ...trovato });
  }

  async listByOwner(ownerId: ProfileId): Promise<Result<readonly Trip[], RepositoryError>> {
    // Le liste non validano riga per riga: vedi la nota su invalid-record.
    const suoi = [...this.trips.values()]
      .filter((t) => t.ownerId === ownerId)
      .map((t) => ({ ...t }));
    return ok(suoi);
  }

  async listOpenOffers(): Promise<Result<readonly SeatOffer[], RepositoryError>> {
    // Nessun filtro su hasCar: per invariante di Trip, seatsAvailable > 0 implica
    // gia' l'auto. Un predicato irraggiungibile non e' difesa, e' codice che
    // nessun test puo' coprire.
    const candidate = [...this.trips.values()].filter(
      (t) => t.status === 'published' && t.seatsAvailable > 0
    );

    // Una sola lettura dei profili invece di una per trasferta. In RAM il
    // risparmio e' nullo, ma e' la forma che l'adapter Supabase dovra' avere —
    // una join, non N query — e questo adapter e' la guida che T09 seguira'.
    const ownerIds = [...new Set(candidate.map((t) => t.ownerId))];
    const profiliTrovati = await this.profiles.listByIds(ownerIds);
    if (!profiliTrovati.ok) {
      return err(profiliTrovati.error);
    }

    const plantPerOwner = new Map<ProfileId, PlantId>(
      profiliTrovati.value.map((p) => [p.id, p.plantId])
    );

    const offerte: SeatOffer[] = [];

    for (const trip of candidate) {
      // Inner join: se il profilo manca, l'offerta si omette. Nessun ripiego —
      // ownerPlantId pesa nel punteggio di T03, e un valore inventato ma
      // plausibile falserebbe la classifica senza farsi notare.
      const ownerPlantId = plantPerOwner.get(trip.ownerId);
      if (!ownerPlantId) continue;

      offerte.push({
        tripId: trip.id,
        ownerId: trip.ownerId,
        ownerPlantId,
        fromPlantId: trip.fromPlantId,
        toPlantId: trip.toPlantId,
        departureAt: trip.departureAt,
        seatsAvailable: trip.seatsAvailable,
      });
    }

    return ok(offerte);
  }
}
