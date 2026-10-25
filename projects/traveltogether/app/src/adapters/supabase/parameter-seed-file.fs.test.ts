// La migrazione di seed committata e DERIVATA da SEED_PARAMETERS: questo test la confronta con
// l'output del generatore, senza rete. Se qualcuno ritocca un valore in `config/parameters.ts` o
// modifica a mano il file SQL, cade.
//
// Dopo la prima applicazione su staging il file e CONGELATO (una migrazione applicata non si
// riscrive): una modifica di SEED_PARAMETERS fa cadere questo test APPOSTA, e cosa farne (una
// migrazione nuova che ritara le righe?) e una decisione, non un fix.
//
// Sta in un file `.fs.test.ts` perche legge il filesystem: tsc lo controlla con i tipi di Node
// (tsconfig.int.json), il resto di src/ no.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEED_PARAMETERS } from '../../config';
import { renderParameterSeedSql } from './parameter-seed-sql';

const FILE_DI_SEED = join(
  __dirname,
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20261025120200_parameter_seed.sql'
);

describe('la migrazione di seed dei parametri', () => {
  it('e uguale all output del generatore applicato a SEED_PARAMETERS', () => {
    const generato = renderParameterSeedSql(SEED_PARAMETERS);

    expect(generato.ok).toBe(true);
    if (generato.ok) {
      expect(readFileSync(FILE_DI_SEED, 'utf8')).toBe(generato.value);
    }
  });

  it('contiene tutte le righe del seed: una per parametro, per coppia di plant e per badge', () => {
    const file = readFileSync(FILE_DI_SEED, 'utf8');
    const righe = file.split('\n').filter((linea) => linea.startsWith('  ('));

    // Non vacuo: il confronto sopra passerebbe anche con due file vuoti.
    expect(righe).toHaveLength(
      Object.keys(SEED_PARAMETERS.values).length +
        SEED_PARAMETERS.plantDistances.length +
        SEED_PARAMETERS.badges.length
    );
  });
});
