// parseParameters: il confine fra la tabella dei parametri e il core.
//
// Funzione pura. Riceve righe GREZZE (`unknown` dentro: una tabella chiave/valore e
// una a colonne tipizzate producono entrambe questa forma, quindi la funzione non
// decide lo schema) e restituisce i tipi che gli usecase gia' ricevono, oppure il
// PRIMO errore, con il nome della chiave. Mai un default: un parametro mancante o
// malformato non diventa un valore plausibile (un `NaN` nella tolleranza farebbe
// sparire tutti i match senza errori; senza limite, le note non avrebbero piu' un
// tetto).
//
// Gli intervalli sono i predicati di parameters.ts, gli stessi che gli usecase
// applicano alla config che ricevono; le etichette passano da badge-label.ts; la
// nota automatica dal controllo di lunghezza di makeMatchRequest, col limite CARICATO.
//
// Le IDENTITA' restano nel codice: una chiave fuori da PARAMETER_KEYS, un badge fuori
// da BADGE_IDS o un plant fuori da PLANT_IDS sono rifiutati, quindi la tabella non
// puo' crearne di nuove.
//
// Ordine dei controlli, fisso: chiavi sconosciute, scalari nell'ordine di
// PARAMETER_KEYS, distanze, badge. Il primo errore vince; non si accumulano.

import type { BadgeId } from './badge';
import { BADGE_IDS } from './badge';
import { badgeLabelProblem } from './badge-label';
import type { MatchRequestError } from './match-request';
import { validaNota } from './match-request';
import type { NoteConfig } from './note-config';
import type {
  BadgeConfig,
  CascadeConfig,
  CreateTripConfig,
  KpiConfig,
  MatchConfig,
  PlantDistanceTable,
} from './parameters';
import {
  isNonNegativeFinite,
  isValidBadgeThreshold,
  isValidMaxSeatsOffered,
  isValidNoteMaxLength,
  isValidToleranceMinutes,
} from './parameters';
import type { PlantId } from './plant';
import { PLANT_IDS } from './plant';
import type { Result } from './result';
import { err, ok } from './result';

/** Le chiavi dei parametri scalari. Sono identita': la tabella non ne aggiunge. */
export const PARAMETER_KEYS = [
  'match.toleranceMinutes',
  'createTrip.maxSeatsOffered',
  'kpi.gramsCo2PerKm',
  'kpi.rentalCostPerDay',
  'kpi.fuelConsumptionLitersPer100Km',
  'kpi.fuelPricePerLiter',
  'notes.maxLength',
  'cascade.autoRejectNote',
] as const;

export type ParameterKey = (typeof PARAMETER_KEYS)[number];

/** Una riga della tabella delle distanze, cosi' com'e' stata letta. */
export interface RawPlantDistance {
  readonly fromPlantId: unknown;
  readonly toPlantId: unknown;
  readonly km: unknown;
}

/** Una riga della tabella dei badge, cosi' com'e' stata letta. */
export interface RawBadgeParameter {
  readonly badgeId: unknown;
  readonly threshold: unknown;
  readonly label: unknown;
}

export interface RawParameters {
  /** Parametri scalari per chiave (`PARAMETER_KEYS`). */
  readonly values: Readonly<Record<string, unknown>>;
  readonly plantDistances: readonly RawPlantDistance[];
  readonly badges: readonly RawBadgeParameter[];
}

/** Tutti i parametri, nei tipi che gli usecase ricevono gia'. */
export interface AppParameters {
  /** Per `findMatches`. */
  readonly matching: MatchConfig;
  /** Per `createTrip`. */
  readonly createTrip: CreateTripConfig;
  /** Per `computeCompanyKpi` (e, come `distances`, per le statistiche personali). */
  readonly kpi: KpiConfig;
  /** Per `makeMatchRequest` e per i repository che scrivono candidature. */
  readonly notes: NoteConfig;
  /** Per `acceptRequest` (insieme a `notes`). */
  readonly cascade: CascadeConfig;
  /** Per `awardBadges` e `refreshPersonalBests`. */
  readonly badges: BadgeConfig;
}

/**
 * Il parametro che non passa: `key` lo nomina ('match.toleranceMinutes',
 * 'distance:pomigliano-foggia', 'badge:mille-km.label'), `detail` dice perche'.
 */
export interface ParameterError {
  readonly key: string;
  readonly detail: string;
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'una stringa';
  if (typeof value === 'number') return `il numero ${String(value)}`;
  return `un valore di tipo ${typeof value}`;
}

function readNumber(
  values: Readonly<Record<string, unknown>>,
  key: ParameterKey,
  isValid: (value: number) => boolean,
  expected: string
): Result<number, ParameterError> {
  const value = values[key];
  if (value === undefined) return err({ key, detail: 'parametro mancante' });
  if (typeof value !== 'number') {
    return err({ key, detail: `atteso un numero, trovata ${describeValue(value)}` });
  }
  if (!isValid(value)) {
    return err({ key, detail: `${String(value)} fuori intervallo: atteso ${expected}` });
  }
  return ok(value);
}

function noteDetail(error: MatchRequestError): string {
  if (error.kind === 'note-too-long') {
    return `${String(error.length)} code point, oltre il limite caricato di ${String(error.maxLength)}`;
  }
  if (error.kind === 'note-blank') return 'testo vuoto o di soli spazi';
  return `nota non valida (${error.kind})`;
}

function isPlantId(value: unknown): value is PlantId {
  return PLANT_IDS.some((id) => id === value);
}

function isBadgeId(value: unknown): value is BadgeId {
  return BADGE_IDS.some((id) => id === value);
}

/** 'a-b' con i due plant nell'ordine di PLANT_IDS: la stessa coppia ha un solo nome. */
function pairName(a: PlantId, b: PlantId): string {
  const [first, second] = PLANT_IDS.indexOf(a) <= PLANT_IDS.indexOf(b) ? [a, b] : [b, a];
  return `distance:${first}-${second}`;
}

function parseDistances(
  rows: readonly RawPlantDistance[]
): Result<PlantDistanceTable, ParameterError> {
  const table: Partial<Record<PlantId, Partial<Record<PlantId, number>>>> = {};
  const seen = new Set<string>();

  for (const row of rows) {
    const { fromPlantId, toPlantId, km } = row;
    if (!isPlantId(fromPlantId) || !isPlantId(toPlantId)) {
      return err({
        key: `distance:${String(fromPlantId)}-${String(toPlantId)}`,
        detail: 'plant sconosciuto: la tabella non puo\' crearne',
      });
    }
    const key = pairName(fromPlantId, toPlantId);
    if (fromPlantId === toPlantId) {
      return err({ key, detail: 'i due plant della coppia sono uguali' });
    }
    if (seen.has(key)) {
      return err({ key, detail: 'coppia duplicata (anche con i plant invertiti)' });
    }
    if (typeof km !== 'number') {
      return err({ key, detail: `atteso un numero di km, trovata ${describeValue(km)}` });
    }
    if (!isNonNegativeFinite(km)) {
      return err({ key, detail: `${String(km)} km fuori intervallo: atteso un numero finito >= 0` });
    }
    seen.add(key);
    table[fromPlantId] = { ...table[fromPlantId], [toPlantId]: km };
  }

  for (const a of PLANT_IDS) {
    for (const b of PLANT_IDS) {
      if (PLANT_IDS.indexOf(a) >= PLANT_IDS.indexOf(b)) continue;
      const key = pairName(a, b);
      if (!seen.has(key)) return err({ key, detail: 'distanza mancante per la coppia' });
    }
  }
  return ok(table);
}

function parseBadges(rows: readonly RawBadgeParameter[]): Result<BadgeConfig, ParameterError> {
  const thresholds: Partial<Record<BadgeId, number>> = {};
  const labels: Partial<Record<BadgeId, string>> = {};

  for (const row of rows) {
    const { badgeId, threshold, label } = row;
    if (!isBadgeId(badgeId)) {
      return err({
        key: `badge:${String(badgeId)}`,
        detail: 'badge sconosciuto: la tabella non puo\' crearne',
      });
    }
    if (thresholds[badgeId] !== undefined) {
      return err({ key: `badge:${badgeId}`, detail: 'badge duplicato' });
    }
    if (typeof threshold !== 'number') {
      return err({
        key: `badge:${badgeId}.threshold`,
        detail: `attesa una soglia numerica, trovata ${describeValue(threshold)}`,
      });
    }
    if (!isValidBadgeThreshold(threshold)) {
      return err({
        key: `badge:${badgeId}.threshold`,
        detail: `${String(threshold)} fuori intervallo: atteso un intero >= 1`,
      });
    }
    if (typeof label !== 'string') {
      return err({
        key: `badge:${badgeId}.label`,
        detail: `attesa un'etichetta di testo, trovata ${describeValue(label)}`,
      });
    }
    const problem = badgeLabelProblem(label);
    if (problem !== null) {
      return err({
        key: `badge:${badgeId}.label`,
        detail:
          problem.kind === 'empty'
            ? 'etichetta vuota'
            : `l'etichetta contiene la parola vietata "${problem.word}"`,
      });
    }
    thresholds[badgeId] = threshold;
    labels[badgeId] = label;
  }

  const complete: { thresholds: Record<BadgeId, number>; labels: Record<BadgeId, string> } = {
    thresholds: { ...EMPTY_THRESHOLDS },
    labels: { ...EMPTY_LABELS },
  };
  for (const id of BADGE_IDS) {
    const threshold = thresholds[id];
    const label = labels[id];
    if (threshold === undefined || label === undefined) {
      return err({ key: `badge:${id}`, detail: 'badge mancante' });
    }
    complete.thresholds[id] = threshold;
    complete.labels[id] = label;
  }
  return ok(complete);
}

// Segnaposto per costruire un Record completo: ogni voce e' riscritta nel ciclo sopra
// oppure la funzione esce con errore, quindi nessuno di questi valori esce da qui.
const EMPTY_THRESHOLDS: Record<BadgeId, number> = {
  'primo-viaggio': 0,
  'cinque-viaggi': 0,
  'dieci-viaggi': 0,
  'primo-passaggio': 0,
  'cinque-colleghi': 0,
  'mille-km': 0,
};

const EMPTY_LABELS: Record<BadgeId, string> = {
  'primo-viaggio': '',
  'cinque-viaggi': '',
  'dieci-viaggi': '',
  'primo-passaggio': '',
  'cinque-colleghi': '',
  'mille-km': '',
};

/** Valida le righe lette dalla tabella e le trasforma nei tipi degli usecase. */
export function parseParameters(raw: RawParameters): Result<AppParameters, ParameterError> {
  const { values } = raw;

  for (const key of Object.keys(values)) {
    if (!PARAMETER_KEYS.some((known) => known === key)) {
      return err({ key, detail: 'chiave sconosciuta: la tabella non puo\' crearne' });
    }
  }

  const tolerance = readNumber(values, 'match.toleranceMinutes', isValidToleranceMinutes, 'un intero >= 0');
  if (!tolerance.ok) return tolerance;

  const maxSeats = readNumber(values, 'createTrip.maxSeatsOffered', isValidMaxSeatsOffered, 'un intero >= 1');
  if (!maxSeats.ok) return maxSeats;

  const kpiRange = 'un numero finito >= 0';
  const gramsCo2PerKm = readNumber(values, 'kpi.gramsCo2PerKm', isNonNegativeFinite, kpiRange);
  if (!gramsCo2PerKm.ok) return gramsCo2PerKm;
  const rentalCostPerDay = readNumber(values, 'kpi.rentalCostPerDay', isNonNegativeFinite, kpiRange);
  if (!rentalCostPerDay.ok) return rentalCostPerDay;
  const fuelConsumption = readNumber(
    values,
    'kpi.fuelConsumptionLitersPer100Km',
    isNonNegativeFinite,
    kpiRange
  );
  if (!fuelConsumption.ok) return fuelConsumption;
  const fuelPrice = readNumber(values, 'kpi.fuelPricePerLiter', isNonNegativeFinite, kpiRange);
  if (!fuelPrice.ok) return fuelPrice;

  const noteMaxLength = readNumber(values, 'notes.maxLength', isValidNoteMaxLength, 'un intero >= 1');
  if (!noteMaxLength.ok) return noteMaxLength;
  const notes: NoteConfig = { maxLength: noteMaxLength.value };

  const autoRejectNote = values['cascade.autoRejectNote'];
  if (autoRejectNote === undefined) {
    return err({ key: 'cascade.autoRejectNote', detail: 'parametro mancante' });
  }
  if (typeof autoRejectNote !== 'string') {
    return err({
      key: 'cascade.autoRejectNote',
      detail: `atteso un testo, trovata ${describeValue(autoRejectNote)}`,
    });
  }
  const noteProblem = validaNota('resolutionNote', autoRejectNote, notes);
  if (noteProblem !== null) {
    return err({ key: 'cascade.autoRejectNote', detail: noteDetail(noteProblem) });
  }

  const distances = parseDistances(raw.plantDistances);
  if (!distances.ok) return distances;

  const badges = parseBadges(raw.badges);
  if (!badges.ok) return badges;

  return ok({
    matching: { toleranceMinutes: tolerance.value },
    createTrip: { maxSeatsOffered: maxSeats.value },
    kpi: {
      gramsCo2PerKm: gramsCo2PerKm.value,
      rentalCostPerDay: rentalCostPerDay.value,
      fuelConsumptionLitersPer100Km: fuelConsumption.value,
      fuelPricePerLiter: fuelPrice.value,
      distanceKm: distances.value,
    },
    notes,
    cascade: { autoRejectNote },
    badges: badges.value,
  });
}
