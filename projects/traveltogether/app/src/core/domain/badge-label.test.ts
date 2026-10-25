// Il predicato delle etichette dei badge. La tabella delle sedici parole del criterio
// (ognuna dentro un'etichetta, rifiutata anche da awardBadges) sta in
// core/usecases/award-badges.test.ts; qui il comportamento del predicato in se'.

import { FORBIDDEN_BADGE_WORDS, badgeLabelProblem, isValidBadgeLabel } from './badge-label';

describe('isValidBadgeLabel', () => {
  it.each([
    'Primo viaggio condiviso',
    'Viaggiatore ricorrente',
    'Viaggiatore esperto',
    'Primo passaggio offerto',
    'Compagno di strada',
    'Lunga strada condivisa',
  ])('accetta "%s"', (label) => {
    expect(isValidBadgeLabel(label)).toBe(true);
    expect(badgeLabelProblem(label)).toBeNull();
  });

  it.each(['', ' ', '\t\n'])('rifiuta l\'etichetta vuota o di soli spazi %j', (label) => {
    expect(isValidBadgeLabel(label)).toBe(false);
    expect(badgeLabelProblem(label)).toEqual({ kind: 'empty' });
  });

  it('confronta in minuscolo: "TICKET" e "Ticket" sono come "ticket"', () => {
    expect(isValidBadgeLabel('TICKET RESTAURANT')).toBe(false);
    expect(isValidBadgeLabel('Ticket restaurant')).toBe(false);
  });

  it('dice quale parola ha fermato l\'etichetta', () => {
    expect(badgeLabelProblem('Ricompense per te')).toEqual({
      kind: 'forbidden-word',
      word: 'ricompens',
    });
  });

  it('"ricompensa" e "ricompense" cadono sulla stessa radice', () => {
    expect(isValidBadgeLabel('Una ricompensa')).toBe(false);
    expect(isValidBadgeLabel('Ricompense per te')).toBe(false);
  });

  it('ogni voce della lista e\' minuscola: il confronto lavora sul testo in minuscolo', () => {
    for (const word of FORBIDDEN_BADGE_WORDS) {
      expect(word).toBe(word.toLowerCase());
    }
  });
});
