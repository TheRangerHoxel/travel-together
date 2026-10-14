// Statistiche personali di UN collega, in entrambi i ruoli. Alimentano i badge (T07).
//
// Funzione pura: nessun I/O, nessun orologio, nessuna mutazione degli input.
//
// DUE FAMIGLIE, due basi dichiarate:
//  - DA PASSEGGERO: `sharedTrips` = le trasferte PROPRIE del collega con
//    `hasCar: false` indicate (`requesterTripId`) da ALMENO UNA candidatura
//    `accepted`. Stessa unita' di T06: la trasferta, non la tratta e non la
//    candidatura, quindi due tratte condivise sulla stessa trasferta sono UN viaggio;
//  - DA CONDUCENTE, sulle trasferte che il collega ha OFFERTO (`ownerId`, con
//    `hasCar: true`):
//      * `sharedLegs` = le tratte (andata/ritorno) con almeno una candidatura
//        `accepted`. Offrire posti che nessuno ha visto accettare vale zero;
//      * `transportedColleagues` = colleghi DISTINTI con almeno una candidatura
//        accettata su quelle tratte (chi viaggia due volte conta una volta);
//      * `sharedKm` = somma, per tratta condivisa, della distanza fra i plant.
//        Una tratta e' contata una volta sola, quanti siano i passeggeri a bordo:
//        i km sono quelli dell'auto, non dei passeggeri.
//
// Una trasferta `cancelled` non conta, per nessuna delle due famiglie: non e'
// avvenuta (lo stesso criterio di T06). Le candidature `pending`, `rejected` e
// `cancelled` non contano.
//
// Una candidatura accettata su una tratta di RITORNO di una trasferta senza
// `returnAt` indica una tratta che non esiste: e' ignorata, non conta ne' errore.
//
// Precondizione: `trips` contiene le trasferte del collega, cioe' quelle che offre e
// quelle con cui si e' candidato. Quelle degli altri non servono.

import type { MatchRequest, PlantId, ProfileId, Result, Trip } from '../domain';
import { err, legKey, ok } from '../domain';
import type { PlantDistanceConfig } from './plant-distance';
import { lookupPlantDistance } from './plant-distance';

export interface PersonalStats {
  readonly profileId: ProfileId;
  /** Trasferte proprie senza auto con almeno una candidatura accettata. */
  readonly sharedTrips: number;
  /** Tratte offerte con almeno una candidatura accettata. */
  readonly sharedLegs: number;
  /** Colleghi distinti trasportati. */
  readonly transportedColleagues: number;
  /** Km delle tratte condivise da conducente. */
  readonly sharedKm: number;
}

export type PersonalStatsError =
  /** Una candidatura accettata del collega indica una trasferta che non e' fra quelle date. */
  | {
      readonly kind: 'unknown-requester-trip';
      readonly requestId: string;
      readonly requesterTripId: string;
    }
  /** La trasferta indicata da `requesterTripId` non e' del collega che si e' candidato. */
  | {
      readonly kind: 'requester-trip-not-owned';
      readonly requestId: string;
      readonly requesterTripId: string;
    }
  | {
      readonly kind: 'missing-distance';
      readonly fromPlantId: PlantId;
      readonly toPlantId: PlantId;
    }
  | { readonly kind: 'invalid-config'; readonly field: 'distanceKm' };

export function computePersonalStats(
  profileId: ProfileId,
  trips: readonly Trip[],
  requests: readonly MatchRequest[],
  config: PlantDistanceConfig
): Result<PersonalStats, PersonalStatsError> {
  const accepted = requests.filter((r) => r.status === 'accepted');

  // Da passeggero.
  const sharedTrips = new Set<string>();
  for (const request of accepted) {
    if (request.requesterId !== profileId) continue;

    const own = trips.find((t) => t.id === request.requesterTripId);
    if (!own) {
      return err({
        kind: 'unknown-requester-trip',
        requestId: request.id,
        requesterTripId: request.requesterTripId,
      });
    }
    if (own.ownerId !== profileId) {
      return err({
        kind: 'requester-trip-not-owned',
        requestId: request.id,
        requesterTripId: request.requesterTripId,
      });
    }
    if (own.hasCar || own.status === 'cancelled') continue;

    sharedTrips.add(own.id);
  }

  // Da conducente.
  const offered = new Map<string, Trip>();
  for (const trip of trips) {
    if (trip.ownerId === profileId && trip.hasCar && trip.status !== 'cancelled') {
      offered.set(trip.id, trip);
    }
  }

  const legs = new Map<string, Trip>();
  const colleagues = new Set<ProfileId>();
  for (const request of accepted) {
    const offer = offered.get(request.tripId);
    if (!offer) continue;
    if (request.direction === 'return' && offer.returnAt === null) continue;
    if (request.requesterId === profileId) continue;

    legs.set(legKey(offer.id, request.direction), offer);
    colleagues.add(request.requesterId);
  }

  let sharedKm = 0;
  for (const offer of legs.values()) {
    const legKm = lookupPlantDistance(config, offer.fromPlantId, offer.toPlantId);
    if (legKm === undefined) {
      return err({
        kind: 'missing-distance',
        fromPlantId: offer.fromPlantId,
        toPlantId: offer.toPlantId,
      });
    }
    if (!Number.isFinite(legKm) || legKm < 0) return err({ kind: 'invalid-config', field: 'distanceKm' });
    sharedKm += legKm;
  }

  return ok({
    profileId,
    sharedTrips: sharedTrips.size,
    sharedLegs: legs.size,
    transportedColleagues: colleagues.size,
    sharedKm,
  });
}
