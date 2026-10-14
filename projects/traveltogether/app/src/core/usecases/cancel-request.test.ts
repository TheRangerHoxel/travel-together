// cancelRequest: solo il richiedente; da accepted restituisce il posto.
// Tre profili distinti: owner, richiedente, estraneo.

import type { MatchRequest, NoteConfig, ProfileId } from '../domain';
import { cancelRequest } from './cancel-request';
import {
  ESTRANEO,
  OWNER,
  RICHIEDENTE,
  TRIP_ID,
  unRequestsSpia,
  unTripsSpia,
  unaRichiesta,
  type RequestsOptions,
  type TripsOptions,
} from './request-test-fakes';

const NOTE: NoteConfig = { maxLength: 10 };

async function esegui(
  actorId: ProfileId,
  resolutionNote: string | null,
  riga: MatchRequest = unaRichiesta(),
  opzioni: { trips?: TripsOptions; requests?: Omit<RequestsOptions, 'existing'> } = {}
) {
  const requests = unRequestsSpia({ existing: [riga], ...opzioni.requests });
  const trips = unTripsSpia(opzioni.trips);
  const r = await cancelRequest(
    { requestId: riga.id, actorId, resolutionNote },
    { trips, requests },
    NOTE
  );
  return { r, requests, trips };
}

/** Una accepted coerente: il suo posto e' gia' stato decrementato (2 su 3). */
const ACCEPTED = unaRichiesta({ status: 'accepted' });
const DUE_SU_TRE: TripsOptions = { seatsAvailable: 2, returnAvailable: 3 };

describe('cancelRequest: da pending', () => {
  it('richiedente: cancelled, nota e autore null, adjustLegSeats non chiamato', async () => {
    const { r, requests, trips } = await esegui(RICHIEDENTE, null);

    expect(r.ok).toBe(true);
    expect(requests.stored('req-1')).toMatchObject({
      status: 'cancelled',
      resolutionNote: null,
      resolvedBy: null,
    });
    expect(trips.adjustCalls).toHaveLength(0);
  });

  it('nota passata: accettata e conservata con resolvedBy requester', async () => {
    const { r, requests, trips } = await esegui(RICHIEDENTE, 'ripensato');

    expect(r.ok).toBe(true);
    expect(requests.stored('req-1')).toMatchObject({
      status: 'cancelled',
      resolutionNote: 'ripensato',
      resolvedBy: 'requester',
    });
    expect(trips.adjustCalls).toHaveLength(0);
  });
});

describe('cancelRequest: da accepted', () => {
  it('richiedente con nota: cancelled, requester, posti +1, tratta opposta invariata', async () => {
    const { r, requests, trips } = await esegui(RICHIEDENTE, 'imprevisto', ACCEPTED, { trips: DUE_SU_TRE });

    expect(r.ok).toBe(true);
    expect(requests.stored('req-1')).toMatchObject({
      status: 'cancelled',
      resolutionNote: 'imprevisto',
      resolvedBy: 'requester',
    });
    const tratta = await trips.findLeg(TRIP_ID, 'outbound');
    expect(tratta.ok && tratta.value.seatsAvailable).toBe(3);
    expect(trips.seats('return')).toBe(3);
  });

  it('senza nota: errore tipizzato, zero scritture', async () => {
    const { r, requests, trips } = await esegui(RICHIEDENTE, null, ACCEPTED, { trips: DUE_SU_TRE });

    expect(r).toEqual({ ok: false, error: { kind: 'resolution-note-required' } });
    expect(requests.saveCalls).toHaveLength(0);
    expect(trips.adjustCalls).toHaveLength(0);
  });

  it('nota di soli spazi: errore con la violazione originale, posti non toccati', async () => {
    const { r, requests, trips } = await esegui(RICHIEDENTE, '  ', ACCEPTED, { trips: DUE_SU_TRE });

    expect(r).toEqual({
      ok: false,
      error: { kind: 'request-invalid', violation: { kind: 'note-blank', field: 'resolutionNote' } },
    });
    expect(requests.saveCalls).toHaveLength(0);
    expect(trips.adjustCalls).toHaveLength(0);
  });

  it('+1 che sfonda seatsTotal: errore tipizzato, nessuna eccezione, nessuna save', async () => {
    // Stato incoerente ma raggiungibile: una accepted scritta senza decremento.
    const { r, requests } = await esegui(RICHIEDENTE, 'imprevisto', ACCEPTED, { trips: { seatsAvailable: 3 } });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('seat-restore-rejected');
    expect(requests.saveCalls).toHaveLength(0);
    expect(requests.stored('req-1')?.status).toBe('accepted');
  });

  it('save che fallisce dopo il +1: compensazione dichiarata, posti tornano a 2', async () => {
    const guasto = { kind: 'storage-unavailable', detail: 'down' } as const;
    const { r, trips } = await esegui(RICHIEDENTE, 'imprevisto', ACCEPTED, {
      trips: DUE_SU_TRE,
      requests: { failSave: guasto },
    });

    expect(r).toEqual({
      ok: false,
      error: { kind: 'save-failed-after-restore', cause: guasto, compensation: { restored: true } },
    });
    expect(trips.seats('outbound')).toBe(2);
  });
});

describe('cancelRequest: rifiuti (zero scritture)', () => {
  it.each([
    ['owner', OWNER],
    ['estraneo', ESTRANEO],
  ])('%s non puo annullare: errore, zero scritture', async (_nome, attore) => {
    const { r, requests, trips } = await esegui(attore, 'nota', ACCEPTED, { trips: DUE_SU_TRE });

    expect(r).toEqual({ ok: false, error: { kind: 'not-requester', actorId: attore } });
    expect(requests.saveCalls).toHaveLength(0);
    expect(trips.adjustCalls).toHaveLength(0);
    expect(trips.seats('outbound')).toBe(2);
  });

  it('riga gia cancelled: errore e nessun secondo +1', async () => {
    const gia = unaRichiesta({ status: 'cancelled', resolutionNote: 'prima', resolvedBy: 'requester' });
    const { r, requests, trips } = await esegui(RICHIEDENTE, 'ancora', gia, { trips: DUE_SU_TRE });

    expect(r).toEqual({ ok: false, error: { kind: 'invalid-transition', from: 'cancelled' } });
    expect(trips.adjustCalls).toHaveLength(0);
    expect(trips.seats('outbound')).toBe(2);
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('riga rejected: errore che nomina lo stato', async () => {
    const gia = unaRichiesta({ status: 'rejected', resolutionNote: 'no', resolvedBy: 'owner' });
    const { r, trips } = await esegui(RICHIEDENTE, 'nota', gia);

    expect(r).toEqual({ ok: false, error: { kind: 'invalid-transition', from: 'rejected' } });
    expect(trips.adjustCalls).toHaveLength(0);
  });

  it('candidatura inesistente: errore tipizzato', async () => {
    const requests = unRequestsSpia();
    const trips = unTripsSpia();
    const r = await cancelRequest(
      { requestId: 'x', actorId: RICHIEDENTE, resolutionNote: null },
      { trips, requests },
      NOTE
    );

    expect(r).toEqual({ ok: false, error: { kind: 'request-not-found', requestId: 'x' } });
  });
});

