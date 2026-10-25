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
   * Il formato e' parte del contratto, non un dettaglio. Il dominio confronta come
   * stringhe solo i `UtcInstant`, cioe' istanti normalizzati a **larghezza fissa**
   * (24 caratteri, sempre i millisecondi): solo cosi' l'ordine lessicografico
   * coincide con quello cronologico. Un offset diverso da `Z` o una forma corta
   * (`...06:00:00Z` contro `...06:00:00.000Z`: lo stesso istante, ordinate al
   * contrario) darebbero la risposta sbagliata, e per questo non si confrontano grezzi.
   *
   * Resta una `string`, non un `UtcInstant`: chi legge l'orologio per confrontare
   * (oggi `createTrip`) la passa dal parser degli istanti, che e' il confine. Un
   * orologio che producesse un'altra forma sarebbe cosi' rifiutato o riportato alla
   * forma canonica, mai confrontato com'e'.
   */
  now(): string;
}
