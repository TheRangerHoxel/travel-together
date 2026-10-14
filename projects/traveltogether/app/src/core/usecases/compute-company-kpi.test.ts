// I KPI aziendali. I valori di config qui sono FIXTURE tonde e diverse da quelle di
// produzione: i conti a mano si leggono, e un valore di produzione hardcoded nel
// core non passerebbe.
//
// Fixture: 100 g CO2/km, 50 euro/giorno di auto, 10 l/100km a 2 euro/l (cioe' 0,2
// euro/km di carburante), Pomigliano-Foggia 200 km.

import type { MatchRequest, MatchRequestStatus, LegDirection, Trip } from '../domain';
import type { CompanyKpi, CompanyKpiError } from './compute-company-kpi';
import { computeCompanyKpi } from './compute-company-kpi';
import type { KpiConfig } from './kpi-config';

// La tabella dichiara UNA volta sola ogni coppia, e nel verso che capita.
const CONFIG: KpiConfig = {
  gramsCo2PerKm: 100,
  rentalCostPerDay: 50,
  fuelConsumptionLitersPer100Km: 10,
  fuelPricePerLiter: 2,
  distanceKm: {
    pomigliano: { foggia: 200 },
    foggia: { grottaglie: 300 },
  },
};

// Chi offre l'auto: Pomigliano -> Foggia, 3-5 nov. Con auto.
const OFFER: Trip = {
  id: 'offer-1',
  ownerId: 'owner',
  fromPlantId: 'pomigliano',
  toPlantId: 'foggia',
  departureAt: '2026-11-03T06:00:00.000Z',
  returnAt: '2026-11-05T16:00:00.000Z',
  hasCar: true,
  seatsTotal: 3,
  seatsAvailable: 3,
  status: 'published',
};

// Trasferta del passeggero: stessa strada, 3 giorni, senza auto, con rientro.
const OWN: Trip = {
  id: 'own-1',
  ownerId: 'passenger',
  fromPlantId: 'pomigliano',
  toPlantId: 'foggia',
  departureAt: '2026-11-03T06:30:00.000Z',
  returnAt: '2026-11-05T17:00:00.000Z',
  hasCar: false,
  seatsTotal: 0,
  seatsAvailable: 0,
  status: 'published',
};

let counter = 0;
function request(
  direction: LegDirection,
  status: MatchRequestStatus,
  overrides: Partial<MatchRequest> = {}
): MatchRequest {
  counter += 1;
  return {
    id: `req-${counter}`,
    tripId: OFFER.id,
    direction,
    requesterId: 'passenger',
    requesterTripId: OWN.id,
    status,
    requestNote: null,
    resolutionNote: null,
    resolvedBy: null,
    ...overrides,
  };
}

function compute(
  trips: readonly Trip[],
  requests: readonly MatchRequest[],
  config: KpiConfig = CONFIG
): CompanyKpi {
  const result = computeCompanyKpi(trips, requests, config);
  if (!result.ok) throw new Error(`atteso ok, ottenuto ${JSON.stringify(result.error)}`);
  return result.value;
}

function computeError(
  trips: readonly Trip[],
  requests: readonly MatchRequest[],
  config: KpiConfig = CONFIG
): CompanyKpiError {
  const result = computeCompanyKpi(trips, requests, config);
  if (result.ok) throw new Error(`atteso errore, ottenuto ${JSON.stringify(result.value)}`);
  return result.error;
}

const ZERO: CompanyKpi = {
  avoidedCars: 0,
  avoidedRentalDays: 0,
  avoidedKm: 0,
  rentalSavingsEuro: 0,
  fuelSavingsEuro: 0,
  savingsEuro: 0,
  co2AvoidedGrams: 0,
};

describe('computeCompanyKpi — niente da contare', () => {
  it('nessuna candidatura: tutti i KPI a zero, nessun NaN', () => {
    expect(compute([OFFER, OWN], [])).toEqual(ZERO);
  });

  it('nessuna trasferta e nessuna candidatura: zero', () => {
    expect(compute([], [])).toEqual(ZERO);
  });

  it.each<MatchRequestStatus>(['pending', 'rejected', 'cancelled'])(
    'una candidatura %s non contribuisce a nessun KPI',
    (status) => {
      const kpi = compute([OFFER, OWN], [request('outbound', status), request('return', status)]);
      expect(kpi).toEqual(ZERO);
    }
  );

  it('un accepted fra molti non-accepted conta solo se stesso', () => {
    const kpi = compute(
      [OFFER, OWN],
      [request('outbound', 'pending'), request('return', 'accepted'), request('outbound', 'rejected')]
    );
    expect(kpi.avoidedCars).toBe(1);
    expect(kpi.avoidedRentalDays).toBe(3);
  });
});

describe('computeCompanyKpi — niente doppio conteggio, in entrambe le direzioni', () => {
  it('UNA tratta accettata su una trasferta di 3 giorni: 1 auto, 3 giorni', () => {
    const kpi = compute([OFFER, OWN], [request('outbound', 'accepted')]);
    expect(kpi.avoidedCars).toBe(1);
    expect(kpi.avoidedRentalDays).toBe(3);
  });

  it('ENTRAMBE le tratte accettate dello stesso collega: ancora 1 auto e 3 giorni, non 2 e non 6', () => {
    const kpi = compute(
      [OFFER, OWN],
      [request('outbound', 'accepted'), request('return', 'accepted')]
    );
    expect(kpi.avoidedCars).toBe(1);
    expect(kpi.avoidedRentalDays).toBe(3);
  });

  it('CO2, carburante e saving sono IDENTICI fra una tratta condivisa e due', () => {
    // La base e' la trasferta del passeggero, non la tratta: chi non ha noleggiato
    // non ha guidato ne' all'andata ne' al ritorno. La candidatura e' l'innesco.
    // Un test che pretendesse il raddoppio misurerebbe un altro numero sulla stessa
    // slide di auto e giorni, che invece non raddoppiano.
    const one = compute([OFFER, OWN], [request('outbound', 'accepted')]);
    const both = compute(
      [OFFER, OWN],
      [request('outbound', 'accepted'), request('return', 'accepted')]
    );
    expect(one.co2AvoidedGrams).toBe(40_000);
    expect(both.co2AvoidedGrams).toBe(one.co2AvoidedGrams);
    expect(both.fuelSavingsEuro).toBe(one.fuelSavingsEuro);
    expect(both.avoidedKm).toBe(one.avoidedKm);
    expect(both.savingsEuro).toBe(one.savingsEuro);
  });

  it('due colleghi diversi sulla stessa tratta sono 2 auto', () => {
    const second: Trip = { ...OWN, id: 'own-2', ownerId: 'passenger-2' };
    const kpi = compute(
      [OFFER, OWN, second],
      [
        request('outbound', 'accepted'),
        request('outbound', 'accepted', { requesterId: 'passenger-2', requesterTripId: 'own-2' }),
      ]
    );
    expect(kpi.avoidedCars).toBe(2);
    expect(kpi.avoidedRentalDays).toBe(6);
    expect(kpi.co2AvoidedGrams).toBe(80_000);
  });
});

describe('computeCompanyKpi — la trasferta e quella indicata, non indovinata', () => {
  it('con due trasferte identiche per plant e giorno conta quella indicata da requesterTripId', () => {
    // Il caso in cui l'euristica per plant e giorno sbaglia: stessa persona, due
    // trasferte sulla stessa tratta nello stesso giorno, una di 3 giorni e una di 6.
    const twin: Trip = { ...OWN, id: 'own-twin', returnAt: '2026-11-08T17:00:00.000Z' };
    const kpi = compute([OFFER, OWN, twin], [request('outbound', 'accepted', { requesterTripId: 'own-twin' })]);
    expect(kpi.avoidedCars).toBe(1);
    expect(kpi.avoidedRentalDays).toBe(6);

    const other = compute([OFFER, OWN, twin], [request('outbound', 'accepted', { requesterTripId: 'own-1' })]);
    expect(other.avoidedRentalDays).toBe(3);
  });

  it('una trasferta indicata ma assente dai dati e\' un errore, non uno zero', () => {
    const req = request('outbound', 'accepted', { requesterTripId: 'ghost' });
    expect(computeError([OFFER, OWN], [req])).toEqual({
      kind: 'unknown-requester-trip',
      requestId: req.id,
      requesterTripId: 'ghost',
    });
  });

  it('una candidatura NON accettata con trasferta ignota non fa fallire il calcolo', () => {
    expect(
      compute([OFFER, OWN], [request('outbound', 'pending', { requesterTripId: 'ghost' })])
    ).toEqual(ZERO);
  });
});

describe('computeCompanyKpi — chi non e un\'auto evitata', () => {
  it('chi offre l\'auto non compare fra le auto evitate', () => {
    const kpi = compute(
      [OFFER],
      [request('outbound', 'accepted', { requesterId: OFFER.ownerId, requesterTripId: OFFER.id })]
    );
    expect(kpi).toEqual(ZERO);
  });

  it('una trasferta del passeggero annullata non contribuisce a nessun KPI, pur con una candidatura accepted', () => {
    const cancelled: Trip = { ...OWN, status: 'cancelled' };
    expect(
      compute(
        [OFFER, cancelled],
        [request('outbound', 'accepted'), request('return', 'accepted')]
      )
    ).toEqual(ZERO);
  });

  it.each<Trip['status']>(['published', 'completed'])(
    'una trasferta del passeggero %s contribuisce',
    (status) => {
      const kpi = compute([OFFER, { ...OWN, status }], [request('outbound', 'accepted')]);
      expect(kpi.avoidedCars).toBe(1);
      expect(kpi.avoidedRentalDays).toBe(3);
      expect(kpi.savingsEuro).toBe(230);
      expect(kpi.co2AvoidedGrams).toBe(40_000);
    }
  );

  it('un richiedente la cui trasferta ha l\'auto non e\' un\'auto evitata', () => {
    const withCar: Trip = { ...OWN, hasCar: true, seatsTotal: 2, seatsAvailable: 2 };
    expect(compute([OFFER, withCar], [request('outbound', 'accepted')])).toEqual(ZERO);
  });
});

describe('computeCompanyKpi — giorni di noleggio', () => {
  it('returnAt null: 1 giorno', () => {
    const oneWay: Trip = { ...OWN, returnAt: null };
    const kpi = compute([OFFER, oneWay], [request('outbound', 'accepted')]);
    expect(kpi.avoidedCars).toBe(1);
    expect(kpi.avoidedRentalDays).toBe(1);
  });

  it('rientro lo stesso giorno: 1 giorno, non 0', () => {
    const sameDay: Trip = { ...OWN, returnAt: '2026-11-03T18:00:00.000Z' };
    expect(compute([OFFER, sameDay], [request('outbound', 'accepted')]).avoidedRentalDays).toBe(1);
  });

  it('i giorni sono quelli della trasferta del passeggero, non quelli dell\'offerente', () => {
    const longer: Trip = { ...OWN, returnAt: '2026-11-08T17:00:00.000Z' };
    expect(compute([OFFER, longer], [request('outbound', 'accepted')]).avoidedRentalDays).toBe(6);
  });

  it('attraversa un 29 febbraio bisestile e il cambio d\'anno', () => {
    const ownLeap: Trip = {
      ...OWN,
      departureAt: '2028-02-28T06:30:00.000Z',
      returnAt: '2028-03-01T17:00:00.000Z',
    };
    expect(compute([OFFER, ownLeap], [request('outbound', 'accepted')]).avoidedRentalDays).toBe(3);

    const ownYear: Trip = {
      ...OWN,
      departureAt: '2026-12-31T06:30:00.000Z',
      returnAt: '2027-01-01T17:00:00.000Z',
    };
    expect(compute([OFFER, ownYear], [request('outbound', 'accepted')]).avoidedRentalDays).toBe(2);
  });

  it('una data di calendario impossibile e\' un errore tipizzato, non un conteggio', () => {
    const impossible: Trip = { ...OWN, returnAt: '2026-02-31T17:00:00.000Z' };
    expect(computeError([OFFER, impossible], [request('outbound', 'accepted')])).toEqual({
      kind: 'invalid-trip-date',
      tripId: 'own-1',
      value: '2026-02-31T17:00:00.000Z',
    });
  });

  it('un rientro precedente alla partenza e\' un errore tipizzato', () => {
    const reversed: Trip = { ...OWN, returnAt: '2026-11-01T17:00:00.000Z' };
    expect(computeError([OFFER, reversed], [request('outbound', 'accepted')]).kind).toBe(
      'invalid-trip-date'
    );
  });
});

describe('computeCompanyKpi — saving e CO2 a mano', () => {
  // Trasferta di 3 giorni con rientro, Pomigliano-Foggia 200 km: km evitati = 400.
  it('componente noleggio: 3 giorni x 50 = 150', () => {
    const kpi = compute([OFFER, OWN], [request('outbound', 'accepted')]);
    expect(kpi.rentalSavingsEuro).toBe(150);
  });

  it('componente carburante: 400 km x 10 l/100km x 2 euro/l = 80', () => {
    const kpi = compute([OFFER, OWN], [request('outbound', 'accepted')]);
    expect(kpi.avoidedKm).toBe(400);
    expect(kpi.fuelSavingsEuro).toBe(80);
  });

  it('il saving e la SOMMA delle due componenti: 150 + 80 = 230', () => {
    const kpi = compute([OFFER, OWN], [request('outbound', 'accepted')]);
    expect(kpi.savingsEuro).toBe(230);
    expect(kpi.savingsEuro).toBe(kpi.rentalSavingsEuro + kpi.fuelSavingsEuro);
  });

  it('le componenti rispondono ciascuna ai propri parametri e a nessun altro', () => {
    const requests = [request('outbound', 'accepted')];
    // Solo il costo auto cambia: si muove la componente noleggio e non il carburante.
    const rentalOnly = compute([OFFER, OWN], requests, { ...CONFIG, rentalCostPerDay: 70 });
    expect(rentalOnly.rentalSavingsEuro).toBe(210);
    expect(rentalOnly.fuelSavingsEuro).toBe(80);

    // Solo il prezzo del carburante: l'opposto.
    const price = compute([OFFER, OWN], requests, { ...CONFIG, fuelPricePerLiter: 3 });
    expect(price.rentalSavingsEuro).toBe(150);
    expect(price.fuelSavingsEuro).toBe(120);

    // Solo il consumo.
    const consumption = compute([OFFER, OWN], requests, {
      ...CONFIG,
      fuelConsumptionLitersPer100Km: 5,
    });
    expect(consumption.rentalSavingsEuro).toBe(150);
    expect(consumption.fuelSavingsEuro).toBe(40);
  });

  it('CO2: 400 km x 100 g/km = 40000 g', () => {
    const kpi = compute([OFFER, OWN], [request('outbound', 'accepted')]);
    expect(kpi.co2AvoidedGrams).toBe(40_000);
  });

  it('senza rientro i km sono quelli di una sola tratta: 200 km, CO2 20000 g, carburante 40', () => {
    const oneWay: Trip = { ...OWN, returnAt: null };
    const kpi = compute([OFFER, oneWay], [request('outbound', 'accepted')]);
    expect(kpi.avoidedKm).toBe(200);
    expect(kpi.co2AvoidedGrams).toBe(20_000);
    expect(kpi.fuelSavingsEuro).toBe(40);
  });

  it('cambiando i parametri il risultato cambia: niente valori hardcoded', () => {
    const requests = [request('outbound', 'accepted')];
    const base = compute([OFFER, OWN], requests);
    const changed = compute([OFFER, OWN], requests, {
      gramsCo2PerKm: 150,
      rentalCostPerDay: 80,
      fuelConsumptionLitersPer100Km: 5,
      fuelPricePerLiter: 4,
      distanceKm: { pomigliano: { foggia: 210 } },
    });
    expect(base.savingsEuro).toBe(230);
    // 3 x 80 + 420 km x 5/100 x 4 = 240 + 84
    expect(changed.savingsEuro).toBe(324);
    expect(changed.co2AvoidedGrams).toBe(420 * 150);
  });
});

describe('computeCompanyKpi — distanze simmetriche', () => {
  // La tabella dichiara pomigliano -> foggia e NON foggia -> pomigliano.
  it('Pomigliano->Foggia e Foggia->Pomigliano danno la stessa distanza', () => {
    const forward = compute([OFFER, OWN], [request('outbound', 'accepted')]);

    const reverseOwn: Trip = { ...OWN, fromPlantId: 'foggia', toPlantId: 'pomigliano' };
    const reverse = compute([OFFER, reverseOwn], [request('outbound', 'accepted')]);

    expect(forward.co2AvoidedGrams).toBe(40_000);
    expect(reverse.co2AvoidedGrams).toBe(forward.co2AvoidedGrams);
  });

  it('la coppia dichiarata nel verso opposto (Foggia->Grottaglie) si trova nei due versi', () => {
    const own: Trip = { ...OWN, fromPlantId: 'grottaglie', toPlantId: 'foggia' };
    expect(compute([OFFER, own], [request('outbound', 'accepted')]).co2AvoidedGrams).toBe(60_000);
  });
});

describe('computeCompanyKpi — coppia di plant assente dalla tabella', () => {
  const missingOwn: Trip = { ...OWN, fromPlantId: 'pomigliano', toPlantId: 'grottaglie' };

  it('errore tipizzato, non zero e non NaN', () => {
    expect(computeCompanyKpi([OFFER, missingOwn], [request('outbound', 'accepted')], CONFIG)).toEqual({
      ok: false,
      error: { kind: 'missing-distance', fromPlantId: 'pomigliano', toPlantId: 'grottaglie' },
    });
  });

  it('una coppia mancante su una candidatura NON accettata non fa fallire il calcolo', () => {
    expect(compute([OFFER, missingOwn], [request('outbound', 'pending')])).toEqual(ZERO);
  });

  it('una distanza non finita o negativa e\' un errore di config, non NaN', () => {
    expect(
      computeError([OFFER, OWN], [request('outbound', 'accepted')], {
        ...CONFIG,
        distanceKm: { pomigliano: { foggia: Number.NaN } },
      })
    ).toEqual({ kind: 'invalid-config', field: 'distanceKm' });
  });
});

describe('computeCompanyKpi — config incoerente', () => {
  it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])('gramsCo2PerKm %s -> invalid-config', (v) => {
    expect(computeError([], [], { ...CONFIG, gramsCo2PerKm: v })).toEqual({
      kind: 'invalid-config',
      field: 'gramsCo2PerKm',
    });
  });

  it.each([
    'rentalCostPerDay',
    'fuelConsumptionLitersPer100Km',
    'fuelPricePerLiter',
  ] as const)('%s negativo -> invalid-config', (field) => {
    expect(computeError([], [], { ...CONFIG, [field]: -5 })).toEqual({
      kind: 'invalid-config',
      field,
    });
  });
});

describe('computeCompanyKpi — purezza', () => {
  it('non muta gli input (congelati) ed e\' deterministica', () => {
    const trips: readonly Trip[] = Object.freeze([Object.freeze({ ...OFFER }), Object.freeze({ ...OWN })]);
    const requests: readonly MatchRequest[] = Object.freeze([
      Object.freeze(request('outbound', 'accepted')),
      Object.freeze(request('return', 'accepted')),
    ]);
    const first = compute(trips, requests);
    const second = compute(trips, requests);
    expect(second).toEqual(first);
  });
});
