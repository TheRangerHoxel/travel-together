// L'aritmetica di calendario, provata sui casi che la rompono: fine mese, anno
// bisestile, cambio d'anno. Il centro di un mese lo azzecca anche un'implementazione
// sbagliata.

import { civilDayNumber, inclusiveDaysBetween } from './calendar';

describe('civilDayNumber — ancore note', () => {
  it('l epoca vale zero', () => {
    expect(civilDayNumber('1970-01-01')).toBe(0);
  });

  it('2000-01-01 e il giorno 10957, e 2000-03-01 viene 60 giorni dopo (2000 e bisestile)', () => {
    expect(civilDayNumber('2000-01-01')).toBe(10_957);
    expect(civilDayNumber('2000-03-01')).toBe(11_017);
  });

  it('le date precedenti l epoca sono negative', () => {
    expect(civilDayNumber('1969-12-31')).toBe(-1);
  });
});

describe('civilDayNumber — date impossibili', () => {
  it.each([
    ['2026-02-31', 'febbraio non ha 31 giorni'],
    ['2026-02-29', '2026 non e bisestile'],
    ['2027-02-29', '2027 non e bisestile'],
    ['2100-02-29', 'i secoli non multipli di 400 non sono bisestili'],
    ['2026-04-31', 'aprile ha 30 giorni'],
    ['2026-00-10', 'mese zero'],
    ['2026-13-10', 'mese tredici'],
    ['2026-11-00', 'giorno zero'],
    ['2026-11-3', 'forma non canonica'],
    ['2026-11-03T00:00:00Z', 'un istante non e una data'],
    ['', 'stringa vuota'],
  ])('%s -> null (%s)', (valore) => {
    expect(civilDayNumber(valore)).toBeNull();
  });

  it('accetta il 29 febbraio solo negli anni bisestili', () => {
    expect(civilDayNumber('2028-02-29')).not.toBeNull();
    expect(civilDayNumber('2000-02-29')).not.toBeNull();
    expect(civilDayNumber('2027-02-29')).toBeNull();
  });
});

describe('civilDayNumber — giorni consecutivi', () => {
  it('fine mese: il 30 aprile precede il 1 maggio di un giorno', () => {
    const aprile = civilDayNumber('2026-04-30');
    const maggio = civilDayNumber('2026-05-01');
    expect(aprile).not.toBeNull();
    expect(maggio).toBe((aprile ?? 0) + 1);
  });

  it('anno bisestile: 28 feb, 29 feb e 1 marzo sono consecutivi nel 2028', () => {
    const f28 = civilDayNumber('2028-02-28');
    const f29 = civilDayNumber('2028-02-29');
    const m01 = civilDayNumber('2028-03-01');
    expect(f29).toBe((f28 ?? 0) + 1);
    expect(m01).toBe((f29 ?? 0) + 1);
  });

  it('anno non bisestile: dal 28 febbraio il giorno dopo e il 1 marzo', () => {
    const f28 = civilDayNumber('2027-02-28');
    expect(civilDayNumber('2027-03-01')).toBe((f28 ?? 0) + 1);
  });

  it('cambio d anno: il 31 dicembre precede il 1 gennaio di un giorno', () => {
    const dicembre = civilDayNumber('2026-12-31');
    expect(civilDayNumber('2027-01-01')).toBe((dicembre ?? 0) + 1);
  });

  it('un anno bisestile ha 366 giorni e uno normale 365', () => {
    expect((civilDayNumber('2029-01-01') ?? 0) - (civilDayNumber('2028-01-01') ?? 0)).toBe(366);
    expect((civilDayNumber('2028-01-01') ?? 0) - (civilDayNumber('2027-01-01') ?? 0)).toBe(365);
  });
});

describe('inclusiveDaysBetween', () => {
  it('dal 3 al 5 novembre sono 3 giorni, estremi inclusi', () => {
    expect(inclusiveDaysBetween('2026-11-03', '2026-11-05')).toBe(3);
  });

  it('lo stesso giorno e 1 giorno', () => {
    expect(inclusiveDaysBetween('2026-11-03', '2026-11-03')).toBe(1);
  });

  it('due giorni consecutivi sono 2', () => {
    expect(inclusiveDaysBetween('2026-11-03', '2026-11-04')).toBe(2);
  });

  it('attraversa la fine del mese', () => {
    expect(inclusiveDaysBetween('2026-10-30', '2026-11-02')).toBe(4);
  });

  it('attraversa il cambio d anno', () => {
    expect(inclusiveDaysBetween('2026-12-31', '2027-01-01')).toBe(2);
  });

  it('attraversa il 29 febbraio bisestile: 28 feb - 1 mar sono 3 giorni nel 2028, 2 nel 2027', () => {
    expect(inclusiveDaysBetween('2028-02-28', '2028-03-01')).toBe(3);
    expect(inclusiveDaysBetween('2027-02-28', '2027-03-01')).toBe(2);
  });

  it('un anno intero bisestile ha 366 giorni', () => {
    expect(inclusiveDaysBetween('2028-01-01', '2028-12-31')).toBe(366);
  });

  it('null se un estremo e impossibile', () => {
    expect(inclusiveDaysBetween('2026-02-31', '2026-03-05')).toBeNull();
    expect(inclusiveDaysBetween('2026-03-01', '2027-02-29')).toBeNull();
  });

  it('null se l intervallo e rovesciato', () => {
    expect(inclusiveDaysBetween('2026-11-05', '2026-11-03')).toBeNull();
  });
});
