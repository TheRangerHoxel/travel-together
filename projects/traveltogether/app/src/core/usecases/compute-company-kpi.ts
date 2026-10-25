// KPI aziendali: auto evitate, giorni di noleggio evitati, saving, CO2, carburante.
//
// Funzione pura: nessun I/O, nessun orologio, nessuna mutazione degli input.
//
// UNA SOLA BASE PER TUTTI I NUMERI: la trasferta del passeggero. La candidatura
// `accepted` e' l'INNESCO (dice che per quel collega non si e' noleggiato), non
// l'unita' di misura. Quattro numeri sulla stessa slide calcolati su basi diverse
// sono la prima cosa che qualcuno nota e smonta, quindi:
//  - auto evitata = una trasferta con `hasCar: false` indicata da ALMENO UNA
//    candidatura `accepted` (`requesterTripId`). Si conta la trasferta, non la
//    tratta e non la candidatura: condividere due tratte non fa due auto;
//  - giorni evitati = i giorni di QUELLA trasferta, estremi inclusi, 1 se manca
//    il rientro;
//  - km evitati = la distanza della tratta della trasferta, per andata E ritorno
//    (x1 se `returnAt` e' null): chi non ha noleggiato non ha guidato, quindi la
//    sua auto mancata non ha percorso nessuna delle due tratte, anche se ne ha
//    condivisa una sola. CO2 e carburante NON raddoppiano passando da una a due
//    tratte condivise, esattamente come auto e giorni;
//  - CO2 = km evitati x g/km;
//  - saving = (giorni x costo auto/giorno) + (km x consumo l/100km / 100 x prezzo
//    carburante). Le due componenti sono esposte a parte;
//  - chi offre l'auto non conta (la sua trasferta ha `hasCar: true`);
//  - DUE STATI DIVERSI SU DUE COSE DIVERSE, da non confondere:
//      * stato della CANDIDATURA: solo `accepted` innesca; `pending`, `rejected` e
//        `cancelled` non contribuiscono a niente;
//      * stato della TRASFERTA del passeggero: `cancelled` non contribuisce ad alcun
//        KPI, nemmeno con una candidatura accettata; `published` e `completed` si.
//
// La trasferta del passeggero si legge dal campo `requesterTripId` della
// candidatura: nessuna ricostruzione per indizio (plant, giorno).
//
// COPPIA DI PLANT ASSENTE DALLA TABELLA: errore tipizzato, non zero. Uno zero
// farebbe sparire dalla CO2 una tratta reale e mostrerebbe in demo una cifra
// plausibile e al ribasso; l'errore costringe a completare la tabella. E' la
// stessa scelta di findMatches ("non ho potuto calcolare" != "il risultato e' 0").
//
// RIENTRO PRECEDENTE ALLA PARTENZA in una trasferta che entra nel conto: errore
// tipizzato `invalid-trip-date`, per lo stesso motivo. Una data impossibile
// (es. 2026-02-31) non e' piu' rappresentabile: lo impedisce il tipo `UtcInstant`.

import type { MatchRequest, PlantId, Result, Trip } from '../domain';
import { err, inclusiveDaysBetween, ok, utcInstantParts } from '../domain';
import type { KpiConfig } from './kpi-config';
import { lookupPlantDistance } from './plant-distance';

export interface CompanyKpi {
  /** Trasferte senza auto con almeno una candidatura accettata. */
  readonly avoidedCars: number;
  /** Somma dei giorni (estremi inclusi) delle trasferte delle auto evitate. */
  readonly avoidedRentalDays: number;
  /** Km di tratta delle trasferte evitate, andata e ritorno. */
  readonly avoidedKm: number;
  /** Componente noleggio: giorni evitati x costo auto/giorno. */
  readonly rentalSavingsEuro: number;
  /** Componente carburante: km evitati x consumo/100 x prezzo al litro. */
  readonly fuelSavingsEuro: number;
  /** `rentalSavingsEuro + fuelSavingsEuro`. Stima, non misura. */
  readonly savingsEuro: number;
  /** Km evitati x g CO2/km. In grammi, stima. */
  readonly co2AvoidedGrams: number;
}

export type CompanyKpiError =
  | {
      readonly kind: 'invalid-config';
      readonly field:
        | 'gramsCo2PerKm'
        | 'rentalCostPerDay'
        | 'fuelConsumptionLitersPer100Km'
        | 'fuelPricePerLiter'
        | 'distanceKm';
    }
  /** Una candidatura accettata indica una trasferta del richiedente che non e' fra quelle date. */
  | {
      readonly kind: 'unknown-requester-trip';
      readonly requestId: string;
      readonly requesterTripId: string;
    }
  | { readonly kind: 'invalid-trip-date'; readonly tripId: string; readonly value: string }
  | {
      readonly kind: 'missing-distance';
      readonly fromPlantId: PlantId;
      readonly toPlantId: PlantId;
    };

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

const SCALARS = [
  'gramsCo2PerKm',
  'rentalCostPerDay',
  'fuelConsumptionLitersPer100Km',
  'fuelPricePerLiter',
] as const;

const KM_PER_CONSUMPTION_UNIT = 100;

/**
 * I KPI aziendali su trasferte e candidature date.
 *
 * `trips` deve contenere le trasferte dei passeggeri indicate da
 * `requesterTripId`. Le candidature non `accepted` vengono ignorate prima di ogni conto.
 */
export function computeCompanyKpi(
  trips: readonly Trip[],
  requests: readonly MatchRequest[],
  config: KpiConfig
): Result<CompanyKpi, CompanyKpiError> {
  for (const field of SCALARS) {
    if (!isNonNegativeFinite(config[field])) return err({ kind: 'invalid-config', field });
  }

  // Le trasferte evitate, ciascuna UNA volta qualunque numero di candidature la indichi.
  const avoided = new Map<string, Trip>();

  for (const request of requests) {
    if (request.status !== 'accepted') continue;

    const own = trips.find((t) => t.id === request.requesterTripId);
    if (!own) {
      return err({
        kind: 'unknown-requester-trip',
        requestId: request.id,
        requesterTripId: request.requesterTripId,
      });
    }
    // Chi ha l'auto ha noleggiato: non e' un'auto evitata.
    if (own.hasCar) continue;
    // Una trasferta annullata non e' avvenuta: non c'era nessun noleggio da evitare,
    // nessun km da non percorrere, nessuna CO2 da non emettere. Contarla gonfierebbe
    // tutti e quattro i numeri. `published` e `completed` contribuiscono.
    if (own.status === 'cancelled') continue;

    avoided.set(own.id, own);
  }

  let days = 0;
  let km = 0;

  for (const trip of avoided.values()) {
    // Le date sono di istanti normalizzati, quindi esistono in calendario. Resta
    // rappresentabile un rientro PRECEDENTE alla partenza: lo coglie il conteggio.
    const start = utcInstantParts(trip.departureAt).date;

    let tripDays = 1;
    if (trip.returnAt !== null) {
      const end = utcInstantParts(trip.returnAt).date;
      const count = inclusiveDaysBetween(start, end);
      if (count === null) {
        return err({ kind: 'invalid-trip-date', tripId: trip.id, value: trip.returnAt });
      }
      tripDays = count;
    }

    const legKm = lookupPlantDistance(config, trip.fromPlantId, trip.toPlantId);
    if (legKm === undefined) {
      return err({
        kind: 'missing-distance',
        fromPlantId: trip.fromPlantId,
        toPlantId: trip.toPlantId,
      });
    }
    if (!isNonNegativeFinite(legKm)) return err({ kind: 'invalid-config', field: 'distanceKm' });

    days += tripDays;
    km += trip.returnAt === null ? legKm : legKm * 2;
  }

  const rentalSavingsEuro = days * config.rentalCostPerDay;
  const fuelSavingsEuro =
    ((km * config.fuelConsumptionLitersPer100Km) / KM_PER_CONSUMPTION_UNIT) *
    config.fuelPricePerLiter;

  return ok({
    avoidedCars: avoided.size,
    avoidedRentalDays: days,
    avoidedKm: km,
    rentalSavingsEuro,
    fuelSavingsEuro,
    savingsEuro: rentalSavingsEuro + fuelSavingsEuro,
    co2AvoidedGrams: km * config.gramsCo2PerKm,
  });
}
