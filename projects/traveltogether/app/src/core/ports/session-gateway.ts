// SessionGateway — dal codice invito alla sessione.
//
// E' un port separato dai repository perche' e' il punto che cambiera' per primo:
// oggi codice invito, domani SSO aziendale. Il core dipende da questa interfaccia,
// quindi quel cambio non lo tocca.

import type { ProfileId, Result } from '../domain';

export interface Session {
  readonly profileId: ProfileId;
}

export type SessionError =
  | { readonly kind: 'invalid-code' }
  | { readonly kind: 'code-disabled' }
  | { readonly kind: 'no-session' }
  | { readonly kind: 'gateway-unavailable'; readonly detail: string };

export interface SessionGateway {
  signInWithInviteCode(code: string): Promise<Result<Session, SessionError>>;

  /** La sessione corrente, se c'e'. Deve sopravvivere a chiusura e riapertura (T10). */
  currentSession(): Promise<Result<Session, SessionError>>;

  signOut(): Promise<Result<null, SessionError>>;
}
