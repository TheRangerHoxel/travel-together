import type { PersonalBests } from './personal-bests';
import { raisePersonalBests, zeroPersonalBests } from './personal-bests';

function bests(
  sharedTrips: number,
  sharedLegs: number,
  transportedColleagues: number,
  sharedKm: number,
  profileId = 'p1'
): PersonalBests {
  return { profileId, sharedTrips, sharedLegs, transportedColleagues, sharedKm };
}

describe('zeroPersonalBests', () => {
  it('ha tutte le metriche a zero e il profilo dato', () => {
    expect(zeroPersonalBests('p9')).toEqual(bests(0, 0, 0, 0, 'p9'));
  });
});

describe('raisePersonalBests', () => {
  it('un candidato piu basso su ogni campo lascia il memorizzato', () => {
    // Uccide: confronto rimosso (candidato vince sempre) e Math.max -> Math.min.
    const risultato = raisePersonalBests(bests(5, 6, 7, 800), bests(1, 2, 3, 100));

    expect(risultato).toEqual(bests(5, 6, 7, 800));
  });

  it('un candidato piu alto su ogni campo sale', () => {
    const risultato = raisePersonalBests(bests(1, 2, 3, 100), bests(5, 6, 7, 800));

    expect(risultato).toEqual(bests(5, 6, 7, 800));
  });

  it('il massimo e per campo: quattro valori distinti, direzioni diverse', () => {
    // Nessun numero coincide con un altro, cosi' nessuna coincidenza di fixture puo'
    // mascherare uno scambio fra campi. Uccide: campi incrociati, "tutti dal
    // memorizzato", "tutti dal candidato", un massimo globale unico.
    const risultato = raisePersonalBests(bests(5, 1, 9, 120), bests(2, 4, 3, 300));

    expect(risultato).toEqual(bests(5, 4, 9, 300));
  });

  it('il profilo e quello del candidato', () => {
    const risultato = raisePersonalBests(bests(1, 1, 1, 1, 'memorizzato'), bests(0, 0, 0, 0, 'candidato'));

    expect(risultato.profileId).toBe('candidato');
  });

  it('non muta gli input', () => {
    const memorizzato = bests(5, 1, 9, 120);
    const candidato = bests(2, 4, 3, 300);

    raisePersonalBests(memorizzato, candidato);

    expect(memorizzato).toEqual(bests(5, 1, 9, 120));
    expect(candidato).toEqual(bests(2, 4, 3, 300));
  });

  it('PIN DI CONFINE: uguale a uguale resta uguale', () => {
    // Non prova nulla sulla scelta fra > e >=: sulla funzione pura sono
    // indistinguibili, il risultato e' lo stesso numero. Documenta il confine e basta.
    expect(raisePersonalBests(bests(3, 3, 3, 3), bests(3, 3, 3, 3))).toEqual(bests(3, 3, 3, 3));
  });
});
