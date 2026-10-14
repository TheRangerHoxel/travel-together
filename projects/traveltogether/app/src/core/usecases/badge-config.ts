// Parametri configurabili dei badge.
//
// Il TIPO sta qui, nel core, perche' e' parte della firma di awardBadges. I VALORI
// stanno in src/config/badges.ts e vi arrivano come parametro; il legame fra le due
// meta' e' badge-config.test.ts.

import type { BadgeId } from '../domain';

export interface BadgeConfig {
  /**
   * Per ogni badge, il valore della sua metrica a cui si assegna ("almeno"). Intero
   * >= 1: con 0 il badge andrebbe a chi non ha fatto niente.
   */
  readonly thresholds: Readonly<Record<BadgeId, number>>;
}
