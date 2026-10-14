// requestSeat: candidatura a una tratta. Ogni rifiuto asserisce zero `save` sullo spia.

import type { MatchRequest, NoteConfig } from '../domain';
import { requestSeat, type RequestSeatInput } from './request-seat';
import { RICHIEDENTE, TRIP_ID, unRequestsSpia, unTripsSpia, unaRichiesta } from './request-test-fakes';

const NOTE: NoteConfig = { maxLength: 10 };

function unInput(modifiche: Partial<RequestSeatInput> = {}): RequestSeatInput {
  return {
    id: 'req-nuova',
    tripId: TRIP_ID,
    direction: 'outbound',
    requesterId: RICHIEDENTE,
    requestNote: null,
    ...modifiche,
  };
}

async function esegui(input: RequestSeatInput, existing: readonly MatchRequest[] = []) {
  const requests = unRequestsSpia({ existing });
  const trips = unTripsSpia();
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
      status: 'pending',
      requestNote: null,
      resolutionNote: null,
      resolvedBy: null,
    });
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
    const trips = unTripsSpia();
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

  it('non rifiuta per posti a zero: la candidatura resta valida in coda', async () => {
    const requests = unRequestsSpia();
    const trips = unTripsSpia({ seatsAvailable: 0 });
    const r = await requestSeat(unInput(), { trips, requests }, NOTE);

    expect(r.ok).toBe(true);
    expect(requests.saveCalls).toHaveLength(1);
  });
});
