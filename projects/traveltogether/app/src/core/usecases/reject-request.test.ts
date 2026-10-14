// rejectRequest: nessuna aritmetica sui posti, zero scritture su ogni rifiuto.
// Tre profili distinti: owner, richiedente, estraneo.

import type { MatchRequest, NoteConfig, ProfileId } from '../domain';
import { rejectRequest } from './reject-request';
import {
  ESTRANEO,
  OWNER,
  RICHIEDENTE,
  unRequestsSpia,
  unTripsSpia,
  unaRichiesta,
} from './request-test-fakes';

const NOTE: NoteConfig = { maxLength: 10 };

async function esegui(
  actorId: ProfileId,
  resolutionNote: string | null,
  riga: MatchRequest = unaRichiesta(),
  requestId: string = riga.id
) {
  const requests = unRequestsSpia({ existing: [riga] });
  const trips = unTripsSpia();
  const r = await rejectRequest({ requestId, actorId, resolutionNote }, { trips, requests }, NOTE);
  return { r, requests, trips };
}

describe('rejectRequest', () => {
  it('owner con nota valida: rejected, resolvedBy owner, nota conservata, posti non toccati', async () => {
    const { r, requests, trips } = await esegui(OWNER, ' non va \n');

    expect(r.ok).toBe(true);
    expect(requests.stored('req-1')).toMatchObject({
      status: 'rejected',
      resolvedBy: 'owner',
      resolutionNote: ' non va \n',
    });
    // E' cio' che distingue "invariati" da "decrementati e reincrementati".
    expect(trips.adjustCalls).toHaveLength(0);
    expect(trips.seats('outbound')).toBe(3);
  });

  it('nota assente: errore tipizzato, zero scritture', async () => {
    const { r, requests, trips } = await esegui(OWNER, null);

    expect(r).toEqual({ ok: false, error: { kind: 'resolution-note-required' } });
    expect(requests.saveCalls).toHaveLength(0);
    expect(trips.adjustCalls).toHaveLength(0);
  });

  it('nota di soli spazi: errore con la violazione originale, zero scritture', async () => {
    const { r, requests } = await esegui(OWNER, '   ');

    expect(r).toEqual({
      ok: false,
      error: { kind: 'request-invalid', violation: { kind: 'note-blank', field: 'resolutionNote' } },
    });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('nota oltre il limite: errore con la violazione originale, zero scritture', async () => {
    const { r, requests } = await esegui(OWNER, 'a'.repeat(11));

    expect(r).toEqual({
      ok: false,
      error: {
        kind: 'request-invalid',
        violation: { kind: 'note-too-long', field: 'resolutionNote', length: 11, maxLength: 10 },
      },
    });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it.each([
    ['richiedente', RICHIEDENTE],
    ['estraneo', ESTRANEO],
  ])('%s non puo rifiutare: errore, zero scritture', async (_nome, attore) => {
    const { r, requests, trips } = await esegui(attore, 'ok');

    expect(r).toEqual({ ok: false, error: { kind: 'not-trip-owner', actorId: attore } });
    expect(requests.saveCalls).toHaveLength(0);
    expect(trips.adjustCalls).toHaveLength(0);
  });

  it.each([
    ['rejected', 'owner'],
    ['cancelled', 'requester'],
    ['accepted', null],
  ] as const)('riga gia %s: errore che nomina lo stato di partenza', async (status, resolvedBy) => {
    const riga = unaRichiesta({
      status,
      resolvedBy,
      resolutionNote: resolvedBy === null ? null : 'motivo',
    });
    const { r, requests } = await esegui(OWNER, 'ok', riga);

    expect(r).toEqual({ ok: false, error: { kind: 'invalid-transition', from: status } });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('candidatura inesistente: errore tipizzato', async () => {
    const { r, requests } = await esegui(OWNER, 'ok', unaRichiesta(), 'non-esiste');

    expect(r).toEqual({ ok: false, error: { kind: 'request-not-found', requestId: 'non-esiste' } });
    expect(requests.saveCalls).toHaveLength(0);
  });

  it('trasferta inesistente: errore tipizzato', async () => {
    const { r, requests } = await esegui(OWNER, 'ok', unaRichiesta({ tripId: 'sparita' }));

    expect(r).toEqual({ ok: false, error: { kind: 'trip-not-found', tripId: 'sparita' } });
    expect(requests.saveCalls).toHaveLength(0);
  });
});

