// Test di conformita': lega i VALORI reali di config/ al TIPO che il core si aspetta.
// Stessa ragione di match-config.test.ts: un campo rinominato arriverebbe a
// runtime come `undefined`, e i confronti con `undefined` sono tutti falsi.

import { CREATE_TRIP_CONFIG } from '../../config';
import type { CreateTripConfig } from './create-trip-config';

describe('i valori di config sono conformi al tipo del core', () => {
  it('CREATE_TRIP_CONFIG soddisfa CreateTripConfig', () => {
    const conforme: CreateTripConfig = CREATE_TRIP_CONFIG;

    expect(conforme.maxSeatsOffered).toBe(CREATE_TRIP_CONFIG.maxSeatsOffered);
  });

  it('il massimo dei posti e un intero >= 1, come createTrip pretende', () => {
    // createTrip rifiuta con 'invalid-config' tutto il resto: i valori di
    // PRODUZIONE non devono finire in quel ramo.
    expect(Number.isInteger(CREATE_TRIP_CONFIG.maxSeatsOffered)).toBe(true);
    expect(CREATE_TRIP_CONFIG.maxSeatsOffered).toBeGreaterThanOrEqual(1);
  });

  it('il massimo di produzione e 8, come dice il criterio di T04', () => {
    expect(CREATE_TRIP_CONFIG.maxSeatsOffered).toBe(8);
  });
});
