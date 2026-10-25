// Il generatore del seed SQL, provato su seed inventati: la quotatura (un apostrofo, che il seed
// di oggi non ha), i numeri, le sezioni vuote e i valori non serializzabili. Il confronto con il
// file committato sta in parameter-seed-file.fs.test.ts.

import type { RawParameters } from '../../core/domain';
import { renderParameterSeedSql } from './parameter-seed-sql';

const VUOTO: RawParameters = { values: {}, plantDistances: [], badges: [] };

function sql(seed: RawParameters): string {
  const esito = renderParameterSeedSql(seed);
  if (!esito.ok) throw new Error(`atteso ok, errore in ${esito.error.where}: ${esito.error.detail}`);
  return esito.value;
}

describe('renderParameterSeedSql', () => {
  it('un apostrofo nel testo e raddoppiato: nel valore, nell etichetta e nel plant', () => {
    const uscita = sql({
      values: { 'cascade.autoRejectNote': "Posti esauriti: l'ultimo e andato" },
      plantDistances: [{ fromPlantId: "d'Arco", toPlantId: 'foggia', km: 1 }],
      badges: [{ badgeId: 'primo-viaggio', threshold: 1, label: "L'altra strada" }],
    });

    expect(uscita).toContain("to_jsonb('Posti esauriti: l''ultimo e andato'::text)");
    expect(uscita).toContain("('d''Arco', 'foggia', 1)");
    expect(uscita).toContain("('primo-viaggio', 1, 'L''altra strada')");
    // Nessun apice singolo isolato dentro un letterale: tolti i raddoppi, gli apici sono a coppie.
    const senzaRaddoppi = uscita.replaceAll("''", '');
    const lineeDati = senzaRaddoppi.split('\n').filter((linea) => linea.startsWith('  ('));
    for (const linea of lineeDati) {
      expect((linea.match(/'/g) ?? []).length % 2).toBe(0);
    }
  });

  it('i numeri sono jsonb senza zeri inutili: 7.0 diventa 7, 2.2 resta 2.2, un esponente e valido', () => {
    const uscita = sql({ ...VUOTO, values: { a: 7.0, b: 2.2, c: 1e-7, d: 0, e: -3 } });

    expect(uscita).toContain("('a', '7'::jsonb)");
    expect(uscita).toContain("('b', '2.2'::jsonb)");
    expect(uscita).toContain("('c', '1e-7'::jsonb)");
    expect(uscita).toContain("('d', '0'::jsonb)");
    expect(uscita).toContain("('e', '-3'::jsonb)");
  });

  it('un accento e una virgoletta restano nel testo, e il JSON lo scrive Postgres (to_jsonb)', () => {
    const uscita = sql({ ...VUOTO, values: { nota: 'Più "posti" \\ liberi' } });

    expect(uscita).toContain('to_jsonb(\'Più "posti" \\ liberi\'::text)');
  });

  it('una sezione senza righe non produce l istruzione', () => {
    const uscita = sql({ ...VUOTO, values: { x: 1 } });

    expect(uscita).toContain('insert into public.parameters');
    expect(uscita).not.toContain('plant_distances');
    expect(uscita).not.toContain('badge_parameters');
    expect(sql(VUOTO)).not.toContain('insert into');
  });

  it('e deterministico, finisce con un a capo e ha l intestazione che dice di non modificarlo a mano', () => {
    const seed: RawParameters = { ...VUOTO, values: { x: 1 } };

    expect(sql(seed)).toBe(sql(seed));
    expect(sql(seed).endsWith(';\n')).toBe(true);
    expect(sql(seed)).toContain('GENERATO da app/scripts/generate-parameter-seed.mjs');
    expect(sql(seed)).toContain('NON modificare a mano');
  });

  it('niente istruzioni di controllo della transazione', () => {
    expect(sql({ ...VUOTO, values: { x: 1 } })).not.toMatch(/^\s*(begin|commit|rollback)\b/im);
  });

  it.each([
    ['un booleano', { values: { x: true }, plantDistances: [], badges: [] }, 'values.x'],
    ['null', { values: { x: null }, plantDistances: [], badges: [] }, 'values.x'],
    ['un numero non finito', { values: { x: Number.POSITIVE_INFINITY }, plantDistances: [], badges: [] }, 'values.x'],
    ['NaN', { values: { x: Number.NaN }, plantDistances: [], badges: [] }, 'values.x'],
    ['un testo con NUL', { values: { x: 'a\u0000b' }, plantDistances: [], badges: [] }, 'values.x'],
    [
      'km non numerico',
      { values: {}, plantDistances: [{ fromPlantId: 'a', toPlantId: 'b', km: '165' }], badges: [] },
      'plantDistances[0].km',
    ],
    [
      'plant non testuale',
      { values: {}, plantDistances: [{ fromPlantId: 1, toPlantId: 'b', km: 1 }], badges: [] },
      'plantDistances[0].fromPlantId',
    ],
    [
      'soglia non numerica',
      { values: {}, plantDistances: [], badges: [{ badgeId: 'x', threshold: 'uno', label: 'e' }] },
      'badges[0].threshold',
    ],
    [
      'etichetta non testuale',
      { values: {}, plantDistances: [], badges: [{ badgeId: 'x', threshold: 1, label: 5 }] },
      'badges[0].label',
    ],
  ])('rifiuta %s, con il punto in cui sta', (_nome, seed, dove) => {
    const esito = renderParameterSeedSql(seed);

    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.error.where).toBe(dove);
  });
});
