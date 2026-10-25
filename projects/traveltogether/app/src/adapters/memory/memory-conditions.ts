// Le condizioni dell'ambiente in cui gira lo storage in RAM.
//
// Uno storage vero ha due cose che la RAM non ha: chi sta chiedendo (le RLS dipendono
// dall'identita' autenticata) e la possibilita' di non rispondere (rete giu', proxy
// aziendale). Qui vivono entrambe, in UN oggetto mutabile condiviso fra gli adapter
// memory: cosi' l'ambiente di contratto le cambia in un punto solo e tutti gli adapter
// le vedono, come per il limite delle note.
//
// Il parametro e' OPZIONALE in ogni costruttore: assente = nessuna policy e nessun
// guasto, cioe' un adapter che non conosce chi lo chiama. I test che non c'entrano con
// l'identita' non devono gestirla; i denti stanno nei test di contratto, che girano
// sempre con le condizioni cablate.

import type { LegDirection, ProfileId, TripId } from '../../core/domain';
import type { RepositoryError } from '../../core/ports';

/**
 * Le interrogazioni sulle candidature che `MemoryTripRepository` deve poter fare per
 * comportarsi come il DB, senza essere nel port. Valgono su TUTTE le righe, anche quelle
 * che l'identita' corrente non vedrebbe: sono il lavoro di una foreign key e di una
 * funzione `security definer`, che non passano dalle policy di lettura.
 */
export interface IndiceCandidature {
  /** Esiste almeno una candidatura, in qualunque stato, su questa tratta? */
  esisteSuTratta(tripId: TripId, direction: LegDirection): boolean;
  /** Il profilo ha una candidatura `accepted` su questa tratta? */
  accettataDa(profileId: ProfileId, tripId: TripId, direction: LegDirection): boolean;
}

export interface CondizioniDiAmbiente {
  /**
   * Chi sta chiamando. `null` = nessuno: ogni scrittura imposta e' rifiutata e ogni
   * lettura imposta filtrata, come una richiesta non autenticata sotto RLS. Le letture
   * filtrate sono quelle di trasferte, tratte, profili, candidature, massimi e
   * parametri: senza identita' `ParameterRepository.load` vede zero righe. Le scritture
   * imposte sono quelle di trasferte, candidature e massimi, e `adjustLegSeats`, che
   * autorizza il proprietario della trasferta o il richiedente di una candidatura
   * `accepted` su quella tratta.
   */
  identita: ProfileId | null;
  /** Lo storage non risponde: ogni metodo di ogni repository ritorna `storage-unavailable`. */
  guasto: boolean;
}

export function nuoveCondizioni(): CondizioniDiAmbiente {
  return { identita: null, guasto: false };
}

/**
 * Una LETTURA di trasferte, tratte o profili e' vuota senza identita': la RLS di
 * lettura e' `authenticated`, e `anon` vede zero righe. Con identita' qualunque, o senza
 * condizioni cablate, nessun filtro.
 */
export function lettureVuote(condizioni: CondizioniDiAmbiente | undefined): boolean {
  return condizioni !== undefined && condizioni.identita === null;
}

/** L'errore di uno storage che non risponde, o `null` se risponde (o se non ci sono condizioni). */
export function erroreDiGuasto(condizioni: CondizioniDiAmbiente | undefined): RepositoryError | null {
  return condizioni?.guasto
    ? { kind: 'storage-unavailable', detail: 'storage non raggiungibile (guasto simulato)' }
    : null;
}

/**
 * Il rifiuto di una scrittura da parte di una policy. Su Postgres una scrittura negata
 * da una RLS e' un ERRORE; `RepositoryError` prescrive `storage-unavailable` per
 * "permessi negati, RLS che blocca". Una LETTURA negata invece non e' un errore: la
 * riga semplicemente non c'e', e gli adapter la omettono senza usare questo.
 */
export function rifiutoDiPolicy(motivo: string): RepositoryError {
  return { kind: 'storage-unavailable', detail: `scrittura negata dalla policy: ${motivo}` };
}
