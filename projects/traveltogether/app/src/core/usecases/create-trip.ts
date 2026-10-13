// Creazione di una trasferta, con auto (offre posti) o senza (cerca passaggio).
//
// Aggiunge SOLO le regole di creazione: plant diversi, partenza non nel passato,
// rientro non precedente, posti entro il massimo. Gli invarianti di Trip (posti
// negativi, disponibili <= totali, posti senza auto) li fa rispettare makeTrip:
// ridefinirli qui darebbe due definizioni della stessa regola, che col tempo
// divergono.

import {
  type Instant,
  type PlantId,
  type ProfileId,
  type Result,
  type Trip,
  type TripId,
  type TripInvariantError,
  err,
  makeTrip,
  ok,
  parseUtcInstant,
} from '../domain';
import type { Clock, RepositoryError, TripRepository } from '../ports';
import type { CreateTripConfig } from './create-trip-config';

/**
 * Cio' che serve per creare una trasferta. Non e' un `Trip`: `seatsTotal`,
 * `seatsAvailable` e `status` li deriva createTrip, e lasciarli all'input
 * permetterebbe di crearne una gia' a meta' vita.
 */
export interface CreateTripInput {
  /** Lo genera chi chiama: il port TripRepository non ha un generatore di id. */
  readonly id: TripId;
  readonly ownerId: ProfileId;
  readonly fromPlantId: PlantId;
  readonly toPlantId: PlantId;
  /**
   * Istante gia' in forma canonica UTC con la `Z`. **Non viene convertito**: la
   * conversione dal fuso locale e' onere di chi chiama (il form di T12). Un valore
   * non canonico e' rifiutato con 'invalid-departure-at'.
   */
  readonly departureAt: string;
  /** Stessa forma di `departureAt`, oppure null se il rientro non e' pianificato. */
  readonly returnAt: string | null;
  readonly hasCar: boolean;
  /** Posti offerti. Senza auto deve essere 0: un valore > 0 viene rifiutato, non azzerato. */
  readonly seatsOffered: number;
}

export interface CreateTripDeps {
  readonly clock: Clock;
  readonly trips: TripRepository;
}

export type CreateTripError =
  | { readonly kind: 'invalid-config'; readonly maxSeatsOffered: number }
  /** L'orologio ha restituito un istante non canonico: ogni confronto sarebbe inaffidabile. */
  | { readonly kind: 'invalid-clock-now'; readonly value: string }
  | { readonly kind: 'invalid-departure-at'; readonly value: string }
  | { readonly kind: 'invalid-return-at'; readonly value: string }
  | { readonly kind: 'same-plant'; readonly plantId: PlantId }
  | { readonly kind: 'departure-in-the-past'; readonly departureAt: string; readonly now: string }
  | { readonly kind: 'return-before-departure'; readonly departureAt: string; readonly returnAt: string }
  | { readonly kind: 'seats-not-integer'; readonly seatsOffered: number }
  | { readonly kind: 'seats-out-of-range'; readonly seatsOffered: number; readonly min: number; readonly max: number }
  /** makeTrip ha rifiutato: la violazione originale e' conservata, non riscritta. */
  | { readonly kind: 'trip-invariant-violated'; readonly violation: TripInvariantError }
  | { readonly kind: 'storage-failed'; readonly cause: RepositoryError };

/** Minimo di posti per dichiarare un'auto. Non configurabile: zero posti non e' un'offerta. */
const MIN_SEATS_WITH_CAR = 1;

/**
 * Confronto cronologico fra due istanti canonici: negativo, zero o positivo.
 *
 * Non si confrontano le stringhe: `parseUtcInstant` accetta i millisecondi
 * opzionali, e "06:00:00Z" contro "06:00:00.000Z" e' lo stesso istante ma, come
 * stringhe, la `Z` (0x5A) segue il `.` (0x2E), quindi il primo risulterebbe
 * maggiore. Proprio sul confine "partenza uguale a adesso" darebbe la risposta
 * sbagliata. Data (YYYY-MM-DD, confrontabile come stringa) e millisecondi nel
 * giorno bastano, senza aritmetica di calendario.
 */
function confronta(a: Instant, b: Instant): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.millisOfDay - b.millisOfDay;
}

/**
 * Crea e salva una trasferta.
 *
 * Ritorna `err` per ogni rifiuto, mai un'eccezione, e **non salva** nulla in quel
 * caso. Un errore dello storage e' incapsulato in 'storage-failed'.
 *
 * Scelte sui confini:
 * - partenza **uguale** a `clock.now()` non e' nel passato: e' accettata. Chi
 *   crea una trasferta "adesso" non va rifiutato per un millisecondo.
 * - rientro **uguale** alla partenza non e' precedente: accettato.
 *
 * Lo stato iniziale e' 'published' perche' non esiste una bozza nel modello
 * (TripStatus ha solo published, cancelled, completed): una trasferta creata deve
 * poter comparire subito fra le offerte del matching, e gli altri due stati
 * descrivono la fine della vita, non l'inizio.
 */
export async function createTrip(
  input: CreateTripInput,
  deps: CreateTripDeps,
  config: CreateTripConfig
): Promise<Result<Trip, CreateTripError>> {
  const { maxSeatsOffered } = config;

  // Si valida prima di usarla: un NaN renderebbe falso ogni confronto sui posti.
  if (!Number.isInteger(maxSeatsOffered) || maxSeatsOffered < MIN_SEATS_WITH_CAR) {
    return err({ kind: 'invalid-config', maxSeatsOffered });
  }

  // Il confronto "nel passato" e' corretto solo se entrambi i lati sono canonici:
  // vale anche per l'orologio, perche' un confronto silenziosamente sbagliato e'
  // il guasto che questa guardia previene.
  const adesso = deps.clock.now();
  const istanteAdesso = parseUtcInstant(adesso);
  if (!istanteAdesso) {
    return err({ kind: 'invalid-clock-now', value: adesso });
  }

  const partenza = parseUtcInstant(input.departureAt);
  if (!partenza) {
    return err({ kind: 'invalid-departure-at', value: input.departureAt });
  }

  let rientro: Instant | null = null;
  if (input.returnAt !== null) {
    rientro = parseUtcInstant(input.returnAt);
    if (!rientro) {
      return err({ kind: 'invalid-return-at', value: input.returnAt });
    }
  }

  if (input.fromPlantId === input.toPlantId) {
    return err({ kind: 'same-plant', plantId: input.fromPlantId });
  }

  if (confronta(partenza, istanteAdesso) < 0) {
    return err({ kind: 'departure-in-the-past', departureAt: input.departureAt, now: adesso });
  }

  if (rientro && input.returnAt !== null && confronta(rientro, partenza) < 0) {
    return err({
      kind: 'return-before-departure',
      departureAt: input.departureAt,
      returnAt: input.returnAt,
    });
  }

  const { seatsOffered } = input;
  if (!Number.isInteger(seatsOffered)) {
    return err({ kind: 'seats-not-integer', seatsOffered });
  }

  if (input.hasCar) {
    if (seatsOffered < MIN_SEATS_WITH_CAR || seatsOffered > maxSeatsOffered) {
      return err({
        kind: 'seats-out-of-range',
        seatsOffered,
        min: MIN_SEATS_WITH_CAR,
        max: maxSeatsOffered,
      });
    }
  }

  // Senza auto non c'e' una regola di creazione: posti > 0 o negativi arrivano qui
  // e li rifiuta makeTrip. L'input non viene azzerato: ignorarlo e' il modo in cui
  // l'utente scopre dopo che i suoi dati sono stati cambiati.
  const costruito = makeTrip({
    id: input.id,
    ownerId: input.ownerId,
    fromPlantId: input.fromPlantId,
    toPlantId: input.toPlantId,
    departureAt: input.departureAt,
    returnAt: input.returnAt,
    hasCar: input.hasCar,
    seatsTotal: seatsOffered,
    // Alla creazione nessun posto e' ancora stato accettato.
    seatsAvailable: seatsOffered,
    status: 'published',
  });
  if (!costruito.ok) {
    return err({ kind: 'trip-invariant-violated', violation: costruito.error });
  }

  const salvato = await deps.trips.save(costruito.value);
  if (!salvato.ok) {
    return err({ kind: 'storage-failed', cause: salvato.error });
  }

  return ok(salvato.value);
}
