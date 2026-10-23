// Fake dei port per i test degli usecase sulle candidature. Solo test: non e'
// importato dal codice di produzione.
//
// Stanno in core/ e non fra gli adapter perche' il lint vieta a core/ di importare
// adapters/: un usecase si prova contro i port. I fake sono SPIE: contano le
// chiamate, cosi' "zero scritture su ogni rifiuto" si asserisce sul numero di
// `save`/`adjustLegSeats` e non sui valori finali, che un'autorizzazione sbagliata
// potrebbe lasciare identici.
//
// `adjustLegSeats` replica il contratto del port: relativo, atomico (la verifica e
// la modifica avvengono senza `await` in mezzo), limiti [0, seatsTotal], altrimenti
// 'invalid-record' con lo storage intatto. Il fake NON e' la difesa lato DB: e'
// una sua copia fedele nel solo event loop.

import {
  type LegDirection,
  type MatchRequest,
  type MatchRequestId,
  type PersonalBests,
  type ProfileId,
  type Result,
  type Trip,
  type TripId,
  type TripLeg,
  legKey,
  raisePersonalBests,
  zeroPersonalBests,
} from '../domain';
import type {
  MatchRequestRepository,
  PersonalBestsRepository,
  RepositoryError,
  TripRepository,
} from '../ports';

export const OWNER: ProfileId = 'owner';
export const RICHIEDENTE: ProfileId = 'richiedente';
export const ESTRANEO: ProfileId = 'estraneo';

export const TRIP_ID: TripId = 'trip-1';

const nonUsato = (): never => {
  throw new Error('metodo non previsto da questo test');
};

export interface AdjustCall {
  readonly tripId: TripId;
  readonly direction: LegDirection;
  readonly delta: number;
}

export interface TripsSpia extends TripRepository {
  readonly adjustCalls: AdjustCall[];
  /** Id letti con `findById`, nell'ordine: per asserire che un controllo non ha guardato. */
  readonly findByIdCalls: TripId[];
  /** Imposta direttamente i posti liberi di una tratta (preparazione del test). */
  setSeats(direction: LegDirection, seatsAvailable: number): void;
  seats(direction: LegDirection): number;
}

export interface TripsOptions {
  readonly seatsTotal?: number;
  readonly seatsAvailable?: number;
  /** Posti liberi del solo ritorno, se diversi da quelli dell'andata. */
  readonly returnAvailable?: number;
  readonly withReturn?: boolean;
  /**
   * Rientro dell'offerente, se diverso dal default (stesso giorno dell'andata, 17:00).
   * Serve ai test che devono distinguere i due capi: col default `departureAt` e
   * `returnAt` cadono nello stesso giorno UTC e un confronto sul giorno non li separa.
   * Ignorato con `withReturn: false`.
   */
  readonly returnAt?: string;
  /** Numero (1-based) di chiamata a adjustLegSeats che fallisce con storage-unavailable. */
  readonly failAdjustOnCall?: number;
  /**
   * Altre trasferte che `findById` deve trovare (per esempio quella con cui ci si
   * candida). Additivo: non hanno tratte e `findLeg`/`adjustLegSeats` non le vedono.
   */
  readonly otherTrips?: readonly Trip[];
  /**
   * Errore di `listByOwner` (che altrimenti ritorna la trasferta offerta e le
   * `otherTrips` del proprietario chiesto). Additivo: assente, nessun test esistente cambia.
   */
  readonly failListByOwner?: RepositoryError;
}

export function unTripsSpia(opzioni: TripsOptions = {}): TripsSpia {
  const seatsTotal = opzioni.seatsTotal ?? 3;
  const seatsAvailable = opzioni.seatsAvailable ?? seatsTotal;
  const trip: Trip = {
    id: TRIP_ID,
    ownerId: OWNER,
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    departureAt: '2026-11-03T07:00:00.000Z',
    returnAt: opzioni.withReturn === false ? null : (opzioni.returnAt ?? '2026-11-03T17:00:00.000Z'),
    hasCar: true,
    seatsTotal,
    seatsAvailable,
    status: 'published',
  };
  const tratte = new Map<string, TripLeg>();
  const direzioni: LegDirection[] = opzioni.withReturn === false ? ['outbound'] : ['outbound', 'return'];
  for (const direction of direzioni) {
    const liberi = direction === 'return' ? (opzioni.returnAvailable ?? seatsAvailable) : seatsAvailable;
    tratte.set(legKey(TRIP_ID, direction), { tripId: TRIP_ID, direction, seatsTotal, seatsAvailable: liberi });
  }
  const adjustCalls: AdjustCall[] = [];
  const findByIdCalls: TripId[] = [];

  return {
    adjustCalls,
    findByIdCalls,
    setSeats(direction, posti) {
      const tratta = tratte.get(legKey(TRIP_ID, direction));
      if (!tratta) throw new Error('tratta inesistente nel fake');
      tratte.set(legKey(TRIP_ID, direction), { ...tratta, seatsAvailable: posti });
    },
    seats(direction) {
      const tratta = tratte.get(legKey(TRIP_ID, direction));
      if (!tratta) throw new Error('tratta inesistente nel fake');
      return tratta.seatsAvailable;
    },
    async findById(id: TripId): Promise<Result<Trip, RepositoryError>> {
      findByIdCalls.push(id);
      await Promise.resolve();
      if (id === trip.id) return { ok: true, value: trip };
      const altra = (opzioni.otherTrips ?? []).find((t) => t.id === id);
      if (altra) return { ok: true, value: altra };
      return { ok: false, error: { kind: 'not-found', id } };
    },
    async findLeg(tripId, direction): Promise<Result<TripLeg, RepositoryError>> {
      await Promise.resolve();
      const tratta = tratte.get(legKey(tripId, direction));
      if (!tratta) return { ok: false, error: { kind: 'not-found', id: legKey(tripId, direction) } };
      return { ok: true, value: tratta };
    },
    async adjustLegSeats(tripId, direction, delta): Promise<Result<TripLeg, RepositoryError>> {
      adjustCalls.push({ tripId, direction, delta });
      // Il punto di sospensione sta PRIMA della sezione atomica, come la rete prima
      // di una UPDATE: ammissione e modifica non sono separate da nessun await.
      await Promise.resolve();
      if (opzioni.failAdjustOnCall === adjustCalls.length) {
        return { ok: false, error: { kind: 'storage-unavailable', detail: 'adjust simulato' } };
      }
      const chiave = legKey(tripId, direction);
      const tratta = tratte.get(chiave);
      if (!tratta) return { ok: false, error: { kind: 'not-found', id: chiave } };
      const nuovi = tratta.seatsAvailable + delta;
      if (nuovi < 0 || nuovi > tratta.seatsTotal) {
        return {
          ok: false,
          error: { kind: 'invalid-record', id: chiave, detail: nuovi < 0 ? 'negative-seats' : 'seats-available-exceeds-total' },
        };
      }
      const aggiornata = { ...tratta, seatsAvailable: nuovi };
      tratte.set(chiave, aggiornata);
      return { ok: true, value: aggiornata };
    },
    async listByOwner(ownerId) {
      await Promise.resolve();
      if (opzioni.failListByOwner) return { ok: false, error: opzioni.failListByOwner };
      const tutte = [trip, ...(opzioni.otherTrips ?? [])];
      return { ok: true, value: tutte.filter((t) => t.ownerId === ownerId) };
    },
    save: nonUsato,
    listOpenOffers: nonUsato,
  };
}

export interface RequestsSpia extends MatchRequestRepository {
  /** Ogni `save` ricevuta, anche se poi fallita. */
  readonly saveCalls: MatchRequest[];
  /** La riga come e' ora nello storage. */
  stored(id: MatchRequestId): MatchRequest | undefined;
}

export interface RequestsOptions {
  readonly existing?: readonly MatchRequest[];
  readonly failSave?: RepositoryError;
  /** Numero (1-based) della chiamata a save che fallisce; le altre riescono. */
  readonly failSaveOnCall?: number;
  /** Errore di `listByLeg` / `listByRequester`. Additivi: assenti, nessun test esistente cambia. */
  readonly failListByLeg?: RepositoryError;
  readonly failListByRequester?: RepositoryError;
}

export function unRequestsSpia(opzioni: RequestsOptions = {}): RequestsSpia {
  const righe = new Map<MatchRequestId, MatchRequest>();
  for (const riga of opzioni.existing ?? []) righe.set(riga.id, riga);
  const saveCalls: MatchRequest[] = [];

  return {
    saveCalls,
    stored: (id) => righe.get(id),
    async save(request) {
      saveCalls.push(request);
      await Promise.resolve();
      if (opzioni.failSave) return { ok: false, error: opzioni.failSave };
      if (opzioni.failSaveOnCall === saveCalls.length) {
        return { ok: false, error: { kind: 'storage-unavailable', detail: 'save simulata' } };
      }
      righe.set(request.id, request);
      return { ok: true, value: request };
    },
    async findById(id) {
      await Promise.resolve();
      const riga = righe.get(id);
      if (!riga) return { ok: false, error: { kind: 'not-found', id } };
      return { ok: true, value: riga };
    },
    async listByLeg(tripId, direction) {
      await Promise.resolve();
      if (opzioni.failListByLeg) return { ok: false, error: opzioni.failListByLeg };
      return {
        ok: true,
        value: [...righe.values()].filter((r) => r.tripId === tripId && r.direction === direction),
      };
    },
    async listByRequester(requesterId) {
      await Promise.resolve();
      if (opzioni.failListByRequester) return { ok: false, error: opzioni.failListByRequester };
      return { ok: true, value: [...righe.values()].filter((r) => r.requesterId === requesterId) };
    },
    async findByLegAndRequester(tripId, direction, requesterId) {
      await Promise.resolve();
      const trovata = [...righe.values()].find(
        (r) => r.tripId === tripId && r.direction === direction && r.requesterId === requesterId
      );
      return { ok: true, value: trovata ?? null };
    },
  };
}

export interface BestsSpia extends PersonalBestsRepository {
  /** Ogni `raise` ricevuta, anche se poi fallita: e' il candidato come l'usecase l'ha costruito. */
  readonly raiseCalls: PersonalBests[];
  /** I massimi come sono ora nello storage del fake. */
  stored(profileId: ProfileId): PersonalBests;
}

export interface BestsOptions {
  /** Massimi gia' memorizzati. */
  readonly initial?: readonly PersonalBests[];
  readonly failRaise?: RepositoryError;
  /**
   * Valore che `raise` ritorna al posto dell'alzata vera (lo storage non cambia).
   * Serve a provare che i badge si calcolano sul valore RITORNATO e non sul candidato,
   * con un valore piu' alto di quello che il candidato produrrebbe.
   */
  readonly forcedResult?: PersonalBests;
}

/**
 * Spia dei massimi. La monotonia e' quella del dominio (`raisePersonalBests`): il
 * fake non ne scrive una propria.
 */
export function unBestsSpia(opzioni: BestsOptions = {}): BestsSpia {
  const righe = new Map<ProfileId, PersonalBests>();
  for (const riga of opzioni.initial ?? []) righe.set(riga.profileId, riga);
  const raiseCalls: PersonalBests[] = [];
  const attuale = (profileId: ProfileId): PersonalBests =>
    righe.get(profileId) ?? zeroPersonalBests(profileId);

  return {
    raiseCalls,
    stored: attuale,
    async findByProfile(profileId) {
      await Promise.resolve();
      return { ok: true, value: attuale(profileId) };
    },
    async raise(candidate) {
      raiseCalls.push(candidate);
      await Promise.resolve();
      if (opzioni.failRaise) return { ok: false, error: opzioni.failRaise };
      const alzata = raisePersonalBests(attuale(candidate.profileId), candidate);
      righe.set(candidate.profileId, alzata);
      return { ok: true, value: opzioni.forcedResult ?? alzata };
    },
  };
}

export function unaRichiesta(modifiche: Partial<MatchRequest> = {}): MatchRequest {
  return {
    id: 'req-1',
    tripId: TRIP_ID,
    direction: 'outbound',
    requesterId: RICHIEDENTE,
    requesterTripId: 'trip-richiedente',
    status: 'pending',
    requestNote: null,
    resolutionNote: null,
    resolvedBy: null,
    ...modifiche,
  };
}

