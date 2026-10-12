// ProfileRepository — lettura dei profili.
//
// Non ha `save`, deliberatamente. Su Supabase i profili nascono da `auth.users`
// (trigger), e un client che inserisse una riga `profiles` con id arbitrario
// verrebbe respinto dalle RLS. Il provisioning di un profilo e' un'operazione di
// amministrazione, non del port: metterci un `save` significherebbe scrivere un
// metodo che l'adapter vero non puo' onorare.

import type { Profile, ProfileId, Result } from '../domain';
import type { RepositoryError } from './repository-error';

export interface ProfileRepository {
  findById(id: ProfileId): Promise<Result<Profile, RepositoryError>>;

  /**
   * I profili richiesti, in un colpo solo.
   *
   * Serve alle liste di match (T13), che mostrano il nome del collega accanto a
   * ogni offerta: senza, la UI farebbe una chiamata per riga.
   * Gli id non trovati vengono omessi dal risultato: un id sconosciuto in una
   * lista di nomi non e' un errore, e trasformarlo in uno farebbe fallire
   * un'intera schermata per una riga.
   */
  listByIds(ids: readonly ProfileId[]): Promise<Result<readonly Profile[], RepositoryError>>;
}
