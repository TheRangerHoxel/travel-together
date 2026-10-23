// Massimo storico delle metriche personali (T07e).
//
// Un MASSIMO non e' una statistica: e' il valore piu' alto che ciascuna metrica ha mai
// raggiunto per quel collega, e per costruzione non scende mai. Per questo ha un tipo
// col suo nome, anche se i quattro campi sono quelli di PersonalStats. LIMITE da
// sapere: i due tipi sono strutturalmente identici, quindi un PersonalBests e' passabile
// dove si attende un PersonalStats (awardBadges lo sfrutta di proposito) e viceversa.
// Il nome protegge chi legge, NON il compilatore: scambiare i due in una chiamata
// compila.
//
// La monotonia vive qui, come funzione pura, perche' e' l'invariante su cui poggia il
// task: un badge non si ritira perche' un massimo non scende. Ogni adapter che la
// esprima nel proprio linguaggio (a T09, GREATEST per colonna in Postgres) e' provato
// equivalente dalla suite di contratto.

import type { ProfileId } from './profile';

export interface PersonalBests {
  readonly profileId: ProfileId;
  /** Massimo di trasferte proprie senza auto condivise. */
  readonly sharedTrips: number;
  /** Massimo di tratte offerte con almeno una candidatura accettata. */
  readonly sharedLegs: number;
  /** Massimo di colleghi distinti trasportati. */
  readonly transportedColleagues: number;
  /** Massimo di km delle tratte condivise da conducente. */
  readonly sharedKm: number;
}

/** Nessun massimo ancora registrato: tutti zero. */
export function zeroPersonalBests(profileId: ProfileId): PersonalBests {
  return { profileId, sharedTrips: 0, sharedLegs: 0, transportedColleagues: 0, sharedKm: 0 };
}

/**
 * Alza i massimi: per CIASCUN campo il maggiore fra il memorizzato e il candidato.
 *
 * Il massimo e' per colonna e non per riga: un candidato che sale su una metrica e
 * scende su un'altra alza la prima e lascia la seconda. Il `profileId` e' quello del
 * candidato. Pura: non muta gli input.
 */
export function raisePersonalBests(
  stored: PersonalBests,
  candidate: PersonalBests
): PersonalBests {
  return {
    profileId: candidate.profileId,
    sharedTrips: Math.max(stored.sharedTrips, candidate.sharedTrips),
    sharedLegs: Math.max(stored.sharedLegs, candidate.sharedLegs),
    transportedColleagues: Math.max(stored.transportedColleagues, candidate.transportedColleagues),
    sharedKm: Math.max(stored.sharedKm, candidate.sharedKm),
  };
}
