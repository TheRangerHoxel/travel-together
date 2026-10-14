// Valori di configurazione delle note di una candidatura.
//
// Niente annotazione di tipo, per lo stesso motivo di matching.ts: il lint vieta
// a config/ di importare domain/. Il legame col tipo NoteConfig e' in
// core/usecases/note-config.test.ts.

export const NOTE_CONFIG = {
  /** Lunghezza massima di una nota, in code point. Confine incluso. */
  maxLength: 280,
} as const;

export const CASCADE_CONFIG = {
  /** Nota sulle candidature chiuse dal sistema all'esaurirsi dei posti. Entro NOTE_CONFIG.maxLength. */
  autoRejectNote: 'Posti esauriti: è stato accettato un altro collega.',
} as const;
