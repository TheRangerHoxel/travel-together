// Assegnazione dei badge. Soglie ed etichette qui sono FIXTURE diverse da quelle del
// seed (2, 3, 4 / 2, 3, 500): un valore compilato nel core non passerebbe.

import type { BadgeId, LegDirection, MatchRequest, Trip } from '../domain';
import { BADGE_IDS, FORBIDDEN_BADGE_WORDS, isValidBadgeLabel } from '../domain';
import { utc } from '../domain/instant-fixture';
import { awardBadges, BADGE_CATALOG } from './award-badges';
import type { BadgeConfig } from './badge-config';
import { computePersonalStats } from './compute-personal-stats';
import type { PersonalStats } from './compute-personal-stats';

const CONFIG: BadgeConfig = {
  thresholds: {
    'primo-viaggio': 2,
    'cinque-viaggi': 3,
    'dieci-viaggi': 4,
    'primo-passaggio': 2,
    'cinque-colleghi': 3,
    'mille-km': 500,
  },
  labels: {
    'primo-viaggio': 'Fixture: prima tappa',
    'cinque-viaggi': 'Fixture: seconda tappa',
    'dieci-viaggi': 'Fixture: terza tappa',
    'primo-passaggio': 'Fixture: primo giro',
    'cinque-colleghi': 'Fixture: compagnia',
    'mille-km': 'Fixture: strada',
  },
};

const ZERO: PersonalStats = {
  profileId: 'carla',
  sharedTrips: 0,
  sharedLegs: 0,
  transportedColleagues: 0,
  sharedKm: 0,
};

function ids(stats: PersonalStats, config: BadgeConfig = CONFIG): BadgeId[] {
  const result = awardBadges(stats, config);
  if (!result.ok) throw new Error(`atteso ok, ottenuto ${JSON.stringify(result.error)}`);
  return result.value.map((b) => b.id);
}

describe('la soglia si prova sui confini, per ogni badge', () => {
  const cases: readonly (readonly [BadgeId, keyof PersonalStats])[] = [
    ['primo-viaggio', 'sharedTrips'],
    ['cinque-viaggi', 'sharedTrips'],
    ['dieci-viaggi', 'sharedTrips'],
    ['primo-passaggio', 'sharedLegs'],
    ['cinque-colleghi', 'transportedColleagues'],
    ['mille-km', 'sharedKm'],
  ];

  it.each(cases)('%s: soglia-1 non assegna, soglia assegna, soglia+1 assegna una volta sola', (id, metric) => {
    const threshold = CONFIG.thresholds[id];
    const count = (value: number): number =>
      ids({ ...ZERO, [metric]: value }).filter((awarded) => awarded === id).length;

    expect(count(threshold - 1)).toBe(0);
    expect(count(threshold)).toBe(1);
    expect(count(threshold + 1)).toBe(1);
  });

  it('a zero non assegna niente', () => {
    expect(ids(ZERO)).toEqual([]);
  });
});

describe('le due famiglie sono distinte', () => {
  it('le statistiche da passeggero non assegnano badge da conducente', () => {
    const awarded = ids({ ...ZERO, sharedTrips: 99 });
    expect(awarded.length).toBeGreaterThan(0);
    for (const id of awarded) expect(BADGE_CATALOG[id].family).toBe('passenger');
  });

  it('le statistiche da conducente non assegnano badge da passeggero', () => {
    const awarded = ids({ ...ZERO, sharedLegs: 99, transportedColleagues: 99, sharedKm: 99999 });
    expect(awarded.length).toBeGreaterThan(0);
    for (const id of awarded) expect(BADGE_CATALOG[id].family).toBe('driver');
  });

  it('ogni badge ha una voce di catalogo, e ci sono badge di entrambe le famiglie', () => {
    const families = new Set(BADGE_IDS.map((id) => BADGE_CATALOG[id].family));
    expect(families).toEqual(new Set(['passenger', 'driver']));
  });
});

describe('la soglia segue il parametro, non una costante', () => {
  const stats: PersonalStats = { ...ZERO, sharedTrips: 1, sharedLegs: 1, transportedColleagues: 1, sharedKm: 10 };

  it('con soglie ridotte a 1 le stesse statistiche assegnano di piu\'', () => {
    const reduced: BadgeConfig = {
      ...CONFIG,
      thresholds: {
        'primo-viaggio': 1,
        'cinque-viaggi': 1,
        'dieci-viaggi': 1,
        'primo-passaggio': 1,
        'cinque-colleghi': 1,
        'mille-km': 10,
      },
    };
    expect(ids(stats)).toEqual([]);
    expect(ids(stats, reduced)).toEqual([...BADGE_IDS]);
  });

  it('con soglie alzate le stesse statistiche non assegnano', () => {
    const raised: BadgeConfig = {
      ...CONFIG,
      thresholds: { ...CONFIG.thresholds, 'primo-viaggio': 3, 'primo-passaggio': 3 },
    };
    expect(ids({ ...ZERO, sharedTrips: 2, sharedLegs: 2 })).toEqual(['primo-viaggio', 'primo-passaggio']);
    expect(ids({ ...ZERO, sharedTrips: 2, sharedLegs: 2 }, raised)).toEqual([]);
  });
});

describe('idempotenza', () => {
  it('due esecuzioni sugli stessi input danno lo stesso insieme, senza duplicati', () => {
    const stats: PersonalStats = { ...ZERO, sharedTrips: 7, sharedLegs: 5, transportedColleagues: 4, sharedKm: 900 };
    const first = ids(stats);
    const second = ids(stats);
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });

  it('sulla stessa persona che cresce da soglia a soglia+1 l\'insieme non cambia', () => {
    expect(ids({ ...ZERO, sharedTrips: 2 })).toEqual(ids({ ...ZERO, sharedTrips: 2 }));
    expect(ids({ ...ZERO, sharedTrips: 2 })).toEqual(['primo-viaggio']);
    expect(ids({ ...ZERO, sharedTrips: 3 })).toEqual(['primo-viaggio', 'cinque-viaggi']);
  });
});

describe('config non valida: errore tipizzato', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('soglia %s', (bad) => {
    const result = awardBadges(ZERO, {
      ...CONFIG,
      thresholds: { ...CONFIG.thresholds, 'mille-km': bad },
    });
    expect(result).toEqual({ ok: false, error: { kind: 'invalid-config', badgeId: 'mille-km' } });
  });
});

describe('simbolici: nessun premio, nessun denaro, nessun buono', () => {
  // Welfare e buoni sono fuori scope per decisione dell'umano (PRD). Un testo che li
  // promette e' una promessa che il prodotto non puo' mantenere, e in demo qualcuno
  // la prenderebbe sul serio. Il test ispeziona i TESTI mostrati, non la logica.
  //
  // La lista delle parole vietate e' una sola (domain/badge-label.ts) e si importa:
  // qui non se ne tiene una copia.
  const STATS_ALTE: PersonalStats = {
    ...ZERO,
    sharedTrips: 99,
    sharedLegs: 99,
    transportedColleagues: 99,
    sharedKm: 99999,
  };

  it('nessuna etichetta della config contiene una parola vietata', () => {
    for (const id of BADGE_IDS) {
      const label = CONFIG.labels[id].toLowerCase();
      for (const word of FORBIDDEN_BADGE_WORDS) {
        expect({ id, word, found: label.includes(word) }).toEqual({ id, word, found: false });
      }
    }
  });

  it('nessun badge assegnato ha un\'etichetta vuota o vietata', () => {
    const result = awardBadges(STATS_ALTE, CONFIG);
    if (!result.ok) throw new Error('atteso ok');
    expect(result.value).toHaveLength(BADGE_IDS.length);
    for (const badge of result.value) {
      expect(badge.label.trim()).not.toBe('');
      for (const word of FORBIDDEN_BADGE_WORDS) expect(badge.label.toLowerCase()).not.toContain(word);
    }
  });

  it('il testo del badge e\' quello della config, per ogni badge', () => {
    const result = awardBadges(STATS_ALTE, CONFIG);
    if (!result.ok) throw new Error('atteso ok');
    expect(result.value).toEqual(BADGE_IDS.map((id) => ({ id, label: CONFIG.labels[id] })));
  });

  // Le sedici parole del criterio di T07b, ognuna dentro un'etichetta scritta come la
  // scriverebbe qualcuno in fretta. Il criterio elenca i PLURALI (premi, buoni,
  // sconti, regali, rimborsi, ricompense): con la vecchia radice 'ricompensa',
  // "Ricompense per te" passava il controllo.
  const ETICHETTE_VIETATE = [
    'Premi per i viaggiatori',
    'Buoni pasto',
    'Dieci euro risparmiati',
    'Risparmio in €',
    'Denaro in tasca',
    'Soldi risparmiati',
    'Sconti per te',
    'Il tuo Voucher',
    'Regali dai colleghi',
    'Bonus viaggio',
    'Rimborsi garantiti',
    'Ricompense per te',
    'Viaggio gratis',
    'Coupon del mese',
    'Ticket restaurant',
    'Welfare aziendale',
  ];

  it('la tabella ha sedici etichette', () => {
    expect(ETICHETTE_VIETATE).toHaveLength(16);
  });

  it.each(ETICHETTE_VIETATE)('"%s": il predicato la rifiuta e awardBadges ritorna invalid-config', (label) => {
    expect(isValidBadgeLabel(label)).toBe(false);

    const result = awardBadges(ZERO, {
      ...CONFIG,
      labels: { ...CONFIG.labels, 'cinque-colleghi': label },
    });

    expect(result).toEqual({ ok: false, error: { kind: 'invalid-config', badgeId: 'cinque-colleghi' } });
  });

  it.each(['', '   '])('l\'etichetta %j (vuota) e\' rifiutata con invalid-config', (label) => {
    const result = awardBadges(ZERO, {
      ...CONFIG,
      labels: { ...CONFIG.labels, 'primo-viaggio': label },
    });

    expect(result).toEqual({ ok: false, error: { kind: 'invalid-config', badgeId: 'primo-viaggio' } });
  });
});

describe('end-to-end: dai dati alle statistiche ai badge', () => {
  const DISTANCES = { distanceKm: { pomigliano: { foggia: 200 } } };

  function trip(id: string, ownerId: string, overrides: Partial<Trip> = {}): Trip {
    return {
      id,
      ownerId,
      fromPlantId: 'pomigliano',
      toPlantId: 'foggia',
      departureAt: utc('2026-11-03T06:00:00.000Z'),
      returnAt: utc('2026-11-05T16:00:00.000Z'),
      hasCar: false,
      seatsTotal: 0,
      seatsAvailable: 0,
      status: 'published',
      ...overrides,
    };
  }

  let counter = 0;
  function request(
    offerId: string,
    direction: LegDirection,
    requesterId: string,
    requesterTripId: string,
    status: MatchRequest['status'] = 'accepted'
  ): MatchRequest {
    counter += 1;
    return {
      id: `e2e-${counter}`,
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

  function badgesOf(profileId: string, trips: Trip[], requests: MatchRequest[]): BadgeId[] {
    const stats = computePersonalStats(profileId, trips, requests, DISTANCES);
    if (!stats.ok) throw new Error(`stats: ${JSON.stringify(stats.error)}`);
    return ids(stats.value, {
      ...CONFIG,
      thresholds: { ...CONFIG.thresholds, 'primo-viaggio': 1, 'primo-passaggio': 1 },
    });
  }

  it('un collega che ha guidato e ha viaggiato da passeggero riceve i badge di ENTRAMBE le famiglie', () => {
    const trips = [
      trip('drive', 'carla', { hasCar: true, seatsTotal: 3, seatsAvailable: 2 }),
      trip('ride', 'carla'),
    ];
    const requests = [
      request('drive', 'outbound', 'anna', 'a-own'),
      request('other-offer', 'outbound', 'carla', 'ride'),
    ];
    const awarded = badgesOf('carla', trips, requests);
    expect(awarded).toContain('primo-viaggio');
    expect(awarded).toContain('primo-passaggio');
  });

  it('chi ha offerto posti e non ha avuto nessuna candidatura accettata non riceve badge da conducente', () => {
    const trips = [trip('drive', 'carla', { hasCar: true, seatsTotal: 3, seatsAvailable: 3 })];
    const requests = [
      request('drive', 'outbound', 'anna', 'a-own', 'pending'),
      request('drive', 'outbound', 'bruno', 'b-own', 'rejected'),
    ];
    expect(badgesOf('carla', trips, requests)).toEqual([]);
  });

  it('una trasferta cancelled non da\' badge, ne\' da passeggero ne\' da conducente', () => {
    const trips = [
      trip('drive', 'carla', { hasCar: true, seatsTotal: 3, seatsAvailable: 2, status: 'cancelled' }),
      trip('ride', 'carla', { status: 'cancelled' }),
    ];
    const requests = [
      request('drive', 'outbound', 'anna', 'a-own'),
      request('other-offer', 'outbound', 'carla', 'ride'),
    ];
    expect(badgesOf('carla', trips, requests)).toEqual([]);
  });
});
