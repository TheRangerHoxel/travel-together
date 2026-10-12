// Errori dei port, tipizzati.
//
// Un errore di rete di Supabase non deve arrivare al core come eccezione grezza:
// l'adapter lo traduce in uno di questi. E' cio' che permette al core di gestire
// il fallimento senza conoscere chi sta sotto.

export type RepositoryError =
  /** L'entita' richiesta non esiste. */
  | { readonly kind: 'not-found'; readonly id: string }
  /**
   * Il record viola un invariante di dominio.
   *
   * Si produce in **scrittura**, quando si tenta di salvare un'entita' non valida,
   * e nelle **letture di una singola entita'**, quando lo storage restituisce un
   * record che il dominio rifiuta: un dato invalido che arriva dal DB non e' meno
   * invalido di uno scritto a mano, ed e' li' che si presentera' davvero (una
   * migrazione, uno script di seed, una query eseguita a mano).
   *
   * Le letture di **liste** non validano riga per riga, deliberatamente: far
   * fallire un'intera schermata per una riga incoerente e' un degrado
   * sproporzionato. Accorgersi di quelle righe e' un problema di osservabilita'
   * (serve un port dedicato) e non di tipo d'errore.
   */
  | { readonly kind: 'invalid-record'; readonly id: string; readonly detail: string }
  /** Lo storage non risponde: rete giu', permessi negati, RLS che blocca. */
  | { readonly kind: 'storage-unavailable'; readonly detail: string };
