// Il seed dei parametri, applicato: le righe lette dalle tabelle, passate a parseParameters,
// danno lo STESSO AppParameters del seed in codice. Prova che jsonb conserva numeri, testo e
// accenti, e che la migrazione generata e il seed non divergono dopo l'applicazione.
//
// Dopo la prima applicazione su staging le tabelle sono la fonte a runtime e possono divergere
// dal seed per decisione dell'umano: questo test applica i FILE del repo in una transazione
// annullata, quindi guarda sempre il seed della migrazione e non i valori ritarati di staging.

import { SEED_PARAMETERS } from '../../src/config';
import type { RawParameters } from '../../src/core/domain';
import { parseParameters } from '../../src/core/domain';
import { type Sessione, applicaSchema, inTransazioneAnnullata } from './support/db';
import { creaProfilo } from './support/fixtures';

/** Le righe delle tre tabelle, nella forma grezza che parseParameters riceve. */
async function leggiRighe(s: Sessione): Promise<RawParameters> {
  const parametri = await s.esegui('select key::text as key, value from public.parameters');
  const distanze = await s.esegui(
    'select from_plant_id::text as "fromPlantId", to_plant_id::text as "toPlantId", km as "km" from public.plant_distances'
  );
  const badge = await s.esegui(
    'select badge_id::text as "badgeId", threshold as "threshold", label as "label" from public.badge_parameters'
  );
  return {
    values: Object.fromEntries(parametri.map((riga) => [String(riga.key), riga.value])),
    plantDistances: distanze.map((riga) => ({
      fromPlantId: riga.fromPlantId,
      toPlantId: riga.toPlantId,
      km: riga.km,
    })),
    badges: badge.map((riga) => ({ badgeId: riga.badgeId, threshold: riga.threshold, label: riga.label })),
  };
}

describe('il seed dei parametri applicato', () => {
  it('le righe lette, passate a parseParameters, danno lo stesso AppParameters del seed in codice', async () => {
    const righe = await inTransazioneAnnullata(async (s) => {
      await applicaSchema(s);
      // Lo legge un autenticato, come l'app: SELECT per authenticated.
      const utente = await creaProfilo(s);
      await s.comeUtente(utente);
      return leggiRighe(s);
    });

    const dalleTabelle = parseParameters(righe);
    const dalSeed = parseParameters(SEED_PARAMETERS);
    expect(dalSeed.ok).toBe(true);
    expect(dalleTabelle.ok).toBe(true);
    expect(dalleTabelle).toEqual(dalSeed);
    // Non vacuo: il confronto sopra passerebbe con due errori uguali.
    if (dalleTabelle.ok) {
      expect(dalleTabelle.value.cascade.autoRejectNote).toBe('Posti esauriti: è stato accettato un altro collega.');
      expect(dalleTabelle.value.kpi.fuelConsumptionLitersPer100Km).toBe(7);
      expect(dalleTabelle.value.kpi.fuelPricePerLiter).toBe(2.2);
      expect(dalleTabelle.value.badges.labels['mille-km']).toBe('Lunga strada condivisa');
    }
  });

  it('i numeri restano numeri e il testo resta testo: nessun valore e passato come stringa', async () => {
    const tipi = await inTransazioneAnnullata(async (s) => {
      await applicaSchema(s);
      const righe = await s.esegui('select key::text as key, jsonb_typeof(value) as tipo from public.parameters');
      return Object.fromEntries(righe.map((riga) => [String(riga.key), riga.tipo]));
    });

    expect(tipi['notes.maxLength']).toBe('number');
    expect(tipi['kpi.fuelPricePerLiter']).toBe('number');
    expect(tipi['cascade.autoRejectNote']).toBe('string');
  });

  // I due casi della suite di contratto di T07b restano RAPPRESENTABILI nelle tabelle (nessun CHECK
  // li impedisce) e a rifiutarli e parseParameters, al primo load.
  it('una coppia di distanze mancante e rappresentabile; parseParameters la rifiuta con la coppia come chiave', async () => {
    const righe = await inTransazioneAnnullata(async (s) => {
      await applicaSchema(s);
      await s.modifica("delete from public.plant_distances where from_plant_id = 'foggia' and to_plant_id = 'grottaglie'");
      return leggiRighe(s);
    });

    expect(righe.plantDistances).toHaveLength(2);
    expect(parseParameters(righe)).toEqual({
      ok: false,
      error: { key: 'distance:foggia-grottaglie', detail: 'distanza mancante per la coppia' },
    });
  });

  it('un etichetta con una parola vietata e rappresentabile; parseParameters la rifiuta con l etichetta come chiave', async () => {
    const righe = await inTransazioneAnnullata(async (s) => {
      await applicaSchema(s);
      await s.modifica("update public.badge_parameters set label = 'Ticket omaggio' where badge_id = 'primo-viaggio'");
      return leggiRighe(s);
    });

    const esito = parseParameters(righe);
    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.key).toBe('badge:primo-viaggio.label');
      expect(esito.error.detail).toContain('ticket');
    }
  });
});
