// Wrapper della Supabase CLI per le migrazioni: `npm run db:push`, `npm run db:status`.
//
// Cosa fa: legge SUPABASE_DB_URL da .env (con @expo/env, la stessa implementazione di
// jest.setup.int.js: stessa precedenza fra .env e variabili di sistema), la passa alla CLI
// con --db-url, e oscura la credenziale in tutto cio' che la CLI stampa (stdout e stderr)
// prima che arrivi al terminale. Non stampa mai l'URL, nemmeno in caso di errore.
//
//   db:status -> supabase migration list   (sola lettura: locali vs applicate)
//   db:push   -> supabase db push          (MODIFICA staging: lo esegue l'orchestratore,
//                                           dopo la review delle migrazioni)
//
// Qualunque altro argomento dopo il nome passa alla CLI cosi' com'e' (per esempio
// `npm run db:push -- --dry-run`, che elenca cosa si applicherebbe senza applicarlo).
//
// Limite dichiarato: l'URL e' un argomento della riga di comando, quindi un altro
// utente della stessa macchina la vedrebbe nell'elenco dei processi mentre gira. La CLI
// non legge la connessione da una variabile d'ambiente.

const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { loadProjectEnv } = require('@expo/env');
const { oscura } = require('./oscura');

const COMANDI = {
  push: ['db', 'push'],
  status: ['migration', 'list'],
};

function esci(messaggio, codice) {
  process.stderr.write(messaggio + '\n');
  process.exit(codice);
}

const [nome, ...extra] = process.argv.slice(2);
const sottocomando = nome === undefined ? undefined : COMANDI[nome];
if (sottocomando === undefined) {
  esci(`uso: node scripts/supabase-db.js <${Object.keys(COMANDI).join('|')}> [argomenti della CLI]`, 2);
}

const radice = join(__dirname, '..');
loadProjectEnv(radice, { silent: true });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  esci(
    'manca la variabile SUPABASE_DB_URL: va messa in projects/traveltogether/app/.env ' +
      '(stringa di connessione del Session pooler, porta 5432, del progetto di STAGING). ' +
      'Il nome atteso e\' elencato in .env.example.',
    1
  );
}

const esito = spawnSync('supabase', [...sottocomando, ...extra, '--db-url', url], {
  cwd: radice,
  encoding: 'utf8',
  // Niente shell: l'URL contiene caratteri che una shell interpreterebbe.
  shell: false,
});

if (esito.error) {
  esci(`impossibile eseguire la Supabase CLI: ${oscura(esito.error.message, url)}`, 1);
}

process.stdout.write(oscura(esito.stdout ?? '', url));
process.stderr.write(oscura(esito.stderr ?? '', url));
process.exit(esito.status ?? 1);
