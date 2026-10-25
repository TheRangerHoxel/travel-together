-- T08 · 2/3 · Funzioni e trigger.
--
-- Tre funzioni in `public`, perche l app le chiama (PostgREST le espone come rpc):
--   adjust_leg_seats, restore_system_rejected, raise_personal_bests.
-- Tutto il resto sta in `private`, che PostgREST non espone e a cui i ruoli dell app non hanno
-- accesso: i trigger che materializzano le tratte, quello di monotonia dei massimi, quello sul
-- limite delle note, e la procedura che accorcia le note.
--
-- Ogni funzione `security definer` ha `search_path` vuoto e nomi qualificati. EXECUTE e revocato
-- a public e ad anon su OGNI funzione, e concesso ad authenticated solo sulle tre dell app.
--
-- I nomi dei parametri delle tre funzioni pubbliche sono il contratto con l adapter Supabase:
-- PostgREST le chiama con argomenti nominati.
--
-- Nessuna istruzione di controllo della transazione.

-- ---------------------------------------------------------------------------
-- Le tratte le materializza il DB: salvare una trasferta e un upsert su `trips`, e la scrittura
-- delle tratte e atomica con quella della trasferta.
--   con auto e senza rientro: l andata; con auto e rientro: andata e ritorno; senza auto: niente.
--   Una tratta nuova parte dai posti della trasferta; una esistente PRESERVA il contatore e
--   prende il nuovo totale. Un contatore preservato fuori dal nuovo totale viola il CHECK e fa
--   fallire l intero salvataggio. Togliere una tratta referenziata da una candidatura (in
--   qualunque stato) e rifiutato dalla foreign key RESTRICT di match_requests.
-- ---------------------------------------------------------------------------
create function private.sync_trip_legs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wanted public.leg_direction[];
begin
  if not new.has_car then
    v_wanted := array[]::public.leg_direction[];
  elsif new.return_at is null then
    v_wanted := array['outbound']::public.leg_direction[];
  else
    v_wanted := array['outbound', 'return']::public.leg_direction[];
  end if;

  delete from public.trip_legs l
  where l.trip_id = new.id and not (l.direction = any (v_wanted));

  update public.trip_legs l
  set seats_total = new.seats_total
  where l.trip_id = new.id
    and l.direction = any (v_wanted)
    and l.seats_total is distinct from new.seats_total;

  insert into public.trip_legs (trip_id, direction, seats_total, seats_available)
  select new.id, d, new.seats_total, new.seats_available
  from unnest(v_wanted) as d
  on conflict (trip_id, direction) do nothing;

  return null;
end;
$$;
revoke all on function private.sync_trip_legs() from public, anon, authenticated;

create trigger trips_sync_legs
  after insert or update on public.trips
  for each row execute function private.sync_trip_legs();

-- ---------------------------------------------------------------------------
-- adjust_leg_seats: aggiunge `delta` ai posti liberi di una tratta, in un unico UPDATE atomico.
-- PostgREST non esprime un aggiornamento relativo a una colonna, quindi e una funzione.
--
-- Esiti, in quest ordine di controlli (esistenza, identita, limiti):
--   - la tratta non esiste: errore P0002;
--   - chi chiama non e l owner della trasferta ne il richiedente di una candidatura `accepted`
--     su quella tratta: errore 42501 (cancelRequest restituisce il posto PRIMA di scrivere
--     `cancelled`, quindi in quel momento la riga e ancora accepted);
--   - il richiedente accepted puo solo +1 (restituire il proprio posto) o -1 (compensare dopo una
--     save fallita): qualunque altro delta e 42501. L owner e libero entro [0, seats_total];
--   - il risultato esce da [0, seats_total]: ZERO RIGHE restituite, nessun errore. La condizione
--     sta nel WHERE, non nel CHECK: un errore di CHECK vorrebbe dire una condizione caduta e
--     salvata solo dal vincolo;
--   - altrimenti la tratta aggiornata.
-- ---------------------------------------------------------------------------
create function public.adjust_leg_seats(
  trip_id uuid,
  direction public.leg_direction,
  delta integer
)
returns setof public.trip_legs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_is_owner boolean;
  v_is_accepted boolean;
begin
  if not exists (
    select 1 from public.trip_legs l
    where l.trip_id = adjust_leg_seats.trip_id and l.direction = adjust_leg_seats.direction
  ) then
    raise exception 'tratta inesistente' using errcode = 'P0002';
  end if;

  select t.owner_id into v_owner from public.trips t where t.id = adjust_leg_seats.trip_id;

  v_is_owner := v_uid is not null and v_owner = v_uid;
  v_is_accepted := v_uid is not null and exists (
    select 1 from public.match_requests r
    where r.trip_id = adjust_leg_seats.trip_id
      and r.direction = adjust_leg_seats.direction
      and r.requester_id = v_uid
      and r.status = 'accepted'
  );

  if not (v_is_owner or v_is_accepted) then
    raise exception 'i posti li cambia il proprietario o il richiedente accettato su quella tratta'
      using errcode = '42501';
  end if;

  -- Il richiedente accettato non e il padrone dell offerta: puo restituire il proprio posto
  -- (+1) o compensare la restituzione dopo una save fallita (-1), non azzerare i posti altrui.
  if not v_is_owner and adjust_leg_seats.delta not in (1, -1) then
    raise exception 'il richiedente accettato puo cambiare i posti solo di +1 o -1'
      using errcode = '42501';
  end if;

  return query
    update public.trip_legs l
    set seats_available = l.seats_available + adjust_leg_seats.delta
    where l.trip_id = adjust_leg_seats.trip_id
      and l.direction = adjust_leg_seats.direction
      and l.seats_available + adjust_leg_seats.delta between 0 and l.seats_total
    returning l.*;
end;
$$;
revoke all on function public.adjust_leg_seats(uuid, public.leg_direction, integer) from public, anon;
grant execute on function public.adjust_leg_seats(uuid, public.leg_direction, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- restore_system_rejected: il reintegro di cancelRequest. Riporta a pending, con la risoluzione
-- azzerata, le candidature rifiutate dal SISTEMA su quella tratta, e ne restituisce gli id; non
-- tocca quelle rifiutate da una persona. Solo se la tratta ha posti liberi.
--
-- E security definer perche il richiedente che annulla non legge le righe degli altri (RLS) e
-- non puo scriverle. NON controlla chi chiama: qualunque authenticated puo lanciarla, in
-- qualunque momento, su qualunque tratta con almeno un posto libero, e restituisce gli id di
-- righe che chi chiama puo non poter leggere. L effetto e limitato alla transizione che la
-- regola di T05 prevede (rejected dal sistema -> pending), ma non e legato a un annullamento.
-- ---------------------------------------------------------------------------
create function public.restore_system_rejected(
  trip_id uuid,
  direction public.leg_direction
)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.trip_legs l
    where l.trip_id = restore_system_rejected.trip_id
      and l.direction = restore_system_rejected.direction
      and l.seats_available > 0
  ) then
    return;
  end if;

  return query
    update public.match_requests r
    set status = 'pending', resolution_note = null, resolved_by = null
    where r.trip_id = restore_system_rejected.trip_id
      and r.direction = restore_system_rejected.direction
      and r.status = 'rejected'
      and r.resolved_by = 'system'
    returning r.id;
end;
$$;
revoke all on function public.restore_system_rejected(uuid, public.leg_direction) from public, anon;
grant execute on function public.restore_system_rejected(uuid, public.leg_direction) to authenticated;

-- ---------------------------------------------------------------------------
-- raise_personal_bests: alza i massimi, GREATEST per colonna (il massimo e per colonna e non
-- per riga). `security invoker`: gira sotto le policy della propria riga, quindi un altro
-- profilo e rifiutato (42501). PostgREST non esprime GREATEST in un upsert.
-- ---------------------------------------------------------------------------
create function public.raise_personal_bests(
  profile_id uuid,
  shared_trips integer,
  shared_legs integer,
  transported_colleagues integer,
  shared_km double precision
)
returns setof public.personal_bests
language sql
security invoker
set search_path = ''
as $$
  insert into public.personal_bests as pb
    (profile_id, shared_trips, shared_legs, transported_colleagues, shared_km)
  values (
    raise_personal_bests.profile_id,
    raise_personal_bests.shared_trips,
    raise_personal_bests.shared_legs,
    raise_personal_bests.transported_colleagues,
    raise_personal_bests.shared_km
  )
  on conflict (profile_id) do update set
    shared_trips = greatest(pb.shared_trips, excluded.shared_trips),
    shared_legs = greatest(pb.shared_legs, excluded.shared_legs),
    transported_colleagues = greatest(pb.transported_colleagues, excluded.transported_colleagues),
    shared_km = greatest(pb.shared_km, excluded.shared_km)
  returning pb.*;
$$;
revoke all on function public.raise_personal_bests(uuid, integer, integer, integer, double precision)
  from public, anon;
grant execute on function public.raise_personal_bests(uuid, integer, integer, integer, double precision)
  to authenticated;

-- ---------------------------------------------------------------------------
-- La monotonia dei massimi, lato DB: la seconda rete. Una scrittura che ABBASSA una colonna e
-- rifiutata (non corretta in silenzio), per chiunque: anche una PATCH diretta del client.
-- ---------------------------------------------------------------------------
create function private.personal_bests_monotonic()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.shared_trips < old.shared_trips
     or new.shared_legs < old.shared_legs
     or new.transported_colleagues < old.transported_colleagues
     or new.shared_km < old.shared_km then
    raise exception 'un massimo non scende mai' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.personal_bests_monotonic() from public, anon, authenticated;

create trigger personal_bests_monotonic
  before update on public.personal_bests
  for each row execute function private.personal_bests_monotonic();

-- ---------------------------------------------------------------------------
-- notes.maxLength non scende sotto la nota piu lunga che esiste: vale per chiunque scriva il
-- parametro, anche la dashboard (che gira come postgres). L unica via per abbassarlo e la
-- procedura qui sotto, che prima accorcia e marca le note. La lunghezza e in caratteri, cioe in
-- code point, come nel dominio.
-- ---------------------------------------------------------------------------
create function private.parameters_note_max_length()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_longest integer;
begin
  if new.key <> 'notes.maxLength' or jsonb_typeof(new.value) <> 'number' then
    return new;
  end if;

  select coalesce(max(greatest(char_length(r.request_note), char_length(r.resolution_note))), 0)
  into v_longest
  from public.match_requests r;

  if (new.value #>> '{}')::numeric < v_longest then
    raise exception 'notes.maxLength sotto la nota piu lunga esistente (% caratteri): usare private.lower_note_max_length', v_longest
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.parameters_note_max_length() from public, anon, authenticated;

create trigger parameters_note_max_length
  before insert or update on public.parameters
  for each row execute function private.parameters_note_max_length();

-- ---------------------------------------------------------------------------
-- lower_note_max_length(n): la procedura per abbassare il limite delle note. Eseguibile solo da
-- `postgres` (cioe da una migrazione): nessun ruolo dell app ha accesso allo schema private.
-- In una transazione:
--   1. rifiuta se la nota automatica della cascata (cascade.autoRejectNote) sfora n: altrimenti
--      parseParameters rifiuterebbe tutti i parametri al primo load;
--   2. accorcia ogni nota oltre n a n-1 caratteri piu «…», cosi nessuna diventa vuota (le save la
--      rifiuterebbero) e l accorciamento si vede nel testo;
--   3. marca la riga con notes_shortened = true (colonna del solo DB);
--   4. solo dopo scrive il parametro.
-- Abbassare il limite e quindi una migrazione che chiama questa funzione.
-- ---------------------------------------------------------------------------
create function private.lower_note_max_length(max_length integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auto text;
begin
  if max_length < 1 then
    raise exception 'il limite delle note deve essere almeno 1' using errcode = '22023';
  end if;

  select p.value #>> '{}' into v_auto
  from public.parameters p
  where p.key = 'cascade.autoRejectNote' and jsonb_typeof(p.value) = 'string';

  if v_auto is not null and char_length(v_auto) > max_length then
    raise exception 'la nota automatica della cascata (% caratteri) sfora il nuovo limite %', char_length(v_auto), max_length
      using errcode = '23514';
  end if;

  update public.match_requests r
  set request_note = case
        when char_length(r.request_note) > max_length
          then left(r.request_note, max_length - 1) || '…'
        else r.request_note
      end,
      resolution_note = case
        when char_length(r.resolution_note) > max_length
          then left(r.resolution_note, max_length - 1) || '…'
        else r.resolution_note
      end,
      notes_shortened = true
  where char_length(r.request_note) > max_length
     or char_length(r.resolution_note) > max_length;

  insert into public.parameters (key, value)
  values ('notes.maxLength', to_jsonb(max_length))
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke all on function private.lower_note_max_length(integer) from public, anon, authenticated;
