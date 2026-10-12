// Profile — chi usa l'app.
//
// Nessun dato personale reale entra mai qui dentro: l'MVP e' una demo su dati
// sintetici. Niente email, niente matricola, niente telefono: il dominio non ne
// ha bisogno, e cio' che non si modella non si puo' esporre per sbaglio.

import type { PlantId } from './plant';

export type ProfileId = string;

export interface Profile {
  readonly id: ProfileId;
  /** Nome mostrato ai colleghi. Nella demo e' dichiaratamente fittizio. */
  readonly displayName: string;
  /** Stabilimento di appartenenza: pesa nel punteggio del matching (T03). */
  readonly plantId: PlantId;
}
