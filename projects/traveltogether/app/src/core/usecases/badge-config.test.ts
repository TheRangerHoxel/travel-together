// Test di conformita': lega i VALORI reali di config/badges.ts al TIPO del core.
// Stessa ragione di kpi-config.test.ts. E' l'unico punto del core che importa
// config/ per i badge.

import { BADGE_CONFIG } from '../../config';
import { BADGE_IDS } from '../domain';
import { awardBadges } from './award-badges';
import type { BadgeConfig } from './badge-config';

describe('i valori di config/badges.ts sono conformi al tipo del core', () => {
  it('BADGE_CONFIG soddisfa BadgeConfig', () => {
    // L'annotazione E' l'asserzione.
    const conforme: BadgeConfig = BADGE_CONFIG;
    expect(conforme.thresholds['primo-viaggio']).toBe(BADGE_CONFIG.thresholds['primo-viaggio']);
  });

  it('ogni badge ha una soglia intera >= 1', () => {
    for (const id of BADGE_IDS) {
      const threshold: number = BADGE_CONFIG.thresholds[id];
      expect(Number.isInteger(threshold) && threshold >= 1).toBe(true);
    }
  });

  it('i valori di produzione sono quelli dichiarati', () => {
    expect(BADGE_CONFIG.thresholds).toEqual({
      'primo-viaggio': 1,
      'cinque-viaggi': 5,
      'dieci-viaggi': 10,
      'primo-passaggio': 1,
      'cinque-colleghi': 5,
      'mille-km': 1000,
    });
  });

  it('la config di produzione e\' accettata da awardBadges', () => {
    const result = awardBadges(
      { profileId: 'x', sharedTrips: 0, sharedLegs: 0, transportedColleagues: 0, sharedKm: 0 },
      BADGE_CONFIG
    );
    expect(result).toEqual({ ok: true, value: [] });
  });
});
