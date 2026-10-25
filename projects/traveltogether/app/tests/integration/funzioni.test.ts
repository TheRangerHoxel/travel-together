// Le funzioni e i trigger della migrazione 2, provati dal punto di vista di chi li chiama:
// adjust_leg_seats, restore_system_rejected, raise_personal_bests, il trigger che materializza le
// tratte, la monotonia dei massimi, il limite delle note, la procedura che accorcia le note, e i
// permessi di esecuzione.
//
// Ogni test applica lo schema DAI FILE del repo in una transazione annullata.

import { type Sessione, applicaSchema, inTransazioneAnnullata } from './support/db';
import {
  creaCandidatura,
  creaProfilo,
  creaTrasferta,
  creaTrasfertaConTratte,
} from './support/fixtures';

const INSUFFICIENT_PRIVILEGE = '42501';
const NO_DATA_FOUND = 'P0002';
const CHECK_VIOLATION = '23514';
const FOREIGN_KEY_VIOLATION = '23503';

type Parametri = readonly (string | number | boolean | null)[];

/** Esegue `corpo` su uno schema appena applicato dai file. */
function inSchema<T>(corpo: (s: Sessione) => Promise<T>): Promise<T> {
  return inTransazioneAnnullata(async (s) => {
    await applicaSchema(s);
    return corpo(s);
  });
}

/** Il codice dell'errore di un'istruzione, o `null` se e riuscita. */
async function codice(s: Sessione, istruzione: string, parametri: Parametri = []): Promise<string | null> {
  const esito = await s.tentativo(() => s.esegui(istruzione, parametri));
  return esito.ok ? null : esito.errore.code;
}

type Direzione = 'outbound' | 'return';

/** adjust_leg_seats: i posti liberi della tratta aggiornata, o `null` se zero righe. */
async function regola(s: Sessione, trip: string, direzione: Direzione, delta: number): Promise<number | null> {
  const righe = await s.esegui(
    'select seats_available from public.adjust_leg_seats($1::uuid, $2::public.leg_direction, $3::integer)',
    [trip, direzione, delta]
  );
  return righe.length === 0 ? null : Number(righe[0]?.seats_available);
}

/** I posti liberi di una tratta, letti come `postgres`. */
async function posti(s: Sessione, trip: string, direzione: Direzione): Promise<number | null> {
  await s.comePostgres();
  const righe = await s.esegui(
    'select seats_available from public.trip_legs where trip_id = $1::uuid and direction = $2::public.leg_direction',
    [trip, direzione]
  );
  return righe.length === 0 ? null : Number(righe[0]?.seats_available);
}

describe('adjust_leg_seats', () => {
  async function scenario(s: Sessione) {
    const owner = await creaProfilo(s, { plantId: 'pomigliano' });
    const richiedente = await creaProfilo(s, { plantId: 'foggia' });
    const estraneo = await creaProfilo(s, { plantId: 'grottaglie' });
    const offerta = await creaTrasfertaConTratte(s, { ownerId: owner });
    const suaTrasferta = await creaTrasferta(s, { ownerId: richiedente });
    return { owner, richiedente, estraneo, offerta, suaTrasferta };
  }

  it('l owner toglie e restituisce posti: ritorna la tratta aggiornata', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      await s.comeUtente(c.owner);
      return {
        meno: await regola(s, c.offerta, 'outbound', -1),
        piu: await regola(s, c.offerta, 'outbound', 1),
        zero: await regola(s, c.offerta, 'outbound', 0),
        ritorno: await posti(s, c.offerta, 'return'),
      };
    });

    expect(esiti).toEqual({ meno: 2, piu: 3, zero: 3, ritorno: 3 });
  });

  it('i limiti: zero e il confine valido, uno sotto e ZERO RIGHE (non un errore); stesso al tetto', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      await s.comeUtente(c.owner);
      return {
        sopraIlTetto: await regola(s, c.offerta, 'outbound', 1),
        inUnColpo: await regola(s, c.offerta, 'outbound', -4),
        finoAZero: await regola(s, c.offerta, 'outbound', -3),
        sottoZero: await regola(s, c.offerta, 'outbound', -1),
        rimasti: await regola(s, c.offerta, 'outbound', 0),
        alTetto: await regola(s, c.offerta, 'outbound', 3),
        oltreIlTetto: await regola(s, c.offerta, 'outbound', 1),
      };
    });

    expect(esiti).toEqual({
      sopraIlTetto: null,
      inUnColpo: null,
      finoAZero: 0,
      sottoZero: null,
      rimasti: 0,
      alTetto: 3,
      oltreIlTetto: null,
    });
  });

  it('il richiedente di una candidatura accepted su quella tratta restituisce il posto', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      await creaCandidatura(s, {
        tripId: c.offerta,
        requesterId: c.richiedente,
        requesterTripId: c.suaTrasferta,
        status: 'accepted',
      });
      await s.comeUtente(c.owner);
      const scalato = await regola(s, c.offerta, 'outbound', -1);
      await s.comeUtente(c.richiedente);
      return { scalato, restituito: await regola(s, c.offerta, 'outbound', 1) };
    });

    expect(esiti).toEqual({ scalato: 2, restituito: 3 });
  });

  it('il richiedente accepted puo solo +1 o -1: un altro delta e 42501 e i posti restano; l owner e libero entro i limiti', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      await creaCandidatura(s, {
        tripId: c.offerta,
        requesterId: c.richiedente,
        requesterTripId: c.suaTrasferta,
        status: 'accepted',
      });
      await s.comeUtente(c.owner);
      const scalato = await regola(s, c.offerta, 'outbound', -1);
      await s.comeUtente(c.richiedente);
      const chiamaConDelta = (delta: number) =>
        codice(s, 'select * from public.adjust_leg_seats($1::uuid, $2::public.leg_direction, $3::integer)', [c.offerta, 'outbound', delta]);
      const azzera = await chiamaConDelta(-2);
      const aggiunge = await chiamaConDelta(2);
      const zero = await chiamaConDelta(0);
      const rimasti = await posti(s, c.offerta, 'outbound');
      await s.comeUtente(c.richiedente);
      const compensa = await regola(s, c.offerta, 'outbound', -1);
      await s.comeUtente(c.owner);
      const ownerLibero = await regola(s, c.offerta, 'outbound', -1);
      return { scalato, azzera, aggiunge, zero, rimasti, compensa, ownerLibero };
    });

    expect(esiti).toEqual({
      scalato: 2,
      azzera: INSUFFICIENT_PRIVILEGE,
      aggiunge: INSUFFICIENT_PRIVILEGE,
      zero: INSUFFICIENT_PRIVILEGE,
      rimasti: 2,
      compensa: 1,
      ownerLibero: 0,
    });
  });

  it('un richiedente pending, o accepted su un altra tratta, e rifiutato (42501) e i posti non cambiano', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      await creaCandidatura(s, {
        tripId: c.offerta,
        requesterId: c.richiedente,
        requesterTripId: c.suaTrasferta,
        status: 'pending',
      });
      await s.comeUtente(c.richiedente);
      const pending = await codice(s, 'select * from public.adjust_leg_seats($1::uuid, $2::public.leg_direction, -1)', [c.offerta, 'outbound']);
      await s.comePostgres();
      await s.modifica("update public.match_requests set status = 'accepted' where trip_id = $1::uuid", [c.offerta]);
      await s.comeUtente(c.richiedente);
      const altraTratta = await codice(s, 'select * from public.adjust_leg_seats($1::uuid, $2::public.leg_direction, -1)', [c.offerta, 'return']);
      return { pending, altraTratta, andata: await posti(s, c.offerta, 'outbound'), ritorno: await posti(s, c.offerta, 'return') };
    });

    expect(esiti).toEqual({
      pending: INSUFFICIENT_PRIVILEGE,
      altraTratta: INSUFFICIENT_PRIVILEGE,
      andata: 3,
      ritorno: 3,
    });
  });

  it('un estraneo e rifiutato (42501) e i posti non cambiano', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      await s.comeUtente(c.estraneo);
      const errore = await codice(s, 'select * from public.adjust_leg_seats($1::uuid, $2::public.leg_direction, -1)', [c.offerta, 'outbound']);
      return { errore, andata: await posti(s, c.offerta, 'outbound') };
    });

    expect(esiti).toEqual({ errore: INSUFFICIENT_PRIVILEGE, andata: 3 });
  });

  it('una tratta inesistente e P0002, anche per un estraneo: l esistenza viene prima dell identita', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      const senzaRientro = await creaTrasfertaConTratte(s, { ownerId: c.owner, returnAt: null });
      await s.comeUtente(c.estraneo);
      return {
        ritornoMancante: await codice(s, 'select * from public.adjust_leg_seats($1::uuid, $2::public.leg_direction, -1)', [senzaRientro, 'return']),
        tripMancante: await codice(s, 'select * from public.adjust_leg_seats($1::uuid, $2::public.leg_direction, -1)', ['99999999-9999-4999-8999-999999999999', 'outbound']),
      };
    });

    expect(esiti).toEqual({ ritornoMancante: NO_DATA_FOUND, tripMancante: NO_DATA_FOUND });
  });

  it('un estraneo con un delta fuori limite e 42501: l identita viene prima dei limiti', async () => {
    const errore = await inSchema(async (s) => {
      const c = await scenario(s);
      await s.comeUtente(c.estraneo);
      return codice(s, 'select * from public.adjust_leg_seats($1::uuid, $2::public.leg_direction, -4)', [c.offerta, 'outbound']);
    });

    expect(errore).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

describe('restore_system_rejected', () => {
  /** Una tratta a `postiLiberi`, con quattro candidature: due rifiutate dal sistema, una da una persona, una annullata. */
  async function scenario(s: Sessione, postiLiberi: number) {
    const owner = await creaProfilo(s, { plantId: 'pomigliano' });
    const offerta = await creaTrasfertaConTratte(s, { ownerId: owner, seatsTotal: 1, seatsAvailable: postiLiberi });
    const persone: string[] = [];
    const trasferte: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const id = await creaProfilo(s, { plantId: 'foggia' });
      persone.push(id);
      trasferte.push(await creaTrasferta(s, { ownerId: id }));
    }
    const rifiutata = { status: 'rejected', resolutionNote: 'Posti esauriti', resolvedBy: 'system' };
    const sistema1 = await creaCandidatura(s, { tripId: offerta, requesterId: persone[0] ?? '', requesterTripId: trasferte[0] ?? '', ...rifiutata });
    const sistema2 = await creaCandidatura(s, { tripId: offerta, requesterId: persone[1] ?? '', requesterTripId: trasferte[1] ?? '', ...rifiutata });
    const persona = await creaCandidatura(s, {
      tripId: offerta,
      requesterId: persone[2] ?? '',
      requesterTripId: trasferte[2] ?? '',
      status: 'rejected',
      resolutionNote: 'Non ci sono posti',
      resolvedBy: 'owner',
    });
    const annullata = await creaCandidatura(s, {
      tripId: offerta,
      requesterId: persone[3] ?? '',
      requesterTripId: trasferte[3] ?? '',
      status: 'cancelled',
    });
    return { offerta, persone, sistema1, sistema2, persona, annullata };
  }

  const stati = async (s: Sessione): Promise<Record<string, unknown>> => {
    await s.comePostgres();
    const righe = await s.esegui(
      'select id::text as id, status::text as stato, resolution_note as nota, resolved_by::text as da from public.match_requests'
    );
    return Object.fromEntries(righe.map((r) => [String(r.id), [r.stato, r.nota, r.da]]));
  };

  it('come richiedente: una UPDATE diretta delle righe degli altri tocca zero righe; la funzione le riporta a pending', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s, 1);
      // Il richiedente della candidatura annullata: le righe degli altri non le vede, quindi
      // una UPDATE diretta sulle loro righe non ne tocca nessuna (e non da errore).
      await s.comeUtente(c.persone[3] ?? '');
      const diretta = await s.modifica(
        "update public.match_requests set status = 'pending', resolution_note = null, resolved_by = null where trip_id = $1::uuid and requester_id <> $2::uuid",
        [c.offerta, c.persone[3] ?? '']
      );
      const prima = await stati(s);
      await s.comeUtente(c.persone[3] ?? '');
      const ripristinate = (await s.esegui('select * from public.restore_system_rejected($1::uuid, $2::public.leg_direction)', [c.offerta, 'outbound'])).map((r) => String(r.restore_system_rejected));
      const dopo = await stati(s);
      return { c, diretta, prima, ripristinate, dopo };
    });
    const { c } = esiti;

    expect(esiti.diretta).toBe(0);
    expect(esiti.prima[c.sistema1]).toEqual(['rejected', 'Posti esauriti', 'system']);
    expect([...esiti.ripristinate].sort()).toEqual([c.sistema1, c.sistema2].sort());
    expect(esiti.dopo[c.sistema1]).toEqual(['pending', null, null]);
    expect(esiti.dopo[c.sistema2]).toEqual(['pending', null, null]);
    // La decisione di una persona e l annullamento restano come sono.
    expect(esiti.dopo[c.persona]).toEqual(['rejected', 'Non ci sono posti', 'owner']);
    expect(esiti.dopo[c.annullata]).toEqual(['cancelled', null, null]);
  });

  it('su una tratta a zero posti la funzione non tocca niente', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s, 0);
      const prima = await stati(s);
      await s.comeUtente(c.persone[3] ?? '');
      const ripristinate = await s.esegui('select * from public.restore_system_rejected($1::uuid, $2::public.leg_direction)', [c.offerta, 'outbound']);
      return { prima, ripristinate, dopo: await stati(s) };
    });

    expect(esiti.ripristinate).toEqual([]);
    expect(esiti.dopo).toEqual(esiti.prima);
  });
});

describe('raise_personal_bests', () => {
  const alza = (s: Sessione, profilo: string, v: [number, number, number, number]) =>
    s.esegui(
      'select shared_trips, shared_legs, transported_colleagues, shared_km from public.raise_personal_bests($1::uuid, $2::integer, $3::integer, $4::integer, $5::double precision)',
      [profilo, ...v]
    );

  it('la prima alzata crea la riga; una mista alza cio che sale e non abbassa il resto', async () => {
    const esiti = await inSchema(async (s) => {
      const profilo = await creaProfilo(s);
      await s.comeUtente(profilo);
      return {
        prima: await alza(s, profilo, [4, 5, 6, 7.5]),
        mista: await alza(s, profilo, [9, 1, 6, 3]),
        piuBassa: await alza(s, profilo, [0, 0, 0, 0]),
      };
    });

    expect(esiti.prima).toEqual([{ shared_trips: 4, shared_legs: 5, transported_colleagues: 6, shared_km: 7.5 }]);
    expect(esiti.mista).toEqual([{ shared_trips: 9, shared_legs: 5, transported_colleagues: 6, shared_km: 7.5 }]);
    expect(esiti.piuBassa).toEqual(esiti.mista);
  });

  it('per un altro profilo e rifiutata (42501) e la sua riga non cambia', async () => {
    const esiti = await inSchema(async (s) => {
      const io = await creaProfilo(s);
      const altro = await creaProfilo(s);
      await s.esegui('insert into public.personal_bests (profile_id, shared_trips) values ($1::uuid, 4)', [altro]);
      await s.comeUtente(io);
      const sullAltro = await codice(
        s,
        'select * from public.raise_personal_bests($1::uuid, 99, 99, 99, 99::double precision)',
        [altro]
      );
      await s.comePostgres();
      const [riga] = await s.esegui('select shared_trips as t from public.personal_bests where profile_id = $1::uuid', [altro]);
      return { sullAltro, valore: riga?.t };
    });

    expect(esiti).toEqual({ sullAltro: INSUFFICIENT_PRIVILEGE, valore: 4 });
  });

  it('un UPDATE diretto che abbassa un massimo e un errore, per l owner e per postgres; uguale o piu alto passa', async () => {
    const esiti = await inSchema(async (s) => {
      const profilo = await creaProfilo(s);
      await s.esegui('insert into public.personal_bests values ($1::uuid, 4, 5, 6, 7.5)', [profilo]);
      await s.comeUtente(profilo);
      const abbassaDaOwner = await codice(s, 'update public.personal_bests set shared_trips = 3 where profile_id = $1::uuid', [profilo]);
      const abbassaKm = await codice(s, 'update public.personal_bests set shared_km = 7.4 where profile_id = $1::uuid', [profilo]);
      const uguale = await codice(s, 'update public.personal_bests set shared_trips = 4 where profile_id = $1::uuid', [profilo]);
      const piuAlto = await codice(s, 'update public.personal_bests set shared_legs = 6 where profile_id = $1::uuid', [profilo]);
      await s.comePostgres();
      const abbassaDaPostgres = await codice(s, 'update public.personal_bests set transported_colleagues = 5 where profile_id = $1::uuid', [profilo]);
      return { abbassaDaOwner, abbassaKm, uguale, piuAlto, abbassaDaPostgres };
    });

    expect(esiti).toEqual({
      abbassaDaOwner: CHECK_VIOLATION,
      abbassaKm: CHECK_VIOLATION,
      uguale: null,
      piuAlto: null,
      abbassaDaPostgres: CHECK_VIOLATION,
    });
  });

  it('un altro profilo non legge i massimi di nessuno (zero righe) e non li scrive (errore RLS)', async () => {
    const esiti = await inSchema(async (s) => {
      const io = await creaProfilo(s);
      const altro = await creaProfilo(s);
      await s.esegui('insert into public.personal_bests (profile_id, shared_trips) values ($1::uuid, 4)', [altro]);
      await s.comeUtente(io);
      const visti = await s.esegui('select * from public.personal_bests');
      const scrittura = await codice(s, 'insert into public.personal_bests (profile_id) values ($1::uuid)', [altro]);
      return { visti: visti.length, scrittura };
    });

    expect(esiti).toEqual({ visti: 0, scrittura: INSUFFICIENT_PRIVILEGE });
  });
});

describe('le tratte le materializza il DB (trigger su trips)', () => {
  const legs = async (s: Sessione, trip: string): Promise<Record<string, [number, number]>> => {
    await s.comePostgres();
    const righe = await s.esegui(
      'select direction::text as d, seats_total as t, seats_available as a from public.trip_legs where trip_id = $1::uuid',
      [trip]
    );
    return Object.fromEntries(righe.map((r) => [String(r.d), [Number(r.t), Number(r.a)]]));
  };

  const aggiorna = (s: Sessione, trip: string, assegnazioni: string, parametri: Parametri = []) =>
    s.tentativo(() => s.modifica(`update public.trips set ${assegnazioni} where id = $1::uuid`, [trip, ...parametri]));

  it('con auto e rientro: andata e ritorno ai posti della trasferta', async () => {
    const tratte = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      return legs(s, await creaTrasferta(s, { ownerId: owner, seatsTotal: 4 }));
    });

    expect(tratte).toEqual({ outbound: [4, 4], return: [4, 4] });
  });

  it('con auto e senza rientro: la sola andata; senza auto: nessuna', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      return {
        senzaRientro: await legs(s, await creaTrasferta(s, { ownerId: owner, returnAt: null })),
        senzaAuto: await legs(s, await creaTrasferta(s, { ownerId: owner, hasCar: false, seatsTotal: 0 })),
      };
    });

    expect(esiti).toEqual({ senzaRientro: { outbound: [3, 3] }, senzaAuto: {} });
  });

  it('il salvataggio e un upsert fatto dall owner: le tratte nascono anche sotto RLS', async () => {
    const tratte = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      await s.comeUtente(owner);
      const [riga] = await s.esegui(
        `insert into public.trips (id, owner_id, from_plant_id, to_plant_id, departure_at, return_at, has_car, seats_total, seats_available, status)
         values (gen_random_uuid(), $1::uuid, 'pomigliano', 'foggia', '2026-11-03T06:30:00.000Z', '2026-11-05T16:00:00.000Z', true, 2, 2, 'published')
         on conflict (id) do update set seats_total = excluded.seats_total
         returning id::text as id`,
        [owner]
      );
      return legs(s, String(riga?.id));
    });

    expect(tratte).toEqual({ outbound: [2, 2], return: [2, 2] });
  });

  it('risalvare PRESERVA il contatore e aggiorna il totale', async () => {
    const tratte = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const trip = await creaTrasfertaConTratte(s, { ownerId: owner, seatsTotal: 3 });
      await s.comeUtente(owner);
      await regola(s, trip, 'outbound', -1);
      // La trasferta torna a 5 posti: il contatore dell'andata (2) non si azzera, il ritorno (3) neppure.
      const esito = await aggiorna(s, trip, 'seats_total = 5, seats_available = 5');
      return { esito, tratte: await legs(s, trip) };
    });

    expect(tratte.esito.ok).toBe(true);
    expect(tratte.tratte).toEqual({ outbound: [5, 2], return: [5, 3] });
  });

  it('un contatore preservato fuori dal nuovo totale fa fallire l intero salvataggio', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const trip = await creaTrasfertaConTratte(s, { ownerId: owner, seatsTotal: 3 });
      const esito = await aggiorna(s, trip, 'seats_total = 2, seats_available = 2');
      await s.comePostgres();
      const [riga] = await s.esegui('select seats_total as t from public.trips where id = $1::uuid', [trip]);
      return { esito, totaleTrasferta: riga?.t, tratte: await legs(s, trip) };
    });

    expect(esiti.esito.ok).toBe(false);
    if (!esiti.esito.ok) expect(esiti.esito.errore.code).toBe(CHECK_VIOLATION);
    // Ne la trasferta ne le tratte sono cambiate.
    expect(esiti.totaleTrasferta).toBe(3);
    expect(esiti.tratte).toEqual({ outbound: [3, 3], return: [3, 3] });
  });

  it('un totale piu basso e accettato se il contatore preservato ci sta', async () => {
    const tratte = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const trip = await creaTrasfertaConTratte(s, { ownerId: owner, seatsTotal: 3 });
      await s.comeUtente(owner);
      await regola(s, trip, 'outbound', -1);
      await regola(s, trip, 'return', -1);
      await aggiorna(s, trip, 'seats_total = 2, seats_available = 2');
      return legs(s, trip);
    });

    expect(tratte).toEqual({ outbound: [2, 2], return: [2, 2] });
  });

  it('il rientro tolto elimina il ritorno e preserva l andata; aggiunto, lo crea ai posti della trasferta', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const trip = await creaTrasfertaConTratte(s, { ownerId: owner });
      await s.comeUtente(owner);
      await regola(s, trip, 'outbound', -1);
      await aggiorna(s, trip, 'return_at = null');
      const senzaRientro = await legs(s, trip);
      await aggiorna(s, trip, "return_at = '2026-11-05T16:00:00.000Z'::text::timestamptz");
      return { senzaRientro, conRientro: await legs(s, trip) };
    });

    expect(esiti.senzaRientro).toEqual({ outbound: [3, 2] });
    expect(esiti.conRientro).toEqual({ outbound: [3, 2], return: [3, 3] });
  });

  it('l auto tolta elimina tutte le tratte', async () => {
    const tratte = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const trip = await creaTrasfertaConTratte(s, { ownerId: owner });
      await aggiorna(s, trip, 'has_car = false, seats_total = 0, seats_available = 0');
      return legs(s, trip);
    });

    expect(tratte).toEqual({});
  });

  it('il rientro tolto con una candidatura sul ritorno e rifiutato: la foreign key RESTRICT, e la trasferta resta com e', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const richiedente = await creaProfilo(s, { plantId: 'foggia' });
      const trip = await creaTrasfertaConTratte(s, { ownerId: owner });
      const sua = await creaTrasferta(s, { ownerId: richiedente });
      await creaCandidatura(s, { tripId: trip, direction: 'return', requesterId: richiedente, requesterTripId: sua });
      await s.comeUtente(owner);
      const esito = await aggiorna(s, trip, 'return_at = null');
      await s.comePostgres();
      const [riga] = await s.esegui('select return_at is null as senza from public.trips where id = $1::uuid', [trip]);
      return { esito, senzaRientro: riga?.senza, tratte: await legs(s, trip) };
    });

    expect(esiti.esito.ok).toBe(false);
    if (!esiti.esito.ok) {
      expect(esiti.esito.errore.code).toBe(FOREIGN_KEY_VIOLATION);
      expect(esiti.esito.errore.constraint).toBe('match_requests_leg_fkey');
    }
    expect(esiti.senzaRientro).toBe(false);
    expect(esiti.tratte).toEqual({ outbound: [3, 3], return: [3, 3] });
  });
});

describe('notes.maxLength', () => {
  const NOTA_EMOJI = '👍'.repeat(10);

  async function conNota(s: Sessione, nota: string) {
    const owner = await creaProfilo(s);
    const richiedente = await creaProfilo(s, { plantId: 'foggia' });
    const offerta = await creaTrasfertaConTratte(s, { ownerId: owner });
    const sua = await creaTrasferta(s, { ownerId: richiedente });
    await s.esegui(
      `insert into public.parameters (key, value) values ('notes.maxLength', '280'::jsonb)
       on conflict (key) do update set value = excluded.value`
    );
    const id = await creaCandidatura(s, { tripId: offerta, requesterId: richiedente, requesterTripId: sua, requestNote: nota });
    return { id };
  }

  const imposta = (s: Sessione, limite: number) =>
    codice(s, "update public.parameters set value = $1::text::jsonb where key = 'notes.maxLength'", [String(limite)]);

  it('non scende sotto la nota piu lunga esistente, nemmeno per postgres (la dashboard); si misura in code point', async () => {
    const esiti = await inSchema(async (s) => {
      await conNota(s, NOTA_EMOJI);
      return {
        sotto: await imposta(s, 9),
        alConfine: await imposta(s, 10),
        sopra: await imposta(s, 11),
      };
    });

    // Dieci emoji sono dieci code point (venti per .length di JavaScript): 9 e rifiutato, 10 passa.
    expect(esiti).toEqual({ sotto: CHECK_VIOLATION, alConfine: null, sopra: null });
  });

  it('vale anche alla prima scrittura del parametro (insert)', async () => {
    const esito = await inSchema(async (s) => {
      await conNota(s, 'a'.repeat(50));
      await s.modifica("delete from public.parameters where key = 'notes.maxLength'");
      return codice(s, "insert into public.parameters (key, value) values ('notes.maxLength', '20'::jsonb)");
    });

    expect(esito).toBe(CHECK_VIOLATION);
  });

  it('un altro parametro non e toccato dal trigger', async () => {
    const esito = await inSchema(async (s) => {
      await conNota(s, 'a'.repeat(50));
      return codice(
        s,
        `insert into public.parameters (key, value) values ('match.toleranceMinutes', '5'::jsonb)
         on conflict (key) do update set value = excluded.value`
      );
    });

    expect(esito).toBeNull();
  });
});

describe('private.lower_note_max_length', () => {
  async function scenario(s: Sessione) {
    const owner = await creaProfilo(s);
    const offerta = await creaTrasfertaConTratte(s, { ownerId: owner });
    const rich: string[] = [];
    const sue: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      const id = await creaProfilo(s, { plantId: 'foggia' });
      rich.push(id);
      sue.push(await creaTrasferta(s, { ownerId: id }));
    }
    await s.esegui(
      `insert into public.parameters (key, value) values ('notes.maxLength', '280'::jsonb), ('cascade.autoRejectNote', to_jsonb('Posti esauriti'::text))
       on conflict (key) do update set value = excluded.value`
    );
    const lunga = await creaCandidatura(s, {
      tripId: offerta,
      requesterId: rich[0] ?? '',
      requesterTripId: sue[0] ?? '',
      status: 'rejected',
      requestNote: 'a'.repeat(50),
      resolutionNote: 'b'.repeat(30),
      resolvedBy: 'owner',
    });
    const corta = await creaCandidatura(s, {
      tripId: offerta,
      requesterId: rich[1] ?? '',
      requesterTripId: sue[1] ?? '',
      requestNote: 'ok',
    });
    return { lunga, corta };
  }

  const riga = async (s: Sessione, id: string) => {
    const [r] = await s.esegui(
      'select request_note as r, resolution_note as n, notes_shortened as m from public.match_requests where id = $1::uuid',
      [id]
    );
    return r;
  };

  it('accorcia a n-1 caratteri piu «…», marca solo le righe toccate, e scrive il parametro', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      await s.esegui('select private.lower_note_max_length(20)');
      const [parametro] = await s.esegui("select value::text as v from public.parameters where key = 'notes.maxLength'");
      return { lunga: await riga(s, c.lunga), corta: await riga(s, c.corta), parametro: parametro?.v };
    });

    expect(esiti.lunga).toEqual({ r: `${'a'.repeat(19)}…`, n: `${'b'.repeat(19)}…`, m: true });
    expect(esiti.lunga?.r).toHaveLength(20);
    // Una riga con note entro il limite non e toccata ne marcata.
    expect(esiti.corta).toEqual({ r: 'ok', n: null, m: false });
    expect(esiti.parametro).toBe('20');
  });

  it('il confine: un limite uguale alla nota piu lunga non accorcia niente', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      await s.esegui('select private.lower_note_max_length(50)');
      return riga(s, c.lunga);
    });

    expect(esiti).toEqual({ r: 'a'.repeat(50), n: 'b'.repeat(30), m: false });
  });

  it('rifiuta se la nota automatica della cascata sfora il nuovo limite, e non cambia niente', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      // «Posti esauriti» sono 14 caratteri: con n = 10 sfora.
      const errore = await codice(s, 'select private.lower_note_max_length(10)');
      const [parametro] = await s.esegui("select value::text as v from public.parameters where key = 'notes.maxLength'");
      return { errore, lunga: await riga(s, c.lunga), parametro: parametro?.v };
    });

    expect(esiti.errore).toBe(CHECK_VIOLATION);
    expect(esiti.lunga).toEqual({ r: 'a'.repeat(50), n: 'b'.repeat(30), m: false });
    expect(esiti.parametro).toBe('280');
  });

  it('un limite sotto 1 e rifiutato con 22023 e non cambia niente', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      const zero = await codice(s, 'select private.lower_note_max_length(0)');
      const negativo = await codice(s, 'select private.lower_note_max_length(-5)');
      const [parametro] = await s.esegui("select value::text as v from public.parameters where key = 'notes.maxLength'");
      return { zero, negativo, lunga: await riga(s, c.lunga), parametro: parametro?.v };
    });

    expect(esiti).toEqual({
      zero: '22023',
      negativo: '22023',
      lunga: { r: 'a'.repeat(50), n: 'b'.repeat(30), m: false },
      parametro: '280',
    });
  });

  it('con n = 1 ogni nota lunga diventa «…», mai una nota vuota', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      await s.esegui("delete from public.parameters where key = 'cascade.autoRejectNote'");
      await s.esegui('select private.lower_note_max_length(1)');
      return riga(s, c.lunga);
    });

    expect(esiti).toEqual({ r: '…', n: '…', m: true });
  });
});

describe('permessi di esecuzione', () => {
  it('anon non esegue nessuna delle tre funzioni dell app (42501)', async () => {
    const esiti = await inSchema(async (s) => {
      const profilo = await creaProfilo(s);
      const trip = await creaTrasfertaConTratte(s, { ownerId: profilo });
      await s.comeAnonimo();
      return {
        regola: await codice(s, 'select * from public.adjust_leg_seats($1::uuid, $2::public.leg_direction, -1)', [trip, 'outbound']),
        ripristina: await codice(s, 'select * from public.restore_system_rejected($1::uuid, $2::public.leg_direction)', [trip, 'outbound']),
        alza: await codice(s, 'select * from public.raise_personal_bests($1::uuid, 1, 1, 1, 1::double precision)', [profilo]),
      };
    });

    expect(esiti).toEqual({
      regola: INSUFFICIENT_PRIVILEGE,
      ripristina: INSUFFICIENT_PRIVILEGE,
      alza: INSUFFICIENT_PRIVILEGE,
    });
  });

  it('un autenticato non esegue la procedura privata (42501)', async () => {
    const esito = await inSchema(async (s) => {
      const profilo = await creaProfilo(s);
      await s.comeUtente(profilo);
      return codice(s, 'select private.lower_note_max_length(100)');
    });

    expect(esito).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it('dal catalogo: nessuna funzione e eseguibile da anon, e solo le tre dell app da authenticated', async () => {
    const funzioni = await inSchema((s) =>
      s.esegui(
        `select n.nspname || '.' || p.proname as nome,
                has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
                has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'private')
         order by 1`
      )
    );

    // Non vacuo: ci sono le funzioni.
    expect(funzioni.length).toBeGreaterThanOrEqual(8);
    expect(funzioni.filter((f) => f.anon === true).map((f) => f.nome)).toEqual([]);
    expect(funzioni.filter((f) => f.authenticated === true).map((f) => f.nome)).toEqual([
      'public.adjust_leg_seats',
      'public.raise_personal_bests',
      'public.restore_system_rejected',
    ]);
  });

  it('ogni funzione security definer ha search_path vuoto', async () => {
    const definer = await inSchema((s) =>
      s.esegui(
        `select n.nspname || '.' || p.proname as nome, coalesce(array_to_string(p.proconfig, ','), '') as config
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'private') and p.prosecdef
         order by 1`
      )
    );

    expect(definer.length).toBeGreaterThan(0);
    expect(definer.filter((f) => !String(f.config).includes('search_path=""')).map((f) => f.nome)).toEqual([]);
  });
});
