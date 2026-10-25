// SOLO PER I TEST. Non e' esportato da `domain/index.ts`, e non va importato da
// codice di produzione.
//
// `utc(raw)` porta un letterale scritto a mano nel tipo `UtcInstant` passando dal
// parser, e **solleva** se il letterale e' invalido: in una fixture un istante
// sbagliato e' un errore di chi scrive il test, e deve fermarlo subito. In
// produzione sollevare e' vietato (gli errori di dominio sono tipi di ritorno):
// per questo il modulo sta fuori dall'indice.

import { type UtcInstant, normalizeUtcInstant } from './instant';

export function utc(raw: string): UtcInstant {
  const r = normalizeUtcInstant(raw);
  if (!r.ok) {
    throw new Error(`Fixture con istante non valido: ${r.error.kind} (${raw})`);
  }
  return r.value;
}
