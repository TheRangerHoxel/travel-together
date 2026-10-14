// Il ciclo completo, in un test solo: accetta sull'ultimo posto -> cascata ->
// annulla l'accepted -> reintegro -> (senza ricandidarsi) riaccetta -> nuova cascata.
// Prova che rejectRemainingPending e restoreSystemRejected sono inverse e che il
// modello a righe riusate regge il giro. Nessun requestSeat in mezzo: se il
// reintegro non funzionasse, il secondo accept fallirebbe con 'invalid-transition'.

import { acceptRequest, type AcceptRequestConfig } from './accept-request';
import { cancelRequest } from './cancel-request';
import { OWNER, unRequestsSpia, unTripsSpia, unaRichiesta } from './request-test-fakes';

const CONFIG: AcceptRequestConfig = { maxLength: 30, autoRejectNote: 'esaurito' };

describe('ciclo accetta -> cascata -> annulla -> reintegro -> riaccetta', () => {
  it('le due transizioni di sistema sono inverse', async () => {
    const requests = unRequestsSpia({
      existing: ['A', 'B', 'C'].map((id) => unaRichiesta({ id, requesterId: `utente-${id}` })),
    });
    const trips = unTripsSpia({ seatsTotal: 3, seatsAvailable: 1 });
    const deps = { trips, requests };

    // 1. A prende l'ultimo posto: B e C chiuse dal sistema.
    const primo = await acceptRequest({ requestId: 'A', actorId: OWNER }, deps, CONFIG);
    expect(primo.ok && primo.value.autoRejected).toEqual(['B', 'C']);
    expect(trips.seats('outbound')).toBe(0);

    // 2. A annulla: posto +1, B e C tornano pending con lo stesso id.
    const annullo = await cancelRequest(
      { requestId: 'A', actorId: 'utente-A', resolutionNote: 'non vengo' },
      deps,
      CONFIG
    );
    expect(annullo.ok && annullo.value.restored).toEqual(['B', 'C']);
    expect(trips.seats('outbound')).toBe(1);
    for (const id of ['B', 'C']) {
      expect(requests.stored(id)).toMatchObject({
        status: 'pending',
        resolutionNote: null,
        resolvedBy: null,
      });
    }
    expect(requests.stored('A')).toMatchObject({ status: 'cancelled', resolvedBy: 'requester' });

    // 3. Senza che nessuno si ricandidi, il proprietario accetta B: nuova cascata
    // su C. A, annullata da una persona, non viene toccata.
    const secondo = await acceptRequest({ requestId: 'B', actorId: OWNER }, deps, CONFIG);
    expect(secondo.ok && secondo.value.autoRejected).toEqual(['C']);
    expect(requests.stored('B')?.status).toBe('accepted');
    expect(requests.stored('C')).toMatchObject({ status: 'rejected', resolvedBy: 'system' });
    expect(requests.stored('A')?.status).toBe('cancelled');
    expect(trips.seats('outbound')).toBe(0);

    // Nessun posto e' mai stato scritto direttamente: solo -1, +1, -1.
    expect(trips.adjustCalls.map((c) => c.delta)).toEqual([-1, 1, -1]);
  });
});
