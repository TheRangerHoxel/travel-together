// acceptRequest (senza cascata): decremento atomico, ordine delle scritture, identita'.
// Tre profili distinti: owner, richiedente, estraneo.

import type { MatchRequest, ProfileId } from '../domain';
import { type AcceptRequestConfig, acceptRequest } from './accept-request';
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

const NOTE: AcceptRequestConfig = { maxLength: 10, autoRejectNote: 'esaurito' };

async function esegui(
  actorId: ProfileId,
  riga: MatchRequest = unaRichiesta(),
  opzioni: { trips?: TripsOptions; requests?: Omit<RequestsOptions, 'existing'> } = {}
) {
  const requests = unRequestsSpia({ existing: [riga], ...opzioni.requests });
  const trips = unTripsSpia(opzioni.trips);
  const r = await acceptRequest({ requestId: riga.id, actorId }, { trips, requests }, NOTE);
  return { r, requests, trips };
}

describe('acceptRequest: percorso valido', () => {
  it('owner, tratta con 3 posti: accepted, la tratta scende a 2, la opposta resta a 3', async () => {
    const { r, requests, trips } = await esegui(OWNER);

    expect(r.ok).toBe(true);
    expect(requests.stored('req-1')?.status).toBe('accepted');
    const tratta = await trips.findLeg(TRIP_ID, 'outbound');
    expect(tratta.ok && tratta.value.seatsAvailable).toBe(2);
    expect(trips.seats('return')).toBe(3);
  });

  it('accetta sulla tratta di ritorno: scende solo il ritorno', async () => {
    const { trips } = await esegui(OWNER, unaRichiesta({ direction: 'return' }));

    expect(trips.seats('return')).toBe(2);
    expect(trips.seats('outbound')).toBe(3);
  });
});

describe('acceptRequest: rifiuti (zero scritture)', () => {
  it('posti a 0: errore, la riga resta pending, zero save', async () => {
    const { r, requests, trips } = await esegui(OWNER, unaRichiesta(), { trips: { seatsAvailable: 0 } });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('no-seats-available');
    expect(requests.stored('req-1')?.status).toBe('pending');
    expect(requests.saveCalls).toHaveLength(0);
    expect(trips.seats('outbound')).toBe(0);
  });

  it('riga gia accepted: errore e NESSUNA chiamata a adjustLegSeats (niente doppio decremento)', async () => {
    const { r, requests, trips } = await esegui(OWNER, unaRichiesta({ status: 'accepted' }));

    expect(r).toEqual({ ok: false, error: { kind: 'invalid-transition', from: 'accepted' } });
    expect(trips.adjustCalls).toHaveLength(0);
    expect(requests.saveCalls).toHaveLength(0);
  });

  it.each([
    ['rejected', 'owner'],
    ['cancelled', 'requester'],
  ] as const)('riga %s: errore che nomina lo stato, nessuna scrittura', async (status, resolvedBy) => {
    const { r, requests, trips } = await esegui(
      OWNER,
      unaRichiesta({ status, resolvedBy, resolutionNote: 'motivo' })
    );

    expect(r).toEqual({ ok: false, error: { kind: 'invalid-transition', from: status } });
    expect(trips.adjustCalls).toHaveLength(0);
    expect(requests.saveCalls).toHaveLength(0);
  });

  it.each([
    ['richiedente', RICHIEDENTE],
    ['estraneo', ESTRANEO],
  ])('%s non puo accettare: errore, zero scritture', async (_nome, attore) => {
    const { r, requests, trips } = await esegui(attore);

    expect(r).toEqual({ ok: false, error: { kind: 'not-trip-owner', actorId: attore } });
    expect(requests.saveCalls).toHaveLength(0);
    expect(trips.adjustCalls).toHaveLength(0);
    expect(trips.seats('outbound')).toBe(3);
  });

  it('candidatura inesistente: errore tipizzato', async () => {
    const requests = unRequestsSpia();
    const trips = unTripsSpia();
    const r = await acceptRequest({ requestId: 'x', actorId: OWNER }, { trips, requests }, NOTE);

    expect(r).toEqual({ ok: false, error: { kind: 'request-not-found', requestId: 'x' } });
    expect(trips.adjustCalls).toHaveLength(0);
  });
});

describe('acceptRequest: la save fallisce dopo il decremento', () => {
  const GUASTO = { kind: 'storage-unavailable', detail: 'down' } as const;

  it('compensazione riuscita: errore che lo dichiara, e i posti tornano a 3', async () => {
    const { r, trips } = await esegui(OWNER, unaRichiesta(), { requests: { failSave: GUASTO } });

    expect(r).toEqual({
      ok: false,
      error: { kind: 'save-failed-after-decrement', cause: GUASTO, compensation: { restored: true } },
    });
    expect(trips.adjustCalls.map((c) => c.delta)).toEqual([-1, 1]);
    expect(trips.seats('outbound')).toBe(3);
  });

  it('compensazione fallita: l errore lo dichiara e i posti restano sfasati', async () => {
    const { r, trips } = await esegui(OWNER, unaRichiesta(), {
      requests: { failSave: GUASTO },
      trips: { failAdjustOnCall: 2 },
    });

    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === 'save-failed-after-decrement') {
      expect(r.error.compensation.restored).toBe(false);
    } else {
      throw new Error('atteso save-failed-after-decrement');
    }
    expect(trips.seats('outbound')).toBe(2);
  });
});

describe('acceptRequest: interleaving nello stesso event loop (NON concorrenza reale)', () => {
  // Questo test NON prova la difesa lato database. JavaScript e' a thread singolo:
  // le due accettazioni si intercalano nei punti `await`, scelti dal codice, e il
  // fake replica il contratto di adjustLegSeats (relativo, atomico, limiti
  // [0, seatsTotal]). Prova che l'usecase DELEGA l'ammissione a quell'operazione
  // invece di leggere i posti e decidere da solo. La concorrenza reale su
  // Postgres e' un criterio di T08.
  it('due accettazioni sull ultimo posto: una ok, una err, posti 0 e una sola accepted', async () => {
    const prima = unaRichiesta({ id: 'req-1', requesterId: 'collega-1' });
    const seconda = unaRichiesta({ id: 'req-2', requesterId: 'collega-2' });
    const requests = unRequestsSpia({ existing: [prima, seconda] });
    const trips = unTripsSpia({ seatsTotal: 3, seatsAvailable: 1 });

    const [a, b] = await Promise.all([
      acceptRequest({ requestId: 'req-1', actorId: OWNER }, { trips, requests }, NOTE),
      acceptRequest({ requestId: 'req-2', actorId: OWNER }, { trips, requests }, NOTE),
    ]);

    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const perdente = a.ok ? b : a;
    if (!perdente.ok) expect(perdente.error.kind).toBe('no-seats-available');
    expect(trips.seats('outbound')).toBe(0);
    const accettate = ['req-1', 'req-2'].filter((id) => requests.stored(id)?.status === 'accepted');
    expect(accettate).toHaveLength(1);
    // L'accettazione che vince consuma l'ultimo posto e fa scattare la cascata: la
    // perdente, ancora pending per l'archivio, viene chiusa dal sistema.
    const altra = accettate[0] === 'req-1' ? 'req-2' : 'req-1';
    expect(requests.stored(altra)).toMatchObject({ status: 'rejected', resolvedBy: 'system' });
    expect(requests.saveCalls).toHaveLength(2);
  });
});
