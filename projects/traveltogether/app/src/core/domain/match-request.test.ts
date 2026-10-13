// Invarianti di MatchRequest. Si testano i CONFINI del limite delle note.
// domain/ non importa config/: la config qui e' un fixture.

import { type MatchRequest, makeMatchRequest } from './match-request';
import type { NoteConfig } from './note-config';

const LIMITE: NoteConfig = { maxLength: 10 };

function unaCandidatura(modifiche: Partial<MatchRequest> = {}): MatchRequest {
  return {
    id: 'req-1',
    tripId: 'trip-1',
    direction: 'outbound',
    requesterId: 'profile-1',
    status: 'pending',
    requestNote: null,
    resolutionNote: null,
    resolvedBy: null,
    ...modifiche,
  };
}

function errore(esito: ReturnType<typeof makeMatchRequest>): string | null {
  return esito.ok ? null : esito.error.kind;
}

describe('makeMatchRequest — nota di candidatura', () => {
  it('accetta una candidatura senza nota', () => {
    expect(makeMatchRequest(unaCandidatura({ requestNote: null }), LIMITE).ok).toBe(true);
  });

  it('accetta limite-1', () => {
    expect(makeMatchRequest(unaCandidatura({ requestNote: 'a'.repeat(9) }), LIMITE).ok).toBe(true);
  });

  it('accetta il limite esatto', () => {
    expect(makeMatchRequest(unaCandidatura({ requestNote: 'a'.repeat(10) }), LIMITE).ok).toBe(true);
  });

  it('rifiuta limite+1 con errore tipizzato, senza troncare', () => {
    const esito = makeMatchRequest(unaCandidatura({ requestNote: 'a'.repeat(11) }), LIMITE);

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error).toEqual({
        kind: 'note-too-long',
        field: 'requestNote',
        length: 11,
        maxLength: 10,
      });
    }
  });

  it('il rifiuto SEGUE il parametro: la stessa nota passa con un limite piu largo', () => {
    const nota = 'a'.repeat(11);

    expect(errore(makeMatchRequest(unaCandidatura({ requestNote: nota }), { maxLength: 10 }))).toBe(
      'note-too-long'
    );
    expect(makeMatchRequest(unaCandidatura({ requestNote: nota }), { maxLength: 11 }).ok).toBe(true);
    expect(errore(makeMatchRequest(unaCandidatura({ requestNote: 'abc' }), { maxLength: 2 }))).toBe(
      'note-too-long'
    );
  });

  it('conta in code point: 6 emoji (length 12) stanno nel limite di 10', () => {
    const sei = '👍'.repeat(6);
    // Oltre il limite contate come unita' di stringa (il conteggio SBAGLIATO),
    // dentro contate come code point: e' questo scarto che il test sfrutta.
    expect(sei.length).toBe(12);

    expect(makeMatchRequest(unaCandidatura({ requestNote: sei }), LIMITE).ok).toBe(true);
  });

  it('conta in code point: 10 emoji stanno nel limite, 11 no', () => {
    expect(makeMatchRequest(unaCandidatura({ requestNote: '👍'.repeat(10) }), LIMITE).ok).toBe(true);
    expect(errore(makeMatchRequest(unaCandidatura({ requestNote: '👍'.repeat(11) }), LIMITE))).toBe(
      'note-too-long'
    );
  });

  it('rifiuta una nota di soli spazi, non la normalizza a null', () => {
    const esito = makeMatchRequest(unaCandidatura({ requestNote: '   ' }), LIMITE);

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error).toEqual({ kind: 'note-blank', field: 'requestNote' });
    }
  });

  it('rifiuta la stringa vuota e gli spazi di altro tipo (tab, a capo)', () => {
    expect(errore(makeMatchRequest(unaCandidatura({ requestNote: '' }), LIMITE))).toBe('note-blank');
    expect(errore(makeMatchRequest(unaCandidatura({ requestNote: ' \t\n ' }), LIMITE))).toBe(
      'note-blank'
    );
  });
});

describe('makeMatchRequest — risoluzione', () => {
  it('pending con resolutionNote e resolvedBy nulli e valida', () => {
    expect(makeMatchRequest(unaCandidatura({ status: 'pending' }), LIMITE).ok).toBe(true);
  });

  it('pending con una risoluzione e rifiutata', () => {
    const esito = makeMatchRequest(
      unaCandidatura({ status: 'pending', resolutionNote: 'ok', resolvedBy: 'owner' }),
      LIMITE
    );

    expect(errore(esito)).toBe('pending-with-resolution');
  });

  it('pending con solo resolvedBy e rifiutata', () => {
    expect(
      errore(makeMatchRequest(unaCandidatura({ status: 'pending', resolvedBy: 'system' }), LIMITE))
    ).toBe('pending-with-resolution');
  });

  it('rejected con nota e resolvedBy insieme e valida', () => {
    const esito = makeMatchRequest(
      unaCandidatura({ status: 'rejected', resolutionNote: 'Posto dato', resolvedBy: 'owner' }),
      LIMITE
    );

    expect(esito.ok).toBe(true);
  });

  it('nota senza resolvedBy e rifiutata', () => {
    expect(
      errore(
        makeMatchRequest(
          unaCandidatura({ status: 'rejected', resolutionNote: 'Posto dato', resolvedBy: null }),
          LIMITE
        )
      )
    ).toBe('resolution-incomplete');
  });

  it('resolvedBy senza nota e rifiutato', () => {
    expect(
      errore(
        makeMatchRequest(
          unaCandidatura({ status: 'rejected', resolutionNote: null, resolvedBy: 'owner' }),
          LIMITE
        )
      )
    ).toBe('resolution-incomplete');
  });

  it('la nota di risoluzione e soggetta allo stesso limite e al rifiuto dei soli spazi', () => {
    const lunga = makeMatchRequest(
      unaCandidatura({ status: 'rejected', resolutionNote: 'a'.repeat(11), resolvedBy: 'owner' }),
      LIMITE
    );
    const bianca = makeMatchRequest(
      unaCandidatura({ status: 'rejected', resolutionNote: '  ', resolvedBy: 'owner' }),
      LIMITE
    );

    expect(lunga.ok || lunga.error).toEqual({
      kind: 'note-too-long',
      field: 'resolutionNote',
      length: 11,
      maxLength: 10,
    });
    expect(bianca.ok || bianca.error).toEqual({ kind: 'note-blank', field: 'resolutionNote' });
  });

  it('accetta tutti e tre i valori di resolvedBy', () => {
    for (const chi of ['owner', 'requester', 'system'] as const) {
      const esito = makeMatchRequest(
        unaCandidatura({ status: 'cancelled', resolutionNote: 'x', resolvedBy: chi }),
        LIMITE
      );
      expect(esito.ok).toBe(true);
    }
  });
});
