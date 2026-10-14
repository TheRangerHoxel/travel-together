// Il reintegro di cancelRequest: le righe chiuse dal SISTEMA tornano pending quando
// un posto torna sopra zero. Si contano le chiamate a save e a adjustLegSeats.

import type { MatchRequest, NoteConfig } from '../domain';
import { cancelRequest } from './cancel-request';
import { unRequestsSpia, unTripsSpia, unaRichiesta, type TripsOptions } from './request-test-fakes';

const NOTE: NoteConfig = { maxLength: 30 };

function riga(id: string, modifiche: Partial<MatchRequest> = {}): MatchRequest {
  return unaRichiesta({ id, requesterId: `utente-${id}`, ...modifiche });
}

const DI_SISTEMA: Partial<MatchRequest> = {
  status: 'rejected',
  resolvedBy: 'system',
  resolutionNote: 'esaurito',
  requestNote: 'passo da Napoli',
};

const DEL_PROPRIETARIO: Partial<MatchRequest> = {
  status: 'rejected',
  resolvedBy: 'owner',
  resolutionNote: 'ho scelto un altro',
};

async function annulla(
  righe: readonly MatchRequest[],
  quale: string,
  nota: string | null,
  trips: TripsOptions,
  failSaveOnCall?: number
) {
  const richiesta = righe.find((r) => r.id === quale);
  if (!richiesta) throw new Error('riga non nel setup');
  const requests = unRequestsSpia({ existing: righe, failSaveOnCall });
  const tripsSpia = unTripsSpia(trips);
  const r = await cancelRequest(
    { requestId: quale, actorId: richiesta.requesterId, resolutionNote: nota },
    { trips: tripsSpia, requests },
    NOTE
  );
  return { r, requests, trips: tripsSpia };
}

/** Tratta esaurita: A accettata, B e C chiuse dal sistema. */
const A_ACCETTATA = riga('A', { status: 'accepted' });
const ESAURITA: TripsOptions = { seatsAvailable: 0, seatsTotal: 3, returnAvailable: 3 };

describe('reintegro delle righe di sistema', () => {
  it('accepted annullata su tratta a 0: B e C tornano pending, stessi id, risoluzione azzerata', async () => {
    const { r, requests, trips } = await annulla(
      [A_ACCETTATA, riga('B', DI_SISTEMA), riga('C', DI_SISTEMA)],
      'A',
      'imprevisto',
      ESAURITA
    );

    expect(r.ok && r.value.restored).toEqual(['B', 'C']);
    for (const id of ['B', 'C']) {
      expect(requests.stored(id)).toEqual({
        id,
        tripId: 'trip-1',
        direction: 'outbound',
        requesterId: `utente-${id}`,
        // Il reintegro conserva il campo introdotto per T06 (fixture di default).
        requesterTripId: 'trip-richiedente',
        // pending e NON accepted: tornano candidati tutti, sceglie chi offre.
        status: 'pending',
        requestNote: 'passo da Napoli',
        resolutionNote: null,
        resolvedBy: null,
      });
    }
    // Il reintegro non tocca i posti: l'unico adjust e' il +1 dell'annullamento.
    expect(trips.adjustCalls.map((c) => c.delta)).toEqual([1]);
    expect(trips.seats('outbound')).toBe(1);
  });

  it('system e owner fianco a fianco: la rejected/owner resta rejected con la sua nota', async () => {
    const { r, requests } = await annulla(
      [A_ACCETTATA, riga('B', DI_SISTEMA), riga('D', DEL_PROPRIETARIO)],
      'A',
      'imprevisto',
      ESAURITA
    );

    expect(r.ok && r.value.restored).toEqual(['B']);
    expect(requests.stored('B')?.status).toBe('pending');
    expect(requests.stored('D')).toMatchObject({
      status: 'rejected',
      resolvedBy: 'owner',
      resolutionNote: 'ho scelto un altro',
    });
  });

  it('le righe cancelled non vengono toccate', async () => {
    const annullata = riga('E', {
      status: 'cancelled',
      resolvedBy: 'requester',
      resolutionNote: 'ripensato',
    });
    const { requests } = await annulla([A_ACCETTATA, riga('B', DI_SISTEMA), annullata], 'A', 'ok', ESAURITA);

    expect(requests.stored('E')).toEqual(annullata);
    expect(requests.saveCalls.map((s) => s.id).sort()).toEqual(['A', 'B']);
  });

  it('le righe di sistema dell altra tratta non vengono reintegrate', async () => {
    const sulRitorno = riga('R', { ...DI_SISTEMA, direction: 'return' });
    const { r, requests } = await annulla([A_ACCETTATA, riga('B', DI_SISTEMA), sulRitorno], 'A', 'ok', ESAURITA);

    expect(r.ok && r.value.restored).toEqual(['B']);
    expect(requests.stored('R')?.status).toBe('rejected');
  });

  it('annullare una PENDING non reintegra, anche se esistono righe di sistema', async () => {
    // Posti invariati (a 0): l'innesco e' il passaggio sopra zero, non l'annullamento.
    const { r, requests, trips } = await annulla(
      [riga('P'), riga('B', DI_SISTEMA)],
      'P',
      null,
      ESAURITA
    );

    expect(r.ok && r.value.restored).toEqual([]);
    expect(requests.saveCalls).toHaveLength(1);
    expect(requests.stored('B')?.status).toBe('rejected');
    expect(trips.adjustCalls).toHaveLength(0);
  });

  // NON c'e' un test per l'annullamento che porta i posti da 1 a 2: nel caso normale
  // in quello stato nessuna riga `system` esiste sulla tratta (nascono solo a posti =
  // 0 e restano finche' non risalgono), quindi asserire che "non succede niente"
  // sarebbe verificare uno stato che quel percorso non produce.
  //
  // Con UNA eccezione, dichiarata anche in cancel-request.ts: un reintegro rimasto
  // incompleto lascia una riga `system` su una tratta che ha gia' un posto libero, e
  // un secondo annullamento non la reintegra. E' raggiungibile, e il test qui sotto
  // ("reintegro a meta") e' proprio quello che produce quello stato. Il recupero e'
  // un nuovo passaggio sopra zero, e la riga resta elencata in `unclosed`.

  it('reintegro a meta: l annullamento resta valido e le righe non reintegrate sono elencate', async () => {
    // save: 1 = A cancelled, 2 = B (fallisce), 3 = C.
    const { r, requests } = await annulla(
      [A_ACCETTATA, riga('B', DI_SISTEMA), riga('C', DI_SISTEMA)],
      'A',
      'imprevisto',
      ESAURITA,
      2
    );

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.request.status).toBe('cancelled');
      expect(r.value.restored).toEqual(['C']);
      expect(r.value.restoreFailure).toMatchObject({ kind: 'incomplete', done: ['C'] });
      if (r.value.restoreFailure?.kind === 'incomplete') {
        expect(r.value.restoreFailure.unclosed.map((u) => u.id)).toEqual(['B']);
      }
    }
    expect(requests.stored('B')?.status).toBe('rejected');
  });
});
