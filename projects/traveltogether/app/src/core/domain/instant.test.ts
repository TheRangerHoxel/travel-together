// Il parser degli istanti. E' il pezzo su cui poggia tutto T03: se accetta una
// forma che non dovrebbe, il motore di matching da' risposte plausibili e sbagliate.

import { parseUtcInstant } from './instant';

describe('parseUtcInstant — forme accettate', () => {
  it('legge la forma canonica con i millisecondi', () => {
    expect(parseUtcInstant('2026-11-03T06:30:00.000Z')).toEqual({
      date: '2026-11-03',
      millisOfDay: 23_400_000,
    });
  });

  it('accetta i millisecondi assenti', () => {
    // Un istante scritto a mano (seed di T17, fixture) spesso non li ha.
    // Una regex che li pretendesse respingerebbe dati legittimi.
    expect(parseUtcInstant('2026-11-03T06:30:00Z')).toEqual({
      date: '2026-11-03',
      millisOfDay: 23_400_000,
    });
  });

  it('legge la mezzanotte come zero, non come assenza di valore', () => {
    // Il caso che rompe le implementazioni che scrivono `if (!millisOfDay)`.
    expect(parseUtcInstant('2026-11-03T00:00:00.000Z')).toEqual({
      date: '2026-11-03',
      millisOfDay: 0,
    });
  });

  it('legge l ultimo millisecondo del giorno', () => {
    expect(parseUtcInstant('2026-11-03T23:59:59.999Z')).toEqual({
      date: '2026-11-03',
      millisOfDay: 86_399_999,
    });
  });
});

describe('parseUtcInstant — forme rifiutate', () => {
  it('rifiuta un offset al posto della Z', () => {
    // IL caso che conta. '+01:00' e 'Z' possono indicare lo stesso istante con
    // stringhe diverse: accettarli entrambi significa confrontare mele e pere
    // ottenendo un risultato che sembra giusto. E' quello che in T02 "funzionava
    // per caso", perche' tutte le fixture usavano lo stesso offset.
    expect(parseUtcInstant('2026-11-03T07:30:00+01:00')).toBeNull();
    expect(parseUtcInstant('2026-11-03T05:30:00-01:00')).toBeNull();
  });

  it('rifiuta un istante senza fuso', () => {
    expect(parseUtcInstant('2026-11-03T06:30:00')).toBeNull();
  });

  it('rifiuta mese, giorno e ora fuori intervallo', () => {
    // Una regex senza controllo di intervallo li farebbe passare tutti.
    expect(parseUtcInstant('2026-13-03T06:00:00Z')).toBeNull();
    expect(parseUtcInstant('2026-00-03T06:00:00Z')).toBeNull();
    expect(parseUtcInstant('2026-11-32T06:00:00Z')).toBeNull();
    expect(parseUtcInstant('2026-11-00T06:00:00Z')).toBeNull();
    expect(parseUtcInstant('2026-11-03T25:00:00Z')).toBeNull();
    expect(parseUtcInstant('2026-11-03T06:60:00Z')).toBeNull();
    expect(parseUtcInstant('2026-11-03T06:00:60Z')).toBeNull();
  });

  it('rifiuta stringhe che non sono istanti', () => {
    expect(parseUtcInstant('')).toBeNull();
    expect(parseUtcInstant('domani')).toBeNull();
    expect(parseUtcInstant('2026-11-03')).toBeNull();
    expect(parseUtcInstant('2026-11-03 06:30:00Z')).toBeNull();
  });
});
