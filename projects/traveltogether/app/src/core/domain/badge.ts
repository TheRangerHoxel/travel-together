// Badge — riconoscimenti simbolici.
//
// Nessun badge implica premi, denaro o buoni: welfare e alberi piantati sono fuori
// scope per decisione dell'umano (PRD). Il dominio modella l'identita' del badge;
// le SOGLIE che lo assegnano stanno in config/ (T07), non qui.

// Due famiglie. Passeggero: viaggi condivisi. Conducente: chi ha offerto posti E ha
// visto accettare almeno una candidatura (T07, "il conducente va riconosciuto").
export type BadgeId =
  | 'primo-viaggio'
  | 'cinque-viaggi'
  | 'dieci-viaggi'
  | 'primo-passaggio'
  | 'cinque-colleghi'
  | 'mille-km';

export const BADGE_IDS: readonly BadgeId[] = [
  'primo-viaggio',
  'cinque-viaggi',
  'dieci-viaggi',
  'primo-passaggio',
  'cinque-colleghi',
  'mille-km',
];

export interface Badge {
  readonly id: BadgeId;
  /** Testo mostrato all'utente, in italiano. */
  readonly label: string;
}
