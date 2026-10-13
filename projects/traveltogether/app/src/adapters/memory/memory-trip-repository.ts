// TripRepository in RAM.
//
// Non e' un artificio di test: e' la PROVA che l'inversione delle dipendenze
// funziona. Se il core gira interamente in memoria, allora non e' accoppiato
// alla rete — e se un giorno non ci riuscisse piu', il port sarebbe sbagliato.

import type {
  LegDirection,
  PlantId,
  ProfileId,
  Result,
  SeatOffer,
  Trip,
  TripId,
  TripLeg,
} from '../../core/domain';
import { err, legKey, makeTrip, makeTripLeg, ok } from '../../core/domain';
import type { ProfileRepository, RepositoryError, TripRepository } from '../../core/ports';

export class MemoryTripRepository implements TripRepository {
  private readonly trips = new Map<TripId, Trip>();
  /** Le tratte, indicizzate dalla chiave canonica (tripId, direction). */
  private readonly legs = new Map<string, TripLeg>();

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

  /**
   * Come `seminaGrezzo`, per le tratte: scrive senza validare, per riprodurre uno
   * storage che contiene gia' una tratta invalida. Non e' nel port.
   */
  seminaTrattaGrezza(leg: TripLeg): void {
    this.legs.set(legKey(leg.tripId, leg.direction), { ...leg });
  }

  async save(trip: Trip): Promise<Result<Trip, RepositoryError>> {
    // Validazione PRIMA della scrittura, come dichiara il doc del port: un record
    // rifiutato non deve lasciare traccia. core/domain/trip.ts prescrive che ogni
    // adapter passi di qui.
    const valido = makeTrip(trip);
    if (!valido.ok) {
      return err({ kind: 'invalid-record', id: trip.id, detail: valido.error.kind });
    }

    // Le tratte si costruiscono e si validano PRIMA di scrivere qualunque cosa:
    // un rifiuto non deve lasciare ne' la trasferta ne' meta' delle tratte.
    const direzioni: readonly LegDirection[] = !trip.hasCar
      ? []
      : trip.returnAt === null
        ? ['outbound']
        : ['outbound', 'return'];

    const tratte: TripLeg[] = [];
    for (const direction of direzioni) {
      // PRESERVAZIONE: se la tratta esiste il suo contatore non si tocca. Un
      // risalvataggio della trasferta non deve poter azzerare i posti gia'
      // accettati; solo le tratte mancanti partono dai posti della trasferta.
      const esistente = this.legs.get(legKey(trip.id, direction));
      const tratta = makeTripLeg({
        tripId: trip.id,
        direction,
        seatsTotal: trip.seatsTotal,
        seatsAvailable: esistente ? esistente.seatsAvailable : trip.seatsAvailable,
      });
      if (!tratta.ok) {
        return err({ kind: 'invalid-record', id: trip.id, detail: tratta.error.kind });
      }
      tratte.push(tratta.value);
    }

    // Copia difensiva: lo storage vero riceve dati, non riferimenti.
    this.trips.set(trip.id, { ...trip });
    // Le tratte che la nuova forma non prevede (auto tolta, rientro tolto) vanno.
    for (const direction of ['outbound', 'return'] as const) {
      if (!direzioni.includes(direction)) {
        this.legs.delete(legKey(trip.id, direction));
      }
    }
    for (const tratta of tratte) {
      this.legs.set(legKey(tratta.tripId, tratta.direction), tratta);
    }
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
    // Un'offerta e' una TRATTA con almeno un posto libero. I posti si leggono dal
    // contatore di tratta e non da Trip.seatsAvailable, che dopo un'accettazione
    // non e' piu' quello vero. Nessun filtro su hasCar: le tratte esistono solo
    // per le trasferte con auto.
    const candidate = [...this.trips.values()].filter((t) => t.status === 'published');

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

      for (const direction of ['outbound', 'return'] as const) {
        const tratta = this.legs.get(legKey(trip.id, direction));
        // Il filtro "almeno un posto libero" e' PER TRATTA.
        if (!tratta || tratta.seatsAvailable <= 0) continue;

        if (direction === 'outbound') {
          offerte.push({
            tripId: trip.id,
            direction,
            ownerId: trip.ownerId,
            ownerPlantId,
            fromPlantId: trip.fromPlantId,
            toPlantId: trip.toPlantId,
            departureAt: trip.departureAt,
            seatsAvailable: tratta.seatsAvailable,
          });
        } else if (trip.returnAt !== null) {
          // Ritorno: plant INVERTITI e orario di returnAt.
          offerte.push({
            tripId: trip.id,
            direction,
            ownerId: trip.ownerId,
            ownerPlantId,
            fromPlantId: trip.toPlantId,
            toPlantId: trip.fromPlantId,
            departureAt: trip.returnAt,
            seatsAvailable: tratta.seatsAvailable,
          });
        }
      }
    }

    return ok(offerte);
  }
  async findLeg(
    tripId: TripId,
    direction: LegDirection
  ): Promise<Result<TripLeg, RepositoryError>> {
    const chiave = legKey(tripId, direction);
    const trovata = this.legs.get(chiave);
    if (!trovata) {
      return err({ kind: 'not-found', id: chiave });
    }

    const valida = makeTripLeg(trovata);
    if (!valida.ok) {
      return err({ kind: 'invalid-record', id: chiave, detail: valida.error.kind });
    }
    return ok({ ...trovata });
  }

  async adjustLegSeats(
    tripId: TripId,
    direction: LegDirection,
    delta: number
  ): Promise<Result<TripLeg, RepositoryError>> {
    const chiave = legKey(tripId, direction);
    const attuale = this.legs.get(chiave);
    if (!attuale) {
      return err({ kind: 'not-found', id: chiave });
    }

    // In RAM leggere e scrivere nello stesso tick e' atomico (nessun await in
    // mezzo); su Postgres e' un UPDATE condizionale: vedi il doc del port.
    const aggiornata = makeTripLeg({
      ...attuale,
      seatsAvailable: attuale.seatsAvailable + delta,
    });
    if (!aggiornata.ok) {
      return err({ kind: 'invalid-record', id: chiave, detail: aggiornata.error.kind });
    }

    this.legs.set(chiave, aggiornata.value);
    return ok({ ...aggiornata.value });
  }
}
