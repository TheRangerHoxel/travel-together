// Badge — riconoscimenti simbolici.
//
// Nessun badge implica premi, denaro o buoni: welfare e alberi piantati sono fuori
// scope per decisione dell'umano (PRD). Il dominio modella l'identita' del badge;
// le SOGLIE che lo assegnano stanno in config/ (T07), non qui.

// Due famiglie. Passeggero: viaggi condivisi. Conducente: chi ha offerto posti E ha
// visto accettare almeno una candidatura (T07, "il conducente va riconosciuto").
//
// L'array e' la fonte e il tipo ne e' derivato: un badge nuovo si aggiunge in un
// punto solo, e chi ha un Record<BadgeId, ...> completo smette di compilare finche'
// non lo copre.
export const BADGE_IDS = [
  'primo-viaggio',
  'cinque-viaggi',
  'dieci-viaggi',
  'primo-passaggio',
  'cinque-colleghi',
  'mille-km',
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export interface Badge {
  readonly id: BadgeId;
  /** Testo mostrato all'utente, in italiano. */
  readonly label: string;
}
