// Clock iniettabile: il tempo e' un parametro, non un fatto dell'ambiente.

import type { Clock } from '../../core/ports';
import { FixedClock } from './fixed-clock';

/**
 * Sta in piedi al posto degli usecase che arriveranno (T04 in avanti): tutto cio'
 * che conta e' che dipenda dal port e non dall'orologio di sistema.
 */
function partenzaGiaPassata(departureAt: string, clock: Clock): boolean {
  return departureAt < clock.now();
}

describe('FixedClock', () => {
  it('ritorna sempre lo stesso istante, lettura dopo lettura', () => {
    const clock = new FixedClock('2026-11-01T07:00:00.000Z');

    expect(clock.now()).toBe('2026-11-01T07:00:00.000Z');
  });

  it('si sposta solo quando glielo si dice', () => {
    const clock = new FixedClock('2026-11-01T07:00:00.000Z');

    clock.set('2026-11-10T07:00:00.000Z');

    expect(clock.now()).toBe('2026-11-10T07:00:00.000Z');
  });
});

describe('iniezione del Clock in chi lo consuma', () => {
  // E' questo che il criterio di T02 chiede di dimostrare: la stessa domanda sugli
  // stessi dati da' esiti opposti a seconda dell'orologio iniettato. Con Date.now()
  // l'esito dipenderebbe da quando gira la suite, e il test andrebbe riscritto ogni anno.
  // Tutti gli istanti sono in UTC normalizzato a larghezza fissa, come prescrive
  // il doc di Clock: il confronto lessicografico qui sotto coincide con quello
  // cronologico solo cosi', e mescolare forme diverse (`+01:00`, o `Z` senza
  // millisecondi) darebbe la risposta sbagliata.
  const partenza = '2026-11-05T06:30:00.000Z';

  it('con un orologio fermo PRIMA della partenza, la partenza e futura', () => {
    const clock = new FixedClock('2026-11-01T07:00:00.000Z');

    expect(partenzaGiaPassata(partenza, clock)).toBe(false);
  });

  it('con un orologio fermo DOPO la partenza, la partenza e passata', () => {
    const clock = new FixedClock('2026-11-10T07:00:00.000Z');

    expect(partenzaGiaPassata(partenza, clock)).toBe(true);
  });

  it('spostando l orologio oltre la partenza, l esito si ribalta', () => {
    const clock = new FixedClock('2026-11-01T07:00:00.000Z');
    expect(partenzaGiaPassata(partenza, clock)).toBe(false);

    clock.set('2026-11-10T07:00:00.000Z');

    expect(partenzaGiaPassata(partenza, clock)).toBe(true);
  });
});
