// Aggiorna i massimi storici di un collega e ritorna i badge calcolati SUI MASSIMI (T07e).
//
// E' il percorso che la dashboard personale (T15) usa: nessun altro compone
// computePersonalStats con awardBadges. Ordine: si LEGGE tutto, si calcola, si scrive
// UNA volta, si calcolano i badge sul valore ritornato dalla scrittura.
//
// I badge si calcolano sul valore che ritorna `raise` e non sul candidato locale: se
// un'altra esecuzione ha alzato il massimo nel frattempo, il valore memorizzato e'
// quello vero, e un badge calcolato sul candidato potrebbe sparire.
//
// NIENTE usecase con `deps` qui dentro: comporre funzioni pure (computePersonalStats,
// awardBadges, raisePersonalBests) non e' orchestrazione, chiamare un altro usecase
// con dipendenze lo sarebbe. Quel punto di composizione e' la UI.
//
// SCRITTURE E ERRORI. Un errore di lettura (`storage-failed`) e `stats-failed`
// arrivano PRIMA della scrittura: nessuna `raise`. `badge-config-invalid` e'
// l'UNICO errore che arriva DOPO una `raise` riuscita. Non e' un massimo a meta' (la scrittura e'
// completa, monotona e idempotente, e sta su una riga sola), ma e' una scrittura
// avvenuta su un esito d'errore, e chi chiama deve saperlo.
//
// LIMITI, da leggere prima di fidarsi:
// - LETTURE: `1 + 2N` al piu' per apertura della dashboard (listByOwner, una
//   listByRequester, una listByLeg per tratta propria; N = trasferte proprie con
//   auto). Costo noto, registrato in IDEAS.md e non risolto qui.
// - DUPLICAZIONE VOLUTA: la regola "le tratte di una trasferta sono l'andata sempre
//   e il ritorno solo se `returnAt` non e' null" vive gia' in `save` e in
//   `listOpenOffers`, e qui e' ripetuta. Le alternative erano un metodo nuovo sul
//   port (checkpoint umano) o fidarsi di `listByLeg` su una tratta inesistente,
//   comportamento che nessun test di contratto fissa: fidarsi di un comportamento non
//   fissato e' peggio della duplicazione.
// - RIGHE INCOERENTI: una candidatura incoerente (per esempio `requesterTripId` che
//   non e' una trasferta del collega) fa fallire computePersonalStats, quindi
//   `stats-failed` e badge spenti per QUEL collega. Una riga sbagliata spegne i
//   badge di una persona; e' la stessa forma del difetto che la premessa di T07c
//   descrive per la dashboard aziendale.
// - I TIPI: PersonalBests e' strutturalmente assegnabile a PersonalStats. E' per
//   questo che awardBadges lo accetta senza cambiare firma; ma il nome protegge chi
//   legge, non il compilatore.
// - Riga assente e riga a zeri sono indistinguibili per scelta (vedi il port).

import {
  type MatchRequest,
  type PersonalBests,
  type ProfileId,
  type Result,
  type Badge,
  err,
  ok,
} from '../domain';
import type {
  MatchRequestRepository,
  PersonalBestsRepository,
  RepositoryError,
  TripRepository,
} from '../ports';
import type { AwardBadgesError } from './award-badges';
import { awardBadges } from './award-badges';
import type { BadgeConfig } from './badge-config';
import type { PersonalStatsError } from './compute-personal-stats';
import { computePersonalStats } from './compute-personal-stats';
import type { PlantDistanceConfig } from './plant-distance';

export interface RefreshPersonalBestsInput {
  readonly profileId: ProfileId;
}

export interface RefreshPersonalBestsDeps {
  readonly trips: TripRepository;
  readonly requests: MatchRequestRepository;
  readonly bests: PersonalBestsRepository;
}

export interface RefreshPersonalBestsConfig {
  readonly distances: PlantDistanceConfig;
  readonly badges: BadgeConfig;
}

export interface RefreshPersonalBestsOutcome {
  /** I massimi dopo l'alzata, come li ha ritornati lo storage. */
  readonly bests: PersonalBests;
  /** I badge calcolati sui massimi. */
  readonly badges: readonly Badge[];
}

export type RefreshPersonalBestsError =
  /**
   * Una lettura o la `raise` stessa e' fallita. Se e' una lettura, nessuna `raise` e'
   * stata tentata; se e' la `raise`, lo storage non ha confermato l'alzata (con una
   * riga sola, o e' applicata per intero o non lo e').
   */
  | { readonly kind: 'storage-failed'; readonly cause: RepositoryError }
  /** I dati letti non permettono di calcolare le statistiche. Nessuna `raise`. */
  | { readonly kind: 'stats-failed'; readonly cause: PersonalStatsError }
  /** La configurazione dei badge e' invalida. Arriva DOPO la `raise`: vedi l'intestazione. */
  | { readonly kind: 'badge-config-invalid'; readonly cause: AwardBadgesError };

export async function refreshPersonalBests(
  input: RefreshPersonalBestsInput,
  deps: RefreshPersonalBestsDeps,
  config: RefreshPersonalBestsConfig
): Promise<Result<RefreshPersonalBestsOutcome, RefreshPersonalBestsError>> {
  const trasferte = await deps.trips.listByOwner(input.profileId);
  if (!trasferte.ok) return err({ kind: 'storage-failed', cause: trasferte.error });

  const inviate = await deps.requests.listByRequester(input.profileId);
  if (!inviate.ok) return err({ kind: 'storage-failed', cause: inviate.error });

  // Le candidature RICEVUTE: una lettura per ogni tratta propria (vedi i LIMITI).
  const candidature = new Map<string, MatchRequest>();
  for (const richiesta of inviate.value) candidature.set(richiesta.id, richiesta);
  for (const trasferta of trasferte.value) {
    if (!trasferta.hasCar) continue;
    const direzioni = trasferta.returnAt === null ? (['outbound'] as const) : (['outbound', 'return'] as const);
    for (const direction of direzioni) {
      const ricevute = await deps.requests.listByLeg(trasferta.id, direction);
      if (!ricevute.ok) return err({ kind: 'storage-failed', cause: ricevute.error });
      for (const richiesta of ricevute.value) candidature.set(richiesta.id, richiesta);
    }
  }

  const statistiche = computePersonalStats(
    input.profileId,
    trasferte.value,
    [...candidature.values()],
    config.distances
  );
  if (!statistiche.ok) return err({ kind: 'stats-failed', cause: statistiche.error });

  // UNA sola scrittura, con le quattro metriche insieme.
  const alzati = await deps.bests.raise({
    profileId: input.profileId,
    sharedTrips: statistiche.value.sharedTrips,
    sharedLegs: statistiche.value.sharedLegs,
    transportedColleagues: statistiche.value.transportedColleagues,
    sharedKm: statistiche.value.sharedKm,
  });
  if (!alzati.ok) return err({ kind: 'storage-failed', cause: alzati.error });

  // Sul valore ritornato da `raise`, non sul candidato.
  const badges = awardBadges(alzati.value, config.badges);
  if (!badges.ok) return err({ kind: 'badge-config-invalid', cause: badges.error });

  return ok({ bests: alzati.value, badges: badges.value });
}
