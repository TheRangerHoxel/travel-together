// PersonalBestsRepository in RAM.

import type { PersonalBests, ProfileId, Result } from '../../core/domain';
import { ok, raisePersonalBests, zeroPersonalBests } from '../../core/domain';
import type { PersonalBestsRepository, RepositoryError } from '../../core/ports';

export class MemoryPersonalBestsRepository implements PersonalBestsRepository {
  private readonly righe = new Map<ProfileId, PersonalBests>();

  async findByProfile(profileId: ProfileId): Promise<Result<PersonalBests, RepositoryError>> {
    return ok({ ...(this.righe.get(profileId) ?? zeroPersonalBests(profileId)) });
  }

  async raise(candidate: PersonalBests): Promise<Result<PersonalBests, RepositoryError>> {
    // La monotonia e' del dominio: qui si invoca, non si riscrive.
    const alzata = raisePersonalBests(
      this.righe.get(candidate.profileId) ?? zeroPersonalBests(candidate.profileId),
      candidate
    );
    this.righe.set(candidate.profileId, alzata);
    return ok({ ...alzata });
  }
}
