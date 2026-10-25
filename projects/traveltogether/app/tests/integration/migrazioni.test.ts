// Le migrazioni sono file SQL del repo, applicabili su un progetto vuoto. Non c'e un secondo
// progetto su cui provarlo (il piano gratuito ne ha due e l'altro e la demo), quindi la prova
// e questa: in una transazione su staging si esegue il revert e poi TUTTE le migrazioni in
// ordine, si asserisce cosa esiste, e si fa ROLLBACK. Il DDL di Postgres e transazionale:
// staging non cambia, e la prova vale prima e dopo la prima applicazione, perche il revert
// svuota qualunque stato di partenza.

import {
  type Sessione,
  applicaSchema,
  eseguiRevert,
  fileSql,
  inTransazioneAnnullata,
} from './support/db';
import { controlliDiTransazione } from './support/istruzioni';

/** I nomi (ordinati) di cio che esiste in public e private, per tipo di oggetto. */
async function oggettiPresenti(
  sessione: Sessione
): Promise<{ tabelle: string[]; enumerati: string[]; funzioni: string[] }> {
  const nomi = async (interrogazione: string): Promise<string[]> =>
    (await sessione.esegui(interrogazione)).map((riga) => String(riga.nome)).sort();
  return {
    tabelle: await nomi(
      `select n.nspname || '.' || c.relname as nome from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')`
    ),
    enumerati: await nomi(
      `select n.nspname || '.' || t.typname as nome from pg_type t join pg_namespace n on n.oid = t.typnamespace
       where n.nspname in ('public', 'private') and t.typtype = 'e'`
    ),
    funzioni: await nomi(
      `select n.nspname || '.' || p.proname as nome from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private')`
    ),
  };
}

const TABELLE_ATTESE = [
  'public.badge_parameters',
  'public.match_requests',
  'public.parameters',
  'public.personal_bests',
  'public.plant_distances',
  'public.profiles',
  'public.trip_legs',
  'public.trips',
];

const ENUMERATI_ATTESI = [
  'public.badge_id',
  'public.leg_direction',
  'public.match_request_status',
  'public.parameter_key',
  'public.plant_id',
  'public.resolved_by',
  'public.trip_status',
];

const FUNZIONI_ATTESE = [
  'private.lower_note_max_length',
  'private.match_requests_guard',
  'private.parameters_note_max_length',
  'private.personal_bests_monotonic',
  'private.sync_trip_legs',
  'public.adjust_leg_seats',
  'public.raise_personal_bests',
  'public.restore_system_rejected',
];

describe('i file', () => {
  it('ci sono migrazioni e uno script di revert, in ordine di timestamp', () => {
    const migrazioni = fileSql('migrations').map((f) => f.nome);
    expect(migrazioni.length).toBeGreaterThan(0);
    expect(fileSql('rollback').length).toBeGreaterThan(0);
    for (const nome of migrazioni) {
      expect(nome).toMatch(/^\d{14}_[a-z_]+\.sql$/);
    }
    expect([...migrazioni].sort()).toEqual(migrazioni);
  });

  it('nessuno contiene begin, commit o rollback come istruzione', () => {
    // Renderebbero distruttiva la prima prova: un COMMIT dentro la transazione di test
    // lascerebbe lo schema su staging. begin/end dentro il corpo di una funzione non contano.
    const tutti = [...fileSql('migrations'), ...fileSql('rollback')];
    expect(tutti.length).toBeGreaterThan(0);
    for (const file of tutti) {
      expect({ file: file.nome, controlli: controlliDiTransazione(file.testo) }).toEqual({
        file: file.nome,
        controlli: [],
      });
    }
  });
});

describe('applicazione su un progetto vuoto', () => {
  it('revert e migrazioni, in ordine, creano gli oggetti attesi', async () => {
    const presenti = await inTransazioneAnnullata(async (s) => {
      await applicaSchema(s);
      return oggettiPresenti(s);
    });

    expect(presenti.tabelle).toEqual(TABELLE_ATTESE);
    expect(presenti.enumerati).toEqual(ENUMERATI_ATTESI);
    expect(presenti.funzioni).toEqual(FUNZIONI_ATTESE);
  });

  it('si puo applicare due volte di seguito: il revert fra le due riporta al vuoto', async () => {
    const presenti = await inTransazioneAnnullata(async (s) => {
      await applicaSchema(s);
      await applicaSchema(s);
      return oggettiPresenti(s);
    });

    expect(presenti.tabelle).toEqual(TABELLE_ATTESE);
    expect(presenti.enumerati).toEqual(ENUMERATI_ATTESI);
    expect(presenti.funzioni).toEqual(FUNZIONI_ATTESE);
  });

  it('il revert da solo lascia public e private senza tabelle, tipi e funzioni', async () => {
    const presenti = await inTransazioneAnnullata(async (s) => {
      await applicaSchema(s);
      await eseguiRevert(s);
      return oggettiPresenti(s);
    });

    expect(presenti).toEqual({ tabelle: [], enumerati: [], funzioni: [] });
  });

  it('lo schema private esiste dopo le migrazioni e non dopo il revert', async () => {
    const esito = await inTransazioneAnnullata(async (s) => {
      const conta = async (): Promise<number> =>
        Number((await s.esegui("select count(*)::int as n from pg_namespace where nspname = 'private'"))[0]?.n);
      await applicaSchema(s);
      const dopo = await conta();
      await eseguiRevert(s);
      return { dopo, dopoRevert: await conta() };
    });

    expect(esito).toEqual({ dopo: 1, dopoRevert: 0 });
  });
});
