// Clock — il tempo entra da qui, non dall'orologio di sistema.
//
// core/ non puo' chiamare Date.now() ne' new Date(): lo impone il lint, e il motivo
// e' che un usecase che legge l'orologio non e' testabile sui confini. "La data di
// partenza e' nel passato" dipende da quando gira il test, e un test che cambia
// esito a mezzanotte non e' un test.

export interface Clock {
  /**
   * Istante corrente in ISO 8601 **normalizzato UTC**, con suffisso `Z` e i
   * millisecondi: `2026-11-03T06:30:00.000Z`.
   *
   * Il formato e' parte del contratto, non un dettaglio. Il dominio confronta gli
   * istanti come stringhe, e il confronto lessicografico e' corretto **solo** a
   * offset uguale: `2026-11-03T07:00:00+01:00` e `2026-11-03T06:00:00Z` sono lo
   * stesso istante ma due stringhe diverse, e `<` darebbe la risposta sbagliata.
   * Con tutto in UTC l'ordine lessicografico coincide con l'ordine cronologico.
   *
   * Vale per ogni istante che entra nel dominio, non solo per quelli prodotti qui:
   * T03 (finestra di tolleranza, confine incluso) e T04 (partenza nel passato) ci
   * si fondano. Normalizzare e' responsabilita' di chi scrive l'istante.
   */
  now(): string;
}
