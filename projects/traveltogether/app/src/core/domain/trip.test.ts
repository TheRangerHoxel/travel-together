// Invarianti di Trip. Si testano i CONFINI, non solo il centro:
// il caso interessante non e' "3 posti su 5", e' "5 su 5" contro "6 su 5".

import { type Trip, makeTrip } from './trip';

/** Base valida. Ogni test cambia solo il campo che sta mettendo alla prova. */
function trasfertaValida(modifiche: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    ownerId: 'profile-1',
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    // Forma canonica UTC con la Z, come prescrive il contratto di Trip.
    // Prima di T03 erano scritti con offset `+01:00`: nessuna asserzione di questo
    // file dipende dai due valori, quindi la cosa non rompeva niente qui — ma era
    // la base da cui T04 avrebbe copiato, e il confronto lessicografico fra un
    // offset e una Z da' risposte sbagliate e plausibili.
    departureAt: '2026-11-03T06:30:00.000Z',
    returnAt: '2026-11-05T16:00:00.000Z',
    hasCar: true,
    seatsTotal: 3,
    seatsAvailable: 3,
    status: 'published',
    ...modifiche,
  };
}

describe('makeTrip — posti disponibili e posti totali', () => {
  it('rifiuta una trasferta con piu posti disponibili che totali', () => {
    const esito = makeTrip(trasfertaValida({ seatsTotal: 3, seatsAvailable: 4 }));

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.kind).toBe('seats-available-exceeds-total');
    }
  });

  it('accetta il confine: disponibili esattamente uguali ai totali', () => {
    const esito = makeTrip(trasfertaValida({ seatsTotal: 3, seatsAvailable: 3 }));

    expect(esito.ok).toBe(true);
  });

  it('accetta zero posti disponibili su una trasferta al completo', () => {
    const esito = makeTrip(trasfertaValida({ seatsTotal: 3, seatsAvailable: 0 }));

    expect(esito.ok).toBe(true);
  });

  it('rifiuta posti negativi', () => {
    const esito = makeTrip(trasfertaValida({ seatsTotal: 3, seatsAvailable: -1 }));

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.kind).toBe('negative-seats');
    }
  });
});

describe('makeTrip — auto e posti offerti', () => {
  it('rifiuta una trasferta senza auto che offre posti', () => {
    const esito = makeTrip(
      trasfertaValida({ hasCar: false, seatsTotal: 3, seatsAvailable: 3 })
    );

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.kind).toBe('seats-offered-without-car');
    }
  });

  it('accetta una trasferta senza auto e senza posti: e chi cerca un passaggio', () => {
    const esito = makeTrip(
      trasfertaValida({ hasCar: false, seatsTotal: 0, seatsAvailable: 0 })
    );

    expect(esito.ok).toBe(true);
  });
});

describe('makeTrip — purezza', () => {
  // Il confronto e' con una copia scattata PRIMA della chiamata, non con
  // l'oggetto passato: makeTrip oggi restituisce la stessa reference, quindi
  // confrontare value con campi sarebbe confrontare un oggetto con se stesso.
  // Passerebbe anche se makeTrip mutasse i campi, cioe' proprio il caso che
  // questo test deve escludere.
  it('non muta l oggetto ricevuto in ingresso', () => {
    const campi = trasfertaValida();
    const primaDellaChiamata: Trip = { ...campi };

    makeTrip(campi);

    expect(campi).toEqual(primaDellaChiamata);
  });
});
