// refreshPersonalBests: il percorso che compone letture, statistiche, alzata dei
// massimi e badge. I fake sono spie (request-test-fakes.ts): le scritture si contano.
//
// Il profilo sotto esame e' OWNER, il proprietario della trasferta offerta del fake.
// Le sue trasferte da passeggero entrano come `otherTrips`.

import type { BadgeId, LegDirection, MatchRequest, PersonalBests, Trip } from '../domain';
import { utc } from '../domain/instant-fixture';
import { awardBadges } from './award-badges';
import type { BadgeConfig } from './badge-config';
import type { RefreshPersonalBestsConfig } from './refresh-personal-bests';
import { refreshPersonalBests } from './refresh-personal-bests';
import {
  OWNER,
  RICHIEDENTE,
  ESTRANEO,
  TRIP_ID,
  unBestsSpia,
  unRequestsSpia,
  unTripsSpia,
  unaRichiesta,
  type BestsOptions,
  type BestsSpia,
  type RequestsOptions,
  type TripsOptions,
} from './request-test-fakes';

// Fixture locali: nessun import da config/ nel core.
const THRESHOLDS: BadgeConfig['thresholds'] = {
  'primo-viaggio': 1,
  'cinque-viaggi': 5,
  'dieci-viaggi': 10,
  'primo-passaggio': 1,
  'cinque-colleghi': 5,
  'mille-km': 1000,
};

const LABELS: BadgeConfig['labels'] = {
  'primo-viaggio': 'Fixture: prima tappa',
  'cinque-viaggi': 'Fixture: seconda tappa',
  'dieci-viaggi': 'Fixture: terza tappa',
  'primo-passaggio': 'Fixture: primo giro',
  'cinque-colleghi': 'Fixture: compagnia',
  'mille-km': 'Fixture: strada',
};

function configCon(thresholds: BadgeConfig['thresholds'] = THRESHOLDS): RefreshPersonalBestsConfig {
  return {
    distances: { distanceKm: { pomigliano: { foggia: 200 } } },
    badges: { thresholds, labels: LABELS },
  };
}

const ALTRUI = 'trip-altrui';

/** Trasferta propria da passeggero (senza auto). */
function miaTrasferta(i: number, status: Trip['status'] = 'published'): Trip {
  return {
    id: `mia-${i}`,
    ownerId: OWNER,
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    departureAt: utc('2026-11-03T06:00:00.000Z'),
    returnAt: null,
    hasCar: false,
    seatsTotal: 0,
    seatsAvailable: 0,
    status,
  };
}

/** Candidatura accettata di OWNER passeggero con la propria trasferta `mia-i`. */
function comePasseggero(i: number): MatchRequest {
  return unaRichiesta({
    id: `p-${i}`,
    tripId: ALTRUI,
    requesterId: OWNER,
    requesterTripId: `mia-${i}`,
    status: 'accepted',
  });
}

/** Candidatura accettata RICEVUTA da OWNER sulla sua tratta. */
function ricevuta(
  id: string,
  requesterId: string,
  direction: LegDirection = 'outbound'
): MatchRequest {
  return unaRichiesta({
    id,
    tripId: TRIP_ID,
    direction,
    requesterId,
    requesterTripId: `trip-di-${requesterId}`,
    status: 'accepted',
  });
}

interface Scenario {
  readonly trips?: TripsOptions;
  readonly requests?: RequestsOptions;
  readonly bests?: BestsOptions;
  readonly bestsSpia?: BestsSpia;
  readonly config?: RefreshPersonalBestsConfig;
}

async function esegui(scenario: Scenario = {}) {
  const bests = scenario.bestsSpia ?? unBestsSpia(scenario.bests);
  const esito = await refreshPersonalBests(
    { profileId: OWNER },
    {
      trips: unTripsSpia(scenario.trips),
      requests: unRequestsSpia(scenario.requests),
      bests,
    },
    scenario.config ?? configCon()
  );
  return { esito, bests };
}

function ids(badges: readonly { id: BadgeId }[]): BadgeId[] {
  return badges.map((b) => b.id);
}

function massimi(
  sharedTrips: number,
  sharedLegs: number,
  transportedColleagues: number,
  sharedKm: number
): PersonalBests {
  return { profileId: OWNER, sharedTrips, sharedLegs, transportedColleagues, sharedKm };
}

describe('refreshPersonalBests: i due invarianti per cui il task esiste', () => {
  it('statistiche che SCENDONO (trasferta annullata): i badge restano', async () => {
    const bests = unBestsSpia();
    const cinque = [1, 2, 3, 4, 5];

    const prima = await esegui({
      bestsSpia: bests,
      trips: { otherTrips: cinque.map((i) => miaTrasferta(i)) },
      requests: { existing: cinque.map(comePasseggero) },
    });
    // Quattro trasferte su cinque annullate: la statistica corrente e' 1, il massimo 5.
    const dopo = await esegui({
      bestsSpia: bests,
      trips: {
        otherTrips: [miaTrasferta(1), ...[2, 3, 4, 5].map((i) => miaTrasferta(i, 'cancelled'))],
      },
      requests: { existing: cinque.map(comePasseggero) },
    });

    expect(prima.esito.ok && ids(prima.esito.value.badges)).toEqual(['primo-viaggio', 'cinque-viaggi']);
    // La fixture scende davvero: il candidato della seconda esecuzione e' 1, non 5.
    expect(bests.raiseCalls.map((c) => c.sharedTrips)).toEqual([5, 1]);
    expect(dopo.esito.ok && dopo.esito.value.bests.sharedTrips).toBe(5);
    expect(dopo.esito.ok && ids(dopo.esito.value.badges)).toEqual(['primo-viaggio', 'cinque-viaggi']);
  });

  it('i duplicati restano non rappresentabili sul percorso nuovo', async () => {
    const dodici = Array.from({ length: 12 }, (_, i) => i + 1);

    const { esito } = await esegui({
      trips: { otherTrips: dodici.map((i) => miaTrasferta(i)) },
      requests: { existing: dodici.map(comePasseggero) },
    });

    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    const elenco = ids(esito.value.badges);
    expect(elenco).toEqual(['primo-viaggio', 'cinque-viaggi', 'dieci-viaggi']);
    expect(new Set(elenco).size).toBe(elenco.length);
  });

  it('due esecuzioni: stessa lista, uguale a awardBadges sui massimi ritornati', async () => {
    const bests = unBestsSpia();
    const scenario: Scenario = {
      bestsSpia: bests,
      trips: { otherTrips: [miaTrasferta(1), miaTrasferta(2)] },
      requests: { existing: [comePasseggero(1), comePasseggero(2), ricevuta('r1', RICHIEDENTE)] },
    };

    const a = await esegui(scenario);
    const b = await esegui(scenario);

    expect(a.esito.ok && b.esito.ok).toBe(true);
    if (!a.esito.ok || !b.esito.ok) return;
    expect(b.esito.value.badges).toEqual(a.esito.value.badges);
    const attesi = awardBadges(b.esito.value.bests, configCon().badges);
    expect(attesi.ok && attesi.value).toEqual(b.esito.value.badges);
  });
});

describe('refreshPersonalBests: cosa legge e cosa scrive', () => {
  it('profilo con ENTRAMBI i ruoli: una sola raise con le quattro metriche', async () => {
    // passeggero: 3 trasferte; conducente: 1 tratta, 2 colleghi, 200 km. Quattro
    // numeri distinti, cosi' nessuna metrica puo' essere scambiata con un'altra.
    const { esito, bests } = await esegui({
      trips: { otherTrips: [1, 2, 3].map((i) => miaTrasferta(i)) },
      requests: {
        existing: [
          ...[1, 2, 3].map(comePasseggero),
          ricevuta('r1', RICHIEDENTE),
          ricevuta('r2', ESTRANEO),
        ],
      },
    });

    expect(esito.ok).toBe(true);
    // Una sola scrittura, non una per metrica ne' una per trasferta.
    expect(bests.raiseCalls).toEqual([massimi(3, 1, 2, 200)]);
    expect(esito.ok && esito.value.bests).toEqual(massimi(3, 1, 2, 200));
  });

  it('l unica candidatura accettata e sul RITORNO: la tratta si conta', async () => {
    const { esito, bests } = await esegui({
      requests: { existing: [ricevuta('r1', RICHIEDENTE, 'return')] },
    });

    expect(esito.ok).toBe(true);
    expect(bests.raiseCalls).toEqual([massimi(0, 1, 1, 200)]);
  });

  it('i badge si calcolano sul valore RITORNATO da raise, non sul candidato', async () => {
    // Candidato: 1 tratta (< soglia 3). Ritornato dalla spia: 7 (>= soglia 3).
    const soglie = { ...THRESHOLDS, 'primo-passaggio': 3 };
    const ritornato: PersonalBests = massimi(0, 7, 0, 0);

    const { esito, bests } = await esegui({
      bests: { forcedResult: ritornato },
      requests: { existing: [ricevuta('r1', RICHIEDENTE)] },
      config: configCon(soglie),
    });

    expect(bests.raiseCalls[0]?.sharedLegs).toBe(1);
    expect(esito.ok && ids(esito.value.badges)).toEqual(['primo-passaggio']);
    expect(esito.ok && esito.value.bests).toEqual(ritornato);
  });
});

describe('refreshPersonalBests: percorsi d errore', () => {
  it('computePersonalStats che fallisce: errore tipizzato e ZERO raise', async () => {
    const incoerente = unaRichiesta({
      id: 'x',
      tripId: ALTRUI,
      requesterId: OWNER,
      requesterTripId: 'trasferta-fantasma',
      status: 'accepted',
    });

    const { esito, bests } = await esegui({ requests: { existing: [incoerente] } });

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.kind).toBe('stats-failed');
      if (esito.error.kind === 'stats-failed') {
        expect(esito.error.cause.kind).toBe('unknown-requester-trip');
      }
    }
    expect(bests.raiseCalls).toHaveLength(0);
  });

  const guasto = { kind: 'storage-unavailable', detail: 'guasto simulato' } as const;

  it.each([
    ['listByOwner', { trips: { failListByOwner: guasto } }],
    ['listByRequester', { requests: { failListByRequester: guasto } }],
    ['listByLeg', { requests: { failListByLeg: guasto } }],
  ] as const)('%s che fallisce: storage-failed e ZERO raise', async (_nome, scenario) => {
    const { esito, bests } = await esegui(scenario);

    expect(esito).toEqual({ ok: false, error: { kind: 'storage-failed', cause: guasto } });
    expect(bests.raiseCalls).toHaveLength(0);
  });

  it('la raise che fallisce: storage-failed, e i badge non vengono calcolati', async () => {
    const { esito, bests } = await esegui({ bests: { failRaise: guasto } });

    expect(esito).toEqual({ ok: false, error: { kind: 'storage-failed', cause: guasto } });
    expect(bests.raiseCalls).toHaveLength(1);
  });

  it('badge-config-invalid arriva DOPO la scrittura: la raise c e stata, ed e completa', async () => {
    // E' l'unico errore che arriva dopo una raise riuscita. Non e' un massimo a meta':
    // la scrittura e' una riga sola, monotona e idempotente. Il test lo pinna invece
    // di nasconderlo.
    const { esito, bests } = await esegui({
      requests: { existing: [ricevuta('r1', RICHIEDENTE)] },
      config: configCon({ ...THRESHOLDS, 'primo-viaggio': 0 }),
    });

    expect(esito).toEqual({
      ok: false,
      error: {
        kind: 'badge-config-invalid',
        cause: { kind: 'invalid-config', badgeId: 'primo-viaggio' },
      },
    });
    expect(bests.raiseCalls).toHaveLength(1);
    expect(bests.stored(OWNER)).toEqual(massimi(0, 1, 1, 200));
  });
});
