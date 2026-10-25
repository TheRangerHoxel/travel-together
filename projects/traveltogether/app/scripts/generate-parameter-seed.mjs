// Genera la migrazione di seed dei parametri da SEED_PARAMETERS.
//
//   node scripts/generate-parameter-seed.mjs            stampa l'SQL su stdout
//   node scripts/generate-parameter-seed.mjs --scrivi   lo scrive in supabase/migrations/
//
// Senza dipendenze nuove: Node 24 esegue TypeScript togliendo i tipi, quindi importa
// direttamente i due moduli .ts (per questo gli import hanno l'estensione, e
// parameter-seed-sql.ts non ha import a runtime).
//
// Il file generato e committato e un test unitario lo confronta con questo output. Dopo la
// prima applicazione su staging e CONGELATO: una migrazione applicata non si riscrive.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderParameterSeedSql } from '../src/adapters/supabase/parameter-seed-sql.ts';
import { SEED_PARAMETERS } from '../src/config/parameters.ts';

const NOME_FILE = '20261025120200_parameter_seed.sql';

const esito = renderParameterSeedSql(SEED_PARAMETERS);
if (!esito.ok) {
  process.stderr.write(`seed non serializzabile: ${esito.error.where}: ${esito.error.detail}\n`);
  process.exit(1);
}

if (process.argv.includes('--scrivi')) {
  const destinazione = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations', NOME_FILE);
  writeFileSync(destinazione, esito.value, 'utf8');
  process.stdout.write(`scritto ${destinazione}\n`);
} else {
  process.stdout.write(esito.value);
}
