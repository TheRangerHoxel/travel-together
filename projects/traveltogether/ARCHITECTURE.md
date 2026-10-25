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
    domain/      # Plant, Trip, TripLeg, SeatOffer, MatchRequest, Profile, Badge, PersonalBests
                 # entità e regole pure — zero I/O, zero dipendenze esterne
    ports/       # interfacce: TripRepository, MatchRequestRepository,
                 # ProfileRepository, PersonalBestsRepository, SessionGateway, Clock
    usecases/    # createTrip, findMatches, requestSeat, acceptRequest,
                 # rejectRequest, computeCompanyKpi, computePersonalStats, awardBadges,
                 # refreshPersonalBests
                 # dipende SOLO da domain/ e ports/
  adapters/
    memory/      # implementa i port in RAM → test veloci, offline, deterministici
    supabase/    # implementa i port con @supabase/supabase-js
  ui/            # schermate React Native — dipende da usecases/, MAI da adapters/
  config/        # plant, distanze, costo noleggio/giorno, g CO₂/km, tolleranze
                 # valori iniettati, nessun segreto
```

### Regole di dipendenza

Una sola direzione: `ui/` → `usecases/` → `ports/` ← `adapters/`. Niente import circolari.

- `core/` **non può** importare `adapters/` né `ui/`
- `ui/` **non può** importare `adapters/`: passa dagli usecase
- `core/` **non può** usare `Date.now()` né `new Date()`: il tempo entra dal port `Clock`
- `core/` **non può** importare `@supabase/supabase-js`, né alcun modulo di rete o filesystem

**Queste regole le impone il lint** (`eslint-plugin-boundaries`), non il giudizio di chi rivede.
Una violazione fa fallire `verify`: non apre una discussione.

**Un punto in cui lint e documento non coincidono, e come si risolve.** Il lint permette
`core/usecases → config/`; questo documento dice che gli usecase dipendono **solo** da `domain/` e
`ports/`. Vince il documento, di fatto: **il codice di produzione del core non importa `config/`**, i
valori entrano come parametro, e il core resta compilabile ed eseguibile senza `config/`.

L'unico arco che esiste davvero vive in un **test di conformità** dentro `core/usecases`, che importa
i valori reali e li lega al tipo. Serve a una cosa sola: far diventare rosso `tsc --noEmit` se i
valori in `config/` divergono dal tipo che il core si aspetta. Senza, `config/` esporterebbe un
oggetto che nessuno confronta con niente, e un campo rinominato arriverebbe a runtime come
`undefined` — che nei conti diventa `NaN`, e `NaN` fa fallire ogni confronto in silenzio.

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
abbassasse quel peso in `config/` invertirebbe la semantica di un criterio di accettazione **con tutti
i test verdi**, perché i test usano fixture di config e non i valori di produzione. Il bonus di plant
è quindi derivato dalla finestra di tolleranza, non configurabile, e tutta l'aritmetica è intera —
niente parità finte da virgola mobile.

È il pezzo di maggior valore del prodotto, quindi è anche quello che riceve la verifica più forte:
una tabella di casi che copre ogni vincolo duro, ogni confine (esattamente al limite della finestra di
tolleranza, zero posti, un posto) e l'ordinamento del punteggio.

Vincoli duri e punteggio morbido sono elencati in [PRD.md](PRD.md).

## Modello dati (bozza — ⛔ lo schema va approvato in T08)

- `plants` — lista chiusa, seed: Pomigliano d'Arco, Foggia, Grottaglie
- `profiles` — id, nome visualizzato, plant di appartenenza
- `trips` — owner, plant partenza, plant destinazione, data/ora partenza, data rientro, `has_car`,
  `seats_total`, `seats_available`, stato
- `trip_legs` — **la tratta** (T04b): chiave primaria composta `(trip_id, direction)` con `direction` in
  (`outbound` / `return`), `seats_total`, `seats_available`. Una riga per l'andata e, se `return_at`
  non è nullo, una per il ritorno; nessuna senza auto. I posti dell'auto valgono per ciascuna tratta.
  Il decremento è un `UPDATE ... SET seats_available = seats_available + :delta WHERE ... AND
  seats_available + :delta BETWEEN 0 AND seats_total`, atomico
- `match_requests` — trip offerta, **`direction`**, richiedente, stato (`pending` / `accepted` /
  `rejected` / `cancelled`), **`request_note`** (facoltativa), **`resolution_note`**, **`resolved_by`**
  (`owner` / `requester` / `system`; nota e `resolved_by` insieme o nessuno dei due). Foreign key
  composta `(trip_id, direction) → trip_legs`, che rende impossibile una candidatura sul rientro di una
  trasferta senza rientro. Il limite di lunghezza delle note è in `config/`, misurato in code point
- `personal_bests` — **bozza (T07e)**: una riga per profilo con le quattro metriche
  (`shared_trips`, `shared_legs`, `transported_colleagues`, `shared_km`), il massimo storico di
  ciascuna. L'alzata è un unico `INSERT ... ON CONFLICT DO UPDATE ... RETURNING *` con `GREATEST` per
  colonna; RLS: ciascuno legge e aggiorna solo la propria riga. Non è uno schema approvato (⛔ T08)
- `invite_codes` — codice, attivo

**Questo modello resta una bozza in attesa di T08**: `trip_legs` e le colonne di nota sono la forma
decisa dal modello di dominio di T04b, non uno schema approvato né una migrazione scritta.

**RLS obbligatorie su ogni tabella.** Anche nell'MVP: un'app con RLS permissive insegna l'abitudine
sbagliata, e la stessa struttura verrebbe portata in un pilota con dati veri.
Il decremento di `seats_available` all'accettazione è un'operazione che non tollera race condition:
va risolta nel DB (transazione o funzione), non nel client.

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
