// core/ports — SOLO interfacce e tipi, nessuna implementazione.
//
// E' il punto di inversione delle dipendenze: il core dipende da qui, gli adapter
// implementano. Lo storage e' il punto che cambiera' (oggi Supabase, domani un DB
// aziendale o SAP): il core deve dipendere da TripRepository, non da Supabase.

export type { Clock } from './clock';
export type { RepositoryError } from './repository-error';
export type { TripRepository } from './trip-repository';
export type { MatchRequestRepository } from './match-request-repository';
export type { ProfileRepository } from './profile-repository';
export type { PersonalBestsRepository } from './personal-bests-repository';
export type { ParameterRepository } from './parameter-repository';
export type { Session, SessionError, SessionGateway } from './session-gateway';
