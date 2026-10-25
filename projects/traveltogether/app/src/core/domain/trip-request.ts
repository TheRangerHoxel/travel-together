// TripRequest — la faccia "richiesta" di una trasferta: cio' che il motore di
// matching confronta con le offerte (T03).
//
// Simmetrico a SeatOffer, e per la stessa ragione: un tipo piu' stretto rende
// impossibile, non solo sconsigliato, far dipendere il punteggio da un campo che
// non c'entra. E' una proiezione di Trip piu' il plant del Profile di chi cerca —
// la stessa composizione (e la stessa join) che produce SeatOffer.ownerPlantId.
//
// Niente tripId, deliberatamente: il vincolo "offerta del richiedente stesso" si
// risolve su ownerId === requesterId. Un campo che nessun vincolo usa e' un campo
// che un domani il punteggio potrebbe usare per sbaglio.

import type { UtcInstant } from './instant';
import type { PlantId } from './plant';
import type { ProfileId } from './profile';

export interface TripRequest {
  readonly requesterId: ProfileId;
  /** Plant di appartenenza di chi cerca: entra nel punteggio, non nei vincoli duri. */
  readonly requesterPlantId: PlantId;
  readonly fromPlantId: PlantId;
  readonly toPlantId: PlantId;
  /** Istante normalizzato UTC. */
  readonly departureAt: UtcInstant;
}
