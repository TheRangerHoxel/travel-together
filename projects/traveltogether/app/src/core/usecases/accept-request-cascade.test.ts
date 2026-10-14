// La cascata di auto-rifiuto di acceptRequest: scatta SOLO sull'ultimo posto, solo
// sulla tratta accettata, solo sulle `pending`. Ogni test conta le `save`, perche'
// "quel che resta identico" non si dimostra guardando i valori finali.

import type { MatchRequest } from '../domain';
import { type AcceptRequestConfig, acceptRequest } from './accept-request';
import { OWNER, unRequestsSpia, unTripsSpia, unaRichiesta, type TripsOptions } from './request-test-fakes';

const CONFIG: AcceptRequestConfig = { maxLength: 30, autoRejectNote: 'esaurito' };

function pendente(id: string, modifiche: Partial<MatchRequest> = {}): MatchRequest {
  return unaRichiesta({ id, requesterId: `utente-${id}`, ...modifiche });
}

async function accetta(
  righe: readonly MatchRequest[],
  quale: string,
  opzioni: {
    trips?: TripsOptions;
    failSaveOnCall?: number;
    config?: AcceptRequestConfig;
  } = {}
) {
  const requests = unRequestsSpia({ existing: righe, failSaveOnCall: opzioni.failSaveOnCall });
  const trips = unTripsSpia(opzioni.trips);
  const r = await acceptRequest(
    { requestId: quale, actorId: OWNER },
    { trips, requests },
    opzioni.config ?? CONFIG
  );
  return { r, requests, trips };
}

const ULTIMO_POSTO: TripsOptions = { seatsAvailable: 1, seatsTotal: 3 };

describe('cascata: l ultimo posto', () => {
  it('1 posto e tre pending: A accepted, B e C rejected/system con la nota automatica, stesse righe', async () => {
    const { r, requests, trips } = await accetta(
      [pendente('A'), pendente('B'), pendente('C')],
      'A',
      { trips: ULTIMO_POSTO }
    );

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.request.id).toBe('A');
      expect(r.value.autoRejected).toEqual(['B', 'C']);
      expect(r.value.cascadeFailure).toBeNull();
    }
    expect(requests.stored('A')?.status).toBe('accepted');
    for (const id of ['B', 'C']) {
      // Letta per id: e' la STESSA riga, non una nuova.
      expect(requests.stored(id)).toMatchObject({
        id,
        requesterId: `utente-${id}`,
        status: 'rejected',
        resolvedBy: 'system',
        resolutionNote: 'esaurito',
      });
    }
    expect(trips.seats('outbound')).toBe(0);
  });

  it('con rientro, le pending della tratta OPPOSTA restano pending', async () => {
    const ritorno = pendente('R', { direction: 'return' });
    const { r, requests } = await accetta([pendente('A'), pendente('B'), ritorno], 'A', {
      trips: { seatsAvailable: 1, seatsTotal: 3, returnAvailable: 3 },
    });

    expect(r.ok && r.value.autoRejected).toEqual(['B']);
    expect(requests.stored('R')?.status).toBe('pending');
    expect(requests.saveCalls.map((s) => s.id).sort()).toEqual(['A', 'B']);
  });

  it('un accettazione che lascia posti > 0 non tocca nessun altra riga (si contano le save)', async () => {
    const { r, requests } = await accetta(
      [pendente('A'), pendente('B'), pendente('C')],
      'A',
      { trips: { seatsAvailable: 2, seatsTotal: 3 } }
    );

    expect(r.ok && r.value.autoRejected).toEqual([]);
    expect(requests.saveCalls).toHaveLength(1);
    expect(requests.saveCalls[0]?.id).toBe('A');
    expect(requests.stored('B')?.status).toBe('pending');
  });

  it('cancelled e rejected/owner sulla stessa tratta non vengono toccate', async () => {
    const annullata = pendente('X', {
      status: 'cancelled',
      resolutionNote: 'ripensato',
      resolvedBy: 'requester',
    });
    const rifiutata = pendente('Y', {
      status: 'rejected',
      resolutionNote: 'no grazie',
      resolvedBy: 'owner',
    });
    const { r, requests } = await accetta([pendente('A'), pendente('B'), annullata, rifiutata], 'A', {
      trips: ULTIMO_POSTO,
    });

    expect(r.ok && r.value.autoRejected).toEqual(['B']);
    expect(requests.stored('X')).toEqual(annullata);
    expect(requests.stored('Y')).toEqual(rifiutata);
    expect(requests.saveCalls.map((s) => s.id).sort()).toEqual(['A', 'B']);
  });

  it('il testo della nota automatica viene dalla config, non dal codice', async () => {
    const { requests } = await accetta([pendente('A'), pendente('B')], 'A', {
      trips: ULTIMO_POSTO,
      config: { maxLength: 30, autoRejectNote: 'testo diverso' },
    });

    expect(requests.stored('B')?.resolutionNote).toBe('testo diverso');
  });
});

describe('cascata: fallimento a meta', () => {
  it('la save della seconda riga su tre fallisce: errore che elenca le non chiuse, accettazione valida', async () => {
    // Chiamate a save: 1 = A (accettazione), 2 = B (cascata), 3 = C (cascata).
    const { r, requests, trips } = await accetta(
      [pendente('A'), pendente('B'), pendente('C')],
      'A',
      { trips: ULTIMO_POSTO, failSaveOnCall: 2 }
    );

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.request.status).toBe('accepted');
      expect(r.value.autoRejected).toEqual(['C']);
      expect(r.value.cascadeFailure).toEqual({
        kind: 'incomplete',
        done: ['C'],
        unclosed: [{ id: 'B', cause: { kind: 'storage-unavailable', detail: 'save simulata' } }],
      });
    }
    // L'accettazione non si ritira: A resta accepted, il posto resta consumato.
    expect(requests.stored('A')?.status).toBe('accepted');
    expect(requests.stored('B')?.status).toBe('pending');
    expect(requests.stored('C')?.status).toBe('rejected');
    expect(trips.seats('outbound')).toBe(0);
    expect(trips.adjustCalls.map((c) => c.delta)).toEqual([-1]);
  });

  it('una nota automatica oltre il limite non e scritta e la riga risulta non chiusa', async () => {
    const { r, requests } = await accetta([pendente('A'), pendente('B')], 'A', {
      trips: ULTIMO_POSTO,
      config: { maxLength: 5, autoRejectNote: 'troppo lunga' },
    });

    expect(r.ok).toBe(true);
    if (r.ok && r.value.cascadeFailure?.kind === 'incomplete') {
      expect(r.value.cascadeFailure.unclosed.map((u) => u.id)).toEqual(['B']);
      expect(r.value.cascadeFailure.unclosed[0]?.cause.kind).toBe('note-too-long');
    } else {
      throw new Error('atteso cascadeFailure incomplete');
    }
    expect(requests.stored('B')?.status).toBe('pending');
  });
});
