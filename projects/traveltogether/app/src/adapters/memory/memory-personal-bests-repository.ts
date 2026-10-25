// PersonalBestsRepository in RAM.

import type { PersonalBests, ProfileId, Result } from '../../core/domain';
import { err, ok, raisePersonalBests, zeroPersonalBests } from '../../core/domain';
import type { PersonalBestsRepository, RepositoryError } from '../../core/ports';
import { type CondizioniDiAmbiente, erroreDiGuasto, rifiutoDiPolicy } from './memory-conditions';

export class MemoryPersonalBestsRepository implements PersonalBestsRepository {
  private readonly righe = new Map<ProfileId, PersonalBests>();

  /**
   * Le condizioni sono opzionali: assenti = nessuna policy e nessun guasto. Cablate,
   * i massimi sono PROPRI: si leggono e si alzano solo per l'identita' corrente,
   * come la policy su `personal_bests` di T08.
   */
  constructor(private readonly condizioni?: CondizioniDiAmbiente) {}

  async findByProfile(profileId: ProfileId): Promise<Result<PersonalBests, RepositoryError>> {
    const guasto = erroreDiGuasto(this.condizioni);
    if (guasto) return err(guasto);

    // Una lettura negata dalla policy non e' un errore: la riga dell'altro non c'e'
    // per chi guarda, quindi la risposta e' quella di "mai scritto".
    if (this.condizioni && this.condizioni.identita !== profileId) {
      return ok(zeroPersonalBests(profileId));
    }
    return ok({ ...(this.righe.get(profileId) ?? zeroPersonalBests(profileId)) });
  }

  async raise(candidate: PersonalBests): Promise<Result<PersonalBests, RepositoryError>> {
    const guasto = erroreDiGuasto(this.condizioni);
    if (guasto) return err(guasto);

    if (this.condizioni && this.condizioni.identita !== candidate.profileId) {
      return err(rifiutoDiPolicy('i massimi sono di un altro profilo'));
    }

    // La monotonia e' del dominio: qui si invoca, non si riscrive.
    const alzata = raisePersonalBests(
      this.righe.get(candidate.profileId) ?? zeroPersonalBests(candidate.profileId),
      candidate
    );
    this.righe.set(candidate.profileId, alzata);
    return ok({ ...alzata });
  }
}
