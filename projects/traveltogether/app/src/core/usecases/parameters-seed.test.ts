// Test di conformita' del SEED dei parametri (src/config/parameters.ts).
//
// Il seed e' la sorgente dell'ambiente memory e, a T08, della migrazione di seed. NON
// e' la produzione: in produzione vale la tabella, che dopo la prima migrazione puo'
// divergere. Per questo i titoli dicono "seed" e questo file non protegge i valori
// letti a runtime (li protegge parseParameters, al confine).
//
// Sta in usecases/ perche' e' l'unico livello del core che il lint abilita a importare
// sia config/ sia il codice del core (i test di conformita').
//
// Sostituisce i sei test *-config.test.ts. Le asserzioni "X soddisfa XConfig" non ci
// sono piu': erano l'annotazione di tipo, e un parser tipizzato non puo' piu' fallire
// li'. Le altre sono qui: i controlli di intervallo diventano "il seed passa
// parseParameters", i valori pinnati sono pinnati sul seed parsato, e le prove di
// accettazione da parte degli usecase restano invariate.

import { SEED_PARAMETERS } from '../../config';
import type { AppParameters } from '../domain';
import { makeMatchRequest, parseParameters } from '../domain';
import { utc } from '../domain/instant-fixture';
import { awardBadges } from './award-badges';
import { computeCompanyKpi } from './compute-company-kpi';

function seedParsato(): AppParameters {
  const esito = parseParameters(SEED_PARAMETERS);
  if (!esito.ok) {
    throw new Error(`il seed non passa parseParameters: ${esito.error.key} (${esito.error.detail})`);
  }
  return esito.value;
}

describe('il seed dei parametri', () => {
  it('passa parseParameters: soglie intere >= 1, tolleranza >= 0, posti >= 1, limite >= 1, nota entro il limite', () => {
    expect(parseParameters(SEED_PARAMETERS).ok).toBe(true);
  });

  it('i valori iniziali sono quelli dichiarati', () => {
    const seed = seedParsato();

    expect(seed.matching).toEqual({ toleranceMinutes: 30 });
    expect(seed.createTrip).toEqual({ maxSeatsOffered: 8 });
    expect(seed.notes).toEqual({ maxLength: 280 });
    expect(seed.kpi.gramsCo2PerKm).toBe(110);
    expect(seed.kpi.rentalCostPerDay).toBe(120);
    expect(seed.kpi.fuelConsumptionLitersPer100Km).toBe(7.0);
    expect(seed.kpi.fuelPricePerLiter).toBe(2.2);
    expect(seed.kpi.distanceKm).toEqual({
      pomigliano: { foggia: 165, grottaglie: 320 },
      foggia: { grottaglie: 232 },
    });
    expect(seed.badges.thresholds).toEqual({
      'primo-viaggio': 1,
      'cinque-viaggi': 5,
      'dieci-viaggi': 10,
      'primo-passaggio': 1,
      'cinque-colleghi': 5,
      'mille-km': 1000,
    });
  });

  it('le etichette dei badge e la nota automatica iniziali sono quelle dichiarate', () => {
    const seed = seedParsato();

    expect(seed.badges.labels).toEqual({
      'primo-viaggio': 'Primo viaggio condiviso',
      'cinque-viaggi': 'Viaggiatore ricorrente',
      'dieci-viaggi': 'Viaggiatore esperto',
      'primo-passaggio': 'Primo passaggio offerto',
      'cinque-colleghi': 'Compagno di strada',
      'mille-km': 'Lunga strada condivisa',
    });
    expect(seed.cascade.autoRejectNote).toBe('Posti esauriti: è stato accettato un altro collega.');
  });

  it('con le soglie del seed, la config e\' accettata da awardBadges', () => {
    const result = awardBadges(
      { profileId: 'x', sharedTrips: 0, sharedLegs: 0, transportedColleagues: 0, sharedKm: 0 },
      seedParsato().badges
    );
    expect(result).toEqual({ ok: true, value: [] });
  });

  it('la nota automatica del seed e\' accettata da makeMatchRequest col limite del seed', () => {
    // Se il limite scendesse sotto il testo, la cascata fallirebbe con note-too-long su
    // una nota che nessun utente ha scritto: qui si vede prima.
    const seed = seedParsato();
    const esito = makeMatchRequest(
      {
        id: 'r',
        tripId: 't',
        direction: 'outbound',
        requesterId: 'p',
        requesterTripId: 'tp',
        status: 'rejected',
        requestNote: null,
        resolutionNote: seed.cascade.autoRejectNote,
        resolvedBy: 'system',
      },
      seed.notes
    );

    expect(esito.ok).toBe(true);
  });

  it('con le distanze del seed ogni coppia di plant e\' risolvibile nei due versi', () => {
    const kpi = seedParsato().kpi;
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
              departureAt: utc('2026-11-03T06:00:00Z'),
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
          kpi
        );
        expect(result.ok).toBe(true);
      }
    }
  });
});
