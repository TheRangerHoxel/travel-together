// Parametri della cascata di auto-rifiuto (T05).
//
// Il TIPO sta qui, i VALORI in src/config/notes.ts; il legame fra le due meta' e'
// cascade-config.test.ts. Il testo della nota automatica e' un parametro e non una
// stringa nel codice: e' cio' che un collega leggera' come motivo del rifiuto.

export interface CascadeConfig {
  /**
   * Nota scritta sulle candidature rifiutate dal sistema quando l'ultimo posto di
   * una tratta viene accettato. Passa dalla stessa validazione di ogni nota, quindi
   * deve stare entro `NoteConfig.maxLength` in code point: il test di conformita'
   * lo verifica sul valore di produzione.
   */
  readonly autoRejectNote: string;
}
