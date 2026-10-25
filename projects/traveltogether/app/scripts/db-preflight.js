// Controllo in SOLA LETTURA prima della prima applicazione: staging deve essere vuoto.
//
//   npm run db:preflight
//
// Conta tabelle, tipi enumerati e funzioni negli schemi `public` e `private`, e le righe di
// `supabase_migrations.schema_migrations`. Esce con 0 solo se sono tutti zero: e' la
// condizione in cui `db:push` applica lo schema su un progetto vuoto. La transazione e'
// `read only`, quindi il controllo non puo' modificare niente nemmeno per errore.
//
// La connessione e' cifrata e VERIFICATA contro la CA radice di Supabase (supabase/
// prod-ca-2021.crt, pubblica, nel repo). Mai stampa la stringa di connessione: ogni errore
// passa da oscura.js.

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { loadProjectEnv } = require('@expo/env');
const postgres = require('postgres');
const { oscura } = require('./oscura');

const radice = join(__dirname, '..');
loadProjectEnv(radice, { silent: true });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  process.stderr.write(
    'manca la variabile SUPABASE_DB_URL: va messa in projects/traveltogether/app/.env ' +
      '(Session pooler, porta 5432, progetto di STAGING). Il nome atteso e\' in .env.example.\n'
  );
  process.exit(1);
}

const sql = postgres(url, {
  max: 1,
  // Opzioni esplicite: hanno la precedenza su un eventuale sslmode=... dell'URL.
  ssl: { ca: readFileSync(join(radice, 'supabase', 'prod-ca-2021.crt'), 'utf8'), rejectUnauthorized: true },
  prepare: false,
  connect_timeout: 20,
  onnotice: () => undefined,
});

async function conta(tx, descrizione, interrogazione) {
  const [riga] = await tx.unsafe(interrogazione);
  return [descrizione, Number(riga.n)];
}

async function main() {
  const conteggi = await sql.begin('read only', async (tx) => {
    const risultati = [
      await conta(
        tx,
        'tabelle in public/private',
        `select count(*) as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')`
      ),
      await conta(
        tx,
        'tipi enumerati in public/private',
        `select count(*) as n from pg_type t join pg_namespace n on n.oid = t.typnamespace
         where n.nspname in ('public', 'private') and t.typtype = 'e'`
      ),
      await conta(
        tx,
        'funzioni in public/private',
        `select count(*) as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'private')`
      ),
    ];
    const [{ presente }] = await tx.unsafe(
      "select to_regclass('supabase_migrations.schema_migrations') is not null as presente"
    );
    risultati.push(
      presente
        ? await conta(tx, 'migrazioni registrate', 'select count(*) as n from supabase_migrations.schema_migrations')
        : ['migrazioni registrate (tabella assente)', 0]
    );
    return risultati;
  });

  let vuoto = true;
  for (const [descrizione, n] of conteggi) {
    process.stdout.write(`${descrizione}: ${n}\n`);
    if (n !== 0) vuoto = false;
  }
  process.stdout.write(vuoto ? 'staging vuoto: db:push puo\' partire\n' : 'staging NON vuoto\n');
  return vuoto ? 0 : 1;
}

main()
  .then(async (codice) => {
    await sql.end({ timeout: 5 });
    process.exit(codice);
  })
  .catch(async (errore) => {
    process.stderr.write(`preflight fallito: ${oscura(errore && errore.message ? errore.message : String(errore), url)}\n`);
    await sql.end({ timeout: 5 }).catch(() => undefined);
    process.exit(1);
  });
