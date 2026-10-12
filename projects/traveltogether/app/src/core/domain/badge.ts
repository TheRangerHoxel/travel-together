// Badge — riconoscimenti simbolici.
//
// Nessun badge implica premi, denaro o buoni: welfare e alberi piantati sono fuori
// scope per decisione dell'umano (PRD). Il dominio modella l'identita' del badge;
// le SOGLIE che lo assegnano stanno in config/ (T07), non qui.

export type BadgeId = 'primo-viaggio' | 'cinque-viaggi' | 'dieci-viaggi';

export const BADGE_IDS: readonly BadgeId[] = ['primo-viaggio', 'cinque-viaggi', 'dieci-viaggi'];

export interface Badge {
  readonly id: BadgeId;
  /** Testo mostrato all'utente, in italiano. */
  readonly label: string;
}
