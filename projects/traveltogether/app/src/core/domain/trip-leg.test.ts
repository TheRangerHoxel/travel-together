// Identita' di tratta: direzione, rango, chiave canonica.

import { type LegDirection, type TripLeg, legDirectionRank, legKey, makeTripLeg } from './trip-leg';

describe('rango della direzione', () => {
  it('pinna il rango: outbound = 0, return = 1', () => {
    // Si asserisce il VALORE del rango e non il confronto fra stringhe: il test
    // deve restare rosso se qualcuno sostituisce il rango con l'ordine alfabetico
    // e rinomina `return` in `inbound`.
    expect(legDirectionRank('outbound')).toBe(0);
    expect(legDirectionRank('return')).toBe(1);
  });

  it('l andata precede il ritorno secondo il rango, non secondo l alfabeto', () => {
    const direzioni: readonly LegDirection[] = ['return', 'outbound'];
    const ordinate = [...direzioni].sort((a, b) => legDirectionRank(a) - legDirectionRank(b));

    expect(ordinate).toEqual(['outbound', 'return']);
  });
});

describe('legKey', () => {
  it('e deterministica', () => {
    expect(legKey('trip-1', 'outbound')).toBe(legKey('trip-1', 'outbound'));
  });

  it('le due direzioni dello stesso tripId danno chiavi diverse', () => {
    expect(legKey('trip-1', 'outbound')).not.toBe(legKey('trip-1', 'return'));
  });

  it('trasferte diverse danno chiavi diverse a parita di direzione', () => {
    expect(legKey('trip-1', 'return')).not.toBe(legKey('trip-2', 'return'));
  });

  it('PRECONDIZIONE: un tripId che contiene il separatore NON produce collisioni', () => {
    // Il brief si aspettava una collisione, ma con questo formato non esiste: la
    // direzione e' un suffisso di un insieme chiuso e le due parole non sono
    // suffisso una dell'altra, quindi il suffisso determina la direzione e il
    // resto il tripId. Il test pinna quella proprieta' (e fallirebbe se si
    // passasse a un formato ambiguo). A T08 gli id sono uuid: il caso e'
    // comunque irraggiungibile.
    const a = legKey('x|return', 'outbound'); // x|return|outbound
    const b = legKey('x', 'return'); // x|return
    const c = legKey('x|outbound', 'return'); // x|outbound|return
    const d = legKey('x', 'outbound'); // x|outbound

    expect(new Set([a, b, c, d]).size).toBe(4);
  });
});

function unaTratta(modifiche: Partial<TripLeg> = {}): TripLeg {
  return { tripId: 'trip-1', direction: 'outbound', seatsTotal: 3, seatsAvailable: 3, ...modifiche };
}

describe('makeTripLeg — posti', () => {
  it('accetta il confine alto: disponibili uguali ai totali', () => {
    expect(makeTripLeg(unaTratta({ seatsTotal: 3, seatsAvailable: 3 })).ok).toBe(true);
  });

  it('rifiuta disponibili = totali + 1', () => {
    const esito = makeTripLeg(unaTratta({ seatsTotal: 3, seatsAvailable: 4 }));

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.kind).toBe('seats-available-exceeds-total');
    }
  });

  it('accetta il confine basso: zero posti disponibili (tratta al completo)', () => {
    expect(makeTripLeg(unaTratta({ seatsAvailable: 0 })).ok).toBe(true);
  });

  it('rifiuta -1 posti disponibili', () => {
    const esito = makeTripLeg(unaTratta({ seatsAvailable: -1 }));

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.kind).toBe('negative-seats');
    }
  });

  it('rifiuta posti non interi', () => {
    const esito = makeTripLeg(unaTratta({ seatsAvailable: 1.5 }));

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.kind).toBe('non-integer-seats');
    }
  });
});