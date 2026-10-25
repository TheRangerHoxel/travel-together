// ParameterRepository in RAM.
//
// Serve le righe GREZZE ricevute dal costruttore (o da `sostituisci`) e le passa da
// parseParameters a ogni `load`: nessun valore implicito, nessun default. Una riga
// mancante o malformata e' `invalid-record` con la chiave del parametro, esattamente
// come un adapter che legge una tabella.

import type { AppParameters, RawParameters, Result } from '../../core/domain';
import { err, ok, parseParameters } from '../../core/domain';
import type { ParameterRepository, RepositoryError } from '../../core/ports';
import { type CondizioniDiAmbiente, erroreDiGuasto } from './memory-conditions';

const NESSUNA_RIGA: RawParameters = { values: {}, plantDistances: [], badges: [] };

export class MemoryParameterRepository implements ParameterRepository {
  private righe: RawParameters;

  /**
   * Le condizioni sono opzionali: assenti = nessuna policy e nessun guasto. Cablate,
   * le righe dei parametri si vedono solo con un'identita', come la lettura riservata
   * agli autenticati: senza, `load` vede zero righe e risponde `invalid-record` sulla
   * prima chiave mancante.
   */
  constructor(
    righe: RawParameters,
    private readonly condizioni?: CondizioniDiAmbiente
  ) {
    this.righe = righe;
  }

  /**
   * Sostituisce l'insieme intero delle righe. **Non e' nel port**, ed e' voluto:
   * modificare i parametri e' amministrazione (la dashboard), non un'operazione
   * dell'app. La suite di contratto lo raggiunge tramite l'ambiente.
   */
  sostituisci(righe: RawParameters): void {
    this.righe = righe;
  }

  async load(): Promise<Result<AppParameters, RepositoryError>> {
    const guasto = erroreDiGuasto(this.condizioni);
    if (guasto) return err(guasto);

    // Una lettura negata dalla policy non e' un errore: le righe non ci sono.
    const visibili = this.condizioni && this.condizioni.identita === null ? NESSUNA_RIGA : this.righe;

    const parametri = parseParameters(visibili);
    if (!parametri.ok) {
      return err({
        kind: 'invalid-record',
        id: parametri.error.key,
        detail: parametri.error.detail,
      });
    }
    return ok(parametri.value);
  }
}
