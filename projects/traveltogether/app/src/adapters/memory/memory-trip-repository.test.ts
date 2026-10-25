// Test specifici dell'adapter memory: i rami che la suite di contratto NON
// puo' coprire, perche' su Supabase sono irraggiungibili (record invalidi in
// lettura singola e nelle liste di trasferte e tratte, offerta senza profilo).
//
// La suite condivisa e' il minimo comune fra gli adapter, non il massimo. Questi
// casi richiedono di mettere lo storage in uno stato che su Postgres sara'
// impedito dai vincoli (foreign key, CHECK constraint di T08). Un test condiviso
// non potrebbe nemmeno costruirli — ma in RAM quei rami esistono, e un ramo di
// codice che nessun test tocca e' un ramo di cui non sappiamo nulla.

import type { Trip } from '../../core/domain';
import { utc } from '../../core/domain/instant-fixture';
import { MemoryProfileRepository } from './memory-profile-repository';
import { MemoryTripRepository } from './memory-trip-repository';

function unaTrasferta(modifiche: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-base',
    ownerId: 'owner-con-profilo',
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    departureAt: utc('2026-11-03T06:30:00.000Z'),
    returnAt: utc('2026-11-05T16:00:00.000Z'),
    hasCar: true,
    seatsTotal: 3,
    seatsAvailable: 3,
    status: 'published',
    ...modifiche,
  };
}

describe('listOpenOffers quando il profilo di chi offre non esiste', () => {
  it('omette quell offerta e restituisce comunque le altre', async () => {
    // Il degrado deve essere proporzionato: una riga incoerente costa un'offerta,
    // non l'intera schermata di matching. In una demo dal vivo e' la differenza
    // fra il pitch che prosegue e una schermata vuota.
    const profiles = new MemoryProfileRepository();
    profiles.semina({
      id: 'owner-con-profilo',
      displayName: 'Collega Fittizio',
      plantId: 'grottaglie',
    });

    const trips = new MemoryTripRepository(profiles);

    // Si pretende che il setup sia riuscito, come nella suite condivisa: un test
    // che asserisce su una lista non deve poter passare perche' la scrittura e'
    // fallita e la lista e' vuota per il motivo sbagliato.
    const sana = await trips.save(unaTrasferta({ id: 'trip-sana', ownerId: 'owner-con-profilo' }));
    const orfana = await trips.save(
      unaTrasferta({ id: 'trip-orfana', ownerId: 'owner-senza-profilo' })
    );
    expect(sana.ok).toBe(true);
    expect(orfana.ok).toBe(true);

    const esito = await trips.listOpenOffers();

    expect(esito.ok).toBe(true);
    if (esito.ok) {
      // Cambiata in T04b: la fixture ha il rientro, quindi la trasferta sana
      // produce DUE offerte (andata e ritorno) con lo stesso tripId. L'intento
      // del test resta: l'orfana non compare e la sana si.
      expect(esito.value.map((o) => o.tripId)).toEqual(['trip-sana', 'trip-sana']);
      expect(esito.value[0]?.ownerPlantId).toBe('grottaglie');
    }
  });
});

// Le liste omettono le righe che il dominio rifiuta (`makeTrip`, `makeTripLeg`). Sta
// qui e non nella suite di contratto perche' su Postgres i CHECK di T08 impediscono
// di costruire queste righe: e' il precedente dichiarato in testa a questo file.
// Ogni test ha accanto una riga sana, seminata allo stesso modo, che resta in lista:
// senza, una lista che omette TUTTO passerebbe lo stesso.
describe('le liste omettono le righe che il dominio rifiuta', () => {
  function adapterConProfilo(): MemoryTripRepository {
    const profiles = new MemoryProfileRepository();
    profiles.semina({
      id: 'owner-con-profilo',
      displayName: 'Collega Fittizio',
      plantId: 'grottaglie',
    });
    return new MemoryTripRepository(profiles);
  }

  /** `tripId/direction` di ogni offerta, ordinate: il confronto non dipende dall'ordine. */
  async function coppieOfferte(trips: MemoryTripRepository): Promise<string[]> {
    const esito = await trips.listOpenOffers();
    expect(esito.ok).toBe(true);
    return esito.ok ? esito.value.map((o) => `${o.tripId}/${o.direction}`).sort() : [];
  }

  it('listOpenOffers: una tratta 2/5 sotto una trasferta valida non diventa un offerta con cinque posti', async () => {
    const trips = adapterConProfilo();
    expect((await trips.save(unaTrasferta({ id: 'trip-rotta' }))).ok).toBe(true);
    expect((await trips.save(unaTrasferta({ id: 'trip-sana' }))).ok).toBe(true);
    // La tratta d'andata viene riscritta invalida, sotto una trasferta che resta valida.
    trips.seminaTrattaGrezza({
      tripId: 'trip-rotta',
      direction: 'outbound',
      seatsTotal: 2,
      seatsAvailable: 5,
    });

    // Resta il ritorno di 'trip-rotta' (valido) e le due tratte di 'trip-sana'.
    expect(await coppieOfferte(trips)).toEqual([
      'trip-rotta/return',
      'trip-sana/outbound',
      'trip-sana/return',
    ]);
  });

  it('listOpenOffers: una trasferta riscritta invalida sopra tratte valide non produce offerte', async () => {
    const trips = adapterConProfilo();
    expect((await trips.save(unaTrasferta({ id: 'trip-rotta' }))).ok).toBe(true);
    expect((await trips.save(unaTrasferta({ id: 'trip-sana' }))).ok).toBe(true);
    // Le tratte di 'trip-rotta' (3/3) restano valide: a essere invalida e' la trasferta.
    trips.seminaGrezzo(unaTrasferta({ id: 'trip-rotta', seatsTotal: 2, seatsAvailable: 5 }));

    expect(await coppieOfferte(trips)).toEqual(['trip-sana/outbound', 'trip-sana/return']);
  });

  it('listByOwner omette la trasferta invalida e restituisce la sana', async () => {
    const trips = adapterConProfilo();
    trips.seminaGrezzo(unaTrasferta({ id: 'trip-rotta', seatsTotal: 2, seatsAvailable: 5 }));
    trips.seminaGrezzo(unaTrasferta({ id: 'trip-sana' }));

    const esito = await trips.listByOwner('owner-con-profilo');

    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.value.map((t) => t.id)).toEqual(['trip-sana']);
    }
  });
});

describe('findById quando lo storage contiene gia un record invalido', () => {
  it('ritorna invalid-record invece di far circolare un Trip malformato', async () => {
    // seminaGrezzo scrive senza validare: riproduce lo stato prodotto da una
    // migrazione mal fatta o da una query eseguita a mano, che e' l'unico modo in
    // cui un record invalido si presenta davvero una volta che save valida.
    const profiles = new MemoryProfileRepository();
    const trips = new MemoryTripRepository(profiles);

    trips.seminaGrezzo(unaTrasferta({ id: 'trip-rotta', seatsTotal: 2, seatsAvailable: 5 }));

    const esito = await trips.findById('trip-rotta');

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.kind).toBe('invalid-record');
    }
  });

  it('un record sano seminato allo stesso modo si rilegge senza errori', async () => {
    // Il controllo che rende falsificabile il test precedente: senza, un findById
    // che ritornasse SEMPRE invalid-record passerebbe lo stesso.
    const profiles = new MemoryProfileRepository();
    const trips = new MemoryTripRepository(profiles);

    trips.seminaGrezzo(unaTrasferta({ id: 'trip-sana' }));

    const esito = await trips.findById('trip-sana');

    expect(esito.ok).toBe(true);
  });
});

describe('findLeg quando lo storage contiene gia una tratta invalida', () => {
  it('ritorna invalid-record invece di far circolare una tratta malformata', async () => {
    const trips = new MemoryTripRepository(new MemoryProfileRepository());

    trips.seminaTrattaGrezza({
      tripId: 'trip-rotta',
      direction: 'outbound',
      seatsTotal: 3,
      seatsAvailable: 7,
    });

    const esito = await trips.findLeg('trip-rotta', 'outbound');

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.kind).toBe('invalid-record');
    }
  });

  it('una tratta sana seminata allo stesso modo si rilegge senza errori', async () => {
    const trips = new MemoryTripRepository(new MemoryProfileRepository());

    trips.seminaTrattaGrezza({
      tripId: 'trip-sana',
      direction: 'outbound',
      seatsTotal: 3,
      seatsAvailable: 3,
    });

    expect((await trips.findLeg('trip-sana', 'outbound')).ok).toBe(true);
  });
});