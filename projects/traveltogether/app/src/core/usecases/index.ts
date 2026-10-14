// core/usecases — la logica applicativa. Dipende da domain/ e ports/.
//
// Non importa config/: i valori entrano come parametro, quindi il core resta
// compilabile ed eseguibile senza. L'unico file che importa config/ e' il test di
// conformita', che lega i valori reali ai tipi del core.
//
// Popolato da T03 in poi.

export type { MatchConfig } from './match-config';
export type { ScoredMatch, MatchError } from './find-matches';
export { findMatches } from './find-matches';
export type { KpiConfig } from './kpi-config';
export type { PlantDistanceConfig, PlantDistanceTable } from './plant-distance';
export { lookupPlantDistance } from './plant-distance';
export type { CompanyKpi, CompanyKpiError } from './compute-company-kpi';
export { computeCompanyKpi } from './compute-company-kpi';
export type { BadgeConfig } from './badge-config';
export type {
  PersonalStats,
  PersonalStatsError,
} from './compute-personal-stats';
export { computePersonalStats } from './compute-personal-stats';
export type { AwardBadgesError, BadgeFamily } from './award-badges';
export { awardBadges, BADGE_CATALOG } from './award-badges';
export type { CreateTripConfig } from './create-trip-config';
export type { CreateTripInput, CreateTripDeps, CreateTripError } from './create-trip';
export { createTrip } from './create-trip';
export type { SeatCompensation } from './seat-compensation';
export type {
  RequestSeatInput,
  RequestSeatDeps,
  RequestSeatError,
  RequesterTripRejection,
} from './request-seat';
export { requestSeat } from './request-seat';
export type { RejectRequestInput, RejectRequestDeps, RejectRequestError } from './reject-request';
export { rejectRequest } from './reject-request';
export type { CascadeConfig } from './cascade-config';
export type {
  LegRef,
  SystemTransitionError,
  UnclosedRequest,
} from './leg-system-transitions';
export { rejectRemainingPending, restoreSystemRejected } from './leg-system-transitions';
export type {
  AcceptRequestConfig,
  AcceptRequestDeps,
  AcceptRequestError,
  AcceptRequestInput,
  AcceptRequestOutcome,
} from './accept-request';
export { acceptRequest } from './accept-request';
export type {
  CancelRequestDeps,
  CancelRequestError,
  CancelRequestInput,
  CancelRequestOutcome,
} from './cancel-request';
export { cancelRequest } from './cancel-request';
