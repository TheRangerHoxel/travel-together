-- T08 · 3/3 · Seed dei parametri.
--
-- GENERATO da app/scripts/generate-parameter-seed.mjs a partire da src/config/parameters.ts
-- (SEED_PARAMETERS). NON modificare a mano: un test confronta questo file con l output del
-- generatore e cade se divergono.
--
-- Dopo la prima applicazione questo file e congelato: una migrazione applicata non si riscrive.
-- Se SEED_PARAMETERS cambia, quel test cade apposta, e la decisione su cosa farne (una
-- migrazione nuova che ritara le righe?) e dell umano. Dopo l applicazione le tabelle sono la
-- fonte a runtime e possono divergere dal seed.
--
-- Nessuna istruzione di controllo della transazione.

insert into public.parameters (key, value) values
  ('match.toleranceMinutes', '30'::jsonb),
  ('createTrip.maxSeatsOffered', '8'::jsonb),
  ('kpi.gramsCo2PerKm', '110'::jsonb),
  ('kpi.rentalCostPerDay', '120'::jsonb),
  ('kpi.fuelConsumptionLitersPer100Km', '7'::jsonb),
  ('kpi.fuelPricePerLiter', '2.2'::jsonb),
  ('notes.maxLength', '280'::jsonb),
  ('cascade.autoRejectNote', to_jsonb('Posti esauriti: è stato accettato un altro collega.'::text));

insert into public.plant_distances (from_plant_id, to_plant_id, km) values
  ('pomigliano', 'foggia', 165),
  ('pomigliano', 'grottaglie', 320),
  ('foggia', 'grottaglie', 232);

insert into public.badge_parameters (badge_id, threshold, label) values
  ('primo-viaggio', 1, 'Primo viaggio condiviso'),
  ('cinque-viaggi', 5, 'Viaggiatore ricorrente'),
  ('dieci-viaggi', 10, 'Viaggiatore esperto'),
  ('primo-passaggio', 1, 'Primo passaggio offerto'),
  ('cinque-colleghi', 5, 'Compagno di strada'),
  ('mille-km', 1000, 'Lunga strada condivisa');
