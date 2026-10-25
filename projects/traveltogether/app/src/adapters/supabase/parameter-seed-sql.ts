// Il seed dei parametri come SQL: la migrazione 3 di T08 e DERIVATA da `SEED_PARAMETERS`, non
// riscritta a mano. Cosi `config/` e la migrazione non possono divergere: un test confronta il
// file committato con l'output di questa funzione.
//
// Funzione pura. Sta in adapters/supabase/ e non nel core perche la forma delle righe (jsonb,
// letterali SQL, nomi di tabella) e un problema di Postgres.
//
// NIENTE import a runtime: lo script `scripts/generate-parameter-seed.mjs` la esegue con Node,
// che toglie i tipi ma non risolve import senza estensione. Quindi solo `import type`, e il
// Result e costruito come oggetto (e la stessa forma di core/domain/result.ts).

import type { RawParameters, Result } from '../../core/domain';

export interface SeedSqlError {
  /** Dove: 'values.<chiave>', 'plantDistances[2].km', 'badges[0].label'. */
  readonly where: string;
  readonly detail: string;
}

/** Le colonne e la tabella di destinazione, nell'ordine in cui vengono scritte. */
export const PARAMETER_SEED_HEADER = [
  '-- T08 · 3/3 · Seed dei parametri.',
  '--',
  '-- GENERATO da app/scripts/generate-parameter-seed.mjs a partire da src/config/parameters.ts',
  '-- (SEED_PARAMETERS). NON modificare a mano: un test confronta questo file con l output del',
  '-- generatore e cade se divergono.',
  '--',
  '-- Dopo la prima applicazione questo file e congelato: una migrazione applicata non si riscrive.',
  '-- Se SEED_PARAMETERS cambia, quel test cade apposta, e la decisione su cosa farne (una',
  '-- migrazione nuova che ritara le righe?) e dell umano. Dopo l applicazione le tabelle sono la',
  '-- fonte a runtime e possono divergere dal seed.',
  '--',
  '-- Nessuna istruzione di controllo della transazione.',
].join('\n');

/** Un letterale di testo SQL: apici raddoppiati. Un NUL non si puo scrivere in un testo Postgres. */
function textLiteral(value: string, where: string): Result<string, SeedSqlError> {
  if (value.includes('\u0000')) {
    return { ok: false, error: { where, detail: 'contiene un carattere NUL, che Postgres non memorizza' } };
  }
  return { ok: true, value: `'${value.replaceAll("'", "''")}'` };
}

function numberLiteral(value: unknown, where: string): Result<string, SeedSqlError> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: { where, detail: 'atteso un numero finito' } };
  }
  // String(n) da una forma valida sia come numero JSON sia come letterale numerico SQL
  // (7 per 7.0, 1e-7, 1e+21), e conserva il valore di un double.
  return { ok: true, value: String(value) };
}

/** Il valore di un parametro scalare, come jsonb: numero o testo, non altro. */
function jsonbLiteral(value: unknown, where: string): Result<string, SeedSqlError> {
  if (typeof value === 'number') {
    const numero = numberLiteral(value, where);
    return numero.ok ? { ok: true, value: `'${numero.value}'::jsonb` } : numero;
  }
  if (typeof value === 'string') {
    const testo = textLiteral(value, where);
    // to_jsonb(text) lascia a Postgres l'escape del JSON (virgolette, accenti, backslash).
    return testo.ok ? { ok: true, value: `to_jsonb(${testo.value}::text)` } : testo;
  }
  return { ok: false, error: { where, detail: 'atteso un numero o un testo' } };
}

/** Un valore che deve essere un testo (un plant, un id di badge, un'etichetta). */
function textOf(value: unknown, where: string): Result<string, SeedSqlError> {
  if (typeof value !== 'string') {
    return { ok: false, error: { where, detail: 'atteso un testo' } };
  }
  return textLiteral(value, where);
}

/** Raccoglie i risultati di una lista di letterali, o il primo errore. */
function tutti(parti: readonly Result<string, SeedSqlError>[]): Result<string[], SeedSqlError> {
  const valori: string[] = [];
  for (const parte of parti) {
    if (!parte.ok) return parte;
    valori.push(parte.value);
  }
  return { ok: true, value: valori };
}

/**
 * Le tre INSERT del seed. Una sezione vuota (nessuna riga) non produce l'istruzione: una
 * INSERT senza valori non e SQL valido.
 */
export function renderParameterSeedSql(seed: RawParameters): Result<string, SeedSqlError> {
  const sezioni: string[] = [PARAMETER_SEED_HEADER];

  const scalari: Result<string, SeedSqlError>[] = [];
  for (const [chiave, valore] of Object.entries(seed.values)) {
    const where = `values.${chiave}`;
    const chiaveSql = textLiteral(chiave, where);
    const valoreSql = jsonbLiteral(valore, where);
    if (!chiaveSql.ok) return chiaveSql;
    if (!valoreSql.ok) return valoreSql;
    scalari.push({ ok: true, value: `  (${chiaveSql.value}, ${valoreSql.value})` });
  }
  const righeScalari = tutti(scalari);
  if (!righeScalari.ok) return righeScalari;
  if (righeScalari.value.length > 0) {
    sezioni.push(
      `insert into public.parameters (key, value) values\n${righeScalari.value.join(',\n')};`
    );
  }

  const distanze: Result<string, SeedSqlError>[] = [];
  for (const [indice, riga] of seed.plantDistances.entries()) {
    const radice = `plantDistances[${String(indice)}]`;
    const da = textOf(riga.fromPlantId, `${radice}.fromPlantId`);
    const a = textOf(riga.toPlantId, `${radice}.toPlantId`);
    const km = numberLiteral(riga.km, `${radice}.km`);
    if (!da.ok) return da;
    if (!a.ok) return a;
    if (!km.ok) return km;
    distanze.push({ ok: true, value: `  (${da.value}, ${a.value}, ${km.value})` });
  }
  const righeDistanze = tutti(distanze);
  if (!righeDistanze.ok) return righeDistanze;
  if (righeDistanze.value.length > 0) {
    sezioni.push(
      `insert into public.plant_distances (from_plant_id, to_plant_id, km) values\n${righeDistanze.value.join(',\n')};`
    );
  }

  const badge: Result<string, SeedSqlError>[] = [];
  for (const [indice, riga] of seed.badges.entries()) {
    const radice = `badges[${String(indice)}]`;
    const id = textOf(riga.badgeId, `${radice}.badgeId`);
    const soglia = numberLiteral(riga.threshold, `${radice}.threshold`);
    const etichetta = textOf(riga.label, `${radice}.label`);
    if (!id.ok) return id;
    if (!soglia.ok) return soglia;
    if (!etichetta.ok) return etichetta;
    badge.push({ ok: true, value: `  (${id.value}, ${soglia.value}, ${etichetta.value})` });
  }
  const righeBadge = tutti(badge);
  if (!righeBadge.ok) return righeBadge;
  if (righeBadge.value.length > 0) {
    sezioni.push(
      `insert into public.badge_parameters (badge_id, threshold, label) values\n${righeBadge.value.join(',\n')};`
    );
  }

  return { ok: true, value: `${sezioni.join('\n\n')}\n` };
}
