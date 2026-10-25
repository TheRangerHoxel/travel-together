// ParameterRepository — lettura dei parametri dell'app (soglie, costi, tolleranze,
// distanze, limite e testo delle note, soglie ed etichette dei badge).
//
// Non ha scritture, deliberatamente, come ProfileRepository: l'app i parametri li
// legge e basta. Modificarli e' amministrazione (la dashboard del database), non
// un'operazione del port.
//
// `load` restituisce i parametri GIA' validati: l'adapter passa le righe lette da
// parseParameters, e un parametro mancante o malformato e' un `invalid-record` con
// `id` = chiave del parametro e `detail` = motivo, mai un valore di default. Si legge
// l'insieme intero e si riporta il PRIMO errore: i parametri sono un aggregato, non
// righe indipendenti fra cui omettere quelle rotte.
//
// Con le RLS, una lettura senza sessione vede zero righe e quindi risponde
// `invalid-record` sulla prima chiave mancante, non un errore di autenticazione:
// va chiamato dopo l'accesso.

import type { AppParameters, Result } from '../domain';
import type { RepositoryError } from './repository-error';

export interface ParameterRepository {
  load(): Promise<Result<AppParameters, RepositoryError>>;
}
