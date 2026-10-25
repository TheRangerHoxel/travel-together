// Il parser degli istanti. E' il pezzo su cui poggia tutto il matching: se accetta una
// forma che non dovrebbe, il motore da' risposte plausibili e sbagliate.

import type { SeatOffer } from './seat-offer';
import type { Trip } from './trip';
import type { TripRequest } from './trip-request';
import {
  type UtcInstant,
  compareUtcInstants,
  normalizeUtcInstant,
  utcInstantParts,
} from './instant';

// Le stringhe sono LETTERALI: sono il formato di un sistema esterno (PostgREST),
// non un dettaglio di gusto, e un test che le costruisse dal codice sotto prova
// non proverebbe niente.
//
// T07f ha eliminato il parser di T03 (che rifiutava tutto cio' che non era canonico) e con lui i suoi test: ogni caso che
// pinnavano — la forma canonica, i millisecondi assenti, mezzanotte e ultimo
// millisecondo, +01:00 / -01:00 rifiutati, senza fuso, mese/giorno/ora fuori
// intervallo, stringhe che non sono istanti — e' qui sotto, contro il parser nuovo.

function normalizzato(raw: string): string | undefined {
  const r = normalizeUtcInstant(raw);
  return r.ok ? r.value : undefined;
}

describe('normalizeUtcInstant — forme accettate e riportate', () => {
  const tabella: readonly (readonly [string, string])[] = [
    ['2026-11-03T06:30:00Z', '2026-11-03T06:30:00.000Z'],
    ['2026-11-03T06:30:00+00:00', '2026-11-03T06:30:00.000Z'],
    ['2026-11-03T06:30:00.12+00:00', '2026-11-03T06:30:00.120Z'],
    ['2026-11-03T06:30:00.5Z', '2026-11-03T06:30:00.500Z'],
    ['2026-11-03T06:30:00.123999+00:00', '2026-11-03T06:30:00.123Z'],
    ['2026-11-03T23:59:59.999999+00:00', '2026-11-03T23:59:59.999Z'],
    ['2026-11-03T06:30:00.123Z', '2026-11-03T06:30:00.123Z'],
    ['2026-11-03T06:30:00.000001+00:00', '2026-11-03T06:30:00.000Z'],
    ['2028-02-29T10:00:00Z', '2028-02-29T10:00:00.000Z'],
    ['2000-02-29T10:00:00Z', '2000-02-29T10:00:00.000Z'],
  ];

  it.each(tabella)('%s -> %s', (grezzo, atteso) => {
    expect(normalizzato(grezzo)).toBe(atteso);
  });

  it('i microsecondi oltre il millisecondo sono troncati, non arrotondati: il giorno non cambia', () => {
    // Arrotondando, 23:59:59.999999 porterebbe il riporto sul giorno dopo.
    const r = normalizeUtcInstant('2026-11-03T23:59:59.999999+00:00');
    expect(r.ok && utcInstantParts(r.value).date).toBe('2026-11-03');
  });

  it('la coppia che oggi ordina al contrario produce la STESSA stringa', () => {
    expect(normalizzato('2026-11-03T06:00:00Z')).toBe(normalizzato('2026-11-03T06:00:00.000Z'));
  });

  it('ogni uscita ha la forma a larghezza fissa, 24 caratteri', () => {
    for (const [grezzo] of tabella) {
      const uscita = normalizzato(grezzo);
      expect(uscita).toBeDefined();
      expect(uscita).toHaveLength(24);
      expect(uscita).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });

  it('e idempotente: una forma canonica e un punto fisso', () => {
    for (const [, canonico] of tabella) {
      expect(normalizzato(canonico)).toBe(canonico);
    }
  });
});

describe('normalizeUtcInstant — forme rifiutate', () => {
  it.each([
    '2026-11-03T07:30:00+01:00',
    '2026-11-03T05:30:00-01:00',
    '2026-11-03T06:30:00-00:00',
  ])('%s -> non-utc-offset, con il valore grezzo', (grezzo) => {
    expect(normalizeUtcInstant(grezzo)).toEqual({
      ok: false,
      error: { kind: 'non-utc-offset', value: grezzo },
    });
  });

  it.each([
    ['sette decimali', '2026-11-03T06:30:00.1234567Z'],
    ['senza fuso', '2026-11-03T06:30:00'],
    ['spazio al posto di T', '2026-11-03 06:30:00Z'],
    ['z minuscola', '2026-11-03T06:30:00z'],
    ['offset senza due punti', '2026-11-03T06:30:00+0000'],
    ['offset solo ore', '2026-11-03T06:30:00+00'],
    ['ora 24', '2026-11-03T24:00:00Z'],
    ['minuti 60', '2026-11-03T06:60:00Z'],
    ['secondi 60', '2026-11-03T06:00:60Z'],
    ['mese 13', '2026-13-03T06:00:00Z'],
    ['mese 00', '2026-00-03T06:00:00Z'],
    ['giorno 32', '2026-11-32T06:00:00Z'],
    ['giorno 00', '2026-11-00T06:00:00Z'],
    ['stringa vuota', ''],
    ['testo', 'domani'],
    ['solo data', '2026-11-03'],
  ])('%s -> malformed-instant', (_nome, grezzo) => {
    expect(normalizeUtcInstant(grezzo)).toEqual({
      ok: false,
      error: { kind: 'malformed-instant', value: grezzo },
    });
  });

  it.each([
    '2026-02-31T06:00:00Z',
    '2026-02-29T06:00:00Z',
    '2027-02-29T06:00:00Z',
    '2100-02-29T06:00:00Z',
    '2026-04-31T06:00:00Z',
  ])('%s -> impossible-date', (grezzo) => {
    expect(normalizeUtcInstant(grezzo)).toEqual({
      ok: false,
      error: { kind: 'impossible-date', value: grezzo },
    });
  });
});

describe('ordine: lessicografico = cronologico', () => {
  // In ordine cronologico noto, scritti nelle forme piu' diverse. Include la coppia
  // 'Z' / '.000Z' e due istanti a un millisecondo di distanza.
  const cronologici = [
    '2026-11-02T23:59:59.999999+00:00',
    '2026-11-03T06:00:00Z',
    '2026-11-03T06:00:00.001Z',
    '2026-11-03T06:00:00.5Z',
    '2026-11-03T06:00:01+00:00',
    '2026-11-03T06:30:00.12+00:00',
    '2026-11-03T23:59:59.999Z',
    '2026-11-04T00:00:00+00:00',
    '2027-01-01T00:00:00Z',
  ];

  it('normalizzati e ordinati come stringhe restano in quell ordine', () => {
    const normalizzati = cronologici.map((g) => normalizzato(g));
    // Un rifiuto del parser darebbe undefined: non deve passare in silenzio dopo il sort.
    expect(normalizzati).not.toContain(undefined);
    expect([...normalizzati].sort()).toEqual(normalizzati);
  });

  it('compareUtcInstants concorda con l ordine noto, a coppie', () => {
    const istanti = cronologici.map((g) => {
      const r = normalizeUtcInstant(g);
      if (!r.ok) throw new Error(`fixture invalida: ${g}`);
      return r.value;
    });
    for (let i = 0; i < istanti.length; i++) {
      for (let j = 0; j < istanti.length; j++) {
        const a = istanti[i];
        const b = istanti[j];
        if (a === undefined || b === undefined) throw new Error('indice fuori tabella');
        expect(Math.sign(compareUtcInstants(a, b))).toBe(Math.sign(i - j));
      }
    }
  });

  it('compareUtcInstants: la coppia Z / .000Z e uguale', () => {
    const a = normalizeUtcInstant('2026-11-03T06:00:00Z');
    const b = normalizeUtcInstant('2026-11-03T06:00:00.000Z');
    if (!a.ok || !b.ok) throw new Error('fixture invalida');
    expect(compareUtcInstants(a.value, b.value)).toBe(0);
  });
});

describe('utcInstantParts — totale sul tipo brandizzato', () => {
  function parti(raw: string) {
    const r = normalizeUtcInstant(raw);
    if (!r.ok) throw new Error(`fixture invalida: ${raw}`);
    return utcInstantParts(r.value);
  }

  it('legge data e millisecondi nel giorno', () => {
    expect(parti('2026-11-03T06:30:00.000Z')).toEqual({ date: '2026-11-03', millisOfDay: 23_400_000 });
  });

  it('legge la mezzanotte come zero, non come assenza di valore', () => {
    expect(parti('2026-11-03T00:00:00.000Z')).toEqual({ date: '2026-11-03', millisOfDay: 0 });
  });

  it('legge l ultimo millisecondo del giorno', () => {
    expect(parti('2026-11-03T23:59:59.999Z')).toEqual({ date: '2026-11-03', millisOfDay: 86_399_999 });
  });

  it('legge i millisecondi riportati da una forma corta', () => {
    expect(parti('2026-11-03T06:30:00.12+00:00').millisOfDay).toBe(23_400_120);
  });
});

describe('UtcInstant — il compilatore distingue il tipo da string', () => {
  // Un test a runtime non vede un tipo. Queste costanti sono valutate da `typecheck`:
  // se `string` diventasse assegnabile a `UtcInstant`, `NonAssegnabile` varrebbe
  // `never` e `true` non sarebbe piu' assegnabile — il file non compilerebbe.
  type NonAssegnabile<Da, A> = [Da] extends [A] ? never : true;

  const stringaNonAssegnabileAlTipo: NonAssegnabile<string, UtcInstant> = true;

  // I campi d'istante delle tre entita': se uno tornasse `string`, `string` sarebbe
  // assegnabile al campo e la costante non compilerebbe.
  const tripDepartureAt: NonAssegnabile<string, Trip['departureAt']> = true;
  const tripReturnAt: NonAssegnabile<string, NonNullable<Trip['returnAt']>> = true;
  const offerDepartureAt: NonAssegnabile<string, SeatOffer['departureAt']> = true;
  const requestDepartureAt: NonAssegnabile<string, TripRequest['departureAt']> = true;

  it('string non e assegnabile a UtcInstant (verificato da typecheck)', () => {
    expect(stringaNonAssegnabileAlTipo).toBe(true);
  });

  it('string non e assegnabile ai campi d istante di Trip, SeatOffer e TripRequest (verificato da typecheck)', () => {
    expect([tripDepartureAt, tripReturnAt, offerDepartureAt, requestDepartureAt]).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
});
