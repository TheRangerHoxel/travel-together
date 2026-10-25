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

import type { ProfileId } from '../../core/domain';
import type { RepositoryError } from '../../core/ports';

export interface CondizioniDiAmbiente {
  /**
   * Chi sta chiamando. `null` = nessuno: per le policy IMPOSTE (scrittura di
   * trasferte, candidature e massimi; lettura di massimi e candidature) ogni
   * scrittura e' rifiutata e ogni lettura filtrata, come una richiesta non
   * autenticata sotto RLS. Restano fuori, e non guardano l'identita':
   * `adjustLegSeats` (T08 non ha deciso chi lo esegue) e le letture di trasferte e
   * profili. Fra le LETTURE filtrate ci sono anche i parametri: senza identita'
   * `ParameterRepository.load` vede zero righe.
   */
  identita: ProfileId | null;
  /** Lo storage non risponde: ogni metodo di ogni repository ritorna `storage-unavailable`. */
  guasto: boolean;
}

export function nuoveCondizioni(): CondizioniDiAmbiente {
  return { identita: null, guasto: false };
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
