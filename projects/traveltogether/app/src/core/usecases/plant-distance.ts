// Distanze fra stabilimenti: la forma della tabella e la ricerca, in UN punto solo.
//
// Perche' un modulo a se': la ricerca simmetrica e' una regola, e la usano sia i KPI
// aziendali sia le statistiche personali dei badge. Due copie divergerebbero in
// silenzio (una smette di provare `b -> a` e nessun test dell'altra se ne accorge).
// Il nome dice cosa contiene (plant + distanza), non chi lo usa.

import type { PlantId } from '../domain';

/**
 * Distanze fra stabilimenti, in km, **dichiarate una volta sola per coppia**: la
 * ricerca e' simmetrica (`a -> b` e, se manca, `b -> a`), perche' la tratta di
 * ritorno ha i plant invertiti e la tabella non deve ripetere la stessa strada.
 */
export type PlantDistanceTable = Readonly<
  Partial<Record<PlantId, Readonly<Partial<Record<PlantId, number>>>>>
>;

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
