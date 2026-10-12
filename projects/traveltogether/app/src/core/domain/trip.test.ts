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
    departureAt: '2026-11-03T07:30:00+01:00',
    returnAt: '2026-11-05T17:00:00+01:00',
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
