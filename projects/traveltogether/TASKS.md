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
- [ ] Plant di partenza diverso → nessun match
- [ ] Plant di destinazione diverso → nessun match
- [ ] Data diversa → nessun match
- [ ] Orario fuori dalla finestra di tolleranza → nessun match
- [ ] Orario **esattamente al limite** della finestra → è un match (confine incluso, documentato)
- [ ] `seatsAvailable == 0` → nessun match
- [ ] Offerta del richiedente stesso → nessun match
- [ ] Richiedente con richiesta già `pending` su quell'offerta → nessun match
- [ ] Richiedente con richiesta già `accepted` su quell'offerta → nessun match

**Criteri di accettazione** (punteggio)
- [ ] A parità di tutto, l'offerta con orario più vicino è prima in classifica
- [ ] L'offerta con stesso plant di appartenenza precede quella con plant diverso
- [ ] Il punteggio è deterministico: due esecuzioni sugli stessi input danno lo stesso ordine
- [ ] Ordinamento stabile a parità di punteggio (nessuna dipendenza dall'ordine di input)

**Criteri di accettazione** (purezza)
- [ ] Nessun import di rete, filesystem o `Date` in tutto il modulo (verificato dal lint)
- [ ] La funzione non muta gli array in input

## T04 Creazione trasferta

Usecase `createTrip`: con auto (offre posti) o senza (cerca passaggio).

**Criteri di accettazione**
- [ ] Trasferta con auto e 3 posti → salvata con `seatsAvailable == 3`
- [ ] Trasferta senza auto → salvata con `hasCar == false` e nessun posto offerto
- [ ] Plant di partenza uguale a quello di destinazione → rifiutata con errore esplicito
- [ ] Data di partenza nel passato (secondo `Clock` iniettato) → rifiutata
- [ ] Data di rientro precedente alla partenza → rifiutata
- [ ] Posti offerti ≤ 0 oppure > 8 con auto dichiarata → rifiutata
- [ ] Ogni caso di rifiuto ritorna un errore tipizzato, non un'eccezione generica

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
