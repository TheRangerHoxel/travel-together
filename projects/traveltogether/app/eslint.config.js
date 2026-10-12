// Lint: qualita' generale (eslint-config-expo) + i confini di modularita'.
//
// I confini NON sono stile: sono criteri di accettazione. Una violazione fa fallire
// verify, non apre una discussione. Vedi ARCHITECTURE.md § Modularita'.
//
//   ui/  ->  core/usecases/  ->  core/ports/  <-  adapters/
//
// Ogni regola qui sotto e' dimostrata violandola: una regola di lint mai vista
// fallire non protegge niente.

const expoConfig = require('eslint-config-expo/flat');
const boundaries = require('eslint-plugin-boundaries');

/** Messaggi: dicono cosa fare, non solo cosa e' vietato. */
const NO_ADAPTERS_FROM_CORE =
  "core/ non puo' importare adapters/ ne' ui/. Se serve, manca un port: " +
  "proponi l'interfaccia in core/ports/, non la scorciatoia.";

const NO_ADAPTERS_FROM_UI =
  "ui/ non puo' importare adapters/: passa sempre da core/usecases/.";

const NO_CLOCK_IN_CORE =
  "core/ non puo' leggere l'orologio di sistema: il tempo entra dal port Clock, " +
  'altrimenti i test non sono deterministici.';

/** Chi puo' dipendere da chi. Una sola direzione, niente cicli. */
const GRAFO = {
  domain: ['domain'],
  ports: ['domain', 'ports'],
  usecases: ['domain', 'ports', 'usecases', 'config'],
  adapters: ['domain', 'ports', 'adapters', 'config'],
  ui: ['domain', 'ports', 'usecases', 'ui', 'config'],
  config: ['config'],
};

module.exports = [
  ...expoConfig,

  {
    ignores: ['node_modules/**', 'dist/**', '.expo/**', 'web-build/**'],
  },

  {
    // import/no-unresolved e' disattivata deliberatamente: il resolver TypeScript
    // che eslint-config-expo porta con se' espone un'interfaccia che la sua stessa
    // versione di eslint-plugin-import non sa caricare ("invalid interface loaded
    // as resolver"), quindi la regola fallirebbe su OGNI import.
    // Non e' una perdita di copertura: 'tsc --noEmit' (step typecheck di verify)
    // verifica la risolvibilita' degli import con l'informazione di tipo completa,
    // cioe' meglio di quanto farebbe questa regola. Una regola che grida al lupo
    // su ogni file viene ignorata, ed e' peggio di una regola assente.
    rules: {
      'import/no-unresolved': 'off',
    },
  },

  // --- Il grafo dei moduli -------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/core/domain/**' },
        { type: 'ports', pattern: 'src/core/ports/**' },
        { type: 'usecases', pattern: 'src/core/usecases/**' },
        { type: 'adapters', pattern: 'src/adapters/**' },
        { type: 'ui', pattern: 'src/ui/**' },
        { type: 'config', pattern: 'src/config/**' },
      ],
    },
    rules: {
      // 'default: disallow' fa si' che un modulo nuovo nasca isolato invece che
      // libero: va dichiarato cosa puo' importare, non cosa non puo'.
      'boundaries/dependencies': [
        2,
        {
          default: 'disallow',
          policies: Object.entries(GRAFO).map(([from, verso]) => ({
            from: { element: { type: from } },
            allow: { to: { element: { types: { anyOf: verso } } } },
          })),
        },
      ],
    },
  },

  // --- core/: isolamento da I/O, rete e orologio ---------------------------
  // Seconda rete sui confini, con le regole del core di eslint. Lavorano sulla
  // stringa di import e non richiedono risoluzione dei moduli: se la
  // configurazione di boundaries avesse un buco, queste reggono lo stesso.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        2,
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message:
                "core/ non conosce Supabase: dipende da core/ports/, mai da un'implementazione.",
            },
          ],
          patterns: [
            { group: ['**/adapters/**', '**/adapters'], message: NO_ADAPTERS_FROM_CORE },
            { group: ['**/ui/**', '**/ui'], message: NO_ADAPTERS_FROM_CORE },
          ],
        },
      ],
      'no-restricted-syntax': [
        2,
        {
          selector: "NewExpression[callee.name='Date']",
          message: NO_CLOCK_IN_CORE,
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='Date'][callee.property.name='now']",
          message: NO_CLOCK_IN_CORE,
        },
      ],
    },
  },

  // --- ui/: non conosce gli adapter ----------------------------------------
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        2,
        {
          patterns: [
            { group: ['**/adapters/**', '**/adapters'], message: NO_ADAPTERS_FROM_UI },
          ],
        },
      ],
    },
  },
];
