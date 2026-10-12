// MatchRequest — la candidatura di un collega a un posto offerto.

import type { ProfileId } from './profile';
import type { TripId } from './trip';

export type MatchRequestId = string;

/**
 * Union di letterali, non string. E' un criterio di accettazione esplicito di T01,
 * e il motivo e' pratico: gli stati governano il decremento dei posti (T05) e il
 * calcolo dei KPI (T06, dove pending e rejected non devono contribuire). Uno stato
 * scritto male come stringa libera falserebbe i numeri in silenzio.
 */
export type MatchRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface MatchRequest {
  readonly id: MatchRequestId;
  /** La trasferta che OFFRE il posto, non quella di chi si candida. */
  readonly tripId: TripId;
  readonly requesterId: ProfileId;
  readonly status: MatchRequestStatus;
}
