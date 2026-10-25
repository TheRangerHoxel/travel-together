// L'harness SQL di test:int: parla con il database di STAGING via SQL, non via REST.
//
// Perche' SQL: una transazione si annulla, una chiamata REST no. Ogni test apre una
// transazione, scrive le sue fixture come `postgres`, passa a `authenticated` o `anon`
// impostando l'identita' che legge `auth.uid()`, agisce, asserisce, e fa ROLLBACK. Il DDL
// di Postgres e' transazionale, quindi anche lo schema (applicato dai file del repo,
// non da cio' che c'e' su staging) sparisce con il rollback: staging non cambia.
//
// Due cose NON si fanno mai, e l'harness le impedisce invece di sperare:
//  - chiudere la transazione con un COMMIT: `esegui` rifiuta ogni istruzione di
//    controllo della transazione;
//  - far uscire la stringa di connessione: ogni errore passa da `oscuraErrore`.
//
// TLS: la connessione e' CIFRATA E VERIFICATA contro la CA radice di Supabase
// (supabase/prod-ca-2021.crt), con `ssl: { ca, rejectUnauthorized: true }` e il controllo del
// nome host di default di Node. Con un'altra CA la connessione FALLISCE (lo prova
// connessione.test.ts); l'harness non ha una modalita' che disattivi la verifica.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { oscuraErrore } from '../../../scripts/oscura';
import { controlliDiTransazione } from './istruzioni';

/** Una riga restituita da una query. */
export type Riga = Record<string, unknown>;

/** L'errore di Postgres che un test vuole ispezionare: codice SQLSTATE e vincolo. */
export interface ErroreDb {
  readonly code: string;
  readonly message: string;
  /** Il nome del vincolo violato, se l'errore ne ha uno. */
  readonly constraint: string | undefined;
}

export type Tentativo<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errore: ErroreDb };

/** Dove stanno gli script SQL del repo. */
export const CARTELLA_SUPABASE = join(__dirname, '..', '..', '..', 'supabase');

const MANCA_LA_URL =
  'test:int non puo girare: manca la variabile SUPABASE_DB_URL. Va messa in ' +
  'projects/traveltogether/app/.env (fuori dal repo, vedi .gitignore): e la stringa di ' +
  'connessione del Session pooler (porta 5432) del progetto Supabase di STAGING, mai di ' +
  'prod. Il nome atteso e elencato in .env.example. Questo comando non deve passare in ' +
  'verde senza: fallire qui e il comportamento corretto.';

/** La stringa di connessione. Mai stampata: chi la usa passa da `oscuraErrore`. */
export function urlDelDatabase(): string {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error(MANCA_LA_URL);
  return url;
}

function comeErroreDb(errore: unknown): ErroreDb | null {
  if (errore instanceof postgres.PostgresError) {
    return {
      code: errore.code,
      message: errore.message,
      constraint: errore.constraint_name,
    };
  }
  return null;
}

/** Il certificato radice di Supabase (pubblico), nel repo: vale anche sull'altra macchina. */
export const CERTIFICATO_RADICE = join(CARTELLA_SUPABASE, 'prod-ca-2021.crt');

/** Apre una connessione. `max: 1`: ogni sessione di test e una connessione sola. */
function apri(url: string, ca: string = readFileSync(CERTIFICATO_RADICE, 'utf8')): postgres.Sql {
  return postgres(url, {
    max: 1,
    // Cifrata e VERIFICATA contro la CA di Supabase, che non sta negli store di sistema, e
    // con il nome dell'host controllato (il default di Node: nessun checkServerIdentity
    // personalizzato). Messo qui, e non lasciato all'URL, perche' un `sslmode=require`
    // nella stringa diventerebbe `rejectUnauthorized: false` in postgres.js: le opzioni
    // esplicite hanno la precedenza sull'URL.
    ssl: { ca, rejectUnauthorized: true },
    // Il Session pooler regge le istruzioni preparate, ma qui non servono: ogni query e
    // diversa e una transazione annullata non deve lasciarne in giro.
    prepare: false,
    connect_timeout: 20,
    idle_timeout: 20,
    // I NOTICE (drop ... if exists su oggetti assenti) non sono rumore da stampare.
    onnotice: () => undefined,
  });
}

/**
 * Prova ad aprire una connessione fidandosi SOLO di `ca`. Serve a dimostrare che la
 * verifica del certificato e' attiva: con la CA di Supabase riesce, con un'altra no.
 * Non esegue altro che `select 1`.
 */
export async function provaConnessioneConCa(
  ca: string
): Promise<{ ok: true } | { ok: false; codice: string | undefined }> {
  const url = urlDelDatabase();
  const sql = apri(url, ca);
  try {
    await sql.unsafe('select 1');
    return { ok: true };
  } catch (errore) {
    return { ok: false, codice: oscuraErrore(errore, url).code };
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}

/**
 * Una sessione dentro una transazione aperta. Tutto cio' che si esegue qui sparisce al
 * rollback finale.
 */
export class Sessione {
  constructor(
    private readonly connessione: postgres.ReservedSql,
    private readonly url: string
  ) {}

  /**
   * Esegue SQL. Senza `parametri` e protocollo semplice: ammette piu istruzioni nello
   * stesso testo (i file di migrazione). Rifiuta ogni istruzione che apre o chiude una
   * transazione, compresi i savepoint: li usa solo `tentativo`.
   */
  async esegui(testo: string, parametri: readonly (string | number | boolean | null)[] = []): Promise<Riga[]> {
    const vietate = controlliDiTransazione(testo);
    if (vietate.length > 0) {
      throw new Error(
        `l'harness non ammette istruzioni di controllo della transazione: "${vietate.join('", "')}". ` +
          'La transazione la chiude solo il rollback finale.'
      );
    }
    return this.grezzo(testo, parametri);
  }

  /**
   * Esegue un INSERT/UPDATE/DELETE e ritorna quante righe ha toccato. Sotto RLS una
   * UPDATE o DELETE negata dalla USING non e un errore: tocca zero righe, e il test lo
   * deve vedere.
   */
  async modifica(testo: string, parametri: readonly (string | number | boolean | null)[] = []): Promise<number> {
    const vietate = controlliDiTransazione(testo);
    if (vietate.length > 0) {
      throw new Error(`l'harness non ammette istruzioni di controllo della transazione: "${vietate.join('", "')}".`);
    }
    return (await this.eseguiRisultato(testo, parametri)).count;
  }

  private async grezzo(testo: string, parametri: readonly (string | number | boolean | null)[] = []): Promise<Riga[]> {
    return Array.from(await this.eseguiRisultato(testo, parametri));
  }

  private async eseguiRisultato(
    testo: string,
    parametri: readonly (string | number | boolean | null)[]
  ): Promise<postgres.RowList<postgres.Row[]>> {
    try {
      return await this.connessione.unsafe(testo, [...parametri]);
    } catch (errore) {
      // Un errore di Postgres non contiene la stringa di connessione e il test ne legge
      // il codice: si lascia com'e'. Tutto il resto passa dal filtro.
      if (comeErroreDb(errore) !== null) throw errore;
      throw oscuraErrore(errore, this.url);
    }
  }

  /**
   * Esegue `azione` dentro un savepoint e ne riporta l'esito. Se fallisce, il savepoint
   * viene annullato e la transazione resta utilizzabile (senza, un errore di Postgres la
   * lascerebbe "aborted" e ogni istruzione successiva fallirebbe). Se riesce, gli effetti
   * restano.
   */
  async tentativo<T>(azione: () => Promise<T>): Promise<Tentativo<T>> {
    await this.grezzo('savepoint tentativo');
    try {
      const value = await azione();
      await this.grezzo('release savepoint tentativo');
      return { ok: true, value };
    } catch (errore) {
      const errorePostgres = comeErroreDb(errore);
      if (errorePostgres === null) throw errore;
      await this.grezzo('rollback to savepoint tentativo');
      await this.grezzo('release savepoint tentativo');
      return { ok: false, errore: errorePostgres };
    }
  }

  /** Da qui in poi chi agisce e questo utente: `authenticated`, con `auth.uid()` = id. */
  async comeUtente(id: string): Promise<void> {
    await this.grezzo('set local role authenticated');
    await this.grezzo(
      "select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)",
      [JSON.stringify({ sub: id, role: 'authenticated' }), id]
    );
  }

  /** Da qui in poi chi agisce e `anon`: nessuna identita, `auth.uid()` e null. */
  async comeAnonimo(): Promise<void> {
    await this.grezzo('set local role anon');
    await this.grezzo(
      "select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', '', true)",
      [JSON.stringify({ role: 'anon' })]
    );
  }

  /** Torna al ruolo della connessione (`postgres`), che scavalca le RLS: le fixture, le migrazioni. */
  async comePostgres(): Promise<void> {
    await this.grezzo('reset role');
    await this.grezzo(
      "select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)"
    );
  }

  /** Il ruolo e l'identita visti dal database in questo momento. */
  async chiSono(): Promise<{ ruolo: string; uid: string | null }> {
    const [riga] = await this.grezzo('select current_user::text as ruolo, auth.uid()::text as uid');
    if (!riga) throw new Error('chiSono: nessuna riga');
    return { ruolo: String(riga.ruolo), uid: riga.uid === null ? null : String(riga.uid) };
  }
}

/**
 * Apre una connessione, una transazione, esegue `corpo` e fa ROLLBACK, sempre: anche se
 * il corpo fallisce. Non c'e un modo di confermare.
 */
export async function inTransazioneAnnullata<T>(corpo: (sessione: Sessione) => Promise<T>): Promise<T> {
  const url = urlDelDatabase();
  const sql = apri(url);
  try {
    const riservata = await sql.reserve();
    try {
      await riservata.unsafe('begin');
      const sessione = new Sessione(riservata, url);
      try {
        return await corpo(sessione);
      } finally {
        // Se la connessione e caduta, il rollback fallisce da solo: la transazione e
        // comunque annullata dal server alla chiusura, e l'errore da mostrare e quello
        // del corpo, non questo.
        await riservata.unsafe('rollback').catch(() => undefined);
      }
    } finally {
      riservata.release();
    }
  } catch (errore) {
    if (comeErroreDb(errore) !== null) throw errore;
    throw oscuraErrore(errore, url);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}

/** I file `.sql` di una cartella di `supabase/`, per nome (l'ordine dei timestamp e l'ordine di applicazione). */
export function fileSql(cartella: 'migrations' | 'rollback'): { nome: string; testo: string }[] {
  const percorso = join(CARTELLA_SUPABASE, cartella);
  if (!existsSync(percorso)) return [];
  return readdirSync(percorso)
    .filter((nome) => nome.endsWith('.sql'))
    .sort()
    .map((nome) => ({ nome, testo: readFileSync(join(percorso, nome), 'utf8') }));
}

/**
 * Porta lo schema allo stato dei FILE del repo: prima lo script di revert, poi tutte le
 * migrazioni in ordine. Vale su staging vuoto, con lo schema gia applicato, e a meta: e
 * lo stesso percorso che il test di applicabilita pretende. Dentro la transazione del
 * test, quindi invisibile fuori.
 */
export async function applicaSchema(sessione: Sessione): Promise<void> {
  await eseguiRevert(sessione);
  for (const file of fileSql('migrations')) {
    await eseguiFile(sessione, 'migrations', file);
  }
}

/** Esegue solo lo script di revert (come `postgres`): riporta public e private allo stato vuoto. */
export async function eseguiRevert(sessione: Sessione): Promise<void> {
  await sessione.comePostgres();
  for (const file of fileSql('rollback')) {
    await eseguiFile(sessione, 'rollback', file);
  }
}

async function eseguiFile(
  sessione: Sessione,
  cartella: string,
  file: { nome: string; testo: string }
): Promise<void> {
  try {
    await sessione.esegui(file.testo);
  } catch (errore) {
    // Il numero di riga di Postgres dice dove, ma non quale file: lo dice questo.
    const dettaglio = errore instanceof Error ? errore.message : String(errore);
    throw new Error(`${cartella}/${file.nome}: ${dettaglio}`);
  }
}
