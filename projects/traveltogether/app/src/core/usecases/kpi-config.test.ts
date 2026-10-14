// Test di conformita': lega i VALORI reali di config/kpi.ts al TIPO del core.
// Stessa ragione di match-config.test.ts: un campo rinominato in config/ arriverebbe
// a runtime come undefined e nei conti diventerebbe NaN. Il grosso lo fa `tsc`.
// E' l'unico punto del core che importa config/ per i KPI.

import { KPI_CONFIG } from '../../config';
import { computeCompanyKpi } from './compute-company-kpi';
import type { KpiConfig } from './kpi-config';

describe('i valori di config/kpi.ts sono conformi al tipo del core', () => {
  it('KPI_CONFIG soddisfa KpiConfig', () => {
    // L'annotazione E' l'asserzione.
    const conforme: KpiConfig = KPI_CONFIG;
    expect(conforme.gramsCo2PerKm).toBe(KPI_CONFIG.gramsCo2PerKm);
  });

  it('i valori di produzione sono quelli dichiarati', () => {
    expect(KPI_CONFIG.gramsCo2PerKm).toBe(110);
    expect(KPI_CONFIG.rentalCostPerDay).toBe(120);
    expect(KPI_CONFIG.fuelConsumptionLitersPer100Km).toBe(7.0);
    expect(KPI_CONFIG.fuelPricePerLiter).toBe(2.2);
    expect(KPI_CONFIG.distanceKm.pomigliano.foggia).toBe(165);
    expect(KPI_CONFIG.distanceKm.pomigliano.grottaglie).toBe(320);
    expect(KPI_CONFIG.distanceKm.foggia.grottaglie).toBe(232);
  });

  it('con la config di produzione ogni coppia di plant e\' risolvibile nei due versi', () => {
    const pairs = [
      ['pomigliano', 'foggia'],
      ['pomigliano', 'grottaglie'],
      ['foggia', 'grottaglie'],
    ] as const;

    for (const [a, b] of pairs) {
      for (const [from, to] of [[a, b], [b, a]] as const) {
        const result = computeCompanyKpi(
          [
            {
              id: 'own',
              ownerId: 'someone',
              fromPlantId: from,
              toPlantId: to,
              departureAt: '2026-11-03T06:00:00Z',
              returnAt: null,
              hasCar: false,
              seatsTotal: 0,
              seatsAvailable: 0,
              status: 'published',
            },
          ],
          [
            {
              id: 'req',
              tripId: 'offer',
              direction: 'outbound',
              requesterId: 'someone',
              requesterTripId: 'own',
              status: 'accepted',
              requestNote: null,
              resolutionNote: null,
              resolvedBy: null,
            },
          ],
          KPI_CONFIG
        );
        expect(result.ok).toBe(true);
      }
    }
  });
});
