// core/domain — entita' e regole pure del dominio.
// Zero I/O: nessuna rete, nessun filesystem, nessun orologio di sistema.
// Nessun import da adapters/, ui/ o librerie esterne (verificato dal lint).

export type { Plant, PlantId } from './plant';
export { PLANT_IDS } from './plant';

export type { Profile, ProfileId } from './profile';

export type { Trip, TripId, TripStatus, TripInvariantError } from './trip';
export { makeTrip } from './trip';

export type { LegDirection, TripLeg, TripLegError } from './trip-leg';
export { legDirectionRank, legKey, makeTripLeg } from './trip-leg';

export type { SeatOffer } from './seat-offer';

export type { TripRequest } from './trip-request';

export type { InstantParts, UtcInstant, UtcInstantError } from './instant';
export { compareUtcInstants, normalizeUtcInstant, utcInstantParts } from './instant';

export { civilDayNumber, inclusiveDaysBetween } from './calendar';

export type {
  MatchRequest,
  MatchRequestId,
  MatchRequestStatus,
  MatchRequestError,
  NoteField,
  ResolvedBy,
} from './match-request';
export { makeMatchRequest, validateMatchRequestStructure } from './match-request';

export type { NoteConfig } from './note-config';

export type { Badge, BadgeId } from './badge';
export { BADGE_IDS } from './badge';

export type { PersonalBests } from './personal-bests';
export { raisePersonalBests, zeroPersonalBests } from './personal-bests';

export type { Result, Ok, Err } from './result';
export { ok, err } from './result';
