# ARCHITECTURE — TravelTogether

**Versione:** 0.1 (Fase 0, in attesa di approvazione) · **Data:** 12/10/2026

---

## Vincoli che hanno determinato lo stack

Non sono preferenze: sono fatti misurati su questa macchina il 12/10/2026.

| Vincolo | Stato |
|---|---|
| Python | 3.12.3 presente |
| git, node, npm, docker, gh | **assenti** — né nel PATH né nei percorsi standard |
| Diritti di amministratore | **nessuno** → solo installazioni user-level |
| Budget | zero → solo free tier |
| Distribuzione | APK diretto, nessuno store |

Conseguenze dirette: **niente Docker** (quindi nessun Supabase locale), **niente toolchain Android
locale** (quindi la build deve avvenire altrove), **git va installato** come prerequisito.

## Stack

**App:** Expo (React Native) + TypeScript
**Dati:** Supabase free (Postgres + Auth + RLS)
**Build:** EAS Build (cloud) → APK · **Aggiornamenti:** EAS Update (OTA)
**Test:** jest + jest-expo + @testing-library/react-native
**Qualità:** eslint (con regole di confine) + tsc strict

### Perché questo e non altro

1. **Nessun admin → build in cloud.** EAS Build compila sui server Expo: niente Android Studio, SDK,
   NDK o JDK in locale. Serve solo Node, installabile da zip in cartella utente. Questo è il motivo
   decisivo, non una preferenza estetica.
2. **APK diretto → servono update OTA.** Senza store non esiste canale di aggiornamento: un bug
   spedito resterebbe sui telefoni per sempre. EAS Update spinge le correzioni JS senza re-sideload.
3. **Un solo linguaggio.** TypeScript copre app, test e le eventuali Edge Function Supabase (Deno/TS).
   I tipi del DB si generano dallo schema, quindi `tsc` verifica anche la forma delle query.
4. **Perché non Python,** nonostante la cartella padre del progetto: non esiste percorso credibile da
   Python a un'app Android distribuibile. Kivy e BeeWare richiedono proprio la toolchain Android
   locale che qui non possiamo installare, e non hanno SDK Supabase.
5. **Perché non Flutter:** tecnicamente valido, ma aggiunge Dart come secondo linguaggio e non porta
   nessun vantaggio sul vincolo che conta — build in cloud e OTA, dove Expo è più diretto.

---

## ⚠️ Scelte irreversibili

Da leggere prima di approvare. Cambiarle dopo costa molto più che deciderle ora.

### Package id Android — `com.softwareoffice.traveltogether`
**Non si cambia.** Per Android un package id diverso è **un'app diversa**: gli utenti esistenti non
ricevono l'aggiornamento, devono disinstallare e reinstallare perdendo i dati locali.
Nota sul nome: nell'handoff compare "TravelTogheter", nel documento "Travel Together". Si adotta
**TravelTogether**.

### Keystore di firma dell'APK
Android rifiuta un aggiornamento firmato con una chiave diversa da quella dell'installazione
esistente. **Se il keystore si perde, nessun utente può aggiornare**: devono disinstallare.
Il keystore sta **fuori dal repo**, con un backup fuori da questa macchina. Mai committato.

### Regione del progetto Supabase
Non si sposta dopo la creazione. Cambiarla significa dump + restore su un progetto nuovo, con nuovi
URL e nuove chiavi. Scegliere la regione europea (coerente con dati di dipendenti, anche se nell'MVP
sono sintetici).

### Postgres invece di NoSQL — **questa resta reversibile**
È la ragione principale per preferire Supabase a Firebase. Il DB è Postgres standard: migrabile su
Neon, Railway, un server aziendale o self-host con un dump. Firestore, al contrario, è un lock-in
che si paga con una riscrittura. Abbiamo comprato reversibilità, non comodità.

---

## Free tier — numeri verificati sulle pagine ufficiali (12/10/2026)

**Supabase free:** 500 MB DB per progetto · 1 GB file storage · 5 GB egress (+5 GB cached) ·
50.000 MAU auth · **2 progetti attivi per organizzazione** (quelli in pausa non contano) ·
**pausa dopo 1 settimana di inattività**.

**Expo free:** 15 build Android + 15 iOS · timeout build 45 min · 1 concorrenza in coda bassa ·
EAS Update 1.000 MAU, 100 GiB banda edge, 20 GiB storage · nessun overage: si ferma al limite.

Per una demo sono numeri abbondanti. L'unico che morde è la **pausa a 1 settimana**: mitigata con un
workflow schedulato su GitHub Actions che pinga il DB (i workflow schedulati vengono però disattivati
dopo 60 giorni di inattività del repo) **più** un controllo manuale il giorno prima della
presentazione, che è la rete davvero affidabile.

I due progetti free sono: **staging** (test di integrazione) e **prod** (la demo).

---

## Modularità e manutenibilità

**Vincolo architetturale, non opzionale.** È criterio di review e, dove esprimibile, criterio di lint.

```
app/src/
  core/
    domain/      # Plant, Trip, TripLeg, SeatOffer, MatchRequest, Profile, Badge, PersonalBests,
                 # tipi dei parametri (AppParameters) e parseParameters
                 # entità e regole pure — zero I/O, zero dipendenze esterne
    ports/       # interfacce: TripRepository, MatchRequestRepository,
                 # ProfileRepository, PersonalBestsRepository, ParameterRepository,
                 # SessionGateway, Clock
    usecases/    # createTrip, findMatches, requestSeat, acceptRequest,
                 # rejectRequest, computeCompanyKpi, computePersonalStats, awardBadges,
                 # refreshPersonalBests
                 # dipende SOLO da domain/ e ports/
  adapters/
    memory/      # implementa i port in RAM → test veloci, offline, deterministici
    supabase/    # implementa i port con @supabase/supabase-js
  ui/            # schermate React Native — dipende da usecases/, MAI da adapters/
  config/        # SEED_PARAMETERS: i valori iniziali dei parametri, in forma grezza
                 # non è la fonte a runtime (lo è la tabella), nessun segreto
```

### Regole di dipendenza

Una sola direzione: `ui/` → `usecases/` → `ports/` ← `adapters/`. Niente import circolari.

- `core/` **non può** importare `adapters/` né `ui/`
- `ui/` **non può** importare `adapters/`: passa dagli usecase
- `core/` **non può** usare `new Date()` né alcun membro di `Date` (`Date.now()`, `Date.parse()`,
  `Date.UTC()`, test inclusi): il tempo entra dal port `Clock`
- `core/` **non può** importare `@supabase/supabase-js`, né alcun modulo di rete o filesystem

**Queste regole le impone il lint** (`eslint-plugin-boundaries`), non il giudizio di chi rivede.
Una violazione fa fallire `verify`: non apre una discussione.

**Convenzione, non regola di lint:** un istante si legge solo con `normalizeUtcInstant`, in
`instant.ts`. Il lint vieta `Date`, non un secondo parser scritto a mano: quello lo ferma il reviewer.

**I parametri vengono da una tabella, non da `config/` (T07b).** Soglie, costi, tolleranze, distanze,
limite e testo delle note, soglie **ed etichette** dei badge si leggono dal port `ParameterRepository`
(`load()`, nessuna scrittura: modificarli è amministrazione, dalla dashboard). `parseParameters`, in
`core/domain`, valida le righe grezze al confine e restituisce i tipi che gli usecase ricevono già
(`MatchConfig`, `CreateTripConfig`, `KpiConfig`, `NoteConfig`, `CascadeConfig`, `BadgeConfig`, spostati in
`core/domain` e riesportati invariati da `usecases/`). Un parametro mancante, non numerico, fuori
intervallo, sconosciuto o un'etichetta vietata è `invalid-record` con la chiave come `id`; **nessun
valore di default**. Gli usecase continuano a ricevere la config come parametro, mai dal port. Restano nel
codice le **identità**: `PlantId`, gli stati, gli id dei badge, le chiavi dei parametri
(`PARAMETER_KEYS`) e il catalogo famiglia/metrica dei badge; il parser rifiuta ciò che la tabella tenta
di aggiungere. La lista delle parole vietate nei testi dei badge è una sola (`core/domain/badge-label.ts`).

> **Inversione della decisione 3 di T03** (12 ottobre), registrata come tale. T03 teneva i valori come
> letterali compilati perché una soglia letta a runtime è `unknown`, non verificabile a compile time, e
> un campo mancante diventerebbe `NaN` facendo sparire i match in silenzio. T07b la rovescia, perché un
> parametro che richiede una build EAS (15 al mese sul piano gratuito) non è configurabile. **Cosa si
> perde:** un valore sbagliato non è più un errore di `tsc`, è un `invalid-record` al primo `load`.
> **Cosa compensa:** `parseParameters` è esattamente la rete contro il caso che T03 temeva.

**`config/` è il seed, e nient'altro.** Contiene solo `SEED_PARAMETERS`, in forma grezza (le stesse righe
che il parser riceve, nessun tipo del core). Serve all'ambiente memory, ai test e, a T08, alla migrazione
di seed, che ne è derivata. **Non è un default a runtime**: dopo la prima migrazione la tabella può
divergere dal seed, ed è voluto.

**Lint e documento coincidono su `config/`.** Il codice di produzione del core non importa `config/`, e
nemmeno `ui/`: l'arco `ui → config` non esiste nel grafo (la UI riceve i valori da `load()`, dopo
l'accesso). L'arco `usecases → config` esiste solo per i file `core/usecases/**/*.test.ts` (categoria di
file `conformance-test`), e oggi lo usa un test solo, `parameters-seed.test.ts`, che passa il seed da
`parseParameters` e ne pinna i valori iniziali. I test di `domain/` non l'hanno. Gli `adapters/`
importano `config/` solo nei test e nella suite di contratto: l'ambiente di contratto in RAM parte **vuoto**, e la suite scrive il
seed nei suoi casi con `scriviParametriGrezzi(SEED_PARAMETERS)`.

**Nessun file di `src/` sta fuori dal grafo.** `src/__tests__/` è un elemento a sé (`harness`) che vede
`domain/`, `ports/`, `usecases/`, `adapters/` e `config/` — **non `ui/`** — per poter comporre in RAM il
percorso adapter memory → `load` → usecase (`parameters-path.test.ts`). L'arco `ui/` ↔ `adapters/` resta
chiuso anche per i test. Il vecchio vincolo (nessun import verso il resto di `src/`) è stato allargato con
questa decisione scritta. `boundaries/no-unknown-files` fa fallire ogni file di `src/` che non appartiene
a un elemento. Restano fuori dal grafo, dichiarato, la radice (`App.tsx`, `index.ts`) e `tests/`: c'è una
voce in `IDEAS.md`.

### Dependency inversion sui punti che cambieranno

Lo storage è il punto che cambierà. Oggi è Supabase; domani potrebbe essere un DB aziendale, o SAP
quando l'integrazione diventasse possibile. Il core dipende da `TripRepository`, non da Supabase.
L'adapter `memory/` non è un artificio di test: è la **prova** che l'inversione funziona davvero —
se il core si può eseguire interamente in RAM, allora non è accoppiato alla rete.

Stessa logica per `SessionGateway` (oggi codice invito, domani SSO aziendale) e `Clock`.

### Un modulo, una responsabilità

Se un file supera una soglia ragionevole o fa due cose, il reviewer chiede lo split. La soglia non è
un numero sacro: è il punto in cui il nome del file non descrive più ciò che contiene.

### Perché la modularità è anche sicurezza del loop

Moduli isolati **confinano l'errore**: un test che fallisce indica un file, non un'area. Il revert
resta pulito perché il commit tocca un confine, non mezza applicazione. La modularità qui non è
eleganza: è la ragione per cui il sistema automatico è contenibile.

---

## Il motore di matching

```typescript
findMatches(
  richiesta: TripRequest,
  offerte: readonly SeatOffer[],
  candidature: readonly MatchRequest[],
  config: MatchConfig
): Result<readonly ScoredMatch[], MatchError>
```

```typescript
interface ScoredMatch {
  readonly offer: SeatOffer;            // una TRATTA: tripId + direction
  readonly score: number;               // intero, più alto = meglio; guida l'ordine
  readonly millisApart: number;         // distanza assoluta fra gli orari, in ms
  readonly sameOwnerPlant: boolean;
  readonly requestStatus: MatchRequestStatus | null;  // candidatura del richiedente su questa tratta
}

type MatchError =
  | { kind: 'invalid-tolerance'; toleranceMinutes: number };
```

`TripRequest.departureAt` e `SeatOffer.departureAt` sono `UtcInstant`, non `string` (T07f): un istante
malformato non è un errore del motore ma uno stato **irrappresentabile**, e per questo
`invalid-request-departure-at` è stato rimosso da `MatchError`. L'istante grezzo si valida una volta
sola, al confine da cui entra (`normalizeUtcInstant`: `createTrip` oggi, l'adapter Supabase da T09).

**L'offerta è una tratta, non una trasferta (T04b).** Una trasferta con auto e rientro produce due
`SeatOffer` (andata e ritorno, plant invertiti, orario di `returnAt`); l'identità è la coppia
`tripId` + `direction`, ed è l'ultima chiave dell'ordine totale (prima `tripId`, poi il rango della
direzione). I posti sono per tratta.

**Lo stato della candidatura marca, non filtra (T04b).** `pending`, `accepted` e `rejected` restituiscono
l'offerta con `requestStatus` attaccato; `cancelled` non marca (`null`, come se la riga non ci fosse). La
corrispondenza è per tratta e per richiedente. Gli altri vincoli duri (plant, data, finestra oraria,
posti esauriti, offerta propria) continuano a omettere.

**Funzione pura.** Nessun I/O, nessuna rete, nessun orologio. Date e orari arrivano come dati, la
configurazione come parametro. Determinismo totale: stessi input, stesso output, sempre.

**Modifica alla firma, decisa in T03 e approvata dall'umano.** La versione di Fase 0 aveva tre
parametri e ritorno diretto. Due cambi:

- **`candidature`** — i criteri di T03 dipendono dalle candidature del richiedente (in T03 una
  `pending` o `accepted` escludeva l'offerta; da T04b la marca, vedi sotto). La firma a tre parametri non
  riceveva quel dato. Le candidature entrano come dato, non da un port: la purezza resta intatta e `[]`
  è il caso di default. **La regola su quali stati marcano resta dentro il core**: passare un insieme di
  id già pre-filtrato sposterebbe una regola di dominio nel chiamante, cioè in UI o in un adapter.
- **`Result`** — una tolleranza incoerente deve essere distinguibile da "nessun collega compatibile".
  Senza canale d'errore si presenterebbe come lista vuota, e in demo sarebbe indistinguibile da un
  risultato legittimo. La stessa ragione valeva per un `departureAt` malformato: da T07f quella
  garanzia è passata al tipo `UtcInstant` (un'offerta con un istante illeggibile non esiste più, invece
  di essere omessa in silenzio), e al `Result` resta la sola tolleranza.

**Il punteggio è a dominanza, non a somma pesata.** Il criterio "l'offerta con stesso plant di
appartenenza precede quella con plant diverso" è enunciato senza condizioni. Con pesi configurabili
sarebbe vero solo finché il peso del plant supera l'escursione della vicinanza oraria: chi un domani
abbassasse quel peso nei parametri invertirebbe la semantica di un criterio di accettazione **con tutti
i test verdi**, perché i test usano fixture di config e non i valori di produzione. Il bonus di plant
è quindi derivato dalla finestra di tolleranza, non configurabile, e tutta l'aritmetica è intera —
niente parità finte da virgola mobile.

È il pezzo di maggior valore del prodotto, quindi è anche quello che riceve la verifica più forte:
una tabella di casi che copre ogni vincolo duro, ogni confine (esattamente al limite della finestra di
tolleranza, zero posti, un posto) e l'ordinamento del punteggio.

Vincoli duri e punteggio morbido sono elencati in [PRD.md](PRD.md).

## Modello dati (T08, applicato a staging)

Lo schema è nelle migrazioni di `app/supabase/migrations/` (`…_schema.sql`, `…_functions.sql`,
`…_parameter_seed.sql`); lo script che le annulla è `app/supabase/rollback/…_revert.sql`. Una migrazione
applicata non si riscrive: ogni correzione è una migrazione nuova. I tipi TypeScript sono **generati**
(`npm run db:types`) in `app/src/adapters/supabase/database.types.ts`.

**Identità come tipi enumerati** (un secondo elenco delle union di letterali del dominio, tenuto uguale
nei due versi da `typecheck`): `plant_id`, `badge_id`, `parameter_key`, `leg_direction`, `trip_status`,
`match_request_status`, `resolved_by`. Nessuna tabella `plants`: gli stabilimenti sono un tipo.

| Tabella | Contenuto e vincoli | Lettura (`authenticated`) | Scrittura dall'app |
|---|---|---|---|
| `profiles` | `id` → `auth.users` (cascade), nome, plant | tutti | nessuna (T10) |
| `trips` | owner → `profiles` (restrict), plant, `departure_at`/`return_at` `timestamptz` con `CHECK` al millisecondo, `has_car`, posti, stato; `CHECK` degli invarianti di `makeTrip`; `UNIQUE (id, owner_id)` | tutti | solo l'owner, upsert compreso |
| `trip_legs` | **la tratta**: PK `(trip_id, direction)`, posti per tratta; `CHECK` `0 ≤ liberi ≤ totali` | tutti | nessuna: la scrivono il trigger e `adjust_leg_seats` |
| `match_requests` | foreign key composta `(trip_id, direction) → trip_legs` (**restrict**), `(requester_trip_id, requester_id) → trips(id, owner_id)`, `UNIQUE (trip_id, direction, requester_id)`, note e `resolved_by` insieme o nessuno, `pending` senza risoluzione, `notes_shortened` (solo DB) | richiedente e owner della trasferta | i due attori, più un trigger sulla riga vecchia |
| `personal_bests` | una riga per profilo, quattro metriche ≥ 0 | solo la propria | solo la propria: `raise_personal_bests`, ma le policy permettono anche `INSERT` e `UPDATE` diretti sulla propria riga; un trigger rifiuta qualunque scrittura che abbassi una metrica |
| `parameters`, `plant_distances`, `badge_parameters` | parametri di prodotto (T07b), seed generato da `SEED_PARAMETERS` | tutti | nessuna: l'umano dalla dashboard |

`anon`: nessuna policy, quindi **zero righe** ovunque (non un errore). **RLS attiva su ogni tabella**, anche
nell'MVP: un'app con RLS permissive insegna l'abitudine sbagliata, e la stessa struttura verrebbe portata in
un pilota con dati veri. Una scrittura negata è un errore (`42501`); una lettura negata è una riga assente.
Fa eccezione una `UPDATE`/`DELETE` che la `USING` non lascia vedere: tocca zero righe senza errore.

**Funzioni.** In `public`, perché l'app le chiama come rpc (PostgREST non esprime un aggiornamento relativo a
una colonna né `GREATEST` in un upsert):
- `adjust_leg_seats(trip_id, direction, delta)` — `security definer`. Il decremento di `seats_available`
  è un unico `UPDATE … SET seats_available = seats_available + :delta WHERE … AND seats_available + :delta
  BETWEEN 0 AND seats_total`, **atomico lato DB**. Esiti: la tratta aggiornata; **zero righe** se il
  risultato esce da `[0, seats_total]`; `P0002` se la tratta non esiste; `42501` se chi chiama non è l'owner
  né il richiedente di una candidatura `accepted` su quella tratta, o se il richiedente usa un delta diverso
  da ±1. Ordine dei controlli: esistenza, identità, limiti.
- `restore_system_rejected(trip_id, direction)` — `security definer`. Riporta a `pending` le candidature
  rifiutate dal sistema su quella tratta, se ha posti liberi, e ne restituisce gli id. **Non controlla chi
  chiama**: qualunque `authenticated` può lanciarla.
- `raise_personal_bests(profile_id, …)` — `security invoker`, `INSERT … ON CONFLICT DO UPDATE` con
  `GREATEST` per colonna, sotto le policy della propria riga.

In `private` (schema non esposto, nessun privilegio per i ruoli dell'app): il trigger che **materializza le
tratte** da `trips` (una con auto senza rientro, due con rientro, nessuna senza auto; contatore preservato;
togliere una tratta con candidature è rifiutato dalla foreign key), il trigger di guardia di
`match_requests` sulla riga vecchia, il trigger di monotonia dei massimi, il trigger su `notes.maxLength` e
`lower_note_max_length(n)`, la procedura (solo `postgres`) per abbassare il limite delle note accorciandole e
marcandole. Ogni funzione `security definer` ha `search_path` vuoto; `EXECUTE` è revocato a `public` e `anon`
su tutte, e concesso ad `authenticated` solo sulle tre dell'app.

**Cosa le RLS non possono fare**, dichiarato: migrazioni, seed e dashboard girano come `postgres` e le
scavalcano, quindi gli invarianti che devono valere per chiunque sono vincoli (`CHECK`, `UNIQUE`, foreign
key), non policy.

**Rischio dichiarato per la demo.** Il richiedente di una candidatura `accepted` può chiamare
`adjust_leg_seats` con +1 e −1 quante volte vuole finché la riga è `accepted`: in N chiamate può **gonfiare i
posti fino a `seats_total` o azzerarli**. Il limite a ±1 impedisce solo il salto in un colpo. Il rimedio è
cambiare stato e posti in un'operazione sola (voce di `IDEAS.md` «stato e posti in un'operazione sola»).

**Fuori da T08:** `invite_codes` (il flusso d'accesso è di T10) e le candidature di tutti per il KPI
aziendale (nessun utente le legge: vedi `IDEAS.md`).

**Collaudo.** Le migrazioni si provano in `test:int` dentro transazioni annullate (revert + migrazioni in
ordine, poi `ROLLBACK`); solo i test di concorrenza scrivono righe confermate, con utenti
`@t08.test.invalid` ripuliti all'avvio e alla fine.

## Verifica — `npm run verify`

| Step | Cosa copre |
|---|---|
| `lint` | eslint + **regole di confine** + regole anti-segreto |
| `typecheck` | `tsc --noEmit` strict, con i tipi DB generati da Supabase |
| `test:unit` | `core/` con adapter `memory` — **nessuna rete** |
| `test:int` | progetto Supabase **staging**: schema, **policy RLS**, codice invito |
| `smoke` | (a) `expo export --platform android` impacchetta senza errori (b) render della root con adapter memory |

`test:int` **non passa in silenzio**: senza credenziali fallisce rumorosamente. Un verde falso è
peggio di un rosso.

**Debolezza dichiarata:** nessuno step gira su un device reale. Lo smoke test dimostra che il bundle
si costruisce e che la prima schermata monta, non che l'APK funzioni su un telefono. La prova su
device resta un checkpoint ⛔ manuale a ogni release (T18).

## Punti aperti

- **Dove si scarica l'APK.** Il repo è privato, quindi le GitHub Release non sono pubbliche. Opzioni:
  bucket pubblico su Supabase Storage (1 GB) o un secondo repo pubblico solo per le release.
  Da decidere prima della prima distribuzione.
- **Telefoni aziendali gestiti via MDM** normalmente bloccano l'installazione da fonti sconosciute:
  la demo va provata sul device su cui verrà mostrata, non su uno qualsiasi.
