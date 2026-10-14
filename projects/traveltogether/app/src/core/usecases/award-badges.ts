// Assegnazione dei badge dalle statistiche personali.
//
// Funzione pura: nessun I/O, nessun orologio. Le statistiche arrivano da
// computePersonalStats; qui non si conta niente, si confrontano numeri con soglie.
//
// FIRMA: `awardBadges(stats, config)` NON riceve i badge gia' assegnati. Il
// risultato e' una funzione delle sole statistiche: si ricalcola da zero ogni volta,
// nell'ordine fisso del catalogo, con ogni badge al massimo una volta. Due chiamate
// con gli stessi input danno lo stesso insieme per costruzione, e un duplicato non
// e' rappresentabile (si itera il catalogo, non si accumula). Conseguenza da sapere:
// il badge non e' un fatto memorizzato, quindi se le statistiche scendono (una
// trasferta annullata a posteriori) il badge sparisce. Memorizzare i badge "per
// sempre" e' una scelta di persistenza, fuori da questo task.
//
// SOGLIA = "almeno": il badge si assegna quando la metrica raggiunge la soglia. Con
// la metrica a soglia-1 non c'e', a soglia c'e', a soglia+1 c'e' ancora (una volta).
//
// SIMBOLICI: nessun testo promette premi, denaro o buoni (CLAUDE.md di progetto).
// Un test ispeziona le etichette. Le etichette NON citano le soglie in numeri: la
// soglia e' configurabile, e un'etichetta "Cinque viaggi" con soglia 3 mentirebbe.

import type { Badge, BadgeId, Result } from '../domain';
import { BADGE_IDS, err, ok } from '../domain';
import type { BadgeConfig } from './badge-config';
import type { PersonalStats } from './compute-personal-stats';

export type BadgeFamily = 'passenger' | 'driver';

type Metric = 'sharedTrips' | 'sharedLegs' | 'transportedColleagues' | 'sharedKm';

interface CatalogEntry {
  readonly family: BadgeFamily;
  readonly metric: Metric;
  readonly label: string;
}

/** Per ogni badge: famiglia, metrica che lo assegna, testo in italiano. */
export const BADGE_CATALOG: Readonly<Record<BadgeId, CatalogEntry>> = {
  'primo-viaggio': { family: 'passenger', metric: 'sharedTrips', label: 'Primo viaggio condiviso' },
  'cinque-viaggi': { family: 'passenger', metric: 'sharedTrips', label: 'Viaggiatore ricorrente' },
  'dieci-viaggi': { family: 'passenger', metric: 'sharedTrips', label: 'Viaggiatore esperto' },
  'primo-passaggio': { family: 'driver', metric: 'sharedLegs', label: 'Primo passaggio offerto' },
  'cinque-colleghi': {
    family: 'driver',
    metric: 'transportedColleagues',
    label: 'Compagno di strada',
  },
  'mille-km': { family: 'driver', metric: 'sharedKm', label: 'Lunga strada condivisa' },
};

export type AwardBadgesError = {
  readonly kind: 'invalid-config';
  readonly badgeId: BadgeId;
};

export function awardBadges(
  stats: PersonalStats,
  config: BadgeConfig
): Result<readonly Badge[], AwardBadgesError> {
  for (const id of BADGE_IDS) {
    const threshold = config.thresholds[id];
    if (!Number.isInteger(threshold) || threshold < 1) {
      return err({ kind: 'invalid-config', badgeId: id });
    }
  }

  const awarded: Badge[] = [];
  for (const id of BADGE_IDS) {
    const entry = BADGE_CATALOG[id];
    if (stats[entry.metric] >= config.thresholds[id]) {
      awarded.push({ id, label: entry.label });
    }
  }
  return ok(awarded);
}
