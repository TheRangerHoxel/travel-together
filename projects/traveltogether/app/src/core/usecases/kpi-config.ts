// Parametri configurabili dei KPI aziendali.
//
// Il TIPO sta qui, nel core, perche' e' parte della firma di computeCompanyKpi. I
// VALORI stanno in src/config/kpi.ts e vi arrivano come parametro, con lo stesso
// schema di MatchConfig; il legame fra le due meta' e' kpi-config.test.ts.

import type { PlantDistanceTable } from './plant-distance';

export interface KpiConfig {
  /** Grammi di CO2 per chilometro di un'auto. Numero finito >= 0. */
  readonly gramsCo2PerKm: number;
  /** Costo auto per giorno (noleggio), in euro. Numero finito >= 0. */
  readonly rentalCostPerDay: number;
  /** Consumo medio, in litri ogni 100 km. Numero finito >= 0. */
  readonly fuelConsumptionLitersPer100Km: number;
  /** Prezzo del carburante, in euro al litro. Numero finito >= 0. */
  readonly fuelPricePerLiter: number;
  /** Distanze in km fra le coppie di plant. Ogni valore e' un numero finito >= 0. */
  readonly distanceKm: PlantDistanceTable;
}
