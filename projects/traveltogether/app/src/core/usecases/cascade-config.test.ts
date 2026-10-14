// Test di conformita': lega i VALORI reali di config/ al TIPO CascadeConfig, e
// verifica che la nota automatica di produzione sia scrivibile col limite di
// produzione. Stesso schema di note-config.test.ts.

import { CASCADE_CONFIG, NOTE_CONFIG } from '../../config';
import { makeMatchRequest } from '../domain';
import type { CascadeConfig } from './cascade-config';

describe('i valori di config della cascata sono conformi al tipo del core', () => {
  it('CASCADE_CONFIG soddisfa CascadeConfig', () => {
    const conforme: CascadeConfig = CASCADE_CONFIG;

    expect(conforme.autoRejectNote).toBe(CASCADE_CONFIG.autoRejectNote);
  });

  it('la nota automatica non e vuota e sta entro maxLength in CODE POINT', () => {
    const lunghezza = Array.from(CASCADE_CONFIG.autoRejectNote).length;

    expect(CASCADE_CONFIG.autoRejectNote.trim()).not.toBe('');
    expect(lunghezza).toBeLessThanOrEqual(NOTE_CONFIG.maxLength);
  });

  it('e accettata da makeMatchRequest come nota di risoluzione di sistema', () => {
    // Se il limite scendesse sotto il testo, la cascata fallirebbe con
    // note-too-long su una nota che nessun utente ha scritto: qui si vede prima.
    const esito = makeMatchRequest(
      {
        id: 'r',
        tripId: 't',
        direction: 'outbound',
        requesterId: 'p',
        status: 'rejected',
        requestNote: null,
        resolutionNote: CASCADE_CONFIG.autoRejectNote,
        resolvedBy: 'system',
      },
      NOTE_CONFIG
    );

    expect(esito.ok).toBe(true);
  });
});
