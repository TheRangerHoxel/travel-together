// TripRepository — persistenza delle trasferte.

import type { ProfileId, Result, SeatOffer, Trip, TripId } from '../domain';
import type { RepositoryError } from './repository-error';

export interface TripRepository {
  /**
   * Scrive la trasferta. Semantica **upsert**: salvare due volte lo stesso `id`
   * sostituisce la versione precedente, non produce un conflitto.
   *
   * Valida gli invarianti di dominio **prima** di scrivere e ritorna
   * `invalid-record` se non reggono, lasciando lo storage intatto. E' il confine
   * in cui la validazione avviene, e vale per entrambi gli adapter.
   */
  save(trip: Trip): Promise<Result<Trip, RepositoryError>>;

  /**
   * Rilegge una trasferta. Valida gli invarianti: un record invalido che arriva
   * dallo storage produce `invalid-record`, non un `Trip` malformato in circolo.
   */
  findById(id: TripId): Promise<Result<Trip, RepositoryError>>;

  /** Non valida riga per riga: vedi la nota su `invalid-record`. */
  listByOwner(ownerId: ProfileId): Promise<Result<readonly Trip[], RepositoryError>>;

  /**
   * Le trasferte pubblicate con almeno un posto libero, proiettate in SeatOffer.
   *
   * Non serve filtrare su `hasCar`: per invariante di `Trip`, posti disponibili
   * maggiori di zero implicano l'auto. Aggiungere quel filtro darebbe un predicato
   * irraggiungibile, cioe' non verificabile da nessun test.
   *
   * E' una **proiezione**, non una ricerca: definisce cosa *e'* un'offerta, non
   * *quali* offerte servano a un dato collega. Nessun filtro su plant, data od
   * orario: quelli sono i vincoli duri del matching e stanno in findMatches (T03),
   * funzione pura testabile sui confini. Spostarli qui li renderebbe logica di
   * business dentro un adapter — vietato da T09 — e li costringerebbe a esistere
   * due volte, in RAM e in SQL, con l'obbligo di restare d'accordo.
   *
   * `ownerPlantId` si ottiene con una join sul profilo di chi offre. Semantica di
   * **inner join**: se il profilo non esiste, l'offerta viene omessa. Non si
   * sostituisce un valore di ripiego — `ownerPlantId` pesa nel punteggio di T03, e
   * un dato inventato ma plausibile falserebbe la classifica senza farsi notare.
   * Omettere una sola offerta e' anche il degrado giusto: far fallire tutta la
   * ricerca per una riga incoerente lascerebbe la demo con una schermata vuota.
   *
   * Vincoli per T08, entrambi necessari:
   * - le RLS su `trips` devono permettere la lettura delle offerte pubblicate di
   *   tutti i colleghi. Se non lo facessero, findMatches non vedrebbe nulla e la
   *   suite di contratto, in RAM, non se ne accorgerebbe.
   * - serve la foreign key `trips.owner_id -> profiles.id`. Senza, lo stato
   *   "offerta con owner inesistente" e' possibile su Postgres, e l'omissione
   *   diventerebbe una perdita silenziosa invece di un caso impossibile.
   */
  listOpenOffers(): Promise<Result<readonly SeatOffer[], RepositoryError>>;
}
