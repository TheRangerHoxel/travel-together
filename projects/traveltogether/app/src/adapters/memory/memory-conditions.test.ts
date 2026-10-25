// Identita' nulla: il caso che la suite di contratto non puo' esprimere, perche'
// l'hook `comeUtente` prende sempre un profilo e non ha modo di tornare a "nessuno".
// Qui le condizioni sono cablate a mano. Con identita' nulla le policy IMPOSTE
// rifiutano ogni scrittura e filtrano ogni lettura di massimi, candidature e parametri; restano
// fuori, come dichiarato, `adjustLegSeats` e le letture di trasferte e profili.

import { SEED_PARAMETERS } from '../../config';
import type { MatchRequest, Trip } from '../../core/domain';
import { parseParameters } from '../../core/domain';
import { utc } from '../../core/domain/instant-fixture';
import { nuoveCondizioni } from './memory-conditions';
import { MemoryMatchRequestRepository } from './memory-match-request-repository';
import { MemoryParameterRepository } from './memory-parameter-repository';
import { MemoryPersonalBestsRepository } from './memory-personal-bests-repository';
import { MemoryProfileRepository } from './memory-profile-repository';
import { MemoryTripRepository } from './memory-trip-repository';

const PROFILO = 'profilo-1';

/** Il limite delle note del seed, passato dal parser come ogni altro parametro. */
function limiteNoteDelSeed(): number {
  const parametri = parseParameters(SEED_PARAMETERS);
  if (!parametri.ok) {
    throw new Error(`il seed non passa parseParameters: ${parametri.error.key}`);
  }
  return parametri.value.notes.maxLength;
}

function unaTrasferta(): Trip {
  return {
    id: 'trip-1',
    ownerId: PROFILO,
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    departureAt: utc('2026-11-03T06:30:00.000Z'),
    returnAt: null,
    hasCar: true,
    seatsTotal: 3,
    seatsAvailable: 3,
    status: 'published',
  };
}

function unaCandidatura(): MatchRequest {
  return {
    id: 'richiesta-1',
    tripId: 'trip-1',
    direction: 'outbound',
    requesterId: PROFILO,
    requesterTripId: 'trip-1',
    status: 'pending',
    requestNote: null,
    resolutionNote: null,
    resolvedBy: null,
  };
}

function ambiente() {
  const condizioni = nuoveCondizioni();
  const profiles = new MemoryProfileRepository(condizioni);
  const trips = new MemoryTripRepository(profiles, condizioni);
  const matchRequests = new MemoryMatchRequestRepository(
    { maxLength: limiteNoteDelSeed() },
    { condizioni, trips }
  );
  const personalBests = new MemoryPersonalBestsRepository(condizioni);
  return { condizioni, trips, matchRequests, personalBests };
}

describe('con identita nulla', () => {
  it('nessuna identita registrata: le scritture sono rifiutate con storage-unavailable', async () => {
    const { condizioni, trips, matchRequests, personalBests } = ambiente();
    expect(condizioni.identita).toBeNull();

    const esiti = [
      await trips.save(unaTrasferta()),
      await matchRequests.save(unaCandidatura()),
      await personalBests.raise({
        profileId: PROFILO,
        sharedTrips: 1,
        sharedLegs: 1,
        transportedColleagues: 1,
        sharedKm: 1,
      }),
    ];

    for (const esito of esiti) {
      expect(esito.ok).toBe(false);
      if (!esito.ok) {
        expect(esito.error.kind).toBe('storage-unavailable');
      }
    }
  });

  it('le righe esistenti non si vedono: massimi a zero, candidatura non trovata e lista vuota', async () => {
    const { condizioni, matchRequests, personalBests } = ambiente();
    // Si scrive CON un'identita', poi la si toglie: una riga esistente serve a
    // distinguere il filtro da una semplice assenza.
    condizioni.identita = PROFILO;
    const alzata = await personalBests.raise({
      profileId: PROFILO,
      sharedTrips: 5,
      sharedLegs: 1,
      transportedColleagues: 9,
      sharedKm: 120,
    });
    expect(alzata.ok).toBe(true);
    const controllo = await personalBests.findByProfile(PROFILO);
    expect(controllo.ok && controllo.value.sharedTrips).toBe(5);
    matchRequests.seminaGrezzo(unaCandidatura());
    const vista = await matchRequests.findById('richiesta-1');
    expect(vista.ok).toBe(true);

    condizioni.identita = null;

    const massimi = await personalBests.findByProfile(PROFILO);
    expect(massimi).toEqual({
      ok: true,
      value: {
        profileId: PROFILO,
        sharedTrips: 0,
        sharedLegs: 0,
        transportedColleagues: 0,
        sharedKm: 0,
      },
    });
    const perId = await matchRequests.findById('richiesta-1');
    expect(perId.ok).toBe(false);
    if (!perId.ok) {
      expect(perId.error.kind).toBe('not-found');
    }
    const lista = await matchRequests.listByRequester(PROFILO);
    expect(lista.ok && lista.value).toEqual([]);
  });

  it('le righe dei parametri non si vedono: load risponde invalid-record sulla prima chiave mancante', async () => {
    const condizioni = nuoveCondizioni();
    const parameters = new MemoryParameterRepository(SEED_PARAMETERS, condizioni);
    // Con un'identita' le stesse righe si leggono: l'assenza che segue e' il filtro.
    condizioni.identita = PROFILO;
    const visti = await parameters.load();
    expect(visti.ok).toBe(true);

    condizioni.identita = null;
    const esito = await parameters.load();

    expect(esito).toEqual({
      ok: false,
      error: { kind: 'invalid-record', id: 'match.toleranceMinutes', detail: 'parametro mancante' },
    });
  });
});
