// Test di conformita': lega i VALORI reali di config/ al TIPO che il core si aspetta.
//
// E' l'unico file del core che importa config/, ed esiste per una ragione sola:
// senza, config/ esporterebbe un oggetto che nessuno confronta con niente. Un
// campo rinominato o rimosso arriverebbe a runtime come `undefined`, e
// `undefined * 60000` e' `NaN` — che non solleva, non si nota, e fa fallire ogni
// confronto successivo. Il risultato sarebbe zero match, nessun errore e tutti i
// test verdi, perche' i test usano fixture di config e non i valori di produzione.
//
// Il grosso del lavoro lo fa `tsc`, non jest: se la forma diverge, `npm run
// typecheck` diventa rosso prima che questo file venga eseguito.

import { MATCH_CONFIG } from '../../config';
import type { MatchConfig } from './match-config';

describe('i valori di config sono conformi al tipo del core', () => {
  it('MATCH_CONFIG soddisfa MatchConfig', () => {
    // L'annotazione E' l'asserzione: se un campo mancasse o cambiasse nome,
    // questa riga non compilerebbe.
    const conforme: MatchConfig = MATCH_CONFIG;

    expect(conforme.toleranceMinutes).toBe(MATCH_CONFIG.toleranceMinutes);
  });

  it('la tolleranza e un intero non negativo, come findMatches pretende', () => {
    // findMatches rifiuta con 'invalid-tolerance' tutto il resto: questo test
    // verifica che i valori di PRODUZIONE non finiscano in quel ramo.
    expect(Number.isInteger(MATCH_CONFIG.toleranceMinutes)).toBe(true);
    expect(MATCH_CONFIG.toleranceMinutes).toBeGreaterThanOrEqual(0);
  });
});
