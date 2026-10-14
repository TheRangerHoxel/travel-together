// Statistiche personali. Config di distanza FIXTURE: Pomigliano-Foggia 200 km,
// Foggia-Grottaglie 300 km (dichiarate una volta, nel verso che capita).

import type { LegDirection, MatchRequest, MatchRequestStatus, Trip } from '../domain';
import type { PersonalStats, PersonalStatsError } from './compute-personal-stats';
import { computePersonalStats } from './compute-personal-stats';
import type { PlantDistanceConfig } from './plant-distance';

const CONFIG: PlantDistanceConfig = {
  distanceKm: {
    pomigliano: { foggia: 200 },
    foggia: { grottaglie: 300 },
  },
};

function trip(id: string, ownerId: string, overrides: Partial<Trip> = {}): Trip {
  return {
    id,
    ownerId,
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    departureAt: '2026-11-03T06:00:00.000Z',
    returnAt: '2026-11-05T16:00:00.000Z',
    hasCar: false,
    seatsTotal: 0,
    seatsAvailable: 0,
    status: 'published',
    ...overrides,
  };
}

function driverTrip(id: string, ownerId: string, overrides: Partial<Trip> = {}): Trip {
  return trip(id, ownerId, { hasCar: true, seatsTotal: 3, seatsAvailable: 3, ...overrides });
}

let counter = 0;
function request(
  offerId: string,
  direction: LegDirection,
  requesterId: string,
  requesterTripId: string,
  status: MatchRequestStatus = 'accepted'
): MatchRequest {
  counter += 1;
  return {
    id: `req-${counter}`,
    tripId: offerId,
    direction,
    requesterId,
    requesterTripId,
    status,
    requestNote: null,
    resolutionNote: null,
    resolvedBy: null,
  };
}

function stats(
  profileId: string,
  trips: readonly Trip[],
  requests: readonly MatchRequest[]
): PersonalStats {
  const result = computePersonalStats(profileId, trips, requests, CONFIG);
  if (!result.ok) throw new Error(`atteso ok, ottenuto ${JSON.stringify(result.error)}`);
  return result.value;
}

function failure(
  profileId: string,
  trips: readonly Trip[],
  requests: readonly MatchRequest[],
  config = CONFIG
): PersonalStatsError {
  const result = computePersonalStats(profileId, trips, requests, config);
  if (result.ok) throw new Error('atteso errore, ottenuto ok');
  return result.error;
}

describe('da passeggero', () => {
  it('conta la trasferta, non le tratte: andata e ritorno accettati sono UN viaggio', () => {
    const trips = [trip('own', 'anna')];
    const requests = [
      request('offer', 'outbound', 'anna', 'own'),
      request('offer', 'return', 'anna', 'own'),
    ];
    expect(stats('anna', trips, requests).sharedTrips).toBe(1);
  });

  it('due trasferte diverse con una candidatura accettata ciascuna sono due viaggi', () => {
    const trips = [trip('own-1', 'anna'), trip('own-2', 'anna')];
    const requests = [
      request('offer', 'outbound', 'anna', 'own-1'),
      request('offer', 'outbound', 'anna', 'own-2'),
    ];
    expect(stats('anna', trips, requests).sharedTrips).toBe(2);
  });

  it.each(['pending', 'rejected', 'cancelled'] as const)(
    'una candidatura %s non conta',
    (status) => {
      const trips = [trip('own', 'anna')];
      expect(
        stats('anna', trips, [request('offer', 'outbound', 'anna', 'own', status)]).sharedTrips
      ).toBe(0);
    }
  );

  it('una trasferta cancelled non conta, nemmeno con una candidatura accettata', () => {
    const trips = [trip('own', 'anna', { status: 'cancelled' })];
    expect(stats('anna', trips, [request('offer', 'outbound', 'anna', 'own')]).sharedTrips).toBe(0);
  });

  it('una trasferta completed conta', () => {
    const trips = [trip('own', 'anna', { status: 'completed' })];
    expect(stats('anna', trips, [request('offer', 'outbound', 'anna', 'own')]).sharedTrips).toBe(1);
  });

  it('una trasferta con auto non e\' un viaggio da passeggero', () => {
    const trips = [driverTrip('own', 'anna')];
    expect(stats('anna', trips, [request('offer', 'outbound', 'anna', 'own')]).sharedTrips).toBe(0);
  });

  it('le candidature di un altro collega non contano', () => {
    const trips = [trip('own', 'anna'), trip('other', 'bruno')];
    const requests = [request('offer', 'outbound', 'bruno', 'other')];
    expect(stats('anna', trips, requests).sharedTrips).toBe(0);
  });

  it('errore tipizzato se la trasferta indicata non e\' fra quelle date', () => {
    const error = failure('anna', [], [request('offer', 'outbound', 'anna', 'ghost')]);
    expect(error.kind).toBe('unknown-requester-trip');
  });

  it('errore tipizzato se la trasferta indicata e\' di un altro collega', () => {
    const error = failure(
      'anna',
      [trip('own', 'bruno')],
      [request('offer', 'outbound', 'anna', 'own')]
    );
    expect(error.kind).toBe('requester-trip-not-owned');
  });
});

describe('da conducente', () => {
  const offer = driverTrip('offer', 'carla');

  it('tratte, colleghi e km di una tratta condivisa', () => {
    const result = stats(
      'carla',
      [offer],
      [request('offer', 'outbound', 'anna', 'a-own'), request('offer', 'outbound', 'bruno', 'b-own')]
    );
    // Due passeggeri sulla stessa tratta: una tratta, due colleghi, 200 km una volta.
    expect(result).toMatchObject({ sharedLegs: 1, transportedColleagues: 2, sharedKm: 200 });
  });

  it('andata e ritorno sono due tratte e i km si sommano; il collega e\' contato una volta', () => {
    const result = stats(
      'carla',
      [offer],
      [request('offer', 'outbound', 'anna', 'a-own'), request('offer', 'return', 'anna', 'a-own')]
    );
    expect(result).toMatchObject({ sharedLegs: 2, transportedColleagues: 1, sharedKm: 400 });
  });

  it('la distanza si cerca nei due versi', () => {
    const reversed = driverTrip('rev', 'carla', { fromPlantId: 'foggia', toPlantId: 'pomigliano' });
    expect(
      stats('carla', [reversed], [request('rev', 'outbound', 'anna', 'a-own')]).sharedKm
    ).toBe(200);
  });

  it('offrire posti senza nessuna candidatura accettata vale zero', () => {
    const result = stats(
      'carla',
      [offer],
      [
        request('offer', 'outbound', 'anna', 'a-own', 'pending'),
        request('offer', 'outbound', 'bruno', 'b-own', 'rejected'),
        request('offer', 'outbound', 'dario', 'd-own', 'cancelled'),
      ]
    );
    expect(result).toMatchObject({ sharedLegs: 0, transportedColleagues: 0, sharedKm: 0 });
  });

  it('una trasferta offerta cancelled non conta', () => {
    const cancelled = driverTrip('offer', 'carla', { status: 'cancelled' });
    const result = stats('carla', [cancelled], [request('offer', 'outbound', 'anna', 'a-own')]);
    expect(result).toMatchObject({ sharedLegs: 0, transportedColleagues: 0, sharedKm: 0 });
  });

  it('un\'accettata sul ritorno di una trasferta senza rientro non e\' una tratta', () => {
    const oneWay = driverTrip('offer', 'carla', { returnAt: null });
    const result = stats('carla', [oneWay], [request('offer', 'return', 'anna', 'a-own')]);
    expect(result).toMatchObject({ sharedLegs: 0, transportedColleagues: 0, sharedKm: 0 });
  });

  it('le trasferte offerte da altri non contano per chi non guida', () => {
    const result = stats('anna', [offer], [request('offer', 'outbound', 'bruno', 'b-own')]);
    expect(result).toMatchObject({ sharedLegs: 0, transportedColleagues: 0, sharedKm: 0 });
  });

  it('coppia di plant assente dalla tabella: errore tipizzato, non zero km', () => {
    const odd = driverTrip('odd', 'carla', { fromPlantId: 'pomigliano', toPlantId: 'grottaglie' });
    const error = failure('carla', [odd], [request('odd', 'outbound', 'anna', 'a-own')]);
    expect(error).toEqual({
      kind: 'missing-distance',
      fromPlantId: 'pomigliano',
      toPlantId: 'grottaglie',
    });
  });

  it('distanza non valida in tabella: errore tipizzato', () => {
    const error = failure('carla', [offer], [request('offer', 'outbound', 'anna', 'a-own')], {
      distanceKm: { pomigliano: { foggia: -1 } },
    });
    expect(error).toEqual({ kind: 'invalid-config', field: 'distanceKm' });
  });
});

describe('entrambi i ruoli', () => {
  it('guida su una trasferta ed e\' passeggero su un\'altra: le statistiche di entrambe le famiglie', () => {
    const trips = [driverTrip('drive', 'carla'), trip('ride', 'carla')];
    const requests = [
      request('drive', 'outbound', 'anna', 'a-own'),
      request('someone-offer', 'outbound', 'carla', 'ride'),
    ];
    expect(stats('carla', trips, requests)).toEqual({
      profileId: 'carla',
      sharedTrips: 1,
      sharedLegs: 1,
      transportedColleagues: 1,
      sharedKm: 200,
    });
  });
});

describe('purezza', () => {
  it('non muta gli input', () => {
    const trips = [driverTrip('offer', 'carla')];
    const requests = [request('offer', 'outbound', 'anna', 'a-own')];
    const before = JSON.stringify([trips, requests]);
    stats('carla', trips, requests);
    expect(JSON.stringify([trips, requests])).toBe(before);
  });
});
