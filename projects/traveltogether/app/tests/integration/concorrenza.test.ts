// La concorrenza, provata SUL DB VERO: in RAM l'intercalatura e deterministica e scelta dal test, qui
// no. Due connessioni, ciascuna con la sua transazione, contro lo schema APPLICATO a staging (non
// quello dei file: questi test girano dopo `db:push`).
//
// QUESTI TEST SCRIVONO RIGHE VERE e le confermano, perche una seconda connessione non vede una
// transazione aperta. Le righe sono solo fixture riconoscibili (utenti `@t08.test.invalid`, nomi
// fittizi), cancellate all'inizio (residui di un'esecuzione interrotta) e alla fine, per
// identita di test: nessun'altra riga, e nessuna tabella dei parametri, viene toccata. Tutti gli
// altri test di test:int girano in una transazione annullata.

import { type Sessione, apriConfermabile, inTransazioneConfermata, inTransazioneAnnullata } from './support/db';
import {
  contaResiduiDiTest,
  creaCandidatura,
  creaProfilo,
  creaTrasferta,
  creaTrasfertaConTratte,
  pulisciFixtureConfermate,
} from './support/fixtures';

const ATTESA_DEL_LOCK_MS = 1500;

const aspetta = (ms: number): Promise<void> => new Promise((risolvi) => setTimeout(risolvi, ms));

const ADJUST = 'select seats_available from public.adjust_leg_seats($1::uuid, $2::public.leg_direction, $3::integer)';

beforeAll(async () => {
  // Il test funziona solo sullo schema applicato: senza, fallisce rumorosamente.
  const presente = await inTransazioneAnnullata((s) =>
    s.esegui("select to_regclass('public.trips') is not null as presente")
  );
  if (presente[0]?.presente !== true) {
    throw new Error(
      'concorrenza.test.ts gira sullo schema APPLICATO a staging, e public.trips non esiste: ' +
        'le migrazioni vanno applicate prima (npm run db:push, lo fa l orchestratore).'
    );
  }
  await inTransazioneConfermata(pulisciFixtureConfermate);
});

afterEach(async () => {
  await inTransazioneConfermata(pulisciFixtureConfermate);
});

afterAll(async () => {
  await inTransazioneConfermata(pulisciFixtureConfermate);
  const residui = await inTransazioneAnnullata((s) => contaResiduiDiTest(s));
  // A fine esecuzione non resta nessuna riga di test.
  expect(residui).toEqual({ utenti: 0, profili: 0, trasferte: 0, candidature: 0, massimi: 0 });
});

/**
 * Aspetta (fino a 10 s) che esista un backend in attesa di un lock che sta eseguendo
 * `adjust_leg_seats`. Legge `pg_stat_activity`; `postgres` su Supabase vede le sessioni degli
 * altri ruoli. Se la vista non mostrasse il backend (pooler) il test fallirebbe, non passerebbe.
 */
async function aspettaUnBackendInAttesaDiLock(): Promise<boolean> {
  for (let tentativo = 0; tentativo < 20; tentativo += 1) {
    const righe = await inTransazioneAnnullata((s) =>
      s.esegui(
        `select count(*)::int as n from pg_stat_activity
         where wait_event_type = 'Lock' and query like '%adjust_leg_seats%'
           and pid <> pg_backend_pid()`
      )
    );
    if (Number(righe[0]?.n) >= 1) return true;
    await aspetta(500);
  }
  return false;
}

/** Un passo di una sequenza: transazione propria, identita data, confermata. */
async function passo<T>(identita: string, corpo: (s: Sessione) => Promise<T>): Promise<T> {
  return inTransazioneConfermata(async (s) => {
    await s.comeUtente(identita);
    return corpo(s);
  });
}

async function statoRiga(id: string): Promise<{ stato: unknown; nota: unknown; da: unknown }> {
  const righe = await inTransazioneAnnullata((s) =>
    s.esegui(
      'select status::text as stato, resolution_note as nota, resolved_by::text as da from public.match_requests where id = $1::uuid',
      [id]
    )
  );
  return { stato: righe[0]?.stato, nota: righe[0]?.nota, da: righe[0]?.da };
}

async function postiLiberi(trip: string, direzione: 'outbound' | 'return'): Promise<number> {
  const righe = await inTransazioneAnnullata((s) =>
    s.esegui('select seats_available from public.trip_legs where trip_id = $1::uuid and direction = $2::public.leg_direction', [
      trip,
      direzione,
    ])
  );
  return Number(righe[0]?.seats_available);
}

describe('concorrenza reale su Postgres', () => {
  it('l ultimo posto conteso: A lo prende e tiene il lock, B attende e a conferma di A ottiene ZERO RIGHE (non un errore di CHECK)', async () => {
    const { owner, trip } = await inTransazioneConfermata(async (s) => {
      const proprietario = await creaProfilo(s);
      return {
        owner: proprietario,
        trip: await creaTrasfertaConTratte(s, { ownerId: proprietario, seatsTotal: 1, returnAt: null }),
      };
    });
    const a = await apriConfermabile();
    const b = await apriConfermabile();
    try {
      await a.inizia();
      await b.inizia();
      await a.sessione.comeUtente(owner);
      await b.sessione.comeUtente(owner);

      // A decrementa l'ultimo posto e TIENE il lock (la transazione resta aperta).
      const daA = await a.sessione.esegui(ADJUST, [trip, 'outbound', -1]);

      // B tenta lo stesso: la sua UPDATE attende il lock di A.
      let bHaRisposto = false;
      const daB = b.sessione.esegui(ADJUST, [trip, 'outbound', -1]).then((righe) => {
        bHaRisposto = true;
        return righe;
      });
      // Non ci si fida solo del tempo: da una terza connessione si aspetta che un backend sia
      // davvero in attesa di un lock (wait_event_type = 'Lock') dentro adjust_leg_seats.
      expect(await aspettaUnBackendInAttesaDiLock()).toBe(true);
      await aspetta(ATTESA_DEL_LOCK_MS);
      expect(bHaRisposto).toBe(false);

      // A conferma: B si sblocca, rilegge la riga e la condizione BETWEEN non regge piu.
      await a.conferma();
      const righeDiB = await daB;
      await b.conferma();

      // Chi ha il posto lo dice il test: A. B non ha ricevuto un errore ma zero righe.
      expect(daA).toEqual([{ seats_available: 0 }]);
      expect(righeDiB).toEqual([]);
      expect(await postiLiberi(trip, 'outbound')).toBe(0);
    } finally {
      await a.chiudi();
      await b.chiudi();
    }
  });

  it('la corsa fra la cascata e una candidatura nuova: la riga nuova resta pending su una tratta a zero, e si chiude solo con un rifiuto motivato', async () => {
    const f = await inTransazioneConfermata(async (s) => {
      const owner = await creaProfilo(s, { plantId: 'pomigliano' });
      const r1 = await creaProfilo(s, { plantId: 'foggia' });
      const r2 = await creaProfilo(s, { plantId: 'foggia' });
      const r3 = await creaProfilo(s, { plantId: 'grottaglie' });
      const trip = await creaTrasfertaConTratte(s, { ownerId: owner, seatsTotal: 1, returnAt: null });
      const tripR1 = await creaTrasferta(s, { ownerId: r1 });
      const tripR2 = await creaTrasferta(s, { ownerId: r2 });
      const tripR3 = await creaTrasferta(s, { ownerId: r3 });
      const c1 = await creaCandidatura(s, { tripId: trip, requesterId: r1, requesterTripId: tripR1 });
      const c2 = await creaCandidatura(s, { tripId: trip, requesterId: r2, requesterTripId: tripR2 });
      return { owner, r3, trip, tripR3, c1, c2 };
    });

    // 1. L'owner accetta r1 e consuma l'ultimo posto.
    await passo(f.owner, async (s) => {
      await s.modifica("update public.match_requests set status = 'accepted' where id = $1::uuid", [f.c1]);
      const righe = await s.esegui(ADJUST, [f.trip, 'outbound', -1]);
      expect(righe).toEqual([{ seats_available: 0 }]);
    });

    // 2. La cascata legge le pending della tratta: ne vede UNA (c2).
    const lette = await passo(f.owner, async (s) =>
      (
        await s.esegui(
          "select id::text as id from public.match_requests where trip_id = $1::uuid and direction = 'outbound' and status = 'pending'",
          [f.trip]
        )
      ).map((riga) => String(riga.id))
    );
    expect(lette).toEqual([f.c2]);

    // 3. FRA la lettura e la scrittura, un richiedente nuovo si candida e CONFERMA: nessun lock lo ferma.
    const nuova = await passo(f.r3, async (s) => {
      const righe = await s.esegui(
        `insert into public.match_requests (trip_id, direction, requester_id, requester_trip_id, status)
         values ($1::uuid, 'outbound', $2::uuid, $3::uuid, 'pending') returning id::text as id`,
        [f.trip, f.r3, f.tripR3]
      );
      return String(righe[0]?.id);
    });

    // 4. La cascata rifiuta SOLO quelle che aveva letto, con la nota automatica, e conferma.
    await passo(f.owner, async (s) => {
      for (const id of lette) {
        const toccate = await s.modifica(
          `update public.match_requests set status = 'rejected', resolution_note = 'Posti esauriti', resolved_by = 'system' where id = $1::uuid`,
          [id]
        );
        expect(toccate).toBe(1);
      }
    });

    // Esito pinnato: c2 chiusa dal sistema, la nuova ANCORA pending, su una tratta a zero.
    expect(await statoRiga(f.c2)).toEqual({ stato: 'rejected', nota: 'Posti esauriti', da: 'system' });
    expect(await statoRiga(nuova)).toEqual({ stato: 'pending', nota: null, da: null });
    expect(await postiLiberi(f.trip, 'outbound')).toBe(0);

    // L'owner che prova ad accettare la nuova ottiene ZERO RIGHE da adjust_leg_seats...
    await passo(f.owner, async (s) => {
      expect(await s.esegui(ADJUST, [f.trip, 'outbound', -1])).toEqual([]);
    });
    // ...e la chiude con un rifiuto motivato, che riesce.
    await passo(f.owner, async (s) => {
      const toccate = await s.modifica(
        `update public.match_requests set status = 'rejected', resolution_note = 'Non ci sono posti', resolved_by = 'owner' where id = $1::uuid`,
        [nuova]
      );
      expect(toccate).toBe(1);
    });
    expect(await statoRiga(nuova)).toEqual({ stato: 'rejected', nota: 'Non ci sono posti', da: 'owner' });
  });

  it('l annullamento con due rifiutati dal sistema in coda: il +1 e il reintegro via funzione riportano a pending solo i loro', async () => {
    const f = await inTransazioneConfermata(async (s) => {
      const owner = await creaProfilo(s, { plantId: 'pomigliano' });
      const persone: string[] = [];
      const trasferte: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        const id = await creaProfilo(s, { plantId: 'foggia' });
        persone.push(id);
        trasferte.push(await creaTrasferta(s, { ownerId: id }));
      }
      const trip = await creaTrasfertaConTratte(s, { ownerId: owner, seatsTotal: 1, seatsAvailable: 0, returnAt: null });
      const p = (i: number) => persone[i] ?? '';
      const t = (i: number) => trasferte[i] ?? '';
      const accettata = await creaCandidatura(s, { tripId: trip, requesterId: p(0), requesterTripId: t(0), status: 'accepted' });
      const rifiutata = { status: 'rejected', resolutionNote: 'Posti esauriti', resolvedBy: 'system' };
      const sistema1 = await creaCandidatura(s, { tripId: trip, requesterId: p(1), requesterTripId: t(1), ...rifiutata });
      const sistema2 = await creaCandidatura(s, { tripId: trip, requesterId: p(2), requesterTripId: t(2), ...rifiutata });
      const persona = await creaCandidatura(s, {
        tripId: trip,
        requesterId: p(3),
        requesterTripId: t(3),
        status: 'rejected',
        resolutionNote: 'Non ci sono posti',
        resolvedBy: 'owner',
      });
      return { trip, richiedente: p(0), accettata, sistema1, sistema2, persona };
    });

    // cancelRequest, con l'identita del richiedente: +1 PRIMA di scrivere cancelled (la riga e ancora accepted)...
    await passo(f.richiedente, async (s) => {
      expect(await s.esegui(ADJUST, [f.trip, 'outbound', 1])).toEqual([{ seats_available: 1 }]);
      const toccate = await s.modifica("update public.match_requests set status = 'cancelled' where id = $1::uuid", [f.accettata]);
      expect(toccate).toBe(1);
    });
    // ...e poi il reintegro: sotto RLS il richiedente non legge ne scrive le righe degli altri, la funzione si'.
    const ripristinate = await passo(f.richiedente, async (s) =>
      (
        await s.esegui('select restore_system_rejected as id from public.restore_system_rejected($1::uuid, $2::public.leg_direction)', [
          f.trip,
          'outbound',
        ])
      ).map((riga) => String(riga.id))
    );

    expect([...ripristinate].sort()).toEqual([f.sistema1, f.sistema2].sort());
    expect(await statoRiga(f.sistema1)).toEqual({ stato: 'pending', nota: null, da: null });
    expect(await statoRiga(f.sistema2)).toEqual({ stato: 'pending', nota: null, da: null });
    // La decisione di una persona e la riga annullata restano come sono.
    expect(await statoRiga(f.persona)).toEqual({ stato: 'rejected', nota: 'Non ci sono posti', da: 'owner' });
    expect((await statoRiga(f.accettata)).stato).toBe('cancelled');
    expect(await postiLiberi(f.trip, 'outbound')).toBe(1);
  });
});
