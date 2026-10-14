// requestSeat: candidatura a una tratta. Ogni rifiuto asserisce zero `save` sullo spia.

import type { MatchRequest, NoteConfig, Trip } from '../domain';
import { requestSeat, type RequestSeatInput } from './request-seat';
import {
  ESTRANEO,
  RICHIEDENTE,
  TRIP_ID,
  type TripsSpia,
  unRequestsSpia,
  unTripsSpia,
  unaRichiesta,
} from './request-test-fakes';

const NOTE: NoteConfig = { maxLength: 10 };

function unInput(modifiche: Partial<RequestSeatInput> = {}): RequestSeatInput {
  return {
    id: 'req-nuova',
    tripId: TRIP_ID,
    direction: 'outbound',
    requesterId: RICHIEDENTE,
    requesterTripId: 'trip-richiedente',
    requestNote: null,
    ...modifiche,
  };
}

function unaTrasfertaPropria(modifiche: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-richiedente',
    ownerId: RICHIEDENTE,
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    departureAt: '2026-11-03T07:00:00.000Z',
    returnAt: null,
    hasCar: false,
    seatsTotal: 0,
    seatsAvailable: 0,
    status: 'published',
    ...modifiche,
  };
}

async function esegui(
  input: RequestSeatInput,
  existing: readonly MatchRequest[] = [],
  otherTrips: readonly Trip[] = [unaTrasfertaPropria()]
) {
  const requests = unRequestsSpia({ existing });
  const trips = unTripsSpia({ otherTrips });
  const r = await requestSeat(input, { trips, requests }, NOTE);
  return { r, requests, trips };
}

describe('requestSeat: casi validi', () => {
  it('senza nota crea una pending con nota e autore della risoluzione a null', async () => {
    const { r, requests } = await esegui(unInput());

    expect(r.ok).toBe(true);
    expect(requests.saveCalls).toHaveLength(1);
    expect(requests.saveCalls[0]).toEqual({
      id: 'req-nuova',
      tripId: TRIP_ID,
      direction: 'outbound',
      requesterId: RICHIEDENTE,
      requesterTripId: 'trip-richiedente',
      status: 'pending',
      requestNote: null,
      resolutionNote: null,
      resolvedBy: null,
    });
  });

  it('salva la trasferta di chi si candida, quella passata in input', async () => {
    const { requests } = await esegui(unInput({ requesterTripId: 'altra-trasferta' }), [], [
      unaTrasfertaPropria({ id: 'altra-trasferta' }),
    ]);

    expect(requests.saveCalls[0]?.requesterTripId).toBe('altra-trasferta');
  });

  it('una cancelled riaperta prende la trasferta della NUOVA candidatura', async () => {
    const vecchia = unaRichiesta({ id: 'req-vecchia', status: 'cancelled', resolutionNote: 'x', resolvedBy: 'requester', requesterTripId: 'vecchia-trasferta' });
    const { requests } = await esegui(unInput({ requesterTripId: 'nuova-trasferta' }), [vecchia], [
      unaTrasfertaPropria({ id: 'nuova-trasferta' }),
    ]);

    expect(requests.saveCalls[0]?.requesterTripId).toBe('nuova-trasferta');
  });

  it('senza trasferta del richiedente la candidatura e rifiutata e non scrive', async () => {
    const { r, requests } = await esegui(unInput({ requesterTripId: '  ' }));

    expect(r).toEqual({
      ok: false,
      error: { kind: 'request-invalid', violation: { kind: 'requester-trip-missing' } },
    });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('conserva la nota byte per byte (spazi interni, a capo, emoji, spazi ai bordi)', async () => {
    // 10 code point (limite incluso): spazi ai bordi e doppi, a capo, emoji.
    const nota = ' ciao\n\u{1F44D}  x';
    const { requests } = await esegui(unInput({ requestNote: nota }));

    expect(requests.saveCalls[0]?.requestNote).toBe(nota);
  });

  it('una cancelled viene riaperta riusando lo STESSO id, con la risoluzione azzerata', async () => {
    const vecchia = unaRichiesta({
      id: 'req-vecchia',
      status: 'cancelled',
      resolutionNote: 'non vengo piu',
      resolvedBy: 'requester',
    });
    const { r, requests } = await esegui(unInput({ id: 'req-nuova', requestNote: 'di nuovo' }), [vecchia]);

    expect(r.ok).toBe(true);
    expect(requests.saveCalls).toHaveLength(1);
    expect(requests.saveCalls[0]).toMatchObject({
      id: 'req-vecchia',
      status: 'pending',
      requestNote: 'di nuovo',
      resolutionNote: null,
      resolvedBy: null,
    });
  });

  it('lo stesso richiedente su andata e ritorno produce due righe distinte', async () => {
    const requests = unRequestsSpia();
    const trips = unTripsSpia({ otherTrips: [unaTrasfertaPropria()] });
    const a = await requestSeat(unInput({ id: 'req-a', direction: 'outbound' }), { trips, requests }, NOTE);
    const b = await requestSeat(unInput({ id: 'req-b', direction: 'return' }), { trips, requests }, NOTE);

    expect(a.ok && b.ok).toBe(true);
    expect(requests.stored('req-a')?.direction).toBe('outbound');
    expect(requests.stored('req-b')?.direction).toBe('return');
  });
});

describe('requestSeat: rifiuti (zero scritture)', () => {
  it('nota di soli spazi: errore con la violazione originale', async () => {
    const { r, requests } = await esegui(unInput({ requestNote: '   ' }));

    expect(r).toEqual({
      ok: false,
      error: { kind: 'request-invalid', violation: { kind: 'note-blank', field: 'requestNote' } },
    });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('nota oltre il limite: errore con la violazione originale, non storage-failed', async () => {
    const { r, requests } = await esegui(unInput({ requestNote: 'a'.repeat(11) }));

    expect(r).toEqual({
      ok: false,
      error: {
        kind: 'request-invalid',
        violation: { kind: 'note-too-long', field: 'requestNote', length: 11, maxLength: 10 },
      },
    });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it.each([
    ['pending', null],
    ['accepted', null],
    ['rejected', 'owner'],
    // Il reintegro dopo l'auto-rifiuto e' automatico: da qui non si passa.
    ['rejected', 'system'],
  ] as const)('esiste gia una %s (resolvedBy %s): errore con lo stato trovato', async (status, resolvedBy) => {
    const esistente = unaRichiesta({
      status,
      resolvedBy,
      resolutionNote: resolvedBy === null ? null : 'motivo',
    });
    const { r, requests } = await esegui(unInput(), [esistente]);

    expect(r).toEqual({ ok: false, error: { kind: 'already-requested', status, resolvedBy } });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('tratta inesistente: errore tipizzato', async () => {
    const { r, requests } = await esegui(unInput({ tripId: 'non-esiste' }));

    expect(r).toEqual({
      ok: false,
      error: { kind: 'leg-not-found', tripId: 'non-esiste', direction: 'outbound' },
    });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('ritorno richiesto su una trasferta senza rientro: tratta inesistente', async () => {
    const requests = unRequestsSpia();
    const trips = unTripsSpia({ withReturn: false });
    const r = await requestSeat(unInput({ direction: 'return' }), { trips, requests }, NOTE);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('leg-not-found');
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('requesterTripId inesistente: errore tipizzato, zero scritture', async () => {
    const { r, requests } = await esegui(unInput({ requesterTripId: 'fantasma' }));

    expect(r).toEqual({
      ok: false,
      error: { kind: 'requester-trip-invalid', reason: 'not-found', requesterTripId: 'fantasma' },
    });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('requesterTripId di un altro collega: errore tipizzato, zero scritture', async () => {
    // Senza auto e pubblicata: l'UNICA ragione di rifiuto e' che non e' sua.
    const altrui = unaTrasfertaPropria({ id: 'trip-collega', ownerId: ESTRANEO });
    const { r, requests } = await esegui(unInput({ requesterTripId: 'trip-collega' }), [], [altrui]);

    expect(r).toEqual({
      ok: false,
      error: { kind: 'requester-trip-invalid', reason: 'not-owned', requesterTripId: 'trip-collega' },
    });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('requesterTripId con l\'auto: errore tipizzato, zero scritture', async () => {
    const conAuto = unaTrasfertaPropria({ hasCar: true, seatsTotal: 3, seatsAvailable: 3 });
    const { r, requests } = await esegui(unInput(), [], [conAuto]);

    expect(r).toEqual({
      ok: false,
      error: { kind: 'requester-trip-invalid', reason: 'has-car', requesterTripId: 'trip-richiedente' },
    });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it.each(['cancelled', 'completed'] as const)(
    'requesterTripId propria e senza auto ma %s: errore con lo stato trovato, zero scritture',
    async (status) => {
      const nonPubblicata = unaTrasfertaPropria({ status });
      const { r, requests } = await esegui(unInput(), [], [nonPubblicata]);

      expect(r).toEqual({
        ok: false,
        error: {
          kind: 'requester-trip-invalid',
          reason: 'not-published',
          status,
          requesterTripId: 'trip-richiedente',
        },
      });
      expect(requests.saveCalls).toHaveLength(0);
    }
  );

  it('un estraneo alla trasferta non apprende lo stato della candidatura esistente', async () => {
    // Esiste una accettata del richiedente: se already-requested venisse prima del
    // titolo, chi indica la trasferta altrui leggerebbe 'accepted'.
    const esistente = unaRichiesta({ status: 'accepted' });
    const altrui = unaTrasfertaPropria({ id: 'trip-collega', ownerId: ESTRANEO });
    const { r, requests } = await esegui(unInput({ requesterTripId: 'trip-collega' }), [esistente], [altrui]);

    expect(r).toEqual({
      ok: false,
      error: { kind: 'requester-trip-invalid', reason: 'not-owned', requesterTripId: 'trip-collega' },
    });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('la FORMA precede already-requested: candidatura esistente E nota invalida danno request-invalid', async () => {
    // Pinna l'altra precedenza decisa in T07c. La gemella ("titolo prima di stato") ha
    // il suo test qui sopra; questa viveva solo in un commento, quindi un riordino
    // futuro avrebbe riportato `already-requested` davanti senza nessun rosso — e il
    // commento in request-seat.ts sarebbe rimasto a descrivere un ordine che non c'e'
    // piu'. Rilievo del reviewer su T07c: di due decisioni di ordinamento prese nello
    // stesso giro, una era un contratto e l'altra una dichiarazione.
    const esistente = unaRichiesta({ status: 'accepted' });
    const propria = unaTrasfertaPropria({ id: 'trip-richiedente' });
    const notaTroppoLunga = 'x'.repeat(NOTE.maxLength + 1);
    const { r, requests } = await esegui(
      unInput({ requestNote: notaTroppoLunga }),
      [esistente],
      [propria]
    );

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('request-invalid');
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('un errore di storage nel leggere la trasferta non e un rifiuto di merito: storage-failed', async () => {
    const requests = unRequestsSpia();
    const base = unTripsSpia();
    const trips: TripsSpia = {
      ...base,
      findById: (id) =>
        id === 'trip-richiedente'
          ? Promise.resolve({ ok: false, error: { kind: 'storage-unavailable', detail: 'giu' } })
          : base.findById(id),
    };
    const r = await requestSeat(unInput(), { trips, requests }, NOTE);

    expect(r).toEqual({
      ok: false,
      error: { kind: 'storage-failed', cause: { kind: 'storage-unavailable', detail: 'giu' } },
    });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('id vuoto: resta la violazione del dominio, la trasferta non viene nemmeno letta', async () => {
    const { r, trips } = await esegui(unInput({ requesterTripId: '  ' }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('request-invalid');
    expect(trips.findByIdCalls).toHaveLength(0);
  });

  it('non rifiuta per posti a zero: la candidatura resta valida in coda', async () => {
    const requests = unRequestsSpia();
    const trips = unTripsSpia({ seatsAvailable: 0, otherTrips: [unaTrasfertaPropria()] });
    const r = await requestSeat(unInput(), { trips, requests }, NOTE);

    expect(r.ok).toBe(true);
    expect(requests.saveCalls).toHaveLength(1);
  });
});
