// Lo schema, provato sui vincoli e non sulle policy: la RLS attiva su ogni tabella, ogni CHECK
// col suo confine (un valore dentro e uno fuori), ogni foreign key e ogni UNIQUE, gli istanti al
// millisecondo. Qui si scrive come `postgres`, che scavalca le RLS: e il punto, perche un vincolo
// deve valere per chiunque scriva (migrazioni, seed, dashboard) e non solo per l app.
//
// Ogni test applica lo schema DAI FILE del repo dentro una transazione annullata.

import { type Sessione, applicaSchema, inTransazioneAnnullata } from './support/db';
import {
  creaCandidatura,
  creaProfilo,
  creaTrasferta,
  creaTrasfertaConTratte,
} from './support/fixtures';

/** Esegue `corpo` su uno schema appena applicato dai file. */
function inSchema<T>(corpo: (s: Sessione) => Promise<T>): Promise<T> {
  return inTransazioneAnnullata(async (s) => {
    await applicaSchema(s);
    return corpo(s);
  });
}

/** Il codice SQLSTATE e il vincolo di una scrittura che deve essere rifiutata (o null se riesce). */
async function rifiuto(
  s: Sessione,
  istruzione: string,
  parametri: readonly (string | number | boolean | null)[] = []
): Promise<{ code: string; constraint: string | undefined } | null> {
  const esito = await s.tentativo(() => s.esegui(istruzione, parametri));
  return esito.ok ? null : { code: esito.errore.code, constraint: esito.errore.constraint };
}

const CHECK_VIOLATION = '23514';
const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';
const INVALID_TEXT = '22P02';

describe('RLS attiva su ogni tabella', () => {
  it('ogni tabella di public e private ha la RLS attiva (letto dal catalogo, nessun elenco)', async () => {
    const tabelle = await inSchema((s) =>
      s.esegui(
        `select n.nspname || '.' || c.relname as nome, c.relrowsecurity as rls
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')
         order by 1`
      )
    );

    // Non vacuo: una query che non trova niente passerebbe da sola.
    expect(tabelle.length).toBeGreaterThan(0);
    expect(tabelle.filter((t) => t.rls !== true).map((t) => t.nome)).toEqual([]);
  });
});

describe('CHECK delle trasferte (gli invarianti di makeTrip)', () => {
  async function inserisci(
    s: Sessione,
    ownerId: string,
    c: { total: number; available: number; hasCar?: boolean }
  ) {
    return rifiuto(
      s,
      `insert into public.trips (owner_id, from_plant_id, to_plant_id, departure_at, has_car, seats_total, seats_available, status)
       values ($1::uuid, 'pomigliano', 'foggia', '2026-11-03T06:30:00.000Z', $2::boolean, $3::integer, $4::integer, 'published')`,
      [ownerId, c.hasCar ?? true, c.total, c.available]
    );
  }

  it('posti liberi = totali e il confine; uno oltre e rifiutato', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      return {
        alConfine: await inserisci(s, owner, { total: 3, available: 3 }),
        oltre: await inserisci(s, owner, { total: 3, available: 4 }),
      };
    });

    expect(esiti.alConfine).toBeNull();
    expect(esiti.oltre).toEqual({ code: CHECK_VIOLATION, constraint: 'trips_available_within_total' });
  });

  it('zero posti e valido, un posto negativo no', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      return {
        zero: await inserisci(s, owner, { total: 0, available: 0 }),
        negativo: await inserisci(s, owner, { total: 1, available: -1 }),
        totaleNegativo: await inserisci(s, owner, { total: -1, available: -1 }),
      };
    });

    expect(esiti.zero).toBeNull();
    expect(esiti.negativo).toEqual({ code: CHECK_VIOLATION, constraint: 'trips_seats_non_negative' });
    expect(esiti.totaleNegativo).toEqual({ code: CHECK_VIOLATION, constraint: 'trips_seats_non_negative' });
  });

  it('senza auto: zero posti e valido, un posto offerto no', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      return {
        zero: await inserisci(s, owner, { total: 0, available: 0, hasCar: false }),
        uno: await inserisci(s, owner, { total: 1, available: 1, hasCar: false }),
      };
    });

    expect(esiti.zero).toBeNull();
    expect(esiti.uno).toEqual({ code: CHECK_VIOLATION, constraint: 'trips_no_car_no_seats' });
  });
});

describe('istanti al millisecondo', () => {
  const inserisciConIstanti = (s: Sessione, ownerId: string, partenza: string, rientro: string | null) =>
    rifiuto(
      s,
      `insert into public.trips (owner_id, from_plant_id, to_plant_id, departure_at, return_at, has_car, seats_total, seats_available, status)
       values ($1::uuid, 'pomigliano', 'foggia', $2::text::timestamptz, $3::text::timestamptz, true, 3, 3, 'published')`,
      [ownerId, partenza, rientro]
    );

  it('una frazione oltre il millisecondo e RIFIUTATA, non arrotondata: 23:59:59.9996 non diventa il giorno dopo', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      return {
        partenza: await inserisciConIstanti(s, owner, '2026-11-03T23:59:59.9996Z', null),
        rientro: await inserisciConIstanti(s, owner, '2026-11-03T06:30:00.000Z', '2026-11-05T23:59:59.9996Z'),
      };
    });

    expect(esiti.partenza).toEqual({ code: CHECK_VIOLATION, constraint: 'trips_departure_at_millis' });
    expect(esiti.rientro).toEqual({ code: CHECK_VIOLATION, constraint: 'trips_return_at_millis' });
  });

  it('un istante con millisecondi che finiscono con zero (.120) si rilegge intatto', async () => {
    const riletti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const id = await creaTrasferta(s, {
        ownerId: owner,
        departureAt: '2026-11-03T23:59:59.120Z',
        returnAt: '2026-11-05T23:59:59.999Z',
      });
      const righe = await s.esegui(
        `select to_char(departure_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as partenza,
                to_char(return_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as rientro
         from public.trips where id = $1::uuid`,
        [id]
      );
      return righe[0];
    });

    expect(riletti).toEqual({ partenza: '2026-11-03T23:59:59.120Z', rientro: '2026-11-05T23:59:59.999Z' });
  });
});

describe('CHECK delle tratte', () => {
  it('posti liberi = totali e il confine, zero e valido; uno oltre e uno sotto zero no', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const trip = await creaTrasferta(s, { ownerId: owner, returnAt: null });
      // Il trigger della migrazione 2 ha gia scritto l'andata: si parte da una trasferta senza tratte.
      await s.modifica('delete from public.trip_legs where trip_id = $1::uuid', [trip]);
      const scrivi = (direction: string, total: number, available: number) =>
        rifiuto(
          s,
          `insert into public.trip_legs (trip_id, direction, seats_total, seats_available)
           values ($1::uuid, $2::public.leg_direction, $3::integer, $4::integer)`,
          [trip, direction, total, available]
        );
      return {
        alConfine: await scrivi('outbound', 3, 3),
        zero: await scrivi('return', 0, 0),
        oltre: await scrivi('outbound', 3, 4),
        sotto: await scrivi('outbound', 3, -1),
      };
    });

    expect(esiti.alConfine).toBeNull();
    expect(esiti.zero).toBeNull();
    // Le due righe rifiutate: il CHECK arriva prima della chiave primaria? No: i CHECK sono
    // valutati prima degli indici, quindi il codice e quello del CHECK anche su una coppia che esiste.
    expect(esiti.oltre).toEqual({ code: CHECK_VIOLATION, constraint: 'trip_legs_available_within_total' });
    expect(esiti.sotto).toEqual({ code: CHECK_VIOLATION, constraint: 'trip_legs_seats_non_negative' });
  });
});

describe('CHECK delle candidature (gli invarianti di validateMatchRequestStructure)', () => {
  async function scenario(s: Sessione) {
    const owner = await creaProfilo(s);
    const richiedente = await creaProfilo(s, { plantId: 'foggia' });
    const offerta = await creaTrasfertaConTratte(s, { ownerId: owner });
    const sua = await creaTrasferta(s, { ownerId: richiedente });
    return { offerta, richiedente, sua };
  }

  const scrivi = (
    s: Sessione,
    c: { offerta: string; richiedente: string; sua: string },
    campi: { status: string; nota: string | null; da: string | null }
  ) =>
    rifiuto(
      s,
      `insert into public.match_requests (trip_id, direction, requester_id, requester_trip_id, status, resolution_note, resolved_by)
       values ($1::uuid, 'outbound', $2::uuid, $3::uuid, $4::public.match_request_status, $5, $6::public.resolved_by)`,
      [c.offerta, c.richiedente, c.sua, campi.status, campi.nota, campi.da]
    );

  it('nota di risoluzione e resolved_by insieme o nessuno dei due', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      // Ogni riga usa uno stato non pending: e la coppia a essere provata. La riga valida
      // resta (la coppia tratta-richiedente e unica); le rifiutate non lasciano traccia.
      return {
        entrambi: await scrivi(s, c, { status: 'rejected', nota: 'Non ci sono posti', da: 'owner' }),
        soloNota: await scrivi(s, c, { status: 'cancelled', nota: 'Nota senza chi', da: null }),
        soloChi: await scrivi(s, c, { status: 'cancelled', nota: null, da: 'owner' }),
      };
    });

    expect(esiti.entrambi).toBeNull();
    expect(esiti.soloNota).toEqual({ code: CHECK_VIOLATION, constraint: 'match_requests_resolution_pair' });
    expect(esiti.soloChi).toEqual({ code: CHECK_VIOLATION, constraint: 'match_requests_resolution_pair' });
  });

  it('una candidatura pending non ha risoluzione; senza e valida', async () => {
    const esiti = await inSchema(async (s) => {
      const c = await scenario(s);
      return {
        conRisoluzione: await scrivi(s, c, { status: 'pending', nota: 'Nota', da: 'owner' }),
        senza: await scrivi(s, c, { status: 'pending', nota: null, da: null }),
      };
    });

    expect(esiti.conRisoluzione).toEqual({ code: CHECK_VIOLATION, constraint: 'match_requests_pending_open' });
    expect(esiti.senza).toBeNull();
  });
});

describe('CHECK dei massimi', () => {
  it('zero e valido; un negativo, Infinity e NaN no', async () => {
    const esiti = await inSchema(async (s) => {
      const profilo = await creaProfilo(s);
      const scrivi = (colonna: string, valore: string) =>
        rifiuto(
          s,
          `insert into public.personal_bests (profile_id, ${colonna}) values ($1::uuid, ${valore})
           on conflict (profile_id) do nothing`,
          [profilo]
        );
      return {
        zero: await scrivi('shared_trips', '0'),
        negativo: await scrivi('shared_trips', '-1'),
        kmNegativo: await scrivi('shared_km', '-0.5'),
        kmInfinito: await scrivi('shared_km', "'Infinity'"),
        kmNan: await scrivi('shared_km', "'NaN'"),
      };
    });

    expect(esiti.zero).toBeNull();
    for (const esito of [esiti.negativo, esiti.kmNegativo, esiti.kmInfinito, esiti.kmNan]) {
      expect(esito).toEqual({ code: CHECK_VIOLATION, constraint: 'personal_bests_non_negative' });
    }
  });
});

describe('tabelle dei parametri', () => {
  it('parameters: numero e testo sono validi; un booleano, un array, un oggetto e null no', async () => {
    const esiti = await inSchema(async (s) => {
      const scrivi = (chiave: string, json: string) =>
        rifiuto(
          s,
          `insert into public.parameters (key, value) values ($1::public.parameter_key, $2::text::jsonb)
           on conflict (key) do update set value = excluded.value`,
          [chiave, json]
        );
      return {
        numero: await scrivi('match.toleranceMinutes', '30'),
        testo: await scrivi('cascade.autoRejectNote', '"Posti esauriti"'),
        booleano: await scrivi('match.toleranceMinutes', 'true'),
        array: await scrivi('match.toleranceMinutes', '[30]'),
        oggetto: await scrivi('match.toleranceMinutes', '{"a":1}'),
        nullJson: await scrivi('match.toleranceMinutes', 'null'),
      };
    });

    expect(esiti.numero).toBeNull();
    expect(esiti.testo).toBeNull();
    for (const esito of [esiti.booleano, esiti.array, esiti.oggetto, esiti.nullJson]) {
      expect(esito).toEqual({ code: CHECK_VIOLATION, constraint: 'parameters_value_scalar' });
    }
  });

  it('parameters: una chiave sconosciuta e rifiutata mentre la si scrive', async () => {
    const esito = await inSchema((s) =>
      rifiuto(s, "insert into public.parameters (key, value) values ('match.refuso', '1'::jsonb)")
    );

    expect(esito?.code).toBe(INVALID_TEXT);
  });

  it('plant_distances: plant diversi, km finiti e >= 0, una riga per coppia non ordinata', async () => {
    const esiti = await inSchema(async (s) => {
      // Se il seed (migrazione 3) ha gia scritto le coppie, partire da una tabella vuota.
      await s.modifica('delete from public.plant_distances');
      const scrivi = (da: string, a: string, km: string) =>
        rifiuto(s, `insert into public.plant_distances values ('${da}', '${a}', ${km})`);
      return {
        valida: await scrivi('pomigliano', 'foggia', '165'),
        zeroKm: await scrivi('pomigliano', 'grottaglie', '0'),
        stessi: await scrivi('foggia', 'foggia', '10'),
        negativa: await scrivi('foggia', 'grottaglie', '-1'),
        infinita: await scrivi('foggia', 'grottaglie', "'Infinity'"),
        invertita: await scrivi('foggia', 'pomigliano', '165'),
        identica: await scrivi('pomigliano', 'foggia', '165'),
        plantSconosciuto: await scrivi('torino', 'foggia', '10'),
      };
    });

    expect(esiti.valida).toBeNull();
    expect(esiti.zeroKm).toBeNull();
    expect(esiti.stessi).toEqual({ code: CHECK_VIOLATION, constraint: 'plant_distances_distinct_plants' });
    expect(esiti.negativa).toEqual({ code: CHECK_VIOLATION, constraint: 'plant_distances_km_finite' });
    expect(esiti.infinita).toEqual({ code: CHECK_VIOLATION, constraint: 'plant_distances_km_finite' });
    expect(esiti.invertita).toEqual({ code: UNIQUE_VIOLATION, constraint: 'plant_distances_pair_key' });
    expect(esiti.identica?.code).toBe(UNIQUE_VIOLATION);
    expect(esiti.plantSconosciuto?.code).toBe(INVALID_TEXT);
  });

  it('badge_parameters: la soglia minima 1 e valida, 0 no; un badge sconosciuto no', async () => {
    const esiti = await inSchema(async (s) => {
      await s.modifica('delete from public.badge_parameters');
      const scrivi = (badge: string, soglia: number) =>
        rifiuto(s, `insert into public.badge_parameters values ('${badge}', ${String(soglia)}, 'Etichetta')`);
      return {
        uno: await scrivi('primo-viaggio', 1),
        zero: await scrivi('cinque-viaggi', 0),
        negativa: await scrivi('cinque-viaggi', -3),
        sconosciuto: await scrivi('badge-inventato', 5),
      };
    });

    expect(esiti.uno).toBeNull();
    expect(esiti.zero).toEqual({ code: CHECK_VIOLATION, constraint: 'badge_parameters_threshold_min' });
    expect(esiti.negativa).toEqual({ code: CHECK_VIOLATION, constraint: 'badge_parameters_threshold_min' });
    expect(esiti.sconosciuto?.code).toBe(INVALID_TEXT);
  });
});

describe('identita come tipi enumerati', () => {
  it('un plant, uno stato o una direzione fuori dall elenco sono rifiutati', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      return {
        plant: await rifiuto(s, "update public.profiles set plant_id = 'torino' where id = $1::uuid", [owner]),
        stato: await rifiuto(
          s,
          "insert into public.trips (owner_id, from_plant_id, to_plant_id, departure_at, has_car, seats_total, seats_available, status) values ($1::uuid, 'pomigliano', 'foggia', '2026-11-03T06:30:00.000Z', true, 1, 1, 'sospesa')",
          [owner]
        ),
        direzione: await rifiuto(s, "select 'laterale'::public.leg_direction"),
      };
    });

    expect(esiti.plant?.code).toBe(INVALID_TEXT);
    expect(esiti.stato?.code).toBe(INVALID_TEXT);
    expect(esiti.direzione?.code).toBe(INVALID_TEXT);
  });
});

describe('foreign key e unicita, come postgres (che scavalca le RLS)', () => {
  it('trips.owner_id -> profiles e profiles.id -> auth.users', async () => {
    const esiti = await inSchema(async (s) => {
      const inesistente = '99999999-9999-4999-8999-999999999999';
      return {
        proprietario: await rifiuto(
          s,
          "insert into public.trips (owner_id, from_plant_id, to_plant_id, departure_at, has_car, seats_total, seats_available, status) values ($1::uuid, 'pomigliano', 'foggia', '2026-11-03T06:30:00.000Z', true, 1, 1, 'published')",
          [inesistente]
        ),
        profilo: await rifiuto(
          s,
          "insert into public.profiles (id, display_name, plant_id) values ($1::uuid, 'Senza utente', 'foggia')",
          [inesistente]
        ),
      };
    });

    expect(esiti.proprietario).toEqual({ code: FOREIGN_KEY_VIOLATION, constraint: 'trips_owner_id_fkey' });
    expect(esiti.profilo).toEqual({ code: FOREIGN_KEY_VIOLATION, constraint: 'profiles_id_fkey' });
  });

  it('requester_trip_id deve essere una trasferta DEL richiedente: la foreign key composta ferma anche postgres (23503)', async () => {
    const esito = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const richiedente = await creaProfilo(s, { plantId: 'foggia' });
      const offerta = await creaTrasfertaConTratte(s, { ownerId: owner });
      // La trasferta e vera, ma e dell owner e non del richiedente.
      return rifiuto(
        s,
        `insert into public.match_requests (trip_id, direction, requester_id, requester_trip_id, status)
         values ($1::uuid, 'outbound', $2::uuid, $1::uuid, 'pending')`,
        [offerta, richiedente]
      );
    });

    expect(esito).toEqual({ code: FOREIGN_KEY_VIOLATION, constraint: 'match_requests_requester_trip_fkey' });
  });

  it('una candidatura su una tratta inesistente (il rientro di una trasferta senza rientro) e impossibile', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const richiedente = await creaProfilo(s, { plantId: 'foggia' });
      const offerta = await creaTrasfertaConTratte(s, { ownerId: owner, returnAt: null });
      const sua = await creaTrasferta(s, { ownerId: richiedente });
      const scrivi = (direction: string) =>
        rifiuto(
          s,
          `insert into public.match_requests (trip_id, direction, requester_id, requester_trip_id, status)
           values ($1::uuid, $2::public.leg_direction, $3::uuid, $4::uuid, 'pending')`,
          [offerta, direction, richiedente, sua]
        );
      return { rientro: await scrivi('return'), andata: await scrivi('outbound') };
    });

    expect(esiti.rientro).toEqual({ code: FOREIGN_KEY_VIOLATION, constraint: 'match_requests_leg_fkey' });
    expect(esiti.andata).toBeNull();
  });

  it('un secondo id sulla stessa coppia (tratta, richiedente) e rifiutato; un altra tratta o un altro richiedente no', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const richiedente = await creaProfilo(s, { plantId: 'foggia' });
      const altro = await creaProfilo(s, { plantId: 'grottaglie' });
      const offerta = await creaTrasfertaConTratte(s, { ownerId: owner });
      const sua = await creaTrasferta(s, { ownerId: richiedente });
      const suaDiAltro = await creaTrasferta(s, { ownerId: altro });
      await creaCandidatura(s, { tripId: offerta, requesterId: richiedente, requesterTripId: sua });
      const scrivi = (direction: string, requesterId: string, requesterTripId: string) =>
        rifiuto(
          s,
          `insert into public.match_requests (trip_id, direction, requester_id, requester_trip_id, status)
           values ($1::uuid, $2::public.leg_direction, $3::uuid, $4::uuid, 'pending')`,
          [offerta, direction, requesterId, requesterTripId]
        );
      return {
        duplicata: await scrivi('outbound', richiedente, sua),
        altraTratta: await scrivi('return', richiedente, sua),
        altroRichiedente: await scrivi('outbound', altro, suaDiAltro),
      };
    });

    expect(esiti.duplicata).toEqual({ code: UNIQUE_VIOLATION, constraint: 'match_requests_leg_requester_key' });
    expect(esiti.altraTratta).toBeNull();
    expect(esiti.altroRichiedente).toBeNull();
  });

  it('RESTRICT: una tratta referenziata da una candidatura chiusa non si elimina, nemmeno con la sua trasferta', async () => {
    const esiti = await inSchema(async (s) => {
      const owner = await creaProfilo(s);
      const richiedente = await creaProfilo(s, { plantId: 'foggia' });
      const offerta = await creaTrasfertaConTratte(s, { ownerId: owner });
      const sua = await creaTrasferta(s, { ownerId: richiedente });
      await creaCandidatura(s, {
        tripId: offerta,
        requesterId: richiedente,
        requesterTripId: sua,
        status: 'rejected',
        resolutionNote: 'Non ci sono posti',
        resolvedBy: 'owner',
      });
      return {
        tratta: await rifiuto(
          s,
          "delete from public.trip_legs where trip_id = $1::uuid and direction = 'outbound'",
          [offerta]
        ),
        trasferta: await rifiuto(s, 'delete from public.trips where id = $1::uuid', [offerta]),
        // Controllo: la tratta senza candidature (il ritorno) si elimina.
        senzaCandidature: await rifiuto(
          s,
          "delete from public.trip_legs where trip_id = $1::uuid and direction = 'return'",
          [offerta]
        ),
      };
    });

    expect(esiti.tratta).toEqual({ code: FOREIGN_KEY_VIOLATION, constraint: 'match_requests_leg_fkey' });
    expect(esiti.trasferta?.code).toBe(FOREIGN_KEY_VIOLATION);
    expect(esiti.senzaCandidature).toBeNull();
  });
});
