// Conformita degli enum del DB alle union del dominio, valutata da `typecheck`.
//
// Gli enum Postgres sono un SECONDO elenco delle identita del dominio (plant, badge, chiavi dei
// parametri, direzioni, stati). I tipi generati da `npm run db:types` li espongono come union di
// letterali, e queste asserzioni pretendono che coincidano con quelle del dominio NEI DUE VERSI:
// un membro aggiunto da una parte sola fa cadere `tsc`.
//
// Non e un `.test.ts`: senza `it` sarebbe una suite vuota e jest la farebbe fallire. Non ha
// nessun effetto a runtime; i tipi esportati esistono solo perche `tsc` li controlli.
//
// Cosa NON prova: che il file generato corrisponda allo schema di staging (se lo schema cambia e
// i tipi non si rigenerano). Quello lo prova tests/integration/tipi.test.ts, che confronta
// `Constants` con `pg_enum`.

import type {
  BadgeId,
  LegDirection,
  MatchRequestStatus,
  ParameterKey,
  PlantId,
  ResolvedBy,
  TripStatus,
} from '../../core/domain';
import type { Database } from './database.types';

type EnumDelDb = Database['public']['Enums'];

/** `true` solo se A e B sono la stessa union, nei due versi. */
type Uguali<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Non compila se `T` non e `true`: l'errore nomina l'asserzione che non regge. */
type Pretendi<T extends true> = T;

export type ConformitaEnum = [
  Pretendi<Uguali<EnumDelDb['plant_id'], PlantId>>,
  Pretendi<Uguali<EnumDelDb['badge_id'], BadgeId>>,
  Pretendi<Uguali<EnumDelDb['parameter_key'], ParameterKey>>,
  Pretendi<Uguali<EnumDelDb['leg_direction'], LegDirection>>,
  Pretendi<Uguali<EnumDelDb['trip_status'], TripStatus>>,
  Pretendi<Uguali<EnumDelDb['match_request_status'], MatchRequestStatus>>,
  Pretendi<Uguali<EnumDelDb['resolved_by'], ResolvedBy>>,
];
