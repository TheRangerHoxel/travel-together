// Le fixture dei test di integrazione. Di norma dentro la transazione annullata del test:
// spariscono col ROLLBACK, quindi non c'e pulizia da fare e nessun dato resta su staging.
// L'unica eccezione sono i test di concorrenza (vedi sotto), che le confermano e le ripuliscono.
//
// Ogni funzione scrive COME `postgres` (e ci torna da sola): le fixture sono amministrazione,
// non operazioni dell app, e devono riuscire anche dove le RLS le vieterebbero. Il test passa
// poi a `comeUtente` per agire.
//
// Le fixture CONFERMATE (per i test di concorrenza, dove una seconda connessione non vede una
// transazione aperta) usano le stesse funzioni dentro `inTransazioneConfermata`, e si ripuliscono
// con `pulisciFixtureConfermate` (in fondo a questo file): solo gli utenti `@t08.test.invalid`
// e cio che dipende da loro.

import type { Sessione } from './db';

/** Il dominio degli indirizzi di test: riservato (RFC 2606), non risolve e non e di nessuno. */
export const DOMINIO_DI_TEST = 't08.test.invalid';

let contatore = 0;

function testo(valore: unknown, nome: string): string {
  if (typeof valore !== 'string') throw new Error(`fixture: ${nome} non restituito`);
  return valore;
}

/**
 * Crea un utente in `auth.users` e ne ritorna l'id. L'indirizzo e fittizio e sul dominio
 * riservato.
 */
export async function creaUtente(sessione: Sessione): Promise<string> {
  await sessione.comePostgres();
  contatore += 1;
  const email = `utente-${String(contatore)}@${DOMINIO_DI_TEST}`;
  const righe = await sessione.esegui(
    `insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             $1, '{}'::jsonb, '{}'::jsonb, now(), now())
     returning id::text as id`,
    [email]
  );
  return testo(righe[0]?.id, 'auth.users.id');
}

/** Un utente e il suo profilo (nome dichiaratamente fittizio). Ritorna l'id, che e anche `auth.uid()`. */
export async function creaProfilo(
  sessione: Sessione,
  dati: { plantId?: string; displayName?: string } = {}
): Promise<string> {
  const id = await creaUtente(sessione);
  await sessione.esegui(
    'insert into public.profiles (id, display_name, plant_id) values ($1::uuid, $2, $3::public.plant_id)',
    [id, dati.displayName ?? 'Collega Fittizio', dati.plantId ?? 'pomigliano']
  );
  return id;
}

export interface DatiTrasferta {
  readonly ownerId: string;
  readonly fromPlantId?: string;
  readonly toPlantId?: string;
  readonly departureAt?: string;
  readonly returnAt?: string | null;
  readonly hasCar?: boolean;
  readonly seatsTotal?: number;
  readonly seatsAvailable?: number;
  readonly status?: string;
}

/**
 * ATTENZIONE ai parametri tipizzati: con un cast diretto (`$1::timestamptz`, `$1::jsonb`)
 * postgres.js serializza il valore col serializzatore del tipo, e quello dei timestamp passa
 * da un Date JavaScript (tronca al millisecondo) e quello jsonb da JSON.stringify (una stringa
 * "true" diventa il testo "\"true\""). Gli istanti e i json grezzi si passano come `$n::text`
 * e si convertono in SQL: `$n::text::timestamptz`.
 *
 * Una trasferta, valida di default (con auto, 3 posti, rientro). NON crea le tratte: le
 * materializza il trigger della migrazione 2 oppure `creaTratta`.
 */
export async function creaTrasferta(sessione: Sessione, dati: DatiTrasferta): Promise<string> {
  await sessione.comePostgres();
  const seatsTotal = dati.seatsTotal ?? 3;
  const righe = await sessione.esegui(
    `insert into public.trips
       (owner_id, from_plant_id, to_plant_id, departure_at, return_at, has_car, seats_total, seats_available, status)
     values ($1::uuid, $2::public.plant_id, $3::public.plant_id, $4::text::timestamptz, $5::text::timestamptz,
             $6::boolean, $7::integer, $8::integer, $9::public.trip_status)
     returning id::text as id`,
    [
      dati.ownerId,
      dati.fromPlantId ?? 'pomigliano',
      dati.toPlantId ?? 'foggia',
      dati.departureAt ?? '2026-11-03T06:30:00.000Z',
      dati.returnAt === undefined ? '2026-11-05T16:00:00.000Z' : dati.returnAt,
      dati.hasCar ?? true,
      seatsTotal,
      dati.seatsAvailable ?? seatsTotal,
      dati.status ?? 'published',
    ]
  );
  return testo(righe[0]?.id, 'trips.id');
}

/**
 * Scrive una tratta a mano. Con il trigger della migrazione 2 la tratta esiste gia: la riga
 * identica non cambia niente (`do nothing`), e un valore diverso va scritto con una UPDATE.
 */
export async function creaTratta(
  sessione: Sessione,
  tripId: string,
  direction: 'outbound' | 'return',
  posti: { total: number; available: number }
): Promise<void> {
  await sessione.comePostgres();
  await sessione.esegui(
    `insert into public.trip_legs (trip_id, direction, seats_total, seats_available)
     values ($1::uuid, $2::public.leg_direction, $3::integer, $4::integer)
     on conflict (trip_id, direction) do nothing`,
    [tripId, direction, posti.total, posti.available]
  );
}

/** Una trasferta con le sue tratte (andata, e ritorno se ha il rientro), a posti pieni. */
export async function creaTrasfertaConTratte(sessione: Sessione, dati: DatiTrasferta): Promise<string> {
  const id = await creaTrasferta(sessione, dati);
  const total = dati.seatsTotal ?? 3;
  const available = dati.seatsAvailable ?? total;
  if (dati.hasCar === false) return id;
  await creaTratta(sessione, id, 'outbound', { total, available });
  if (dati.returnAt !== null) await creaTratta(sessione, id, 'return', { total, available });
  return id;
}

export interface DatiCandidatura {
  readonly tripId: string;
  readonly direction?: 'outbound' | 'return';
  readonly requesterId: string;
  readonly requesterTripId: string;
  readonly status?: string;
  readonly requestNote?: string | null;
  readonly resolutionNote?: string | null;
  readonly resolvedBy?: string | null;
}

/** Una candidatura (di default `pending` sull'andata). Ritorna il suo id. */
export async function creaCandidatura(sessione: Sessione, dati: DatiCandidatura): Promise<string> {
  await sessione.comePostgres();
  const righe = await sessione.esegui(
    `insert into public.match_requests
       (trip_id, direction, requester_id, requester_trip_id, status, request_note, resolution_note, resolved_by)
     values ($1::uuid, $2::public.leg_direction, $3::uuid, $4::uuid, $5::public.match_request_status,
             $6, $7, $8::public.resolved_by)
     returning id::text as id`,
    [
      dati.tripId,
      dati.direction ?? 'outbound',
      dati.requesterId,
      dati.requesterTripId,
      dati.status ?? 'pending',
      dati.requestNote ?? null,
      dati.resolutionNote ?? null,
      dati.resolvedBy ?? null,
    ]
  );
  return testo(righe[0]?.id, 'match_requests.id');
}

const UTENTI_DI_TEST = `select id from auth.users where email like '%@${DOMINIO_DI_TEST}'`;

/**
 * Cancella le fixture CONFERMATE dei test di concorrenza, e SOLO quelle: tutto cio che e legato
 * a un utente con indirizzo `@t08.test.invalid`, nell'ordine delle foreign key (candidature,
 * trasferte -- le tratte vanno in cascata --, massimi, profili, utenti). Non tocca nessun'altra
 * riga, nemmeno delle stesse tabelle. Va chiamata dentro `inTransazioneConfermata`, e all'avvio
 * oltre che alla fine: un'esecuzione interrotta lascia i residui.
 *
 * Limite dichiarato: la cancellazione cerca le candidature legate a utenti di test, e le
 * trasferte di test con tutte le candidature sopra. L'unica riga NON di test che puo sparire e
 * la candidatura di un utente vero su una trasferta di test (la foreign key la renderebbe
 * orfana): esiste solo nei pochi secondi in cui una trasferta di test esiste su staging.
 */
export async function pulisciFixtureConfermate(sessione: Sessione): Promise<void> {
  await sessione.comePostgres();
  await sessione.modifica(
    `delete from public.match_requests
     where requester_id in (${UTENTI_DI_TEST})
        or trip_id in (select id from public.trips where owner_id in (${UTENTI_DI_TEST}))`
  );
  await sessione.modifica(`delete from public.trips where owner_id in (${UTENTI_DI_TEST})`);
  await sessione.modifica(`delete from public.personal_bests where profile_id in (${UTENTI_DI_TEST})`);
  await sessione.modifica(`delete from public.profiles where id in (${UTENTI_DI_TEST})`);
  await sessione.modifica(`delete from auth.users where email like '%@${DOMINIO_DI_TEST}'`);
}

/** Quante righe di test restano, per tabella: tutte devono essere zero a fine esecuzione. */
export async function contaResiduiDiTest(sessione: Sessione): Promise<Record<string, number>> {
  await sessione.comePostgres();
  const conta = async (interrogazione: string): Promise<number> =>
    Number((await sessione.esegui(interrogazione))[0]?.n);
  return {
    utenti: await conta(`select count(*)::int as n from auth.users where email like '%@${DOMINIO_DI_TEST}'`),
    profili: await conta(`select count(*)::int as n from public.profiles where id in (${UTENTI_DI_TEST})`),
    trasferte: await conta(`select count(*)::int as n from public.trips where owner_id in (${UTENTI_DI_TEST})`),
    candidature: await conta(
      `select count(*)::int as n from public.match_requests
       where requester_id in (${UTENTI_DI_TEST})
          or trip_id in (select id from public.trips where owner_id in (${UTENTI_DI_TEST}))`
    ),
    massimi: await conta(`select count(*)::int as n from public.personal_bests where profile_id in (${UTENTI_DI_TEST})`),
  };
}

/** Quante righe ha una tabella, contate come `postgres` (le RLS non c'entrano). */
export async function contaRighe(sessione: Sessione, tabella: string): Promise<number> {
  await sessione.comePostgres();
  const righe = await sessione.esegui(`select count(*)::int as n from ${tabella}`);
  return Number(righe[0]?.n);
}
