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
import type { LegDirection } from './trip-leg';

/**
 * Un'offerta e' una TRATTA, non una trasferta: una trasferta con auto e rientro
 * produce due offerte. L'identita' e' la coppia (`tripId`, `direction`).
 */
export interface SeatOffer {
  readonly tripId: TripId;
  /** Quale tratta della trasferta: andata o ritorno. */
  readonly direction: LegDirection;
  readonly ownerId: ProfileId;
  /** Stabilimento di appartenenza di chi offre: entra nel punteggio, non nei vincoli duri. */
  readonly ownerPlantId: PlantId;
  /** Partenza di QUESTA tratta: sul ritorno e' la destinazione della trasferta. */
  readonly fromPlantId: PlantId;
  /** Arrivo di QUESTA tratta: sul ritorno e' la partenza della trasferta. */
  readonly toPlantId: PlantId;
  /**
   * ISO 8601. Orario di QUESTA tratta (`departureAt` della trasferta per l'andata,
   * `returnAt` per il ritorno). La vicinanza a questo orario e' la componente
   * principale del punteggio.
   */
  readonly departureAt: string;
  /** Posti liberi su QUESTA tratta, dal suo contatore e non da `Trip`. */
  readonly seatsAvailable: number;
}
