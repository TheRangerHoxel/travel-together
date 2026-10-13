// Valori di configurazione della creazione di una trasferta.
//
// Niente annotazione di tipo, per lo stesso motivo di matching.ts: il lint vieta
// a config/ di importare usecases/. Il legame col tipo CreateTripConfig e' in
// core/usecases/create-trip-config.test.ts.

export const CREATE_TRIP_CONFIG = {
  /** Massimo di posti offribili con un'auto. Confine incluso. */
  maxSeatsOffered: 8,
} as const;
