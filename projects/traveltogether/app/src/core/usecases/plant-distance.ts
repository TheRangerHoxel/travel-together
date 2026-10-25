// Distanze fra stabilimenti: la forma della tabella e la ricerca, in UN punto solo.
//
// Perche' un modulo a se': la ricerca simmetrica e' una regola, e la usano sia i KPI
// aziendali sia le statistiche personali dei badge. Due copie divergerebbero in
// silenzio (una smette di provare `b -> a` e nessun test dell'altra se ne accorge).
// Il nome dice cosa contiene (plant + distanza), non chi lo usa.

import type { PlantDistanceTable, PlantId } from '../domain';

// Il tipo della tabella vive in core/domain/parameters.ts (lo restituisce il port
// ParameterRepository); qui resta il percorso storico, invariato per chi importa da
// usecases/.
export type { PlantDistanceTable } from '../domain';

/** Cio' che serve a cercare una distanza: la tabella. */
export interface PlantDistanceConfig {
  /** Distanze in km fra le coppie di plant. Ogni valore e' un numero finito >= 0. */
  readonly distanceKm: PlantDistanceTable;
}

/**
 * Ricerca SIMMETRICA: prima `a -> b`, poi `b -> a`. Ritorna `undefined` se la
 * coppia non e' nella tabella in nessun verso.
 */
export function lookupPlantDistance(
  config: PlantDistanceConfig,
  a: PlantId,
  b: PlantId
): number | undefined {
  return config.distanceKm[a]?.[b] ?? config.distanceKm[b]?.[a];
}
