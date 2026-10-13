// Test di conformita': lega i VALORI reali di config/ al TIPO NoteConfig del dominio.
// Stesso schema di match-config.test.ts; sta in usecases/ perche' e' l'unico
// livello del core che puo' importare sia config/ sia domain/ (domain/ non importa
// config/).

import { NOTE_CONFIG } from '../../config';
import type { NoteConfig } from '../domain';

describe('i valori di config delle note sono conformi al tipo del dominio', () => {
  it('NOTE_CONFIG soddisfa NoteConfig', () => {
    // L'annotazione E' l'asserzione: se un campo mancasse o cambiasse nome,
    // questa riga non compilerebbe.
    const conforme: NoteConfig = NOTE_CONFIG;

    expect(conforme.maxLength).toBe(NOTE_CONFIG.maxLength);
  });

  it('il limite di produzione e un intero >= 1', () => {
    expect(Number.isInteger(NOTE_CONFIG.maxLength)).toBe(true);
    expect(NOTE_CONFIG.maxLength).toBeGreaterThanOrEqual(1);
  });
});
