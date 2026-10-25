// parseParameters: il confine fra la tabella e il core. Ogni caso ha un test, e ogni
// errore nomina la chiave. I valori della fixture sono DIVERSI da quelli del seed:
// un valore compilato nel parser non passerebbe.

import type { RawBadgeParameter, RawParameters, RawPlantDistance } from './parse-parameters';
import { PARAMETER_KEYS, parseParameters } from './parse-parameters';

const BASE_VALUES: Readonly<Record<string, unknown>> = {
  'match.toleranceMinutes': 15,
  'createTrip.maxSeatsOffered': 4,
  'kpi.gramsCo2PerKm': 100,
  'kpi.rentalCostPerDay': 90,
  'kpi.fuelConsumptionLitersPer100Km': 6.5,
  'kpi.fuelPricePerLiter': 1.9,
  'notes.maxLength': 100,
  'cascade.autoRejectNote': 'Posti finiti.',
};

const BASE_DISTANCES: readonly RawPlantDistance[] = [
  { fromPlantId: 'pomigliano', toPlantId: 'foggia', km: 150 },
  { fromPlantId: 'pomigliano', toPlantId: 'grottaglie', km: 300 },
  { fromPlantId: 'foggia', toPlantId: 'grottaglie', km: 200 },
];

const BASE_BADGES: readonly RawBadgeParameter[] = [
  { badgeId: 'primo-viaggio', threshold: 2, label: 'Prima tappa' },
  { badgeId: 'cinque-viaggi', threshold: 3, label: 'Seconda tappa' },
  { badgeId: 'dieci-viaggi', threshold: 4, label: 'Terza tappa' },
  { badgeId: 'primo-passaggio', threshold: 2, label: 'Primo giro' },
  { badgeId: 'cinque-colleghi', threshold: 3, label: 'Compagnia' },
  { badgeId: 'mille-km', threshold: 500, label: 'Strada' },
];

function raw(parti: Partial<RawParameters> = {}): RawParameters {
  return {
    values: BASE_VALUES,
    plantDistances: BASE_DISTANCES,
    badges: BASE_BADGES,
    ...parti,
  };
}

function conValore(key: string, value: unknown): RawParameters {
  return raw({ values: { ...BASE_VALUES, [key]: value } });
}

function senzaValore(key: string): RawParameters {
  return raw({ values: Object.fromEntries(Object.entries(BASE_VALUES).filter(([k]) => k !== key)) });
}

function conBadge(index: number, modifiche: Partial<RawBadgeParameter>): RawParameters {
  return raw({ badges: BASE_BADGES.map((b, i) => (i === index ? { ...b, ...modifiche } : b)) });
}

function errore(esito: ReturnType<typeof parseParameters>): { key: string; detail: string } {
  if (esito.ok) throw new Error('atteso un errore, ottenuto ok');
  return esito.error;
}

describe('le chiavi e il caso valido', () => {
  it('le chiavi dei parametri sono otto e pinnate: sono identita\', non dati', () => {
    expect(PARAMETER_KEYS).toEqual([
      'match.toleranceMinutes',
      'createTrip.maxSeatsOffered',
      'kpi.gramsCo2PerKm',
      'kpi.rentalCostPerDay',
      'kpi.fuelConsumptionLitersPer100Km',
      'kpi.fuelPricePerLiter',
      'notes.maxLength',
      'cascade.autoRejectNote',
    ]);
  });

  it('righe valide: i tipi che gli usecase ricevono, scritti per esteso', () => {
    expect(parseParameters(raw())).toEqual({
      ok: true,
      value: {
        matching: { toleranceMinutes: 15 },
        createTrip: { maxSeatsOffered: 4 },
        kpi: {
          gramsCo2PerKm: 100,
          rentalCostPerDay: 90,
          fuelConsumptionLitersPer100Km: 6.5,
          fuelPricePerLiter: 1.9,
          distanceKm: {
            pomigliano: { foggia: 150, grottaglie: 300 },
            foggia: { grottaglie: 200 },
          },
        },
        notes: { maxLength: 100 },
        cascade: { autoRejectNote: 'Posti finiti.' },
        badges: {
          thresholds: {
            'primo-viaggio': 2,
            'cinque-viaggi': 3,
            'dieci-viaggi': 4,
            'primo-passaggio': 2,
            'cinque-colleghi': 3,
            'mille-km': 500,
          },
          labels: {
            'primo-viaggio': 'Prima tappa',
            'cinque-viaggi': 'Seconda tappa',
            'dieci-viaggi': 'Terza tappa',
            'primo-passaggio': 'Primo giro',
            'cinque-colleghi': 'Compagnia',
            'mille-km': 'Strada',
          },
        },
      },
    });
  });

  it('la distanza si legge nel verso in cui e\' scritta la riga, non in uno imposto', () => {
    const esito = parseParameters(
      raw({
        plantDistances: [
          { fromPlantId: 'foggia', toPlantId: 'pomigliano', km: 150 },
          { fromPlantId: 'grottaglie', toPlantId: 'pomigliano', km: 300 },
          { fromPlantId: 'grottaglie', toPlantId: 'foggia', km: 200 },
        ],
      })
    );
    expect(esito.ok && esito.value.kpi.distanceKm).toEqual({
      foggia: { pomigliano: 150 },
      grottaglie: { pomigliano: 300, foggia: 200 },
    });
  });
});

describe('i confini validi sono accettati', () => {
  it('tolleranza 0, un posto, soglie 1, limite 1, costi a 0', () => {
    const esito = parseParameters(
      raw({
        values: {
          ...BASE_VALUES,
          'match.toleranceMinutes': 0,
          'createTrip.maxSeatsOffered': 1,
          'kpi.gramsCo2PerKm': 0,
          'kpi.rentalCostPerDay': 0,
          'kpi.fuelConsumptionLitersPer100Km': 0,
          'kpi.fuelPricePerLiter': 0,
          'notes.maxLength': 1,
          'cascade.autoRejectNote': 'x',
        },
        plantDistances: BASE_DISTANCES.map((d) => ({ ...d, km: 0 })),
        badges: BASE_BADGES.map((b) => ({ ...b, threshold: 1 })),
      })
    );
    expect(esito.ok).toBe(true);
  });
});

describe('nessun valore di default: un parametro mancante e\' un errore con la sua chiave', () => {
  it.each(PARAMETER_KEYS)('manca %s', (key) => {
    expect(errore(parseParameters(senzaValore(key)))).toEqual({
      key,
      detail: 'parametro mancante',
    });
  });

  it('nessuna riga: errore sulla prima chiave, non un oggetto di default', () => {
    const esito = parseParameters({ values: {}, plantDistances: [], badges: [] });
    expect(errore(esito).key).toBe('match.toleranceMinutes');
  });

  it('un valore undefined e\' mancante', () => {
    expect(errore(parseParameters(conValore('kpi.fuelPricePerLiter', undefined)))).toEqual({
      key: 'kpi.fuelPricePerLiter',
      detail: 'parametro mancante',
    });
  });
});

describe('valore non numerico: nessuna conversione', () => {
  const NUMERICHE = PARAMETER_KEYS.filter((k) => k !== 'cascade.autoRejectNote');

  it.each(NUMERICHE)('%s come stringa "30" e\' rifiutato, non convertito', (key) => {
    expect(errore(parseParameters(conValore(key, '30'))).key).toBe(key);
  });

  it.each([null, true, {}, [], Number.NaN])('match.toleranceMinutes = %j', (valore) => {
    expect(errore(parseParameters(conValore('match.toleranceMinutes', valore))).key).toBe(
      'match.toleranceMinutes'
    );
  });

  it('il testo della nota automatica non puo\' essere un numero', () => {
    expect(errore(parseParameters(conValore('cascade.autoRejectNote', 5)))).toMatchObject({
      key: 'cascade.autoRejectNote',
    });
  });
});

describe('fuori intervallo', () => {
  it.each([
    ['match.toleranceMinutes', -1],
    ['match.toleranceMinutes', 1.5],
    ['match.toleranceMinutes', Number.POSITIVE_INFINITY],
    ['createTrip.maxSeatsOffered', 0],
    ['createTrip.maxSeatsOffered', -1],
    ['createTrip.maxSeatsOffered', 2.5],
    ['kpi.gramsCo2PerKm', -0.1],
    ['kpi.rentalCostPerDay', Number.POSITIVE_INFINITY],
    ['kpi.fuelConsumptionLitersPer100Km', -1],
    ['kpi.fuelPricePerLiter', Number.NaN],
    ['notes.maxLength', 0],
    ['notes.maxLength', 1.5],
    ['notes.maxLength', -5],
  ])('%s = %s', (key, valore) => {
    expect(errore(parseParameters(conValore(key, valore))).key).toBe(key);
  });

  it('la tolleranza e\' un intero >= 0: 0 e\' valido, -1 no (stesso predicato di findMatches)', () => {
    expect(parseParameters(conValore('match.toleranceMinutes', 0)).ok).toBe(true);
    expect(parseParameters(conValore('match.toleranceMinutes', -1)).ok).toBe(false);
  });

  it('i posti: 1 e\' il confine valido piu\' basso, 0 no', () => {
    expect(parseParameters(conValore('createTrip.maxSeatsOffered', 1)).ok).toBe(true);
    expect(parseParameters(conValore('createTrip.maxSeatsOffered', 0)).ok).toBe(false);
  });
});

describe('chiavi sconosciute', () => {
  it('una chiave fuori da PARAMETER_KEYS e\' rifiutata, anche accanto a quelle giuste', () => {
    expect(errore(parseParameters(conValore('match.toleranceMinute', 10)))).toEqual({
      key: 'match.toleranceMinute',
      detail: 'chiave sconosciuta: la tabella non puo\' crearne',
    });
  });
});

describe('la nota automatica e il limite CARICATO', () => {
  it('vuota o di soli spazi', () => {
    expect(errore(parseParameters(conValore('cascade.autoRejectNote', '   ')))).toEqual({
      key: 'cascade.autoRejectNote',
      detail: 'testo vuoto o di soli spazi',
    });
  });

  it('oltre il limite caricato (non quello del seed): rifiutata', () => {
    const esito = parseParameters(
      raw({ values: { ...BASE_VALUES, 'notes.maxLength': 5, 'cascade.autoRejectNote': 'sei ok' } })
    );
    expect(errore(esito)).toEqual({
      key: 'cascade.autoRejectNote',
      detail: '6 code point, oltre il limite caricato di 5',
    });
  });

  it('esattamente al limite: accettata; si contano i code point, non le unita\'', () => {
    const tre = '\u{1F44D}\u{1F44D}\u{1F44D}';
    expect(tre.length).toBe(6);
    const alLimite = raw({ values: { ...BASE_VALUES, 'notes.maxLength': 3, 'cascade.autoRejectNote': tre } });
    const oltre = raw({
      values: { ...BASE_VALUES, 'notes.maxLength': 3, 'cascade.autoRejectNote': `${tre}\u{1F44D}` },
    });
    expect(parseParameters(alLimite).ok).toBe(true);
    expect(parseParameters(oltre).ok).toBe(false);
  });
});

describe('distanze fra plant', () => {
  it.each([
    ['pomigliano', 'foggia'],
    ['pomigliano', 'grottaglie'],
    ['foggia', 'grottaglie'],
  ])('manca la coppia %s - %s', (a, b) => {
    const righe = BASE_DISTANCES.filter(
      (d) => !(d.fromPlantId === a && d.toPlantId === b)
    );
    expect(righe).toHaveLength(2);
    expect(errore(parseParameters(raw({ plantDistances: righe })))).toEqual({
      key: `distance:${a}-${b}`,
      detail: 'distanza mancante per la coppia',
    });
  });

  it('coppia duplicata', () => {
    const righe = [...BASE_DISTANCES, { fromPlantId: 'pomigliano', toPlantId: 'foggia', km: 1 }];
    expect(errore(parseParameters(raw({ plantDistances: righe })))).toMatchObject({
      key: 'distance:pomigliano-foggia',
    });
  });

  it('coppia duplicata con i plant invertiti', () => {
    const righe = [...BASE_DISTANCES, { fromPlantId: 'foggia', toPlantId: 'pomigliano', km: 1 }];
    expect(errore(parseParameters(raw({ plantDistances: righe })))).toMatchObject({
      key: 'distance:pomigliano-foggia',
      detail: 'coppia duplicata (anche con i plant invertiti)',
    });
  });

  it('plant uguali', () => {
    const righe = [...BASE_DISTANCES, { fromPlantId: 'foggia', toPlantId: 'foggia', km: 0 }];
    expect(errore(parseParameters(raw({ plantDistances: righe })))).toEqual({
      key: 'distance:foggia-foggia',
      detail: 'i due plant della coppia sono uguali',
    });
  });

  it('un plant fuori da PLANT_IDS: la tabella non crea un\'identita\'', () => {
    const righe = [...BASE_DISTANCES, { fromPlantId: 'pomigliano', toPlantId: 'napoli', km: 30 }];
    expect(errore(parseParameters(raw({ plantDistances: righe })))).toMatchObject({
      key: 'distance:pomigliano-napoli',
    });
  });

  it.each(['150', -1, Number.NaN, null])('km = %j', (km) => {
    const righe = BASE_DISTANCES.map((d, i) => (i === 0 ? { ...d, km } : d));
    expect(errore(parseParameters(raw({ plantDistances: righe })))).toMatchObject({
      key: 'distance:pomigliano-foggia',
    });
  });
});

describe('badge', () => {
  it('un badge fuori da BADGE_IDS: la tabella non crea un\'identita\'', () => {
    const righe = [...BASE_BADGES, { badgeId: 'cento-viaggi', threshold: 100, label: 'Cento' }];
    expect(errore(parseParameters(raw({ badges: righe })))).toEqual({
      key: 'badge:cento-viaggi',
      detail: 'badge sconosciuto: la tabella non puo\' crearne',
    });
  });

  it('badge duplicato', () => {
    const righe = [...BASE_BADGES, { badgeId: 'mille-km', threshold: 9, label: 'Altra strada' }];
    expect(errore(parseParameters(raw({ badges: righe })))).toEqual({
      key: 'badge:mille-km',
      detail: 'badge duplicato',
    });
  });

  it('badge mancante', () => {
    const righe = BASE_BADGES.filter((b) => b.badgeId !== 'dieci-viaggi');
    expect(errore(parseParameters(raw({ badges: righe })))).toEqual({
      key: 'badge:dieci-viaggi',
      detail: 'badge mancante',
    });
  });

  it.each([0, -1, 1.5, '5', null, Number.NaN])('soglia = %j', (soglia) => {
    expect(errore(parseParameters(conBadge(5, { threshold: soglia })))).toMatchObject({
      key: 'badge:mille-km.threshold',
    });
  });

  it.each(['', '  '])('etichetta vuota %j', (label) => {
    expect(errore(parseParameters(conBadge(0, { label })))).toEqual({
      key: 'badge:primo-viaggio.label',
      detail: 'etichetta vuota',
    });
  });

  it('etichetta con una parola vietata: errore sul badge, con la parola', () => {
    expect(errore(parseParameters(conBadge(2, { label: 'Ticket restaurant' })))).toEqual({
      key: 'badge:dieci-viaggi.label',
      detail: 'l\'etichetta contiene la parola vietata "ticket"',
    });
  });

  it('"Ricompense per te" non passa (il plurale)', () => {
    expect(errore(parseParameters(conBadge(1, { label: 'Ricompense per te' }))).key).toBe(
      'badge:cinque-viaggi.label'
    );
  });

  it('etichetta che non e\' un testo', () => {
    expect(errore(parseParameters(conBadge(1, { label: 7 }))).key).toBe('badge:cinque-viaggi.label');
  });
});

describe('il primo errore, in ordine fisso', () => {
  it('chiave sconosciuta prima di un parametro mancante', () => {
    const esito = parseParameters(raw({ values: { refuso: 1 } }));
    expect(errore(esito).key).toBe('refuso');
  });

  it('gli scalari prima delle distanze, le distanze prima dei badge', () => {
    const tuttoRotto = raw({
      values: { ...BASE_VALUES, 'notes.maxLength': 0 },
      plantDistances: [],
      badges: [],
    });
    expect(errore(parseParameters(tuttoRotto)).key).toBe('notes.maxLength');

    const distanzeEBadgeRotti = raw({ plantDistances: [], badges: [] });
    expect(errore(parseParameters(distanzeEBadgeRotti)).key).toBe('distance:pomigliano-foggia');
  });
});
