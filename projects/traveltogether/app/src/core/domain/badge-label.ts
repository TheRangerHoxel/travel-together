// Il testo di un badge e le parole che non puo' contenere. UNA lista sola.
//
// I badge sono simbolici: nessun premio, nessun buono, nessun denaro; welfare e
// alberi piantati sono fuori scope per decisione dell'umano (PRD). Le etichette
// arrivano da una tabella modificabile, quindi il controllo sta al confine
// (parseParameters) e dentro awardBadges: nessun percorso produce un `Badge` che
// prometta cio' che il prodotto non puo' mantenere.
//
// La lista e' qui e in nessun altro punto: due copie divergerebbero in silenzio, e
// una CHECK nel database sarebbe la seconda copia, in un altro linguaggio.
//
// Le voci sono RADICI, cercate dentro il testo in minuscolo: 'buon' intercetta
// "buono" e "buoni", 'ricompens' intercetta "ricompensa" e "ricompense" (con
// 'ricompensa' il plurale passava). Il controllo e' una sottostringa sul testo
// com'e': non normalizza accenti o spaziature, quindi non e' una garanzia contro un
// testo scritto per aggirarlo.
export const FORBIDDEN_BADGE_WORDS = [
  'premi',
  'buon',
  'euro',
  '€',
  'denaro',
  'soldi',
  'sconto',
  'scont',
  'voucher',
  'regalo',
  'regali',
  'bonus',
  'rimbors',
  'ricompens',
  'gratis',
  'coupon',
  'ticket',
  'welfare',
] as const;

/** Perche' un'etichetta e' rifiutata: vuota (o di soli spazi), o con una parola vietata. */
export type BadgeLabelProblem =
  | { readonly kind: 'empty' }
  | { readonly kind: 'forbidden-word'; readonly word: string };

/** Il primo problema dell'etichetta, oppure `null` se e' accettabile. */
export function badgeLabelProblem(label: string): BadgeLabelProblem | null {
  if (label.trim() === '') return { kind: 'empty' };
  const lower = label.toLowerCase();
  for (const word of FORBIDDEN_BADGE_WORDS) {
    if (lower.includes(word)) return { kind: 'forbidden-word', word };
  }
  return null;
}

/** Non vuota e senza parole vietate. */
export function isValidBadgeLabel(label: string): boolean {
  return badgeLabelProblem(label) === null;
}
