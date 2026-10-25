// Creazione di una trasferta, sui confini.
//
// Clock e repository sono fake locali che implementano i port, e non gli adapter
// memory: core/ non puo' importare adapters/ (lo impone il lint, anche per i
// test), quindi un usecase si prova contro i port e basta. Il fake del repository
// registra i salvataggi, cosi' ogni rifiuto verifica anche che NON sia stato
// scritto nulla — un'asserzione sul solo errore passerebbe anche se la trasferta
// invalida venisse salvata comunque.
//
// Ogni test di rifiuto controlla il `kind` esatto: "c'e' un errore" passerebbe
// anche con la regola sbagliata a scattare.

import type { Result, Trip } from '../domain';
import type { Clock, RepositoryError, TripRepository } from '../ports';
import { createTrip, type CreateTripDeps, type CreateTripError, type CreateTripInput } from './create-trip';
import type { CreateTripConfig } from './create-trip-config';

const CONFIG: CreateTripConfig = { maxSeatsOffered: 8 };

const ADESSO = '2026-11-03T06:00:00.000Z';

function unOrologio(istante: string): Clock {
  return { now: () => istante };
}

interface RepoSpia extends TripRepository {
  readonly salvate: Trip[];
}

function unRepoSpia(esito: 'ok' | RepositoryError = 'ok'): RepoSpia {
  const salvate: Trip[] = [];
  const nonUsato = (): never => {
    throw new Error('metodo non previsto da createTrip');
  };
  return {
    salvate,
    async save(trip: Trip): Promise<Result<Trip, RepositoryError>> {
      if (esito !== 'ok') return { ok: false, error: esito };
      salvate.push(trip);
      return { ok: true, value: trip };
    },
    findById: nonUsato,
    listByOwner: nonUsato,
    listOpenOffers: nonUsato,
    findLeg: nonUsato,
    adjustLegSeats: nonUsato,
  };
}

function unInput(modifiche: Partial<CreateTripInput> = {}): CreateTripInput {
  return {
    id: 'trip-1',
    ownerId: 'utente-1',
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    departureAt: '2026-11-03T07:00:00.000Z',
    returnAt: null,
    hasCar: true,
    seatsOffered: 3,
    ...modifiche,
  };
}

function conRepo(repo: TripRepository, istante: string = ADESSO): CreateTripDeps {
  return { clock: unOrologio(istante), trips: repo };
}

/** Esegue createTrip e pretende un rifiuto, restituendone l'errore. */
async function rifiutata(
  input: CreateTripInput,
  opzioni: { istante?: string; config?: CreateTripConfig; repo?: RepoSpia } = {}
): Promise<{ error: CreateTripError; repo: RepoSpia }> {
  const repo = opzioni.repo ?? unRepoSpia();
  const r = await createTrip(input, conRepo(repo, opzioni.istante), opzioni.config ?? CONFIG);
  if (r.ok) throw new Error(`attesto un errore, ottenuta la trasferta ${r.value.id}`);
  return { error: r.error, repo };
}

describe('createTrip: casi validi', () => {
  it('con auto e 3 posti salva con seatsAvailable == 3', async () => {
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ seatsOffered: 3 }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
    expect(repo.salvate).toHaveLength(1);
    expect(repo.salvate[0]).toMatchObject({
      id: 'trip-1',
      hasCar: true,
      seatsTotal: 3,
      seatsAvailable: 3,
      status: 'published',
    });
    if (r.ok) expect(r.value).toBe(repo.salvate[0]);
  });

  it('senza auto salva con hasCar == false e nessun posto offerto', async () => {
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ hasCar: false, seatsOffered: 0 }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
    expect(repo.salvate).toHaveLength(1);
    expect(repo.salvate[0]).toMatchObject({ hasCar: false, seatsTotal: 0, seatsAvailable: 0 });
  });

  it('conserva i campi dell input senza alterarli', async () => {
    const repo = unRepoSpia();
    await createTrip(
      unInput({ ownerId: 'utente-9', fromPlantId: 'grottaglie', toPlantId: 'pomigliano', returnAt: '2026-11-03T17:00:00.000Z' }),
      conRepo(repo),
      CONFIG
    );

    expect(repo.salvate[0]).toMatchObject({
      ownerId: 'utente-9',
      fromPlantId: 'grottaglie',
      toPlantId: 'pomigliano',
      departureAt: '2026-11-03T07:00:00.000Z',
      returnAt: '2026-11-03T17:00:00.000Z',
    });
  });
});

describe('createTrip: plant', () => {
  it('partenza e destinazione uguali sono rifiutate con errore esplicito', async () => {
    const { error, repo } = await rifiutata(unInput({ fromPlantId: 'foggia', toPlantId: 'foggia' }));

    expect(error).toEqual({ kind: 'same-plant', plantId: 'foggia' });
    expect(repo.salvate).toHaveLength(0);
  });
});

describe('createTrip: posti con auto, confini', () => {
  it('0 posti e rifiutato', async () => {
    const { error, repo } = await rifiutata(unInput({ seatsOffered: 0 }));

    expect(error).toEqual({ kind: 'seats-out-of-range', seatsOffered: 0, min: 1, max: 8 });
    expect(repo.salvate).toHaveLength(0);
  });

  it('1 posto e accettato', async () => {
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ seatsOffered: 1 }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
    expect(repo.salvate[0]?.seatsAvailable).toBe(1);
  });

  it('8 posti e accettato', async () => {
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ seatsOffered: 8 }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
    expect(repo.salvate[0]?.seatsAvailable).toBe(8);
  });

  it('9 posti e rifiutato', async () => {
    const { error, repo } = await rifiutata(unInput({ seatsOffered: 9 }));

    expect(error).toEqual({ kind: 'seats-out-of-range', seatsOffered: 9, min: 1, max: 8 });
    expect(repo.salvate).toHaveLength(0);
  });

  it('un posto negativo con auto e rifiutato', async () => {
    const { error } = await rifiutata(unInput({ seatsOffered: -2 }));

    expect(error.kind).toBe('seats-out-of-range');
  });

  it('il massimo viene dalla config e non e fisso a 8', async () => {
    const stretta: CreateTripConfig = { maxSeatsOffered: 4 };

    const { error } = await rifiutata(unInput({ seatsOffered: 5 }), { config: stretta });
    expect(error).toEqual({ kind: 'seats-out-of-range', seatsOffered: 5, min: 1, max: 4 });

    const repo = unRepoSpia();
    const r = await createTrip(unInput({ seatsOffered: 4 }), conRepo(repo), stretta);
    expect(r.ok).toBe(true);
  });

  it('un numero di posti non intero e rifiutato', async () => {
    const { error } = await rifiutata(unInput({ seatsOffered: 2.5 }));

    expect(error).toEqual({ kind: 'seats-not-integer', seatsOffered: 2.5 });
  });
});

describe('createTrip: senza auto', () => {
  it('posti > 0 e un errore esplicito, non vengono azzerati', async () => {
    const { error, repo } = await rifiutata(unInput({ hasCar: false, seatsOffered: 2 }));

    expect(error).toEqual({
      kind: 'trip-invariant-violated',
      violation: { kind: 'seats-offered-without-car', seatsTotal: 2 },
    });
    expect(repo.salvate).toHaveLength(0);
  });

  it('un valore negativo e rifiutato dall invariante di Trip, non da una regola duplicata', async () => {
    const { error, repo } = await rifiutata(unInput({ hasCar: false, seatsOffered: -1 }));

    expect(error).toEqual({
      kind: 'trip-invariant-violated',
      violation: { kind: 'negative-seats', seatsTotal: -1, seatsAvailable: -1 },
    });
    expect(repo.salvate).toHaveLength(0);
  });
});

describe('createTrip: partenza nel passato (Clock iniettato)', () => {
  it('un millisecondo prima di adesso e rifiutata', async () => {
    const { error, repo } = await rifiutata(unInput({ departureAt: '2026-11-03T05:59:59.999Z' }));

    expect(error).toEqual({
      kind: 'departure-in-the-past',
      departureAt: '2026-11-03T05:59:59.999Z',
      now: ADESSO,
    });
    expect(repo.salvate).toHaveLength(0);
  });

  it('esattamente adesso NON e nel passato: accettata', async () => {
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ departureAt: ADESSO }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
    expect(repo.salvate).toHaveLength(1);
  });

  it('un millisecondo dopo adesso e accettata', async () => {
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ departureAt: '2026-11-03T06:00:00.001Z' }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
  });

  it('uguale ad adesso e accettata anche se uno dei due non ha i millisecondi', async () => {
    // Come stringhe "06:00:00.000Z" < "06:00:00Z" (la Z segue il punto): un
    // confronto lessicografico direbbe "nel passato" per due istanti uguali.
    const repo = unRepoSpia();
    const r = await createTrip(
      unInput({ departureAt: '2026-11-03T06:00:00.000Z' }),
      conRepo(repo, '2026-11-03T06:00:00Z'),
      CONFIG
    );

    expect(r.ok).toBe(true);
  });

  it('partenza senza millisecondi un millisecondo prima di adesso (Clock conforme) e rifiutata', async () => {
    // Entrambi i lati sono accettati dal confine: departureAt senza millisecondi
    // viene riportato a ".000Z", e now() con i millisecondi e' quanto promette Clock.
    // Come stringhe grezze "...00Z" > "...00.001Z" (la Z, 0x5A, segue il punto,
    // 0x2E), quindi un confronto sui grezzi la accetterebbe. Il test prova che la
    // normalizzazione avviene PRIMA del confronto, che e' poi quello di
    // compareUtcInstants su stringhe a larghezza fissa. L'errore riporta il grezzo.
    const { error, repo } = await rifiutata(unInput({ departureAt: '2026-11-03T07:00:00Z' }), {
      istante: '2026-11-03T07:00:00.001Z',
    });

    expect(error).toEqual({
      kind: 'departure-in-the-past',
      departureAt: '2026-11-03T07:00:00Z',
      now: '2026-11-03T07:00:00.001Z',
    });
    expect(repo.salvate).toHaveLength(0);
  });

  it('un giorno prima e rifiutata anche con orario successivo', async () => {
    const { error } = await rifiutata(unInput({ departureAt: '2026-11-02T23:00:00.000Z' }));

    expect(error.kind).toBe('departure-in-the-past');
  });

  it('segue il Clock: la stessa partenza e valida o no a seconda di adesso', async () => {
    const input = unInput({ departureAt: '2026-11-03T07:00:00.000Z' });

    const dopo = await rifiutata(input, { istante: '2026-11-03T07:00:00.001Z' });
    expect(dopo.error.kind).toBe('departure-in-the-past');

    const repo = unRepoSpia();
    const prima = await createTrip(input, conRepo(repo, '2026-11-03T06:59:59.999Z'), CONFIG);
    expect(prima.ok).toBe(true);
  });
});

describe('createTrip: rientro', () => {
  it('rientro precedente alla partenza e rifiutato', async () => {
    const { error, repo } = await rifiutata(
      unInput({ departureAt: '2026-11-03T07:00:00.000Z', returnAt: '2026-11-03T06:59:59.999Z' })
    );

    expect(error).toEqual({
      kind: 'return-before-departure',
      departureAt: '2026-11-03T07:00:00.000Z',
      returnAt: '2026-11-03T06:59:59.999Z',
    });
    expect(repo.salvate).toHaveLength(0);
  });

  it('rientro uguale alla partenza NON e precedente: accettato', async () => {
    const repo = unRepoSpia();
    const r = await createTrip(
      unInput({ departureAt: '2026-11-03T07:00:00.000Z', returnAt: '2026-11-03T07:00:00.000Z' }),
      conRepo(repo),
      CONFIG
    );

    expect(r.ok).toBe(true);
    expect(repo.salvate[0]?.returnAt).toBe('2026-11-03T07:00:00.000Z');
  });

  it('rientro successivo e accettato', async () => {
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ returnAt: '2026-11-03T17:00:00.000Z' }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
  });

  it('rientro null e accettato e resta null', async () => {
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ returnAt: null }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
    expect(repo.salvate[0]?.returnAt).toBeNull();
  });

  it('rientro in un giorno precedente e rifiutato', async () => {
    const { error } = await rifiutata(unInput({ returnAt: '2026-11-02T20:00:00.000Z' }));

    expect(error.kind).toBe('return-before-departure');
  });
});

describe('createTrip: l istante grezzo e normalizzato al confine, oppure rifiutato (mai convertito di fuso)', () => {
  it('una partenza con offset +01:00 e rifiutata', async () => {
    const { error, repo } = await rifiutata(unInput({ departureAt: '2026-11-03T07:00:00+01:00' }));

    expect(error).toEqual({ kind: 'invalid-departure-at', value: '2026-11-03T07:00:00+01:00' });
    expect(repo.salvate).toHaveLength(0);
  });

  it('una partenza con microsecondi e accettata e troncata al millisecondo', async () => {
    // Cambia aspettativa in T07f: era "rifiutata". PostgREST serializza al
    // microsecondo, e il dominio tronca invece di respingere quello che il DB produce.
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ departureAt: '2026-11-03T07:00:00.123456Z' }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
    expect(repo.salvate[0]?.departureAt).toBe('2026-11-03T07:00:00.123Z');
  });

  it('una partenza con +00:00 e accettata e riportata alla forma canonica', async () => {
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ departureAt: '2026-11-03T07:00:00+00:00' }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
    expect(repo.salvate[0]?.departureAt).toBe('2026-11-03T07:00:00.000Z');
  });

  it('una data di calendario impossibile e rifiutata con errore tipizzato, senza scrivere', async () => {
    const { error, repo } = await rifiutata(unInput({ departureAt: '2026-02-31T07:00:00.000Z' }));

    expect(error).toEqual({ kind: 'invalid-departure-at', value: '2026-02-31T07:00:00.000Z' });
    expect(repo.salvate).toHaveLength(0);
  });

  it('un rientro con offset e rifiutato', async () => {
    const { error } = await rifiutata(unInput({ returnAt: '2026-11-03T18:00:00+01:00' }));

    expect(error).toEqual({ kind: 'invalid-return-at', value: '2026-11-03T18:00:00+01:00' });
  });

  it('un rientro con microsecondi e accettato e troncato al millisecondo', async () => {
    // Cambia aspettativa in T07f: era "rifiutato". Stessa ragione della partenza.
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ returnAt: '2026-11-03T18:00:00.123456Z' }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
    expect(repo.salvate[0]?.returnAt).toBe('2026-11-03T18:00:00.123Z');
  });

  it('una partenza senza la Z e rifiutata', async () => {
    const { error } = await rifiutata(unInput({ departureAt: '2026-11-03T07:00:00' }));

    expect(error.kind).toBe('invalid-departure-at');
  });

  it('senza millisecondi ma con la Z e accettato e riportato a .000Z', async () => {
    // Cambia aspettativa in T07f: era "accettato e non riscritto". La forma
    // canonica e' una sola, a larghezza fissa: la forma corta non si salva.
    const repo = unRepoSpia();
    const r = await createTrip(unInput({ departureAt: '2026-11-03T07:00:00Z' }), conRepo(repo), CONFIG);

    expect(r.ok).toBe(true);
    expect(repo.salvate[0]?.departureAt).toBe('2026-11-03T07:00:00.000Z');
  });

  it('un istante non canonico da clock.now() e rifiutato', async () => {
    const { error, repo } = await rifiutata(unInput(), { istante: '2026-11-03T07:00:00+01:00' });

    expect(error).toEqual({ kind: 'invalid-clock-now', value: '2026-11-03T07:00:00+01:00' });
    expect(repo.salvate).toHaveLength(0);
  });
});

describe('createTrip: errori della configurazione e dello storage', () => {
  it.each([0, -1, 2.5, Number.NaN])('maxSeatsOffered = %p e una config invalida', async (maxSeatsOffered) => {
    const { error, repo } = await rifiutata(unInput(), { config: { maxSeatsOffered } });

    expect(error.kind).toBe('invalid-config');
    expect(repo.salvate).toHaveLength(0);
  });

  it('un errore del repository diventa storage-failed, con la causa originale', async () => {
    const guasto: RepositoryError = { kind: 'storage-unavailable', detail: 'rete giu' };
    const { error } = await rifiutata(unInput(), { repo: unRepoSpia(guasto) });

    expect(error).toEqual({ kind: 'storage-failed', cause: guasto });
  });
});

describe('createTrip: gli errori sono valori, non eccezioni', () => {
  it('ogni rifiuto risolve la promise con ok == false', async () => {
    const casi: readonly CreateTripInput[] = [
      unInput({ fromPlantId: 'foggia', toPlantId: 'foggia' }),
      unInput({ departureAt: '2026-11-03T05:00:00.000Z' }),
      unInput({ returnAt: '2026-11-03T06:30:00.000Z' }),
      unInput({ seatsOffered: 0 }),
      unInput({ seatsOffered: 9 }),
      unInput({ hasCar: false, seatsOffered: 1 }),
      unInput({ departureAt: 'domani' }),
    ];

    for (const caso of casi) {
      const r = await createTrip(caso, conRepo(unRepoSpia()), CONFIG);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(typeof r.error.kind).toBe('string');
    }
  });
});
