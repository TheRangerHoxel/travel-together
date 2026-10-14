// Soglie dei badge: il valore di ogni metrica a cui il badge si assegna.
//
// Niente annotazione di tipo, per lo stesso motivo di KPI_CONFIG: config/ non puo'
// importare il core. Il legame col tipo e' in core/usecases/badge-config.test.ts.
//
// Passeggero: trasferte condivise. Conducente: tratte offerte con almeno una
// candidatura accettata, colleghi trasportati, km condivisi. Valori da demo, da
// ritarare.

export const BADGE_CONFIG = {
  thresholds: {
    'primo-viaggio': 1,
    'cinque-viaggi': 5,
    'dieci-viaggi': 10,
    'primo-passaggio': 1,
    'cinque-colleghi': 5,
    'mille-km': 1000,
  },
} as const;
