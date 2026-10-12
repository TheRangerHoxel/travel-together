// Primo cancello di test:int: senza credenziali di staging si FALLISCE qui,
// con un messaggio che dice esattamente cosa manca e dove metterlo.
//
// Questo test esiste perche' il modo piu' comune di rompere una suite di
// integrazione non e' un bug: e' saltarla quando l'ambiente non c'e'. Un test
// saltato in silenzio si presenta come un verde, e un verde falso e' peggio di
// un rosso.
//
// Le verifiche vere su schema, policy RLS e codice invito arrivano in T08 e T10:
// finche' non esistono, questo file e' l'unico contenuto di test:int, ed e' giusto
// che il comando resti rosso finche' staging non e' configurato.

const RICHIESTE = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
] as const;

describe('credenziali del progetto Supabase di staging', () => {
  it('sono presenti nell ambiente', () => {
    const mancanti = RICHIESTE.filter((nome) => !process.env[nome]);

    if (mancanti.length > 0) {
      throw new Error(
        'test:int non puo girare: mancano le variabili ' +
          mancanti.join(', ') +
          '. Vanno messe in projects/traveltogether/app/.env (fuori dal repo, ' +
          'vedi .gitignore) e puntare al progetto Supabase di STAGING, mai a prod. ' +
          'I nomi attesi sono elencati in .env.example. ' +
          'Questo comando non deve passare in verde senza credenziali: fallire qui ' +
          'e il comportamento corretto.'
      );
    }

    expect(mancanti).toEqual([]);
  });
});
