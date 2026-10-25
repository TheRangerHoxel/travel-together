// ProfileRepository in RAM.

import type { Profile, ProfileId, Result } from '../../core/domain';
import { err, ok } from '../../core/domain';
import type { ProfileRepository, RepositoryError } from '../../core/ports';
import { type CondizioniDiAmbiente, erroreDiGuasto } from './memory-conditions';

export class MemoryProfileRepository implements ProfileRepository {
  private readonly profili = new Map<ProfileId, Profile>();

  /** Le condizioni sono opzionali: assenti = storage sempre raggiungibile. */
  constructor(private readonly condizioni?: CondizioniDiAmbiente) {}

  /**
   * Provisioning di un profilo. **Non e' nel port**, ed e' voluto: su Supabase i
   * profili nascono da auth.users, quindi crearne uno e' amministrazione e non
   * un'operazione dell'applicazione. La suite di contratto lo raggiunge tramite
   * l'ambiente, che su ciascun adapter lo realizza a modo suo.
   */
  semina(profile: Profile): void {
    this.profili.set(profile.id, { ...profile });
  }

  async findById(id: ProfileId): Promise<Result<Profile, RepositoryError>> {
    const guasto = erroreDiGuasto(this.condizioni);
    if (guasto) return err(guasto);

    const trovato = this.profili.get(id);
    if (!trovato) {
      return err({ kind: 'not-found', id });
    }
    return ok({ ...trovato });
  }

  async listByIds(
    ids: readonly ProfileId[]
  ): Promise<Result<readonly Profile[], RepositoryError>> {
    const guasto = erroreDiGuasto(this.condizioni);
    if (guasto) return err(guasto);

    const trovati: Profile[] = [];
    for (const id of ids) {
      const p = this.profili.get(id);
      if (p) trovati.push({ ...p });
    }
    return ok(trovati);
  }
}
