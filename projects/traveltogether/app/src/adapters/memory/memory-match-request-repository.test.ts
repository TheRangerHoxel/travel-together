// Test specifici dell'adapter memory sulle candidature: i rami che la suite di contratto NON
// puo' coprire, perche' su Postgres sono irraggiungibili.
//
// Una candidatura strutturalmente invalida (nota di risoluzione senza `resolvedBy`, `pending`
// con una risoluzione) nello storage non si puo' costruire su Postgres: i CHECK di T08 su
// `match_requests` replicano gli invarianti di `validateMatchRequestStructure`, e la riga
// che questi test seminano (`cancelled` con nota e senza `resolvedBy`) viene rifiutata dal
// DB. Per questo stavano nella suite di contratto solo finche' T08 non l'aveva deciso: ora
// sono *solo memory*, come i test sulle liste invalide di trasferte e tratte
// (memory-trip-repository.test.ts). Le asserzioni sono quelle di prima, invariate.
//
// Ogni test legge con un'identita' che VEDE la riga (owner o richiedente) e ha accanto una
// riga valida seminata allo stesso modo: altrimenti l'omissione sarebbe indistinguibile dal
// filtro d'identita'.

import { SEED_PARAMETERS } from '../../config';
import type { MatchRequest, ProfileId, Trip, TripId } from '../../core/domain';
import { parseParameters } from '../../core/domain';
import { utc } from '../../core/domain/instant-fixture';
import { nuoveCondizioni } from './memory-conditions';
import { MemoryMatchRequestRepository } from './memory-match-request-repository';
import { MemoryProfileRepository } from './memory-profile-repository';
import { MemoryTripRepository } from './memory-trip-repository';

const OWNER = 'owner-1';
const RICHIEDENTE = 'richiedente-1';
const ALTRO_RICHIEDENTE = 'richiedente-2';
const OFFERTA = 'trip-offerta';

/** Il limite delle note del seed, passato dal parser come ogni altro parametro. */
function limiteNoteDelSeed(): number {
  const parametri = parseParameters(SEED_PARAMETERS);
  if (!parametri.ok) {
    throw new Error(`il seed non passa parseParameters: ${parametri.error.key}`);
  }
  return parametri.value.notes.maxLength;
}

function unaTrasferta(id: TripId, ownerId: ProfileId): Trip {
  return {
    id,
    ownerId,
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    departureAt: utc('2026-11-03T06:30:00.000Z'),
    returnAt: utc('2026-11-05T16:00:00.000Z'),
    hasCar: true,
    seatsTotal: 3,
    seatsAvailable: 3,
    status: 'published',
  };
}

/** Ambiente cablato con le policy, come quello della suite di contratto, con le trasferte salvate. */
async function ambiente() {
  const condizioni = nuoveCondizioni();
  const profiles = new MemoryProfileRepository(condizioni);
  const trips = new MemoryTripRepository(profiles, condizioni);
  const matchRequests = new MemoryMatchRequestRepository(
    { maxLength: limiteNoteDelSeed() },
    { condizioni, trips }
  );
  trips.collegaCandidature(matchRequests);

  for (const [id, plantId] of [
    [OWNER, 'pomigliano'],
    [RICHIEDENTE, 'foggia'],
    [ALTRO_RICHIEDENTE, 'foggia'],
  ] as const) {
    profiles.semina({ id, displayName: 'Collega Fittizio', plantId });
  }

  // Ciascuno salva la propria trasferta: la offerta e' dell'owner, le altre dei richiedenti.
  const trasferte = [
    [OWNER, OFFERTA],
    [RICHIEDENTE, 'trip-richiedente-1'],
    [ALTRO_RICHIEDENTE, 'trip-richiedente-2'],
  ] as const;
  for (const [ownerId, id] of trasferte) {
    condizioni.identita = ownerId;
    const salvata = await trips.save(unaTrasferta(id, ownerId));
    expect(salvata.ok).toBe(true);
  }
  return { condizioni, matchRequests };
}

function unaCandidatura(
  requesterId: ProfileId,
  id: string,
  direction: MatchRequest['direction'],
  modifiche: Partial<MatchRequest> = {}
): MatchRequest {
  return {
    id,
    tripId: OFFERTA,
    direction,
    requesterId,
    requesterTripId: requesterId === RICHIEDENTE ? 'trip-richiedente-1' : 'trip-richiedente-2',
    status: 'pending',
    requestNote: null,
    resolutionNote: null,
    resolvedBy: null,
    ...modifiche,
  };
}

const NOTA_SENZA_CHI: Partial<MatchRequest> = {
  status: 'cancelled',
  resolutionNote: 'Nota senza chi',
  resolvedBy: null,
};

describe('candidature strutturalmente invalide nello storage', () => {
  it('una riga strutturalmente invalida nello storage da invalid-record in lettura', async () => {
    const { condizioni, matchRequests } = await ambiente();
    const id = 'richiesta-rotta';
    matchRequests.seminaGrezzo(unaCandidatura(RICHIEDENTE, id, 'outbound', NOTA_SENZA_CHI));

    condizioni.identita = OWNER;
    const esito = await matchRequests.findById(id);

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.kind).toBe('invalid-record');
    }
  });

  describe('letture di righe invalide', () => {
    it('listByLeg omette la riga invalida e restituisce la valida', async () => {
      const { condizioni, matchRequests } = await ambiente();
      const rotta = 'richiesta-rotta';
      const sana = 'richiesta-sana';
      matchRequests.seminaGrezzo(unaCandidatura(RICHIEDENTE, rotta, 'outbound', NOTA_SENZA_CHI));
      matchRequests.seminaGrezzo(unaCandidatura(ALTRO_RICHIEDENTE, sana, 'outbound'));

      condizioni.identita = OWNER;
      const esito = await matchRequests.listByLeg(OFFERTA, 'outbound');

      expect(esito.ok).toBe(true);
      if (esito.ok) {
        expect(esito.value.map((r) => r.id)).toEqual([sana]);
      }
    });

    it('listByRequester omette la riga invalida e restituisce la valida', async () => {
      const { condizioni, matchRequests } = await ambiente();
      const rotta = 'richiesta-rotta';
      const sana = 'richiesta-sana';
      matchRequests.seminaGrezzo(unaCandidatura(RICHIEDENTE, rotta, 'outbound', NOTA_SENZA_CHI));
      matchRequests.seminaGrezzo(unaCandidatura(RICHIEDENTE, sana, 'return'));

      condizioni.identita = RICHIEDENTE;
      const esito = await matchRequests.listByRequester(RICHIEDENTE);

      expect(esito.ok).toBe(true);
      if (esito.ok) {
        expect(esito.value.map((r) => r.id)).toEqual([sana]);
      }
    });

    it('findByLegAndRequester su una riga invalida da invalid-record, non null; la valida si legge', async () => {
      const { condizioni, matchRequests } = await ambiente();
      const rotta = 'richiesta-rotta';
      const sana = 'richiesta-sana';
      matchRequests.seminaGrezzo(unaCandidatura(RICHIEDENTE, rotta, 'outbound', NOTA_SENZA_CHI));
      matchRequests.seminaGrezzo(unaCandidatura(RICHIEDENTE, sana, 'return'));

      condizioni.identita = RICHIEDENTE;
      const invalida = await matchRequests.findByLegAndRequester(OFFERTA, 'outbound', RICHIEDENTE);
      const valida = await matchRequests.findByLegAndRequester(OFFERTA, 'return', RICHIEDENTE);

      expect(invalida.ok).toBe(false);
      if (!invalida.ok) {
        expect(invalida.error.kind).toBe('invalid-record');
      }
      expect(valida.ok).toBe(true);
      if (valida.ok) {
        expect(valida.value?.id).toBe(sana);
      }
    });
  });
});
