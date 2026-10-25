// Le policy RLS, provate dal punto di vista di chi le subisce: per ogni tabella una lettura
// permessa e una negata, e ogni regola di scrittura col suo caso positivo e il suo negativo.
//
// Si agisce come `authenticated` con `auth.uid()` impostato (comeUtente) o come `anon`. Il
// criterio di prodotto, che qui e verificato sul DB: UNA SCRITTURA NEGATA E UN ERRORE (42501),
// UNA LETTURA NEGATA E UNA RIGA ASSENTE. Fa eccezione, per come funziona Postgres, una UPDATE o
// DELETE che la USING non lascia vedere: tocca zero righe senza errore, e i test rileggono il
// valore invece di aspettarsi un errore.
//
// Ogni test applica lo schema DAI FILE del repo in una transazione annullata.

import { type Sessione, applicaSchema, inTransazioneAnnullata } from './support/db';
import {
  contaRighe,
  creaCandidatura,
  creaProfilo,
  creaTrasferta,
  creaTrasfertaConTratte,
} from './support/fixtures';

const INSUFFICIENT_PRIVILEGE = '42501';

interface Scenario {
  /** Owner dell'offerta. */
  readonly a: string;
  /** Richiedente. */
  readonly r: string;
  /** Estraneo: non c'entra con l'offerta ne con la candidatura. */
  readonly x: string;
  readonly offerta: string;
  readonly tripR: string;
  readonly tripX: string;
  readonly candidatura: string;
}

/** Tre profili, un'offerta con le sue tratte, la candidatura pending di R, e una riga per tabella. */
async function scenario(s: Sessione): Promise<Scenario> {
  await applicaSchema(s);
  const a = await creaProfilo(s, { plantId: 'pomigliano' });
  const r = await creaProfilo(s, { plantId: 'foggia' });
  const x = await creaProfilo(s, { plantId: 'grottaglie' });
  const offerta = await creaTrasfertaConTratte(s, { ownerId: a });
  const tripR = await creaTrasferta(s, { ownerId: r });
  const tripX = await creaTrasferta(s, { ownerId: x });
  const candidatura = await creaCandidatura(s, { tripId: offerta, requesterId: r, requesterTripId: tripR });
  await s.esegui(
    `insert into public.personal_bests (profile_id, shared_trips) values ($1::uuid, 4), ($2::uuid, 7)
     on conflict (profile_id) do nothing`,
    [a, r]
  );
  // Righe delle tabelle dei parametri: se la migrazione di seed e gia applicata ci sono, altrimenti
  // si scrivono; in ogni caso il valore e noto.
  await s.esegui(
    `insert into public.parameters (key, value) values ('match.toleranceMinutes', '45'::jsonb)
     on conflict (key) do update set value = excluded.value`
  );
  await s.esegui(
    `insert into public.plant_distances values ('pomigliano', 'foggia', 165)
     on conflict (from_plant_id, to_plant_id) do update set km = excluded.km`
  );
  await s.esegui(
    `insert into public.badge_parameters values ('primo-viaggio', 1, 'Primo viaggio condiviso')
     on conflict (badge_id) do update set threshold = excluded.threshold, label = excluded.label`
  );
  return { a, r, x, offerta, tripR, tripX, candidatura };
}

/** Quante righe di `tabella` vede chi agisce ora, e quante ne esistono davvero. */
async function conta(s: Sessione, tabella: string): Promise<number> {
  return Number((await s.esegui(`select count(*)::int as n from ${tabella}`))[0]?.n);
}

/** Il codice dell'errore di una scrittura, o `null` se e riuscita. */
async function codice(
  s: Sessione,
  istruzione: string,
  parametri: readonly (string | number | boolean | null)[] = []
): Promise<string | null> {
  const esito = await s.tentativo(() => s.esegui(istruzione, parametri));
  return esito.ok ? null : esito.errore.code;
}

describe('anon: zero righe ovunque, non un errore', () => {
  it.each([
    'public.profiles',
    'public.trips',
    'public.trip_legs',
    'public.match_requests',
    'public.personal_bests',
    'public.parameters',
    'public.plant_distances',
    'public.badge_parameters',
  ])('%s', async (tabella) => {
    const visti = await inTransazioneAnnullata(async (s) => {
      await scenario(s);
      // Non vacuo: la tabella ha righe, e le vede chi scavalca le RLS.
      const esistenti = await contaRighe(s, tabella);
      await s.comeAnonimo();
      return { esistenti, daAnon: await conta(s, tabella) };
    });

    expect(visti.esistenti).toBeGreaterThan(0);
    expect(visti.daAnon).toBe(0);
  });

  it('non puo scrivere: una INSERT e un errore di permessi', async () => {
    const esito = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeAnonimo();
      return codice(
        s,
        `insert into public.trips (owner_id, from_plant_id, to_plant_id, departure_at, has_car, seats_total, seats_available, status)
         values ($1::uuid, 'pomigliano', 'foggia', '2026-11-03T06:30:00.000Z', true, 1, 1, 'published')`,
        [sc.a]
      );
    });

    expect(esito).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

describe('letture degli autenticati', () => {
  it.each([
    'public.profiles',
    'public.trips',
    'public.trip_legs',
    'public.parameters',
    'public.plant_distances',
    'public.badge_parameters',
  ])('%s: ogni autenticato le legge, anche un estraneo', async (tabella) => {
    const visti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      const esistenti = await contaRighe(s, tabella);
      await s.comeUtente(sc.x);
      return { esistenti, daEstraneo: await conta(s, tabella) };
    });

    expect(visti.esistenti).toBeGreaterThan(0);
    expect(visti.daEstraneo).toBe(visti.esistenti);
  });

  it('match_requests: le vedono il richiedente e l owner della trasferta, non un estraneo', async () => {
    const visti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      const esistenti = await contaRighe(s, 'public.match_requests');
      await s.comeUtente(sc.r);
      const richiedente = await conta(s, 'public.match_requests');
      await s.comeUtente(sc.a);
      const owner = await conta(s, 'public.match_requests');
      await s.comeUtente(sc.x);
      const estraneo = await conta(s, 'public.match_requests');
      return { esistenti, richiedente, owner, estraneo };
    });

    expect(visti).toEqual({ esistenti: 1, richiedente: 1, owner: 1, estraneo: 0 });
  });

  it('personal_bests: ciascuno legge solo la propria riga', async () => {
    const visti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      const letture: Record<string, unknown> = { esistenti: await contaRighe(s, 'public.personal_bests') };
      for (const [nome, id] of [['a', sc.a], ['r', sc.r], ['x', sc.x]] as const) {
        await s.comeUtente(id);
        letture[nome] = (await s.esegui('select profile_id::text as p, shared_trips as t from public.personal_bests')).map(
          (riga) => [riga.p === id, riga.t]
        );
      }
      return letture;
    });

    expect(visti).toEqual({ esistenti: 2, a: [[true, 4]], r: [[true, 7]], x: [] });
  });
});

describe('scrittura delle trasferte: solo l owner, upsert compreso', () => {
  const NUOVA = (id: string) => ({
    sql: `insert into public.trips (id, owner_id, from_plant_id, to_plant_id, departure_at, has_car, seats_total, seats_available, status)
          values (gen_random_uuid(), $1::uuid, 'pomigliano', 'foggia', '2026-11-03T06:30:00.000Z', true, 3, 3, 'published')`,
    parametri: [id],
  });

  it('l owner crea una trasferta a proprio nome', async () => {
    const esito = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.a);
      const { sql, parametri } = NUOVA(sc.a);
      return codice(s, sql, parametri);
    });

    expect(esito).toBeNull();
  });

  it('chi crea una trasferta a nome di un altro e rifiutato (42501)', async () => {
    const esito = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.x);
      const { sql, parametri } = NUOVA(sc.a);
      return codice(s, sql, parametri);
    });

    expect(esito).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it('un upsert non e una via per prendersi la trasferta di un altro: errore e riga intatta', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.x);
      // Stesso id dell'offerta di A, owner = X: la WITH CHECK dell'INSERT passa, e a fermarlo
      // deve essere la USING del ramo DO UPDATE.
      const errore = await codice(
        s,
        `insert into public.trips (id, owner_id, from_plant_id, to_plant_id, departure_at, has_car, seats_total, seats_available, status)
         values ($1::uuid, $2::uuid, 'grottaglie', 'foggia', '2026-11-03T06:30:00.000Z', true, 3, 3, 'published')
         on conflict (id) do update set owner_id = excluded.owner_id, from_plant_id = excluded.from_plant_id`,
        [sc.offerta, sc.x]
      );
      await s.comePostgres();
      const [riga] = await s.esegui(
        'select owner_id::text as owner, from_plant_id::text as da from public.trips where id = $1::uuid',
        [sc.offerta]
      );
      return { errore, owner: riga?.owner === sc.a, da: riga?.da };
    });

    expect(esiti).toEqual({ errore: INSUFFICIENT_PRIVILEGE, owner: true, da: 'pomigliano' });
  });

  it('l owner aggiorna la propria trasferta; un altro la tocca zero righe e il valore resta', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.a);
      const propria = await s.modifica("update public.trips set to_plant_id = 'grottaglie' where id = $1::uuid", [sc.offerta]);
      await s.comeUtente(sc.x);
      const altrui = await s.modifica("update public.trips set to_plant_id = 'pomigliano' where id = $1::uuid", [sc.offerta]);
      await s.comePostgres();
      const [riga] = await s.esegui('select to_plant_id::text as a from public.trips where id = $1::uuid', [sc.offerta]);
      return { propria, altrui, valore: riga?.a };
    });

    expect(esiti).toEqual({ propria: 1, altrui: 0, valore: 'grottaglie' });
  });

  it('l owner non puo cedere la trasferta a un altro con una UPDATE (42501)', async () => {
    const esito = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.a);
      return codice(s, 'update public.trips set owner_id = $2::uuid where id = $1::uuid', [sc.offerta, sc.x]);
    });

    expect(esito).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it('nessuno elimina una trasferta dall app: la DELETE tocca zero righe', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.a);
      const toccate = await s.modifica('delete from public.trips where id = $1::uuid', [sc.tripX]);
      const proprie = await s.modifica('delete from public.trips where id = $1::uuid', [sc.offerta]);
      await s.comePostgres();
      return { toccate, proprie, restano: await conta(s, 'public.trips') };
    });

    expect(esiti).toEqual({ toccate: 0, proprie: 0, restano: 3 });
  });
});

describe('scrittura delle candidature: i due attori', () => {
  const INSERISCI = `insert into public.match_requests (trip_id, direction, requester_id, requester_trip_id, status)
                     values ($1::uuid, $2::public.leg_direction, $3::uuid, $4::uuid, $5::public.match_request_status)`;

  /** Uno scenario con un secondo richiedente Y senza candidature, e il suo id. */
  async function conAltroRichiedente(s: Sessione): Promise<{ sc: Scenario; y: string; tripY: string }> {
    const sc = await scenario(s);
    const y = await creaProfilo(s, { plantId: 'foggia' });
    const tripY = await creaTrasferta(s, { ownerId: y });
    return { sc, y, tripY };
  }

  it('il richiedente crea la propria candidatura (pending); un altro la forgia a suo nome e viene rifiutato', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const { sc, y, tripY } = await conAltroRichiedente(s);
      await s.comeUtente(y);
      const propria = await codice(s, INSERISCI, [sc.offerta, 'return', y, tripY, 'pending']);
      await s.comeUtente(sc.a);
      // A (owner) scrive una candidatura a nome di X: la creazione e del richiedente.
      const forgiata = await codice(s, INSERISCI, [sc.offerta, 'return', sc.x, sc.tripX, 'pending']);
      return { propria, forgiata };
    });

    expect(esiti).toEqual({ propria: null, forgiata: INSUFFICIENT_PRIVILEGE });
  });

  it('requester_trip_id deve essere del richiedente: la policy rifiuta con 42501, prima della foreign key', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const { sc, y } = await conAltroRichiedente(s);
      await s.comeUtente(y);
      // La trasferta e vera ma e di A (l'offerta) o di X; oppure non esiste.
      const dellOwner = await codice(s, INSERISCI, [sc.offerta, 'return', y, sc.offerta, 'pending']);
      const dellEstraneo = await codice(s, INSERISCI, [sc.offerta, 'return', y, sc.tripX, 'pending']);
      const inesistente = await codice(s, INSERISCI, [
        sc.offerta,
        'return',
        y,
        '99999999-9999-4999-8999-999999999999',
        'pending',
      ]);
      return { dellOwner, dellEstraneo, inesistente };
    });

    expect(esiti).toEqual({
      dellOwner: INSUFFICIENT_PRIVILEGE,
      dellEstraneo: INSUFFICIENT_PRIVILEGE,
      inesistente: INSUFFICIENT_PRIVILEGE,
    });
  });

  it('il richiedente non crea una candidatura gia accepted', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const { sc, y, tripY } = await conAltroRichiedente(s);
      await s.comeUtente(y);
      const accepted = await codice(s, INSERISCI, [sc.offerta, 'return', y, tripY, 'accepted']);
      return { accepted };
    });

    expect(esiti).toEqual({ accepted: INSUFFICIENT_PRIVILEGE });
  });

  it('l owner accetta la candidatura sulla propria trasferta; il richiedente no (42501)', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      const accetta = "update public.match_requests set status = 'accepted' where id = $1::uuid";
      await s.comeUtente(sc.r);
      const dalRichiedente = await codice(s, accetta, [sc.candidatura]);
      await s.comeUtente(sc.a);
      const dallOwner = await codice(s, accetta, [sc.candidatura]);
      return { dalRichiedente, dallOwner };
    });

    expect(esiti).toEqual({ dalRichiedente: INSUFFICIENT_PRIVILEGE, dallOwner: null });
  });

  it('l owner rifiuta con nota e resolved_by; il richiedente annulla la propria; l owner non puo annullarla (42501)', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const { sc, y, tripY } = await conAltroRichiedente(s);
      const daY = await creaCandidatura(s, { tripId: sc.offerta, direction: 'return', requesterId: y, requesterTripId: tripY });
      await s.comeUtente(sc.a);
      const rifiuta = await codice(
        s,
        "update public.match_requests set status = 'rejected', resolution_note = 'Non ci sono posti', resolved_by = 'owner' where id = $1::uuid",
        [sc.candidatura]
      );
      const annullaDaOwner = await codice(s, "update public.match_requests set status = 'cancelled' where id = $1::uuid", [daY]);
      await s.comeUtente(y);
      const annullaDaRichiedente = await codice(s, "update public.match_requests set status = 'cancelled' where id = $1::uuid", [daY]);
      return { rifiuta, annullaDaOwner, annullaDaRichiedente };
    });

    expect(esiti).toEqual({ rifiuta: null, annullaDaOwner: INSUFFICIENT_PRIVILEGE, annullaDaRichiedente: null });
  });

  it('il richiedente non riassegna la propria candidatura a un altro richiedente (42501)', async () => {
    const esito = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.r);
      return codice(
        s,
        'update public.match_requests set requester_id = $2::uuid, requester_trip_id = $3::uuid where id = $1::uuid',
        [sc.candidatura, sc.x, sc.tripX]
      );
    });

    expect(esito).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it('un estraneo non tocca la candidatura: zero righe, e la riga resta com e', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.x);
      const toccate = await s.modifica("update public.match_requests set status = 'cancelled' where id = $1::uuid", [sc.candidatura]);
      // Nemmeno spostandola su una propria trasferta per accettarla.
      const spostata = await s.modifica(
        "update public.match_requests set trip_id = $2::uuid, status = 'accepted' where id = $1::uuid",
        [sc.candidatura, sc.tripX]
      );
      await s.comePostgres();
      const [riga] = await s.esegui('select status::text as stato, trip_id::text as t from public.match_requests where id = $1::uuid', [sc.candidatura]);
      return { toccate, spostata, stato: riga?.stato, tripOriginale: riga?.t === sc.offerta };
    });

    expect(esiti).toEqual({ toccate: 0, spostata: 0, stato: 'pending', tripOriginale: true });
  });

  it('l owner non riscrive come pending, e a proprio nome, la candidatura di un collega: lo ferma il trigger', async () => {
    // La WITH CHECK vede solo la riga nuova (pending, requester = A, trasferta di A): passa. Senza
    // il trigger sulla riga VECCHIA, A si approprierebbe la candidatura di R.
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.a);
      const errore = await codice(
        s,
        `update public.match_requests set status = 'pending', requester_id = $2::uuid, requester_trip_id = $3::uuid
         where id = $1::uuid`,
        [sc.candidatura, sc.a, sc.offerta]
      );
      await s.comePostgres();
      const [riga] = await s.esegui('select requester_id::text as r from public.match_requests where id = $1::uuid', [sc.candidatura]);
      return { errore, ancoraDiR: riga?.r === sc.r };
    });

    expect(esiti).toEqual({ errore: INSUFFICIENT_PRIVILEGE, ancoraDiR: true });
  });
});

describe('scrittura delle candidature: i casi che toccano una sola delle due reti', () => {
  const riga = async (s: Sessione, id: string) => {
    await s.comePostgres();
    const [r] = await s.esegui(
      'select status::text as stato, trip_id::text as trip, requester_id::text as req, requester_trip_id::text as rtrip from public.match_requests where id = $1::uuid',
      [id]
    );
    return r;
  };

  it('il richiedente non sposta la propria candidatura pending sulla propria trasferta con status accepted: lo ferma il trigger sulla riga vecchia', async () => {
    // La WITH CHECK passa (accepted, e la trasferta NUOVA e di R): a rifiutare e solo il ramo del
    // trigger che guarda l owner della trasferta VECCHIA.
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      const propriaConTratte = await creaTrasfertaConTratte(s, { ownerId: sc.r });
      await s.comeUtente(sc.r);
      const errore = await codice(
        s,
        "update public.match_requests set trip_id = $2::uuid, status = 'accepted' where id = $1::uuid",
        [sc.candidatura, propriaConTratte]
      );
      const dopo = await riga(s, sc.candidatura);
      return { errore, stato: dopo?.stato, tripOriginale: dopo?.trip === sc.offerta };
    });

    expect(esiti).toEqual({ errore: INSUFFICIENT_PRIVILEGE, stato: 'pending', tripOriginale: true });
  });

  it('il richiedente non punta requester_trip_id alla trasferta di un altro: 42501 dalla policy, non 23503 dalla foreign key', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.r);
      const errore = await codice(s, 'update public.match_requests set requester_trip_id = $2::uuid where id = $1::uuid', [
        sc.candidatura,
        sc.tripX,
      ]);
      const dopo = await riga(s, sc.candidatura);
      return { errore, rtripIntatta: dopo?.rtrip === sc.tripR };
    });

    expect(esiti).toEqual({ errore: INSUFFICIENT_PRIVILEGE, rtripIntatta: true });
  });

  it('un upsert di un estraneo sull id della candidatura di R e rifiutato (42501) e la riga resta intatta', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.x);
      // La INSERT proposta e di X e passa la sua WITH CHECK; a fermare il ramo DO UPDATE e la USING.
      const errore = await codice(
        s,
        `insert into public.match_requests (id, trip_id, direction, requester_id, requester_trip_id, status)
         values ($1::uuid, $2::uuid, 'outbound', $3::uuid, $4::uuid, 'pending')
         on conflict (id) do update set status = 'cancelled', requester_id = excluded.requester_id`,
        [sc.candidatura, sc.offerta, sc.x, sc.tripX]
      );
      const dopo = await riga(s, sc.candidatura);
      return { errore, stato: dopo?.stato, ancoraDiR: dopo?.req === sc.r };
    });

    expect(esiti).toEqual({ errore: INSUFFICIENT_PRIVILEGE, stato: 'pending', ancoraDiR: true });
  });
});

describe('scrittura dei massimi: solo i propri', () => {
  it('ciascuno crea e aggiorna la propria riga', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.x);
      const crea = await codice(s, 'insert into public.personal_bests (profile_id, shared_trips) values ($1::uuid, 2)', [sc.x]);
      const aggiorna = await s.modifica('update public.personal_bests set shared_trips = 9 where profile_id = $1::uuid', [sc.x]);
      return { crea, aggiorna };
    });

    expect(esiti).toEqual({ crea: null, aggiorna: 1 });
  });

  it('la riga di un altro non si crea (42501) ne si aggiorna (zero righe, valore intatto)', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.x);
      const crea = await codice(s, 'insert into public.personal_bests (profile_id, shared_trips) values ($1::uuid, 99)', [sc.a]);
      const aggiorna = await s.modifica('update public.personal_bests set shared_trips = 99 where profile_id = $1::uuid', [sc.a]);
      await s.comePostgres();
      const [riga] = await s.esegui('select shared_trips as t from public.personal_bests where profile_id = $1::uuid', [sc.a]);
      return { crea, aggiorna, valore: riga?.t };
    });

    expect(esiti).toEqual({ crea: INSUFFICIENT_PRIVILEGE, aggiorna: 0, valore: 4 });
  });
});

describe('tabelle senza scrittura dall app', () => {
  it('profiles, trip_legs e le tre tabelle dei parametri: INSERT rifiutata, UPDATE e DELETE a zero righe, valori intatti', async () => {
    const esiti = await inTransazioneAnnullata(async (s) => {
      const sc = await scenario(s);
      await s.comeUtente(sc.a);
      const inserimenti = {
        profiles: await codice(s, "insert into public.profiles (id, display_name, plant_id) values (gen_random_uuid(), 'Finto', 'foggia')"),
        tratte: await codice(
          s,
          "insert into public.trip_legs (trip_id, direction, seats_total, seats_available) values ($1::uuid, 'outbound', 3, 3)",
          [sc.tripX]
        ),
        parametri: await codice(s, "insert into public.parameters (key, value) values ('kpi.gramsCo2PerKm', '1'::jsonb)"),
        distanze: await codice(s, "insert into public.plant_distances values ('foggia', 'grottaglie', 1)"),
        badge: await codice(s, "insert into public.badge_parameters values ('mille-km', 1, 'Etichetta')"),
      };
      const aggiornamenti = [
        await s.modifica("update public.profiles set display_name = 'Cambiato'"),
        await s.modifica('update public.trip_legs set seats_available = 0'),
        await s.modifica("update public.parameters set value = '99'::jsonb"),
        await s.modifica('update public.plant_distances set km = 1'),
        await s.modifica("update public.badge_parameters set label = 'Cambiata'"),
      ];
      const eliminazioni = [
        await s.modifica('delete from public.profiles'),
        await s.modifica('delete from public.trip_legs'),
        await s.modifica('delete from public.parameters'),
        await s.modifica('delete from public.plant_distances'),
        await s.modifica('delete from public.badge_parameters'),
      ];
      // Si rilegge il valore, non ci si fida del conteggio: il parametro scritto dal fixture e 45.
      const [parametro] = await s.esegui("select value::text as v from public.parameters where key = 'match.toleranceMinutes'");
      const [etichetta] = await s.esegui("select label from public.badge_parameters where badge_id = 'primo-viaggio'");
      return { inserimenti, aggiornamenti, eliminazioni, parametro: parametro?.v, etichetta: etichetta?.label };
    });

    for (const codiceErrore of Object.values(esiti.inserimenti)) {
      expect(codiceErrore).toBe(INSUFFICIENT_PRIVILEGE);
    }
    expect(esiti.aggiornamenti).toEqual([0, 0, 0, 0, 0]);
    expect(esiti.eliminazioni).toEqual([0, 0, 0, 0, 0]);
    expect(esiti.parametro).toBe('45');
    expect(esiti.etichetta).toBe('Primo viaggio condiviso');
  });
});
