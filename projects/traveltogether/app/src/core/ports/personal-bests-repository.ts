// PersonalBestsRepository — persistenza del massimo storico delle metriche (T07e).

import type { PersonalBests, ProfileId, Result } from '../domain';
import type { RepositoryError } from './repository-error';

export interface PersonalBestsRepository {
  /**
   * I massimi di un profilo. Se non e' mai stato scritto niente ritorna **zeri in
   * `ok`**, non `not-found`: "nessun massimo ancora registrato" e' un caso normale,
   * come `findByLegAndRequester` che ritorna `null`.
   *
   * Riga assente e riga a zeri sono **indistinguibili, per scelta**: gli zeri non
   * assegnano badge (le soglie sono >= 1), quindi distinguerle non cambierebbe
   * nessun risultato.
   *
   * Perche' il port ha anche la lettura, che l'usecase di T07e non usa: e' la lettura
   * che rende la scrittura **dimostrabile**. Senza, un adapter che calcola il massimo
   * e non lo persiste passerebbe la suite di contratto.
   */
  findByProfile(profileId: ProfileId): Promise<Result<PersonalBests, RepositoryError>>;

  /**
   * Alza i massimi del profilo del candidato: per ciascun campo il maggiore fra il
   * memorizzato e il candidato (`raisePersonalBests`). Scrivere un valore piu' basso
   * non abbassa niente. Ritorna **lo stato dopo l'alzata**, cioe' i massimi
   * memorizzati e non l'eco del candidato.
   *
   * Prende l'aggregato intero, con il `profileId` dentro (come `save(trip)`), cosi'
   * il disallineamento fra profilo e massimi non e' rappresentabile. E' UNA scrittura
   * sola su UNA riga con le quattro metriche: un massimo scritto a meta' non esiste.
   *
   * Non e' un leggi-modifica-scrivi per lo stesso motivo per cui `adjustLegSeats` e'
   * relativa: un merge fatto nel client fra una lettura e una scrittura perderebbe
   * un'alzata concorrente, cioe' abbasserebbe un massimo. A T08 e' un unico
   * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING *` con `GREATEST` per colonna.
   */
  raise(candidate: PersonalBests): Promise<Result<PersonalBests, RepositoryError>>;
}
