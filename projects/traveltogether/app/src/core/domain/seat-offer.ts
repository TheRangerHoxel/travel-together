// SeatOffer — la faccia "offerta" di una trasferta: cio' che il motore di
// matching confronta con una richiesta (T03).
//
// E' un tipo a se' e non un Trip perche' findMatches non deve conoscere l'intera
// trasferta: gli servono solo i campi che partecipano ai vincoli e al punteggio.
// Un tipo piu' stretto rende impossibile, non solo sconsigliato, far dipendere il
// punteggio da un campo che non c'entra.

import type { PlantId } from './plant';
import type { ProfileId } from './profile';
import type { TripId } from './trip';

export interface SeatOffer {
  readonly tripId: TripId;
  readonly ownerId: ProfileId;
  /** Stabilimento di appartenenza di chi offre: entra nel punteggio, non nei vincoli duri. */
  readonly ownerPlantId: PlantId;
  readonly fromPlantId: PlantId;
  readonly toPlantId: PlantId;
  /** ISO 8601. La vicinanza a questo orario e' la componente principale del punteggio. */
  readonly departureAt: string;
  readonly seatsAvailable: number;
}
