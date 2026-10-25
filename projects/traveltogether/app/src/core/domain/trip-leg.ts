// TripLeg — la tratta: una meta' di una trasferta (andata o ritorno).
//
// L'identita' di una tratta e' la COPPIA (tripId, direction), non un id
// sintetico: una tratta e' una proiezione della trasferta, e un id generato
// cambierebbe fra due letture. L'unicita' e' una conseguenza del modello
// (trips.id e' unico, direction ha due valori), non un'asserzione.

import { type Result, err, ok } from './result';
import type { TripId } from './trip';

/** Union di letterali, non string: una direzione inesistente non compila. */
export type LegDirection = 'outbound' | 'return';

/**
 * Rango ESPLICITO delle direzioni: l'andata precede il ritorno.
 *
 * Non si confrontano le stringhe. `'outbound' < 'return'` e' vero per un
 * incidente dell'ortografia: rinominare `return` in `inbound` invertirebbe
 * l'ordine con tutti i test verdi. Il rango e' un dato, e un test lo pinna.
 */
const LEG_DIRECTION_RANK: Readonly<Record<LegDirection, number>> = {
  outbound: 0,
  return: 1,
};

export function legDirectionRank(direction: LegDirection): number {
  return LEG_DIRECTION_RANK[direction];
}

const LEG_KEY_SEPARATOR = '|';

/**
 * Chiave canonica e deterministica di una tratta: `<tripId>|<direction>`.
 * Serve dove l'identita' composta deve stare in una stringa sola (Map, Set).
 *
 * Precondizione sul `tripId`: nello schema (T08) gli id sono `uuid`, quindi non contengono il
 * separatore. Con un id libero che lo contenesse la chiave resta comunque
 * iniettiva finche' le direzioni sono un insieme chiuso di parole in cui
 * nessuna e' suffisso dell'altra (il suffisso decide la direzione, il resto e'
 * il tripId); cio' che NON sarebbe sicuro e' spezzare la chiave per ricavarne
 * il tripId, e per questo non esiste una funzione inversa.
 */
export function legKey(tripId: TripId, direction: LegDirection): string {
  return `${tripId}${LEG_KEY_SEPARATOR}${direction}`;
}

/**
 * Lo stato dei posti di UNA tratta. Una trasferta con auto ha una riga per
 * l'andata e, se `returnAt` non e' null, una per il ritorno.
 *
 * I posti dell'auto sono posti PER TRATTA: un'auto da 3 posti con rientro ha 3
 * posti sull'andata e 3 sul ritorno, non 3 in tutto. E' per questo che il
 * contatore vive qui e non su `Trip`.
 *
 * Una tratta non ha un id proprio: la sua identita' e' (tripId, direction).
 */
export interface TripLeg {
  readonly tripId: TripId;
  readonly direction: LegDirection;
  /** Posti totali dell'auto, uguali su entrambe le tratte. */
  readonly seatsTotal: number;
  /** Posti ancora liberi su QUESTA tratta. */
  readonly seatsAvailable: number;
}

/** Gli invarianti di una tratta, gli stessi di `Trip` sui posti. */
export type TripLegError =
  | { readonly kind: 'negative-seats'; readonly seatsTotal: number; readonly seatsAvailable: number }
  | {
      readonly kind: 'seats-available-exceeds-total';
      readonly seatsAvailable: number;
      readonly seatsTotal: number;
    }
  | { readonly kind: 'non-integer-seats'; readonly seatsTotal: number; readonly seatsAvailable: number };

/**
 * Costruttore di TripLeg: il modo DA USARE per ottenerne una valida.
 *
 * Come `makeTrip`, il tipo non impedisce di costruire un letterale: ogni adapter
 * che scrive o ricostruisce una tratta da storage deve passare di qui.
 */
export function makeTripLeg(campi: TripLeg): Result<TripLeg, TripLegError> {
  if (!Number.isInteger(campi.seatsTotal) || !Number.isInteger(campi.seatsAvailable)) {
    return err({
      kind: 'non-integer-seats',
      seatsTotal: campi.seatsTotal,
      seatsAvailable: campi.seatsAvailable,
    });
  }

  if (campi.seatsTotal < 0 || campi.seatsAvailable < 0) {
    return err({
      kind: 'negative-seats',
      seatsTotal: campi.seatsTotal,
      seatsAvailable: campi.seatsAvailable,
    });
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