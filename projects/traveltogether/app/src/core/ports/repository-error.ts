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
   * Si produce in **scrittura**, quando si tenta di salvare un'entita' non valida
   * (o una seconda candidatura sulla stessa coppia tratta/richiedente: l'unicita' e'
   * un invariante del dominio, non un guasto), e nelle **letture di una singola
   * entita'**, quando lo storage restituisce un record che il dominio rifiuta: un
   * dato invalido che arriva dal DB non e' meno invalido di uno scritto a mano, ed
   * e' li' che si presentera' davvero (una migrazione, uno script di seed, una
   * query eseguita a mano).
   *
   * Le letture di **liste** validano riga per riga e **omettono** le righe che il
   * dominio rifiuta, invece di fallire: far fallire un'intera schermata per una riga
   * incoerente e' un degrado sproporzionato. L'omissione e' oggi **silenziosa**: il
   * canale per accorgersene non esiste ancora (e' la voce «Port di osservabilita'»
   * di IDEAS.md, non schedulata), quindi nessun chiamante puo' saperla.
   * `findByLegAndRequester` e' una lettura singola, non una lista: una riga invalida
   * e' `invalid-record` e non `null`, perche' un `null` direbbe "non si e' mai
   * candidato".
   */
  | { readonly kind: 'invalid-record'; readonly id: string; readonly detail: string }
  /**
   * Lo storage non risponde: rete giu', permessi negati, RLS che blocca. Vale per le
   * **scritture** negate da una policy; una lettura negata non e' un errore, la riga
   * semplicemente non c'e'.
   */
  | { readonly kind: 'storage-unavailable'; readonly detail: string };
