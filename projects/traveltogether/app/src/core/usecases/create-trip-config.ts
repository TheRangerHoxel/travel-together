// Parametri configurabili della creazione di una trasferta.
//
// Stesso schema di MatchConfig: il TIPO sta qui, nel core, perche' e' parte della
// firma di createTrip; i VALORI stanno in src/config/ e arrivano come parametro.
// Il legame fra le due meta' e' create-trip-config.test.ts.

export interface CreateTripConfig {
  /**
   * Massimo di posti che si possono offrire con un'auto. Confine **incluso**:
   * con 8, offrire 8 posti e' valido e 9 no. Deve essere un intero >= 1.
   * Il minimo (1) non e' configurabile: offrire zero posti dichiarando l'auto non
   * e' un'offerta.
   */
  readonly maxSeatsOffered: number;
}
