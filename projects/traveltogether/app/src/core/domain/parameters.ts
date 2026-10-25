// I parametri configurabili dell'app: i TIPI che gli usecase ricevono come config e i
// PREDICATI che ne definiscono l'intervallo valido.
//
// Stanno in domain/ e non in usecases/ perche' il port ParameterRepository li
// restituisce, e ports/ puo' importare solo domain/. usecases/ li riesporta con lo
// stesso nome: la loro superficie pubblica non cambia.
//
// I predicati sono UNO per intervallo e li chiamano sia gli usecase (che validano la
// config che ricevono) sia parseParameters (che valida le righe lette dalla tabella):
// due copie dello stesso `>= 0` divergerebbero in silenzio.

import type { BadgeId } from './badge';
import type { PlantId } from './plant';

export interface MatchConfig {
  /**
   * Quanto puo' distare l'orario di un'offerta da quello richiesto, in minuti.
   * Il confine e' **incluso**: con 30, un'offerta a esattamente 30 minuti e' un match.
   * Deve essere un intero >= 0.
   */
  readonly toleranceMinutes: number;
}

export interface CreateTripConfig {
  /**
   * Massimo di posti che si possono offrire con un'auto. Confine **incluso**:
   * con 8, offrire 8 posti e' valido e 9 no. Deve essere un intero >= 1.
   * Il minimo (1) non e' configurabile: offrire zero posti dichiarando l'auto non
   * e' un'offerta.
   */
  readonly maxSeatsOffered: number;
}

/**
 * Distanze fra stabilimenti, in km, **dichiarate una volta sola per coppia**: la
 * ricerca e' simmetrica (`a -> b` e, se manca, `b -> a`), perche' la tratta di
 * ritorno ha i plant invertiti e la tabella non deve ripetere la stessa strada.
 */
export type PlantDistanceTable = Readonly<
  Partial<Record<PlantId, Readonly<Partial<Record<PlantId, number>>>>>
>;

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

export interface CascadeConfig {
  /**
   * Nota scritta sulle candidature rifiutate dal sistema quando l'ultimo posto di
   * una tratta viene accettato. Passa dalla stessa validazione di ogni nota, quindi
   * deve stare entro `NoteConfig.maxLength` in code point: lo verifica
   * `parseParameters` sul limite caricato insieme a lei.
   */
  readonly autoRejectNote: string;
}

export interface BadgeConfig {
  /**
   * Per ogni badge, il valore della sua metrica a cui si assegna ("almeno"). Intero
   * >= 1: con 0 il badge andrebbe a chi non ha fatto niente.
   */
  readonly thresholds: Readonly<Record<BadgeId, number>>;
  /**
   * Per ogni badge, il testo mostrato all'utente. Non vuoto e senza le parole di
   * `FORBIDDEN_BADGE_WORDS` (i badge sono simbolici). Non cita le soglie in numeri:
   * la soglia e' un parametro, e "Cinque viaggi" con soglia 3 mentirebbe.
   */
  readonly labels: Readonly<Record<BadgeId, string>>;
}

/** Minimo di posti per dichiarare un'auto. Non configurabile: zero posti non e' un'offerta. */
export const MIN_SEATS_WITH_CAR = 1;

/** Tolleranza oraria: intero >= 0 (zero = solo l'orario esatto). */
export function isValidToleranceMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/** Massimo di posti offribili: intero >= del minimo di un'auto. */
export function isValidMaxSeatsOffered(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_SEATS_WITH_CAR;
}

/** Valore di un KPI (costo, consumo, g/km, distanza): numero finito >= 0. */
export function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Soglia di un badge: intero >= 1. */
export function isValidBadgeThreshold(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/** Limite delle note, in code point: intero >= 1. */
export function isValidNoteMaxLength(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}
