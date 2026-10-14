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
export type { CreateTripConfig } from './create-trip-config';
export type { CreateTripInput, CreateTripDeps, CreateTripError } from './create-trip';
export { createTrip } from './create-trip';
export type { SeatCompensation } from './seat-compensation';
export type { RequestSeatInput, RequestSeatDeps, RequestSeatError } from './request-seat';
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
