// I tipi generati (src/adapters/supabase/database.types.ts) non sono invecchiati: gli enum che
// elencano coincidono con quelli di `pg_enum` su staging, valore per valore e nell'ordine di
// dichiarazione. Se qualcuno cambia uno schema (una migrazione nuova) e non rigenera i tipi
// (`npm run db:types -- --scrivi`), cade questo test.
//
// Il confronto con le union del dominio, invece, lo fa `typecheck`
// (database-enums-conformance.ts). Sola lettura, transazione annullata.

import { Constants } from '../../src/adapters/supabase/database.types';
import { inTransazioneAnnullata } from './support/db';

describe('i tipi generati e lo schema applicato', () => {
  it('ogni enum del file coincide con pg_enum di staging, nell ordine', async () => {
    const righe = await inTransazioneAnnullata((s) =>
      s.esegui(
        `select t.typname::text as nome, e.enumlabel::text as valore
         from pg_type t
         join pg_namespace n on n.oid = t.typnamespace
         join pg_enum e on e.enumtypid = t.oid
         where n.nspname = 'public'
         order by t.typname, e.enumsortorder`
      )
    );
    const delDb: Record<string, string[]> = {};
    for (const riga of righe) {
      const nome = String(riga.nome);
      delDb[nome] = [...(delDb[nome] ?? []), String(riga.valore)];
    }

    // Non vacuo: gli enum ci sono.
    expect(Object.keys(delDb).length).toBeGreaterThan(0);
    expect(delDb).toEqual(Constants.public.Enums);
  });
});
