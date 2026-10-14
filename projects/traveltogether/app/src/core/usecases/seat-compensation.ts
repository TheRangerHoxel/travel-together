// Compensazione di una modifica ai posti quando la scrittura successiva fallisce.
//
// acceptRequest e cancelRequest scrivono in due punti (posti di tratta, stato della
// candidatura) che il port non permette di racchiudere in una transazione. Si fa
// per primo il passo con ammissione atomica (adjustLegSeats) e, se il secondo
// fallisce, si tenta di annullare il primo. Il tentativo puo' a sua volta
// fallire: l'esito viene DICHIARATO a chi chiama invece di essere assunto, perche'
// "errore, tutto a posto" e "errore, posti sfasati di uno" richiedono interventi
// diversi.

import type { LegDirection, TripId } from '../domain';
import type { RepositoryError, TripRepository } from '../ports';

export type SeatCompensation =
  | { readonly restored: true }
  | { readonly restored: false; readonly cause: RepositoryError };

/** Applica `-delta` ai posti della tratta, annullando un `adjustLegSeats(delta)` gia' riuscito. */
export async function undoSeatAdjustment(
  trips: TripRepository,
  tripId: TripId,
  direction: LegDirection,
  delta: number
): Promise<SeatCompensation> {
  const esito = await trips.adjustLegSeats(tripId, direction, -delta);
  return esito.ok ? { restored: true } : { restored: false, cause: esito.error };
}
