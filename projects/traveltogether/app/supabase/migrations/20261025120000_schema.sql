-- T08 · 1/3 · Schema: tipi, tabelle, vincoli, RLS, policy e trigger di guardia.
--
-- Ogni tabella nasce con la RLS attiva e le sue policy, nello stesso file: questa migrazione
-- e sicura anche da sola. Funzioni e trigger che materializzano le tratte stanno nella
-- migrazione 2, il seed dei parametri nella 3 (generato da src/config/parameters.ts).
--
-- Chi scrive come `postgres` (migrazioni, seed, dashboard) scavalca le RLS: per questo gli
-- invarianti che devono valere per chiunque sono vincoli (CHECK, UNIQUE, foreign key), e
-- le policy sono il livello sopra, per i ruoli dell app (`authenticated`, `anon`).
--
-- `anon` non ha nessuna policy: legge zero righe (non un errore) e non scrive.
-- Le grant sulle tabelle sono quelle di default di Supabase per lo schema public.
--
-- Nessuna istruzione di controllo della transazione: la CLI applica ogni file in una
-- transazione, e i test eseguono questo file dentro una transazione annullata.

-- ---------------------------------------------------------------------------
-- Schema privato: non esposto da PostgREST, nessun privilegio per i ruoli dell app.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Identita del dominio come tipi enumerati: un valore sbagliato e rifiutato mentre lo si
-- scrive. Sono le union di letterali di core/domain, e un test di tipo le tiene uguali.
-- ---------------------------------------------------------------------------
create type public.plant_id as enum ('pomigliano', 'foggia', 'grottaglie');

create type public.badge_id as enum (
  'primo-viaggio',
  'cinque-viaggi',
  'dieci-viaggi',
  'primo-passaggio',
  'cinque-colleghi',
  'mille-km'
);

create type public.parameter_key as enum (
  'match.toleranceMinutes',
  'createTrip.maxSeatsOffered',
  'kpi.gramsCo2PerKm',
  'kpi.rentalCostPerDay',
  'kpi.fuelConsumptionLitersPer100Km',
  'kpi.fuelPricePerLiter',
  'notes.maxLength',
  'cascade.autoRejectNote'
);

create type public.leg_direction as enum ('outbound', 'return');
create type public.trip_status as enum ('published', 'cancelled', 'completed');
create type public.match_request_status as enum ('pending', 'accepted', 'rejected', 'cancelled');
create type public.resolved_by as enum ('owner', 'requester', 'system');

-- ---------------------------------------------------------------------------
-- profiles: l identita delle RLS (auth.uid()) e il profilo sono lo stesso id.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  plant_id public.plant_id not null
);
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  from_plant_id public.plant_id not null,
  to_plant_id public.plant_id not null,
  departure_at timestamptz not null,
  return_at timestamptz,
  has_car boolean not null,
  seats_total integer not null,
  seats_available integer not null,
  status public.trip_status not null,
  -- Bersaglio della foreign key composta di match_requests (requester_trip_id, requester_id).
  constraint trips_id_owner_key unique (id, owner_id),
  -- Gli invarianti di makeTrip, e solo quelli: le regole di creazione (plant uguali, data
  -- nel passato, rientro prima della partenza) restano fuori, la trasferta degenere e
  -- rappresentabile.
  constraint trips_seats_non_negative check (seats_total >= 0 and seats_available >= 0),
  constraint trips_no_car_no_seats check (has_car or seats_total = 0),
  constraint trips_available_within_total check (seats_available <= seats_total),
  -- Istanti al millisecondo, come normalizeUtcInstant: una frazione oltre il millisecondo e
  -- RIFIUTATA. timestamptz(3) la arrotonderebbe in silenzio (23:59:59.9996 diventerebbe il
  -- giorno dopo), e il confronto per giorno darebbe due risposte fra SQL e JavaScript.
  constraint trips_departure_at_millis check (departure_at = date_trunc('milliseconds', departure_at)),
  constraint trips_return_at_millis check (return_at is null or return_at = date_trunc('milliseconds', return_at))
);
alter table public.trips enable row level security;

create policy trips_select on public.trips
  for select to authenticated using (true);

-- Scrittura solo dall owner, upsert compreso: la WITH CHECK dell INSERT vale per la riga
-- proposta, la USING + WITH CHECK dell UPDATE per il ramo DO UPDATE. Senza il vincolo
-- sull owner, chi passa l id di un collega ne sovrascriverebbe la trasferta.
create policy trips_insert on public.trips
  for insert to authenticated with check (owner_id = (select auth.uid()));

create policy trips_update on public.trips
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- trip_legs: la tratta e una proiezione della trasferta. Nessuna policy di scrittura: la
-- scrivono solo il trigger che le materializza e adjust_leg_seats (migrazione 2).
-- ---------------------------------------------------------------------------
create table public.trip_legs (
  trip_id uuid not null references public.trips (id) on delete cascade,
  direction public.leg_direction not null,
  seats_total integer not null,
  seats_available integer not null,
  primary key (trip_id, direction),
  constraint trip_legs_seats_non_negative check (seats_total >= 0 and seats_available >= 0),
  constraint trip_legs_available_within_total check (seats_available <= seats_total)
);
alter table public.trip_legs enable row level security;

create policy trip_legs_select on public.trip_legs
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- match_requests
-- ---------------------------------------------------------------------------
create table public.match_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  direction public.leg_direction not null,
  requester_id uuid not null references public.profiles (id) on delete restrict,
  requester_trip_id uuid not null,
  status public.match_request_status not null,
  request_note text,
  resolution_note text,
  resolved_by public.resolved_by,
  -- Solo del DB: il dominio non lo legge. Lo mette private.lower_note_max_length quando accorcia una nota.
  notes_shortened boolean not null default false,
  -- Una candidatura su una tratta inesistente (il ritorno di una trasferta senza rientro) e
  -- impossibile per costruzione. RESTRICT: una tratta con candidature, in qualunque stato,
  -- non si toglie. Niente CASCADE: sarebbe perdita silenziosa.
  constraint match_requests_leg_fkey foreign key (trip_id, direction)
    references public.trip_legs (trip_id, direction) on delete restrict,
  -- La trasferta del richiedente e DEL richiedente, per chiunque scriva (anche postgres):
  -- da qui dipendono i quattro KPI. La policy sotto da all app lo stesso rifiuto, prima.
  constraint match_requests_requester_trip_fkey foreign key (requester_trip_id, requester_id)
    references public.trips (id, owner_id) on delete restrict,
  constraint match_requests_leg_requester_key unique (trip_id, direction, requester_id),
  -- Gli invarianti di validateMatchRequestStructure. Nessun CHECK sulle note vuote (la decide
  -- trim() di JavaScript, che btrim non riproduce) ne sulla lunghezza (e un parametro).
  constraint match_requests_resolution_pair check ((resolution_note is null) = (resolved_by is null)),
  constraint match_requests_pending_open check (status <> 'pending' or resolution_note is null)
);
create index match_requests_requester_idx on public.match_requests (requester_id);
alter table public.match_requests enable row level security;

-- Lettura: il richiedente e l owner della trasferta, nessun altro.
create policy match_requests_select on public.match_requests
  for select to authenticated
  using (
    requester_id = (select auth.uid())
    or exists (
      select 1 from public.trips t
      where t.id = match_requests.trip_id and t.owner_id = (select auth.uid())
    )
  );

-- Creazione: la fa il richiedente, e mai a nome altrui. pending e cancelled sono sue; accepted
-- e rejected sono dell owner della trasferta (cosi fa anche la versione in RAM). La trasferta
-- del richiedente deve essere del richiedente.
create policy match_requests_insert on public.match_requests
  for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and exists (
      select 1 from public.trips t
      where t.id = match_requests.requester_trip_id and t.owner_id = match_requests.requester_id
    )
    and (
      status in ('pending', 'cancelled')
      or exists (
        select 1 from public.trips t
        where t.id = match_requests.trip_id and t.owner_id = (select auth.uid())
      )
    )
  );

-- Modifica: la USING vede la riga VECCHIA ma non lo stato nuovo, la WITH CHECK vede la riga
-- NUOVA ma non quella vecchia. Qui sta il lato nuovo; il lato vecchio lo impone il trigger
-- match_requests_guard qui sotto.
create policy match_requests_update on public.match_requests
  for update to authenticated
  using (
    requester_id = (select auth.uid())
    or exists (
      select 1 from public.trips t
      where t.id = match_requests.trip_id and t.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = match_requests.requester_trip_id and t.owner_id = match_requests.requester_id
    )
    and (
      (status in ('pending', 'cancelled') and requester_id = (select auth.uid()))
      or (
        status in ('accepted', 'rejected')
        and exists (
          select 1 from public.trips t
          where t.id = match_requests.trip_id and t.owner_id = (select auth.uid())
        )
      )
    )
  );

-- Guardia sulla riga VECCHIA, solo per i ruoli dell app: senza, un owner potrebbe riscrivere
-- come pending, e a proprio nome, la candidatura di un collega sulla sua trasferta.
-- Non scatta dentro le funzioni security definer (restore_system_rejected, la procedura sulle
-- note): li current_user e il proprietario della funzione, non authenticated.
create function private.match_requests_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.status in ('pending', 'cancelled') then
    if old.requester_id is distinct from v_uid then
      raise exception 'pending e cancelled solo dal richiedente della riga'
        using errcode = '42501';
    end if;
  elsif not exists (
    select 1 from public.trips t where t.id = old.trip_id and t.owner_id = v_uid
  ) then
    raise exception 'accepted e rejected solo dall owner della trasferta della riga'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all on function private.match_requests_guard() from public, anon, authenticated;

create trigger match_requests_guard
  before update on public.match_requests
  for each row execute function private.match_requests_guard();

-- ---------------------------------------------------------------------------
-- personal_bests: il massimo storico di ciascuna metrica, una riga per profilo.
-- ---------------------------------------------------------------------------
create table public.personal_bests (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  shared_trips integer not null default 0,
  shared_legs integer not null default 0,
  transported_colleagues integer not null default 0,
  shared_km double precision not null default 0,
  constraint personal_bests_non_negative check (
    shared_trips >= 0 and shared_legs >= 0 and transported_colleagues >= 0
    and shared_km >= 0 and shared_km < 'Infinity'::double precision
  )
);
alter table public.personal_bests enable row level security;

-- Ciascuno legge e scrive solo la propria riga. L alzata passa da raise_personal_bests.
create policy personal_bests_select on public.personal_bests
  for select to authenticated using (profile_id = (select auth.uid()));

create policy personal_bests_insert on public.personal_bests
  for insert to authenticated with check (profile_id = (select auth.uid()));

create policy personal_bests_update on public.personal_bests
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Parametri (T07b): leggibili da ogni autenticato, scrivibili da nessuno dall app. Il gate
-- e la dashboard, che ha solo l umano: nessun ruolo admin nel modello.
-- ---------------------------------------------------------------------------
create table public.parameters (
  key public.parameter_key primary key,
  value jsonb not null,
  constraint parameters_value_scalar check (jsonb_typeof(value) in ('number', 'string'))
);
alter table public.parameters enable row level security;
create policy parameters_select on public.parameters
  for select to authenticated using (true);

create table public.plant_distances (
  from_plant_id public.plant_id not null,
  to_plant_id public.plant_id not null,
  km double precision not null,
  primary key (from_plant_id, to_plant_id),
  constraint plant_distances_distinct_plants check (from_plant_id <> to_plant_id),
  constraint plant_distances_km_finite check (km >= 0 and km < 'Infinity'::double precision)
);
-- Una riga per coppia NON ordinata: (a, b) e (b, a) sono la stessa strada.
create unique index plant_distances_pair_key on public.plant_distances (
  (least(from_plant_id, to_plant_id)),
  (greatest(from_plant_id, to_plant_id))
);
alter table public.plant_distances enable row level security;
create policy plant_distances_select on public.plant_distances
  for select to authenticated using (true);

create table public.badge_parameters (
  badge_id public.badge_id primary key,
  threshold integer not null,
  label text not null,
  constraint badge_parameters_threshold_min check (threshold >= 1)
);
alter table public.badge_parameters enable row level security;
create policy badge_parameters_select on public.badge_parameters
  for select to authenticated using (true);
