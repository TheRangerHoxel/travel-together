# TASKS — TravelTogether

Backlog ordinato. **Un task senza criterio testabile non è un task.**
Un task = un commit, a `verify` verde, con messaggio che cita l'id.

Legenda: ⛔ checkpoint umano obbligatorio prima di procedere.

---

# FASE 1 — Scaffolding e harness

L'harness viene **prima** della logica: serve un segnale pass/fail reale prima che il loop parta.

## F1.1 ⛔ Prerequisiti: git e Node, installazione user-level

Senza git non esiste reversibilità, quindi non esiste il sistema. Senza admin servono gli zip.

- PortableGit estratto in `%LOCALAPPDATA%\Programs\PortableGit`, aggiunto al PATH utente
- Node LTS estratto in `%LOCALAPPDATA%\Programs\nodejs`, aggiunto al PATH utente
- `eas-cli` installato via npm

**Criteri di accettazione**
- [ ] `git --version` stampa una versione
- [ ] `node --version` stampa una LTS (≥ 20)
- [ ] `npm --version` stampa una versione
- [ ] `eas --version` stampa una versione
- [ ] Nessuna installazione ha richiesto privilegi di amministratore

⛔ Scarica software da internet: serve approvazione esplicita per ogni download.

## F1.2 Repo git, branch e verifica dei freni

- `git init` alla radice di `officina-software`, commit iniziale su `main`
- Repo GitHub **privato** collegato come `origin`
- Branch `auto/build` creato e pushato
- `.gitignore` attivo
- Branch protection su `main` configurata **dall'umano** su GitHub

**Criteri di accettazione**
- [ ] `git log --oneline` mostra il commit iniziale su `main`
- [ ] `git branch --show-current` risponde `auto/build`
- [ ] `git status` non elenca `.env` tra i file da tracciare
- [ ] Un tentativo di `git push --force` viene **bloccato** dall'hook, con messaggio leggibile
- [ ] Un tentativo di `git reset --hard` viene **bloccato** dall'hook
- [ ] Un tentativo di `git push origin main` viene **bloccato** dall'hook
- [ ] `git push origin auto/build` **funziona** (il freno non blocca il flusso normale)
- [ ] Un push diretto su `main` viene rifiutato dal server

L'hook si verifica **eseguendo** i comandi vietati, non leggendo il file. In particolare va confermato
che `$CLAUDE_PROJECT_DIR` si risolva correttamente su Windows; se non si risolve, si passa al percorso
assoluto. La logica interna del guard è già coperta da 28 casi di test.

## F1.3 Scaffold Expo + TypeScript strict

- Progetto Expo in `projects/traveltogether/app`
- `tsconfig.json` con `strict: true`, `noUncheckedIndexedAccess: true`
- Struttura cartelle `core/{domain,ports,usecases}`, `adapters/{memory,supabase}`, `ui/`, `config/`

**Criteri di accettazione**
- [ ] `npx tsc --noEmit` esce 0
- [ ] Le cartelle sopra esistono, ognuna con almeno un file indice
- [ ] `strict` e `noUncheckedIndexedAccess` sono attivi in `tsconfig.json`
- [ ] Nessuna dipendenza oltre a quelle generate da Expo + TypeScript

⛔ Ogni dipendenza aggiunta oltre allo scaffold va approvata.

## F1.4 Lint con regole di confine

Le regole di modularità devono essere **imposte dalla macchina**, non dal giudizio del reviewer.

- eslint configurato con `eslint-plugin-boundaries`
- Regole: `core/` non importa `adapters/` né `ui/`; `ui/` non importa `adapters/`
- Divieto di `Date.now()` e `new Date()` dentro `core/`
- Divieto di import di `@supabase/supabase-js` dentro `core/`

**Criteri di accettazione**
- [ ] `npm run lint` esce 0 sul codice pulito
- [ ] Un file di prova in `core/` che importa da `adapters/` fa **fallire** il lint
- [ ] Un file di prova in `core/` che chiama `Date.now()` fa **fallire** il lint
- [ ] Un file di prova in `ui/` che importa da `adapters/` fa **fallire** il lint
- [ ] I file di prova vengono rimossi prima del commit

Ogni regola si dimostra **violandola** e vedendo il rosso. Una regola di lint non testata non protegge.

## F1.5 Test runner

- jest + `jest-expo` + `@testing-library/react-native`
- Script `test:unit` separato da `test:int`

**Criteri di accettazione**
- [ ] `npm run test:unit` esegue almeno un test e esce 0
- [ ] Un test deliberatamente rotto fa uscire il comando ≠ 0
- [ ] `test:unit` non effettua **nessuna** chiamata di rete (verificabile: gira con rete disattivata)

## F1.6 Smoke test

Due livelli, perché nessuno dei due da solo dimostra che l'app parte.

- (a) `expo export --platform android` deve completare
- (b) render test: monta la root dell'app con adapter `memory`, verifica che la prima schermata appaia

**Criteri di accettazione**
- [ ] `npm run smoke` esce 0
- [ ] Un import rotto in un modulo caricato dalla root fa **fallire** lo smoke
- [ ] Il render test asserisce su un testo realmente presente in schermata, non sull'assenza di errori

## F1.7 ⛔ `verify` unificato

- `npm run verify` = `lint` && `typecheck` && `test:unit` && `test:int` && `smoke`
- `test:int` senza credenziali **fallisce rumorosamente**, non viene saltato

**Criteri di accettazione**
- [ ] `npm run verify` è un comando unico e esce 0
- [ ] Rompendo un solo step, `verify` esce ≠ 0 e il messaggio dice **quale** step è caduto
- [ ] Rimuovendo le credenziali staging, `verify` **fallisce** (non passa in verde)

⛔ Fine Fase 1: `verify` va mostrato in esecuzione prima di aprire la Fase 2.

---

# FASE 2 — Prodotto

Ordine deliberato: la logica pura prima della rete e della UI. Se il motore sbaglia, sbaglia dentro un
file, i test lo indicano con precisione e il revert è pulito.

## T01 Modello di dominio

Tipi ed entità in `core/domain`: `Plant`, `Trip`, `SeatOffer`, `MatchRequest`, `Profile`, `Badge`,
più gli stati come union type. Zero I/O.

**Criteri di accettazione**
- [x] `npx tsc --noEmit` esce 0
- [x] Nessun import da `adapters/`, `ui/` o librerie esterne in tutto `core/domain`
- [x] Gli stati di `MatchRequest` sono una union di letterali, non `string`
- [x] Un test dimostra che un `Trip` con `seatsAvailable > seatsTotal` è rifiutato dal costruttore
- [x] Un test dimostra che un `Trip` senza auto non può avere posti offerti

## T02 Port e adapter memory

Interfacce in `core/ports` e implementazione in RAM in `adapters/memory`.

**Criteri di accettazione**
- [x] Esistono `TripRepository`, `MatchRequestRepository`, `ProfileRepository`, `SessionGateway`, `Clock`
- [x] `core/ports` contiene **solo** interfacce e tipi, nessuna implementazione
- [x] L'adapter memory soddisfa una suite di test di contratto, la stessa che userà l'adapter Supabase
- [x] La suite di contratto gira senza rete
- [x] `Clock` è iniettabile e un test lo sostituisce con un orologio fisso

## T03 Motore di matching — **il cuore**

`findMatches(richiesta, offerte, config)` in `core/usecases`. Funzione pura.

**Criteri di accettazione** (vincoli duri, uno per uno)
- [x] Plant di partenza diverso → nessun match
- [x] Plant di destinazione diverso → nessun match
- [x] Data diversa → nessun match
- [x] Orario fuori dalla finestra di tolleranza → nessun match
- [x] Orario **esattamente al limite** della finestra → è un match (confine incluso, documentato)
- [x] `seatsAvailable == 0` → nessun match
- [x] Offerta del richiedente stesso → nessun match
- [x] ~~Richiedente con richiesta già `pending` su quell'offerta → nessun match~~
- [x] ~~Richiedente con richiesta già `accepted` su quell'offerta → nessun match~~

> **⚠️ Questi due criteri sono stati emendati il 13 ottobre 2026, dopo la chiusura di T03.**
> Erano soddisfatti e verificati al momento del commit `e6ff157`: restano spuntati perché T03 è stato
> consegnato correttamente contro il requisito di allora. Il **requisito è cambiato**, non
> l'implementazione a essere stata sbagliata.
> Decisione dell'umano: un'offerta su cui ho già una candidatura deve **restare in lista**, grigia e
> spuntata se `pending`/`accepted`, rossa se `rejected`, non cliccabile. Un'offerta che sparisce non
> può essere disegnata grigia, quindi l'esclusione passa da vincolo duro a **stato di presentazione**.
> Il comportamento nuovo è un criterio di **T04b**, dove è anche sotto test di non-regressione per gli
> altri vincoli duri, che restano invariati.
> Vale solo per questi due criteri: gli altri sette vincoli duri di T03 sono intatti.

**Criteri di accettazione** (punteggio)
- [x] A parità di tutto, l'offerta con orario più vicino è prima in classifica
- [x] L'offerta con stesso plant di appartenenza precede quella con plant diverso
- [x] Il punteggio è deterministico: due esecuzioni sugli stessi input danno lo stesso ordine
- [x] Ordinamento stabile a parità di punteggio (nessuna dipendenza dall'ordine di input)

**Criteri di accettazione** (purezza)
- [x] Nessun import di rete, filesystem o `Date` in tutto il modulo (verificato dal lint)
- [x] La funzione non muta gli array in input

## T04 Creazione trasferta

Usecase `createTrip`: con auto (offre posti) o senza (cerca passaggio).

**Criteri di accettazione**
- [x] Trasferta con auto e 3 posti → salvata con `seatsAvailable == 3`
- [x] Trasferta senza auto → salvata con `hasCar == false` e nessun posto offerto
- [x] Plant di partenza uguale a quello di destinazione → rifiutata con errore esplicito
- [x] Data di partenza nel passato (secondo `Clock` iniettato) → rifiutata
- [x] Data di rientro precedente alla partenza → rifiutata
- [x] Posti offerti ≤ 0 oppure > 8 con auto dichiarata → rifiutata
- [x] Ogni caso di rifiuto ritorna un errore tipizzato, non un'eccezione generica

## T04b ⛔ Modello a tratte, stato della candidatura in lista, note

Nasce da quattro decisioni di prodotto dell'umano del 13 ottobre 2026, registrate in
[PROGRESS.md](PROGRESS.md) e in [IDEAS.md](IDEAS.md). Raggruppate in un task solo perché cadono tutte
su `SeatOffer` e `MatchRequest`: separate sarebbero tre checkpoint e tre giri sugli stessi adapter.

Porta **solo** il modello e la forma dei dati. I comportamenti (cascata di auto-rifiuto,
reintegro, annullamento) sono di T05.

`Trip` **non** cambia: resta `departureAt` + `returnAt`, quindi T04 non si tocca. L'algoritmo di
`findMatches` **non** cambia: cambia la sua firma di ritorno. `TripRequest` **non** cambia: descrive
già una tratta sola (`fromPlantId`, `toPlantId`, `departureAt`).

### Decisioni fissate dall'umano — da applicare, non da rinegoziare

1. **L'identità della tratta è la coppia `tripId` + `direction`**, non un `legId` sintetico. L'unicità
   diventa così una conseguenza del modello invece di un'asserzione: `trips.id` è unico e `direction`
   ha due valori. Una tratta è una **proiezione** della trasferta, quindi un id generato cambierebbe
   fra due letture, e un id memorizzato richiederebbe comunque un vincolo di unicità sulla coppia.
   A T08: `trip_legs(trip_id, direction)` come chiave primaria composta, bersaglio della foreign key
   composta di `match_requests`, che rende impossibile per costruzione una candidatura sul rientro di
   una trasferta che non ha rientro.
2. **I posti per tratta vivono in una riga di stato di tratta** (`TripLeg`), scritta dall'adapter
   quando `TripRepository.save` scrive una trasferta con auto: una riga se `returnAt` è null, due
   altrimenti. Scartate le alternative: il contatore-override introduce un default implicito, e i
   posti derivati dalle candidature `accepted` metterebbero logica di business nell'adapter (vietata
   dal criterio di T09) e renderebbero indifendibile lato DB il criterio di T05 sulle accettazioni
   concorrenti, perché un conteggio non si vincola con un `CHECK`.
3. **Ricandidarsi dopo un annullamento riusa la stessa riga**, da `cancelled` a `pending`: è l'unica
   forma compatibile con `findByLegAndRequester`, che ritorna una riga sola, e con l'upsert di `save`.
4. **Una nota di soli spazi è rifiutata con errore tipizzato**, non normalizzata a `null`: accettarla
   permetterebbe di adempiere all'obbligo di nota al rifiuto scrivendo uno spazio, cioè di svuotarlo.
5. **La direzione non entra né nei vincoli duri né nel punteggio.** Nei vincoli sarebbe un predicato
   irraggiungibile, perché i plant e la data discriminano già la direzione; nel punteggio non c'è una
   preferenza di prodotto per una direzione. La preferenza dichiarata ("partire e tornare con la
   stessa persona") è un bonus su **coppie** di tratte, non esprimibile in `findMatches` così com'è:
   resta in `IDEAS.md`.

**Criteri di accettazione** (modello a tratte)
- [x] `LegDirection` è `'outbound' | 'return'`, union di letterali, con un **rango esplicito**
      (`outbound` prima di `return`) sotto test: l'ordine lessicografico delle due stringhe è un
      incidente dell'ortografia, e rinominare `return` in `inbound` lo invertirebbe con i test verdi
- [x] Una trasferta con auto e `returnAt` non null produce da `listOpenOffers` **due** offerte: andata
      (`fromPlantId → toPlantId` all'orario di `departureAt`) e ritorno (**plant invertiti**, orario di
      `returnAt`)
- [x] Una trasferta con auto e `returnAt` null produce **una** sola offerta; senza auto, nessuna
- [x] Salvata una trasferta con auto e 3 posti e rientro, **entrambe** le tratte hanno 3 posti: i 3
      posti dell'auto sono 3 su ciascuna tratta, non 3 in tutto
- [x] Scritto a 2 il contatore dell'andata, una rilettura dà **andata 2 e ritorno 3**
- [x] Il contatore di tratta non scende sotto zero né supera `seatsTotal`: errore tipizzato, come
      `makeTrip`
- [x] Il filtro "almeno un posto libero" è **per tratta**: andata esaurita e ritorno libero producono
      una sola offerta, quella del ritorno
- [x] Due candidature dello stesso collega sulle **due tratte della stessa trasferta** sono ammesse e
      distinte, non una doppia candidatura
- [x] `findByLegAndRequester(tripId, direction, requesterId)` sostituisce `findByTripAndRequester`:
      interrogata sul ritorno non restituisce la candidatura dell'andata
- [x] `listByLeg(tripId, direction)` sostituisce `listByTrip`: i criteri di T14 parlano di posti e di
      esaurimento, che sono per tratta, e la cascata di T05 deve leggere le `pending` di **quella**
      tratta
- [x] L'ultima chiave dell'ordine totale di `findMatches` è l'**identità di tratta**, non `tripId`: un
      test permuta l'input e ottiene lo stesso ordine su due offerte a punteggio identico **che
      condividono il `tripId`**
- [x] Un test costruisce la trasferta degenere con `fromPlantId == toPlantId` (raggiungibile: non è un
      invariante di `makeTrip` ma una regola di creazione di T04) e dimostra che le sue **due** tratte,
      che matchano la stessa richiesta con lo stesso punteggio e lo stesso `tripId`, restano in ordine
      totale

**Criteri di accettazione** (stato della candidatura in lista)
- [x] `findMatches` **restituisce** le offerte su cui il richiedente ha una candidatura `pending`,
      `accepted` o `rejected`, con lo stato attaccato al risultato, invece di ometterle
- [x] Una candidatura `cancelled` **non** marca l'offerta: risulta candidabile come se non ci fosse
- [x] Non-regressione su T03: gli altri vincoli duri continuano a **omettere** — plant diverso, data
      diversa, orario fuori finestra, `seatsAvailable == 0`, offerta del richiedente stesso

**Criteri di accettazione** (note)
- [x] `requestNote` è facoltativa: una candidatura senza nota è valida
- [x] `resolutionNote` e `resolvedBy` (`'owner' | 'requester' | 'system'`, union di letterali) esistono
      sulla riga e sono nulli finché la candidatura è aperta
- [x] I due si impostano **insieme**: uno non null e l'altro null è rifiutato con errore tipizzato
- [x] Il limite di lunghezza delle note sta in `config/`, non nel codice: un test con una config a
      limite ridotto dimostra che il rifiuto segue il parametro
- [x] Confini provati, non solo il centro: limite−1 accettato, limite esatto accettato, limite+1
      rifiutato
- [x] Il limite si misura in **code point** e non in unità di stringa: un test con un carattere fuori
      dal piano base (`'👍'.length === 2`) dimostra che due emoji non consumano quattro caratteri,
      altrimenti il conteggio applicato non è quello che l'utente vede
- [x] Una nota oltre il limite è rifiutata con **errore tipizzato**, non troncata in silenzio
- [x] Una nota di **soli spazi** è rifiutata con errore tipizzato, non normalizzata a `null`
- [x] Una riga `cancelled` può tornare a `pending` **riusando lo stesso id**, e un test lo dimostra
      attraverso la suite di contratto (semantica di upsert già dichiarata nel port)
- [x] La suite di contratto condivisa verifica che note e `resolvedBy` sopravvivano a scrittura e
      rilettura, senza modifiche alla suite fra `memory` e `supabase`

⛔ Checkpoint obbligatorio, **più grande di come era stato scritto la prima volta**: modifica
**cinque** interfacce pubbliche dopo T02 — `SeatOffer`, `MatchRequest`, il ritorno di `findMatches`,
`MatchRequestRepository` (due metodi rinominati e per-tratta) e `TripRepository` (un metodo nuovo per
il contatore di tratta, più `listOpenOffers` che cambia semantica: da una offerta per trasferta a due).
Aggiunge inoltre un'**entità di dominio nuova** (`TripLeg`) e **pre-impegna la forma di una tabella di
T08** (`trip_legs`, chiave primaria composta). Approvato dall'umano il 13 ottobre 2026 dopo che il
planner ha mostrato che il criterio sui posti per tratta non era soddisfacibile senza di esso.

## T05 Candidatura, accettazione, rifiuto

Usecase `requestSeat`, `acceptRequest`, `rejectRequest`.

**Criteri di accettazione**
- [ ] Candidatura valida → richiesta creata in stato `pending`
- [ ] Accettazione → richiesta `accepted` **e** `seatsAvailable` decrementato di 1
- [ ] Rifiuto → richiesta `rejected` e `seatsAvailable` **invariato**
- [ ] Accettazione quando `seatsAvailable == 0` → rifiutata con errore esplicito
- [ ] Doppia candidatura dello stesso utente sulla stessa offerta → rifiutata
- [ ] Solo il proprietario dell'offerta può accettare o rifiutare: un altro utente riceve errore
- [ ] Una richiesta già `accepted` non può essere accettata di nuovo (nessun doppio decremento)
- [ ] Un test dimostra che due accettazioni concorrenti sull'ultimo posto non portano `seatsAvailable` sotto zero

## T06 KPI aziendali

Usecase `computeCompanyKpi` sui match accettati. Funzione pura su parametri configurabili.

**Criteri di accettazione**
- [ ] Zero match accettati → tutti i KPI a zero, nessuna divisione per zero
- [ ] 1 match accettato su trasferta di 3 giorni → 1 auto evitata, 3 giorni di noleggio evitati
- [ ] Saving € = giorni evitati × costo noleggio/giorno da `config`, verificato su un caso a mano
- [ ] CO₂ evitata = distanza tratta (tabella statica) × g CO₂/km da `config`, verificato su un caso a mano
- [ ] Cambiando un parametro in `config` il risultato cambia di conseguenza (niente valori hardcoded)
- [ ] I match `pending` e `rejected` **non** contribuiscono ad alcun KPI

## T07 Badge

Usecase `awardBadges` sulle statistiche personali. Funzione pura.

**Criteri di accettazione**
- [ ] Primo viaggio condiviso → badge "primo viaggio" assegnato
- [ ] Soglie definite in `config`, non nel codice
- [ ] Il badge è assegnato **esattamente** al raggiungimento della soglia, non uno prima né uno dopo
- [ ] Nessun badge duplicato se la funzione viene eseguita due volte
- [ ] Nessun badge implica premi, denaro o buoni: solo simbolico (verificato sui testi)

## T08 ⛔ Schema Supabase, migrazioni e RLS

Tabelle da `ARCHITECTURE.md`, come SQL versionato nel repo.

**Criteri di accettazione**
- [ ] Le migrazioni sono file SQL tracciati in git, applicabili su un progetto vuoto
- [ ] Applicate su **staging** senza errori
- [ ] **RLS attiva su ogni tabella**, nessuna esclusa
- [ ] Un test di integrazione dimostra che un utente **non** può leggere i dati di un altro oltre a
      quanto previsto
- [ ] Un test dimostra che un utente non può modificare le trasferte altrui
- [ ] Un test dimostra che un utente non può accettare richieste su offerte non sue
- [ ] Il decremento di `seats_available` è atomico lato DB: un test di concorrenza non va sotto zero
- [ ] I tipi TypeScript sono **generati** dallo schema, non scritti a mano

⛔ Checkpoint obbligatorio: cambio di schema DB.

## T09 Adapter Supabase

Implementazione dei port con `@supabase/supabase-js`.

**Criteri di accettazione**
- [ ] Passa **la stessa suite di contratto** dell'adapter memory, senza modifiche alla suite
- [ ] Nessuna logica di business nell'adapter: solo traduzione (verificato dal reviewer)
- [ ] URL e chiavi letti da `config`, iniettati, **nessuna chiave nel codice**
- [ ] Un errore di rete si presenta come errore tipizzato del port, non come eccezione Supabase grezza
- [ ] `core/` continua a non importare `@supabase/supabase-js` (verificato dal lint)

⛔ Nuova dipendenza: `@supabase/supabase-js` va approvata.

## T10 Accesso con codice invito

`SessionGateway`: codice invito → sessione.

**Criteri di accettazione**
- [ ] Codice valido → sessione creata, profilo accessibile
- [ ] Codice non valido → errore esplicito, nessuna sessione
- [ ] Codice disattivato → errore esplicito
- [ ] Il codice **non** è nel codice sorgente né nel repo: sta in `config`, iniettato
- [ ] Senza sessione valida, le RLS impediscono qualsiasi lettura (test di integrazione)
- [ ] La sessione sopravvive alla chiusura e riapertura dell'app

## T11 UI onboarding e profilo
- [ ] Inserendo un codice valido si arriva alla schermata principale
- [ ] Codice errato → messaggio di errore visibile, si resta sulla schermata
- [ ] Il profilo mostra nome e plant di appartenenza
- [ ] Nessun import da `adapters/` in tutto `ui/` (verificato dal lint)
- [ ] Render test: la schermata di onboarding monta con adapter memory

## T12 UI creazione trasferta
- [ ] Il form raccoglie: plant partenza, plant destinazione, data/ora partenza, data rientro, auto sì/no, posti
- [ ] I plant si scelgono da una lista chiusa, non si digitano
- [ ] Il campo posti appare **solo** se l'auto è dichiarata
- [ ] Ogni errore di validazione di T04 produce un messaggio visibile in schermata
- [ ] A salvataggio avvenuto la trasferta appare nella lista personale
- [ ] Render test su almeno un percorso completo di creazione

## T13 UI match e candidatura
- [ ] Creata una trasferta compatibile con un'offerta esistente, il match appare in lista
- [ ] Ogni match mostra: collega, orario, posti disponibili, quanto combacia
- [ ] I match sono ordinati per punteggio, come da T03
- [ ] Nessun match compatibile → stato vuoto esplicito, non una lista bianca senza spiegazione
- [ ] Inviata la candidatura, lo stato passa a "in attesa" ed è visibile

## T14 UI richieste ricevute
- [ ] Chi offre posti vede le candidature ricevute in stato `pending`
- [ ] Accettando, i posti disponibili mostrati diminuiscono
- [ ] Rifiutando, i posti disponibili restano invariati
- [ ] Esauriti i posti, l'offerta non accetta più candidature e lo dichiara in schermata

## T15 UI dashboard personale e badge
- [ ] Mostra viaggi condivisi, CO₂ evitata, saving generato, badge ottenuti
- [ ] I numeri coincidono con quelli calcolati da T06 e T07 sugli stessi dati (test)
- [ ] I valori stimati sono **dichiarati come stime** in schermata
- [ ] Utente senza viaggi → stato vuoto con zeri, nessun errore

## T16 UI dashboard aziendale
- [ ] Mostra trasferte registrate, match proposti, match accettati, auto evitate, giorni evitati, saving €, CO₂
- [ ] I numeri coincidono con T06 sugli stessi dati (test)
- [ ] È visibile che saving e CO₂ sono stime da parametri configurabili
- [ ] DB vuoto → tutti zeri, nessun crash e nessun `NaN`

## T17 Seed dimostrativo

Dataset sintetico sulle tratte del pilota, **disattivabile**.

**Criteri di accettazione**
- [ ] Il seed è uno script separato, non parte dell'avvio dell'app
- [ ] Popola trasferte sulle tratte Pomigliano–Foggia–Grottaglie con almeno un match plausibile
- [ ] Nessun nome di persona reale: tutti i profili sono dichiaratamente fittizi
- [ ] Eseguito due volte non duplica i dati (idempotente)
- [ ] Esiste un modo documentato per svuotare i dati di seed
- [ ] L'app funziona correttamente **anche** con il seed non applicato

## T18 ⛔ Build APK e prova su device

**Criteri di accettazione**
- [ ] `eas build -p android --profile preview` produce un APK scaricabile
- [ ] L'APK si installa su un telefono Android reale
- [ ] Sul telefono gira il percorso completo di [PRD.md](PRD.md) § "Definizione di successo"
- [ ] Il keystore è salvato e il backup è **fuori** da questa macchina e fuori dal repo
- [ ] Il package id è `com.softwareoffice.traveltogether`
- [ ] La prova è stata fatta sul device su cui verrà mostrata la demo

⛔ Azione irreversibile: la prima build fissa il keystore e il package id.
