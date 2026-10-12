// SessionGateway in RAM.
//
// I codici invito validi si registrano nel setup dei test: nessun codice letterale
// nel codice sorgente. A runtime il codice vero arriva da config, iniettato da
// variabili d'ambiente.

import type { ProfileId, Result } from '../../core/domain';
import { err, ok } from '../../core/domain';
import type { Session, SessionError, SessionGateway } from '../../core/ports';

interface RigaCodice {
  readonly profileId: ProfileId;
  readonly attivo: boolean;
}

export class MemorySessionGateway implements SessionGateway {
  /**
   * Una sola mappa, con il flag dentro la riga: specchia `invite_codes` su
   * Postgres, dove "disattivato" e' una colonna e non una tabella a parte.
   *
   * Tenere i disattivati in un Set separato sembrava equivalente e non lo era: un
   * codice mai registrato ma disattivato avrebbe risposto `code-disabled` invece di
   * `invalid-code`, mentre su Supabase un codice assente da' sempre `invalid-code`.
   * Due adapter divergenti dietro lo stesso port e' esattamente cio' che la suite
   * di contratto esiste per impedire.
   */
  private readonly codici = new Map<string, RigaCodice>();

  private sessione: Session | null = null;

  semina(codice: string, profileId: ProfileId): void {
    this.codici.set(codice, { profileId, attivo: true });
  }

  disattiva(codice: string): void {
    const riga = this.codici.get(codice);
    if (!riga) return; // Un codice che non esiste non si puo' disattivare.
    this.codici.set(codice, { ...riga, attivo: false });
  }

  async signInWithInviteCode(code: string): Promise<Result<Session, SessionError>> {
    const riga = this.codici.get(code);

    if (!riga) {
      return err({ kind: 'invalid-code' });
    }
    if (!riga.attivo) {
      return err({ kind: 'code-disabled' });
    }

    this.sessione = { profileId: riga.profileId };
    return ok({ ...this.sessione });
  }

  async currentSession(): Promise<Result<Session, SessionError>> {
    if (!this.sessione) {
      return err({ kind: 'no-session' });
    }
    return ok({ ...this.sessione });
  }

  async signOut(): Promise<Result<null, SessionError>> {
    this.sessione = null;
    return ok(null);
  }
}
