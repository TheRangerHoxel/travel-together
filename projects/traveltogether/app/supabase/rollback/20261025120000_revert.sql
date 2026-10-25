-- Annulla le migrazioni di T08 (schema, funzioni, seed): riporta public e private allo stato
-- vuoto. Funziona anche su uno schema vuoto o applicato a meta (`if exists` ovunque).
--
-- NON e una migrazione: non sta in migrations/ e la CLI non la applica. Serve a due cose:
--  - i test di integrazione la eseguono prima delle migrazioni, dentro una transazione
--    annullata, cosi lo schema in prova viene sempre dai file del repo;
--  - se una migrazione applicata si rivelasse sbagliata, il suo contenuto (copiato in una
--    migrazione NUOVA) e il ritorno indietro. Una migrazione applicata non si riscrive e non
--    si fa `db reset`.
--
-- Non tocca auth ne supabase_migrations. Ma NON si limita agli oggetti di T08: `drop schema
-- private cascade` porta via qualunque cosa sia in `private`, e `drop table ... cascade` anche
-- le dipendenze di quelle tabelle (viste, funzioni, foreign key di tabelle future). Oggi in
-- `private` e nelle 8 tabelle c'e solo T08; il giorno in cui qualcuno aggiunge oggetti li, questo
-- script va riletto prima di usarlo su un database con dati.
-- Nessuna istruzione di controllo della transazione.

-- Funzioni dell app, prima delle tabelle (raise_personal_bests restituisce il tipo di riga).
drop function if exists public.adjust_leg_seats(uuid, public.leg_direction, integer);
drop function if exists public.restore_system_rejected(uuid, public.leg_direction);
drop function if exists public.raise_personal_bests(uuid, integer, integer, integer, double precision);

-- Le tabelle, con i loro trigger e le loro policy.
drop table if exists public.match_requests cascade;
drop table if exists public.trip_legs cascade;
drop table if exists public.trips cascade;
drop table if exists public.personal_bests cascade;
drop table if exists public.plant_distances cascade;
drop table if exists public.badge_parameters cascade;
drop table if exists public.parameters cascade;
drop table if exists public.profiles cascade;

-- Lo schema privato porta con se funzioni di trigger e procedure.
drop schema if exists private cascade;

drop type if exists public.plant_id;
drop type if exists public.badge_id;
drop type if exists public.parameter_key;
drop type if exists public.leg_direction;
drop type if exists public.trip_status;
drop type if exists public.match_request_status;
drop type if exists public.resolved_by;
