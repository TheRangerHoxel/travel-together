// Trip — una trasferta. E' l'entita' centrale del dominio.
//
// Il tempo e' una stringa ISO 8601 e non un Date: core/ non puo' usare l'orologio
// di sistema (lo impone il lint), e un Date e' mutabile e porta con se' il fuso
// della macchina. Qui le date sono DATI, confrontabili e deterministici.

import type { PlantId } from './plant';
import type { ProfileId } from './profile';
import { type Result, err, ok } from './result';

export type TripId = string;

/** Union di letterali, non string: uno stato inesistente non compila. */
export type TripStatus = 'published' | 'cancelled' | 'completed';

export interface Trip {
  readonly id: TripId;
  readonly ownerId: ProfileId;
  readonly fromPlantId: PlantId;
  readonly toPlantId: PlantId;
  /** ISO 8601, es. "2026-11-03T07:30:00+01:00". */
  readonly departureAt: string;
  /** ISO 8601, oppure null se il rientro non e' pianificato. */
  readonly returnAt: string | null;
  readonly hasCar: boolean;
  /** Posti totali dell'auto. Zero se non c'e' auto. */
  readonly seatsTotal: number;
  /** Posti ancora liberi. Scende a ogni candidatura accettata (T05). */
  readonly seatsAvailable: number;
  readonly status: TripStatus;
}

/**
 * Gli invarianti che un Trip non puo' violare in nessun momento della sua vita.
 *
 * Sono distinti dalle regole di CREAZIONE di T04 (data nel passato, plant uguali,
 * massimo 8 posti): quelle valgono quando si crea una trasferta, queste valgono
 * sempre, anche dopo un'accettazione o un annullamento.
 */
export type TripInvariantError =
  | { readonly kind: 'seats-available-exceeds-total'; readonly seatsAvailable: number; readonly seatsTotal: number }
  | { readonly kind: 'seats-offered-without-car'; readonly seatsTotal: number }
  | { readonly kind: 'negative-seats'; readonly seatsTotal: number; readonly seatsAvailable: number };

/**
 * Costruttore di Trip: il modo DA USARE per ottenerne uno valido.
 *
 * Attenzione, perche' il tipo non lo impone: input e output sono entrambi `Trip`,
 * quindi qualunque modulo puo' costruire un letterale e saltare questi controlli.
 * In particolare ogni adapter che ricostruisce un Trip da storage (T02, T09) deve
 * passare di qui: un record invalido che arriva dal DB non e' meno invalido.
 * Renderlo inaggirabile richiede un tipo opaco — proposta in IDEAS.md.
 *
 * Ritorna un Result invece di sollevare: chi chiama e' costretto dal compilatore
 * a decidere cosa fare del caso di errore.
 */
export function makeTrip(campi: Trip): Result<Trip, TripInvariantError> {
  if (campi.seatsTotal < 0 || campi.seatsAvailable < 0) {
    return err({
      kind: 'negative-seats',
      seatsTotal: campi.seatsTotal,
      seatsAvailable: campi.seatsAvailable,
    });
  }

  // Senza auto non si offrono posti. Il contrario e' ammesso: si puo' avere
  // l'auto ed essere al completo.
  if (!campi.hasCar && campi.seatsTotal > 0) {
    return err({ kind: 'seats-offered-without-car', seatsTotal: campi.seatsTotal });
  }

  if (campi.seatsAvailable > campi.seatsTotal) {
    return err({
      kind: 'seats-available-exceeds-total',
      seatsAvailable: campi.seatsAvailable,
      seatsTotal: campi.seatsTotal,
    });
  }

  return ok(campi);
}
