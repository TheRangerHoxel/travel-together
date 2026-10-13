// Parametri configurabili delle note di una candidatura.
//
// Il TIPO sta in domain/ e non in usecases/ (a differenza di MatchConfig) perche'
// la validazione della nota vive nel costruttore di dominio makeMatchRequest, e
// domain/ puo' importare solo domain/. I VALORI stanno in src/config/notes.ts; il
// legame fra le due meta' e' core/usecases/note-config.test.ts.

export interface NoteConfig {
  /**
   * Lunghezza massima di una nota, in **code point** (non in unita' di stringa:
   * '👍'.length === 2). Confine **incluso**: con 10, una nota di 10 e' valida e di
   * 11 no. Deve essere un intero >= 1.
   */
  readonly maxLength: number;
}
