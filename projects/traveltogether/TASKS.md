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

Usecase `requestSeat`, `acceptRequest`, `rejectRequest`, `cancelRequest`.

**Criteri riscritti il 13 ottobre 2026.** Gli otto originali erano scritti quando l'unità di offerta
era la **trasferta**: cinque su otto nominavano un `seatsAvailable` che ora esiste **per tratta**, e
uno — "doppia candidatura sulla stessa offerta" — avrebbe classificato come doppione il collega che
prende andata **e** ritorno dalla stessa persona, cioè il caso che l'umano ha indicato come il
migliore. Sostituiti dall'elenco sotto, che incorpora anche le quattro decisioni di prodotto del
13 ottobre. Vedi `PROGRESS.md`.

**Criteri di accettazione** (candidatura)
- [x] Candidatura valida su una **tratta** → `pending`, con `requestNote` facoltativa
- [x] Doppia candidatura sulla stessa tratta → rifiutata se esiste già una riga `pending`, `accepted`
      oppure `rejected`
- [x] Una riga `cancelled` **non** blocca: la ricandidatura è ammessa e **riusa lo stesso id**
- [x] Candidature dello stesso collega sulle **due tratte** della stessa trasferta: entrambe ammesse

**Criteri di accettazione** (accettazione e rifiuto)
- [x] Accettazione → `accepted` **e** i posti di **quella** tratta decrementati di 1; i posti
      dell'altra tratta **invariati**
- [x] Rifiuto → `rejected`, `resolvedBy: 'owner'`, posti **invariati**
- [x] Rifiuto **senza nota** → errore tipizzato: la nota è obbligatoria e il modello non può imporla
      (dipende dallo stato precedente della riga), quindi la impone questo usecase
- [x] Accettazione quando i posti di quella tratta sono a 0 → rifiutata con errore esplicito
- [x] Solo il proprietario della trasferta può accettare o rifiutare: un altro utente riceve errore
- [x] Una richiesta già `accepted` non può essere accettata di nuovo (nessun doppio decremento)
- [x] Un test dimostra che due accettazioni concorrenti sull'ultimo posto non portano i posti della
      tratta sotto zero

**Criteri di accettazione** (annullamento)
- [x] Annullamento di una `pending` → `cancelled`, **nessuna** nota richiesta, posti invariati
- [x] Annullamento di una `accepted` → `cancelled`, `resolvedBy: 'requester'`, nota **obbligatoria**
      (senza nota → errore tipizzato) e posti della tratta **+1**
- [x] Solo il richiedente può annullare la propria candidatura: un altro utente riceve errore

**Criteri di accettazione** (le due transizioni pilotate dal sistema)
- [x] Quando un'accettazione consuma l'**ultimo** posto, tutte le altre `pending` di **quella** tratta
      passano a `rejected` con `resolvedBy: 'system'` e nota automatica; quelle dell'altra tratta
      restano `pending`
- [x] Quando i posti di una tratta tornano **> 0**, le righe `rejected` con `resolvedBy: 'system'` di
      quella tratta tornano a `pending`, con `resolutionNote` e `resolvedBy` **azzerati**
- [x] Un rifiuto con `resolvedBy: 'owner'` **non** viene reintegrato: un test lo distingue da uno
      `system` sulla stessa tratta
- [x] Il reintegro non tocca le righe `cancelled`
- [x] Il reintegro porta a `pending` e **non** ad `accepted`: tornano candidati tutti, e sceglie chi
      offre l'auto. Nessun criterio di precedenza fra loro, quindi nessun ordine da inventare

**Criteri di accettazione** (correzioni portate da T04b)
- [x] La lunghezza delle note è validata **solo in scrittura**: una riga scritta quando il limite era
      più alto si rilegge senza `invalid-record`. Un test abbassa il limite **dopo** la scrittura e
      pretende che la rilettura funzioni. Gli invarianti strutturali restano validati sempre
> **Il criterio sul guard di `save` è stato spostato a T08 il 13 ottobre 2026, perché era scritto
> male.** Diceva "candidature **aperte**", ma su Postgres la foreign key composta blocca la
> cancellazione di una tratta finché esiste **qualsiasi** riga che la referenzia, comprese le
> `rejected` e le `cancelled`: un guard limitato alle aperte non avrebbe chiuso la divergenza fra i due
> adapter, l'avrebbe solo spostata. La semantica esatta è una decisione di schema e vive dove lo schema
> si scrive. Nel frattempo il percorso è **irraggiungibile**: `save` è chiamato solo da `createTrip`,
> dove non esistono né tratte né candidature preesistenti.

**Fuori da T05, e senza un innesco oggi.** L'umano ha deciso che una tratta che scompare deve
**annullare a cascata** le candidature aperte, con `resolvedBy: 'system'` e nota automatica. Non entra
qui perché richiede un usecase di **modifica trasferta** che nessun task del backlog prevede: oggi
`save` è chiamato solo da `createTrip`, dove non esistono né tratte né candidature preesistenti.
Il criterio su `save` qui sopra chiude nel frattempo la perdita silenziosa. Quando la modifica
trasferta diventerà un task, l'annullamento a cascata è un suo criterio — e **non** va messo
nell'adapter, dove sarebbe logica di business vietata dal criterio di T09.

## T06 KPI aziendali

Usecase `computeCompanyKpi`. Funzione pura su parametri configurabili.

### La base di calcolo, decisa dall'umano il 14 ottobre 2026

I criteri originali dicevano *"1 match accettato su trasferta di 3 giorni → 1 auto evitata, 3 giorni di
noleggio evitati"*, scritti quando un match era per **trasferta**. Con le tratte un match accettato è
mezzo viaggio, e contarlo per tratta dava numeri sbagliati in entrambe le direzioni.

**L'unità di misura è la trasferta del richiedente, e il fatto misurato è che per lui non è stato
noleggiato nulla.** Parole dell'umano: *"io comunque devo fare una trasferta di 3 giorni, ma non ho
preso una macchina per me, indipendentemente da come vado e torno"*. Quindi:

- **Un'auto è evitata** per ogni collega la cui **propria** trasferta ha `hasCar: false` e che ha
  **almeno una** candidatura `accepted`. Non per tratta, e non serve che entrambe le tratte siano
  coperte: il fatto contabile è che per quella persona non è stato pagato un noleggio.
- **I giorni di noleggio evitati** sono i giorni della **sua** trasferta, da `departureAt` a `returnAt`.
  Un noleggio si paga a periodo, non a tratta.
- **Chi offre l'auto non conta** fra le auto evitate: ha noleggiato, ed è l'auto che viene condivisa.

È la base più difendibile perché è **misurabile dai dati** e corrisponde a come l'azienda conta
davvero: quanti noleggi non ha pagato. Semplificazione da dichiarare in schermata: il modello non sa
come il collega ha coperto le tratte che non ha condiviso (treno, un altro collega, un passaggio
privato) e non conta le emissioni di quei mezzi.

**Serve aritmetica di calendario, che oggi non esiste.** `parseUtcInstant` si ferma al giorno per
scelta dichiarata, quindi "giorni fra `departureAt` e `returnAt`" non è calcolabile: va aggiunta una
conversione data civile → numero di giorno in `core/domain`, provata su fine mese, anno bisestile e
cambio d'anno. È il buco segnalato il 13 ottobre, e questo è il task che lo pretende.
Il conteggio è **inclusivo**: dal 3 al 5 novembre sono 3 giorni, come dice il criterio originale.

**Criteri di accettazione**
- [x] Zero candidature accettate → tutti i KPI a zero, nessuna divisione per zero
- [x] Un collega senza auto con **una** candidatura accettata su una trasferta di 3 giorni → **1 auto
      evitata, 3 giorni** di noleggio evitati, anche se ha condiviso **una sola** tratta
- [x] Lo stesso collega con **entrambe** le tratte accettate → ancora **1 auto evitata e 3 giorni**,
      non 2 e non 6: è il test che impedisce il doppio conteggio
- [x] Chi **offre** l'auto non compare fra le auto evitate
- [x] Giorni inclusivi: dal 3 al 5 novembre sono 3; `returnAt` null → 1 giorno
- [x] L'aritmetica dei giorni è provata su **fine mese, anno bisestile e cambio d'anno**
- [x] **Prerequisito ⛔, approvato il 14 ottobre:** `MatchRequest` guadagna `requesterTripId`,
      valorizzato da `requestSeat`. Senza, la trasferta del passeggero — da cui dipendono giorni,
      saving e CO₂ — si può solo **dedurre** (stessa persona, senza auto, stessi plant, stesso giorno),
      e il numero in cima alla slide poggerebbe su una regola invece che su un dato. Lo schema di T08
      non è ancora scritto, quindi adesso non c'è nessuna migrazione da rifare
- [x] **Saving €** = (giorni evitati × costo auto/giorno) **+** (km evitati × consumo × prezzo
      carburante), tutti e quattro i parametri da `config`, verificato su un caso a mano
- [x] **CO₂ e carburante si contano sulla trasferta del passeggero, non per tratta condivisa.**
      Chi non ha noleggiato non ha guidato: la sua auto mancata non ha percorso **nessuna** delle due
      tratte, quindi si contano andata **e** ritorno (×1 se `returnAt` è null). È l'unica base coerente
      con i giorni di noleggio, e quattro numeri sulla stessa base non si smontano
- [x] **Conseguenza da mettere sotto test:** CO₂ e carburante **non** raddoppiano se il collega ha
      condiviso entrambe le tratte invece di una. Il valore è lo stesso, esattamente come per auto
      evitate e giorni: la candidatura accettata è l'**innesco**, non l'unità di misura
- [x] Cambiando un parametro in `config` il risultato cambia di conseguenza (niente valori hardcoded)
- [x] Le candidature `pending`, `rejected` e `cancelled` **non** contribuiscono ad alcun KPI
- [x] Una **trasferta** con stato `cancelled` **non** contribuisce ad alcun KPI, nemmeno se ha una
      candidatura accettata: non è avvenuta, quindi non c'era nessun noleggio da evitare e nessun km da
      non percorrere. `published` e `completed` contribuiscono. È un criterio distinto da quello sopra,
      che parla dello stato della **candidatura**: sono due stati diversi su due entità diverse, e
      confonderli gonfia ogni numero della slide
- [x] Una tratta la cui coppia di plant non è nella tabella delle distanze **non** fa fallire il
      calcolo in silenzio: errore tipizzato oppure zero dichiarato, documentato

## T07 Badge

Usecase `awardBadges` sulle statistiche personali. Funzione pura.

**Criteri di accettazione**
### Il conducente va riconosciuto, deciso dall'umano il 14 ottobre 2026

*"Anche il conducente risparmia facendo così perché condivide l'auto e deve essere premiato perché ha
messo a disposizione l'auto e il fastidio."*

I KPI **aziendali** restano invariati: contare il conducente fra le auto evitate conterebbe **due
volte** la stessa auto — una per il passeggero e una per chi guidava — ed è il doppio conteggio da cui
due test di T06 difendono. Il conducente non risparmia denaro, ha noleggiato comunque: il suo
contributo è **aver reso possibile** il risparmio altrui, e si riconosce invece di sommarsi.
Il riconoscimento vive quindi qui e nella dashboard personale di T15.

**Criteri di accettazione**
- [x] Primo viaggio condiviso → badge "primo viaggio" assegnato
- [x] Soglie definite in `config`, non nel codice
- [x] Il badge è assegnato **esattamente** al raggiungimento della soglia, non uno prima né uno dopo
- [x] Nessun badge duplicato se la funzione viene eseguita due volte
- [x] Nessun badge implica premi, denaro o buoni: solo simbolico (verificato sui testi)

**Criteri di accettazione** (riconoscimento del conducente)
- [x] Esistono badge **dedicati a chi guida e offre posti**, distinti da quelli del passeggero
- [x] Le statistiche del conducente si contano su ciò che ha **offerto e visto accettare**: tratte
      offerte con almeno una candidatura accettata, colleghi trasportati, km condivisi
- [x] Un collega che ha fatto **entrambi** i ruoli — guidatore su una trasferta, passeggero su
      un'altra — riceve i badge di **entrambe** le famiglie, e un test lo dimostra
- [x] Un conducente che ha offerto posti e **non** ha avuto nessuna candidatura accettata non riceve
      i badge da conducente: il riconoscimento è per aver trasportato qualcuno, non per aver offerto
- [x] Le soglie dei badge da conducente stanno in `config` come le altre, e un test con soglie ridotte
      dimostra che l'assegnazione segue il parametro

## T07c Validazione di `requesterTripId` in `requestSeat`

Nasce dal rilievo N1 del reviewer su T06, e l'umano ha scelto il 14 ottobre 2026 di chiuderlo **in
entrambi i posti**: il controllo nell'usecase adesso, i vincoli nel DB a T08.

**Perché è il campo più pesante del modello.** `requesterTripId` è obbligatorio e non vuoto, e lì si
fermano i controlli: nessuno verifica che quella trasferta esista, che sia **del richiedente** o che
sia **senza auto**. Da lui dipendono tutti e quattro i numeri della dashboard aziendale. Conseguenze
**con `verify` verde**: un riferimento alla trasferta di un collega, o a una più lunga della propria,
gonfia giorni, km, CO₂ e saving senza che nulla protesti; un id inesistente fa fallire l'**intero**
calcolo, cioè un dato sbagliato di una riga spegne la dashboard.

`requestSeat` ha già `deps.trips` in mano e non la interroga. Il controllo nell'usecase dà il messaggio
giusto in schermata a T13; il vincolo nel DB rende lo stato **impossibile**, anche per il seed di T17 e
per le migrazioni — che oggi sono le uniche vie d'ingresso esistenti, perché nessuna UI è scritta.

**Da fare prima di T12**, che costruirà il form da cui quel campo arriverà.

**Criteri di accettazione**
- [x] `requesterTripId` che punta a una trasferta **inesistente** → errore tipizzato, **zero scritture**
- [x] `requesterTripId` che punta alla trasferta **di un altro collega** → errore tipizzato, zero
      scritture. È il caso che gonfia i KPI senza che nessun test possa accorgersene
- [x] `requesterTripId` che punta a una trasferta **con l'auto** → errore tipizzato: chi ha noleggiato
      non si candida come passeggero, e conterebbe come auto evitata una persona che ha noleggiato
- [x] Il percorso valido resta valido: nessuno dei test esistenti di `requestSeat` cambia aspettativa
- [x] Criterio corrispondente aggiunto a **T08**: foreign key `requester_trip_id → trips.id` e policy
      che impone l'appartenenza

## T07d Compatibilità fra la trasferta dichiarata e la tratta

Decisione dell'umano del 14 ottobre 2026, su un buco che **T07c ha reso visibile chiudendo l'altra metà
dello stesso problema**. Dopo T07c l'unico modo di gonfiare i KPI è dichiarare una trasferta propria
**legittima ma irrilevante**, e l'umano ha scelto di impedirlo.

**Il buco, con i numeri.** `requestSeat` verifica che la trasferta dichiarata esista, sia tua, sia senza
auto e sia `published`, ma **non** che abbia a che vedere con la tratta su cui chiedi il posto. Quindi
oggi passa: chiedo un posto su una tratta **Pomigliano→Foggia di un giorno** e dichiaro la mia
trasferta **Pomigliano→Grottaglie di sei giorni**. Tutti i controlli di T07c sono soddisfatti, e i KPI
aziendali accreditano **sei giorni di noleggio evitati e i km della tratta più lunga**, perché la base
di calcolo di T06 è la trasferta del passeggero.

**Perché il vincolo non è arbitrario:** sono gli **stessi vincoli duri** che `findMatches` applica già
per *proporre* quell'offerta. Quindi non rifiuta nulla che l'app possa aver suggerito — chiude solo la
via "scelgo a mano la trasferta che mi conviene dichiarare".

**Da fare prima di T12**, che costruirà il form da cui la candidatura parte.

**Criteri riscritti il 23 ottobre 2026, prima di aprire il task.** I due criteri originali dicevano
*"i plant della trasferta dichiarata non coincidono con quelli della tratta"* e *"la data di partenza
non coincide con quella della tratta"*. Erano scritti pensando all'andata, e `listOpenOffers` proietta
la tratta di **rientro** con i plant **invertiti** e `departureAt = returnAt`: presi alla lettera
avrebbero rifiutato **ogni** candidatura legittima sul rientro, e il criterio di non-regressione qui
sotto sarebbe nato rosso — cioè il task avrebbe prodotto codice verde e sbagliato. L'umano ha scelto il
23 ottobre 2026 la **simmetria per direzione**.

**Criteri di accettazione**
- [x] `requestSeat` rifiuta con errore tipizzato quando la trasferta dichiarata non è compatibile con
      la **direzione** della tratta richiesta:
      - tratta `outbound` → i plant della trasferta dichiarata coincidono con quelli della tratta
        nello stesso ordine, e la data è quella del suo `departureAt`
      - tratta `return` → i plant coincidono **invertiti** (la tratta va dal `toPlantId` al
        `fromPlantId` della trasferta dichiarata), e la data è quella del suo `returnAt`
- [x] Una trasferta dichiarata **senza `returnAt`** non è compatibile con una tratta `return`: stesso
      errore e stesso `reason`. Chiedere il rientro senza averne dichiarato uno è lo stesso buco con un
      campo in meno
- [x] Il confronto sulla data è sul **giorno** e **non** applica la finestra di tolleranza del
      matching: `requestSeat` non ha `MatchConfig` fra le dipendenze e prendersela sarebbe un cambio di
      firma fuori da questo task. Resta quindi più lasco dei vincoli duri di `findMatches` — non
      rifiuta nulla che l'app possa aver proposto — ed è sufficiente a chiudere il buco dei KPI, che si
      misura in giorni e in km
- [x] Il motivo entra nell'errore `requester-trip-invalid` **già esistente**, come quinto `reason`: non
      un `kind` nuovo, perché per T13 resta lo stesso evento di schermata
- [x] Un test dimostra il caso dei numeri qui sopra: tratta di un giorno, trasferta dichiarata di sei,
      → rifiutata. È il caso che gonfia la slide
- [x] **Nessun percorso legittimo viene rifiutato:** un test parte da un'offerta che `findMatches`
      avrebbe proposto e dimostra che la candidatura passa, **su entrambe le direzioni** — una tratta
      `outbound` e una `return`. Il caso `return` è quello per cui i criteri sono stati riscritti: se
      manca, la simmetria resta non verificata e il task torna verde e sbagliato. Se questo test
      diventa rosso, il vincolo è più stretto dei vincoli duri del matching e il difetto è nel vincolo,
      non nel test
- [x] Ogni rifiuto asserisce **zero scritture**, contando le chiamate sullo spia
- [x] Limite dichiarato nel commento: il vincolo esclude le **tappe intermedie**, che oggi il modello
      non esprime. Se un domani serviranno, è questo vincolo da allentare — e va scritto dove si trova

**Chiuso il 23 ottobre 2026**, `verify` verde (420 test unitari in 27 suite) e reviewer approvato al
secondo giro. Bocciato al primo con `verify` verde: il predicato era corretto, ma nel fake degli usecase
andata e rientro dell'offerente cadevano nello stesso giorno UTC, quindi i due capi erano
indistinguibili e **due mutanti del predicato sopravvivevano** — la simmetria per direzione era
verificata su un lato solo. Chiuso dove stava la causa, nelle fixture del fake.

Limiti che restano, dichiarati nel commento di `trasfertaCompatibile` e non chiusi da questo task: le
tappe intermedie, l'assenza della finestra di tolleranza, il giorno **UTC** e non quello del fuso di chi
viaggia, e l'istante illeggibile dell'**offerente** che produce un messaggio rivolto al richiedente —
causa da rimuovere in **T07f**, prima di T09. Due voci di `IDEAS.md` raccolgono ciò che il vincolo non
copre: il capo non richiesto della trasferta e il giorno UTC.

## T07e Massimo storico delle metriche, perché un badge non si ritiri

Decisione dell'umano del 14 ottobre 2026, fra tre opzioni. Nasce da un prezzo che il developer di T07
ha **dichiarato**: `awardBadges` ricalcola da zero dalle statistiche, quindi un badge **sparisce** se le
statistiche scendono. Oggi irraggiungibile — nessun usecase annulla una trasferta — ma lo diventerà
insieme a quel flusso, e un premio simbolico **ritirato** è peggio di non averlo dato.

**La via scelta, e perché non paga il prezzo delle altre due.** Si memorizza il **massimo storico** di
ogni metrica, **non** i badge. Così `awardBadges` resta una funzione pura sulle sole statistiche, i
duplicati restano **non rappresentabili** — che è la proprietà più forte che quel criterio ha oggi — e
un badge non si ritira perché un massimo non scende. L'alternativa "memorizzo i badge" avrebbe
riaperto il criterio dei duplicati, riportandolo da *non rappresentabile* a *da verificare*.

**Da fare prima di T15**, la dashboard personale che mostra badge e statistiche.

**Criteri integrati il 23 ottobre 2026, prima di aprire il task, e il motivo va letto.** Il criterio
*"chi la chiama le passa il massimo"* **non aveva soggetto**: in produzione nessuno compone
`computePersonalStats` con `awardBadges` — l'unico accoppiamento vive nei test — e i criteri non dicevano
**quando** il massimo si aggiorna, che è la decisione da cui dipendono il port, la forma del codice e una
policy RLS di T08. Scelta dell'umano, fra tre vie: **un usecase nuovo, letto-poi-scritto.** Le altre due
erano aggiornare i massimi dentro i quattro usecase di scrittura già chiusi (più letture e più scritture
per ogni accettazione, e un criterio di T05 da riaprire) e fermarsi al port lasciando la composizione a
T15 (il criterio sul badge che non si ritira sarebbe stato dimostrato su una funzione **che nessuno
chiama**, cioè la stessa forma del difetto che il task nasce per evitare).

**Criteri di accettazione**
- [x] Esiste un port per leggere e aggiornare il **massimo** di ogni metrica per profilo, con adapter
      memory, e la suite di contratto condivisa lo copre
- [x] L'aggiornamento è **monotono**: scrivere un valore più basso del massimo memorizzato non lo
      abbassa. Un test lo dimostra, ed è l'invariante su cui poggia tutto il task
- [x] La **definizione** della monotonia vive in `core/domain` come funzione pura e ha un test proprio.
      L'adapter memory la **invoca** — niente `Math.max` scritto nell'adapter — e questo lo verifica il
      **reviewer per lettura**. Ogni altro adapter che la esprima nel proprio linguaggio è provato
      **equivalente** dalla stessa suite di contratto, che su due tecnologie diverse è l'unica forma di
      verifica disponibile.
      **Criterio corretto il 23 ottobre 2026, e l'errore era mio.** L'avevo scritto come *"l'adapter la
      usa, non la reimplementa, e la suite di contratto lo verifica su entrambi"*: sbagliato due volte.
      Una suite **comportamentale** non può vedere se un adapter *importa* una funzione, quindi
      prometteva una verifica che non esiste. E a T09 la forma giusta su Postgres è `GREATEST` per
      colonna in un unico `UPDATE`, cioè una **riespressione** della monotonia in un altro linguaggio:
      preso alla lettera, il criterio avrebbe imposto l'unica alternativa — leggi, calcola in
      TypeScript, riscrivi — che reintroduce la corsa per cui `adjustLegSeats` è stata definita
      relativa, e che può **abbassare un massimo**. Cioè avrebbe chiesto a T09 la cosa che il task
      vieta. Rilievo del planner, non trovato da nessun test perché nessun test può trovarlo
- [x] **Una riga per profilo con le quattro metriche**, non una riga per (profilo, metrica). Deciso
      perché rende il *"massimo scritto a metà"* **non rappresentabile** invece di evitarlo: con quattro
      righe l'alzata sono quattro scritture indipendenti e la terza che fallisce lascia applicate le
      prime due — è la voce di `IDEAS.md` *"La cascata e il reintegro scrivono N righe una alla volta"*,
      già registrata come difetto. In più la forma per metrica richiederebbe un **enum delle metriche
      nel DB**, cioè un secondo posto dove vive l'elenco, da tenere d'accordo con la union TypeScript.
      Prezzo accettato e dichiarato: una quinta metrica diventa una migrazione di colonna — e lo è già
      oggi un cambio di `PersonalStats`, del catalogo dei badge e di `config/`
- [x] Un **usecase nuovo** compone il percorso: legge trasferte e candidature, calcola le statistiche
      correnti con `computePersonalStats`, alza i massimi dove sono saliti, e ritorna i badge calcolati
      **sui massimi**. È il percorso che T15 userà, quindi è quello su cui i criteri seguenti si
      dimostrano
- [x] Il massimo è un tipo con un **nome proprio** (stesse quattro metriche di `PersonalStats`,
      significato diverso: un pelo d'acqua, non una statistica). Un campo che si chiama statistica e
      contiene un massimo mentirebbe sul proprio nome, ed è la classe di difetto che questo progetto
      rifiuta
- [x] `awardBadges` **non cambia firma** e resta una funzione pura: riceve il massimo al posto delle
      statistiche correnti
- [x] Un test dimostra il caso che il task esiste per impedire: statistiche che **scendono** (una
      trasferta annullata) → i badge **restano**. Sul percorso dell'usecase, non su una funzione isolata
- [x] I duplicati restano **non rappresentabili**: il criterio di T07 non si indebolisce, e un test lo
      riafferma sul percorso nuovo — soddisfatto **in composizione**, e il reviewer ha dichiarato il
      limite: il test sul percorso nuovo esercita i tre badge da passeggero, non tutti e sei. Voce in
      `IDEAS.md`, perché nessun test **si legge come il criterio**
- [x] Un errore di `computePersonalStats` **non lascia i massimi a metà**: si legge e si calcola prima,
      si scrive dopo, come fa `requestSeat` con la sua unica `save`. Un test lo asserisce contando le
      scritture sulla spia
- [x] **T15 dichiara in schermata** che le statistiche mostrate e quelle che assegnano i badge possono
      essere due numeri diversi, con la stessa onestà con cui dichiara che saving e CO₂ sono stime —
      spuntato come **criterio aggiunto a T15**, che è tutto ciò che T07e può fare: nessuna schermata
      esiste ancora, e si chiude lì
- [x] Criterio corrispondente su **T08**: la tabella dei massimi, con RLS che permette a ciascuno di
      leggere i propri **e di aggiornare i propri**. La metà in scrittura segue dalla decisione del
      23 ottobre: se aprire la dashboard aggiorna i massimi, una tabella leggibile e non aggiornabile
      renderebbe il percorso inutilizzabile — e una policy scritta solo in lettura è il genere di
      omissione che si scopre in demo. La forma che soddisfa la suite di contratto è **`GREATEST` per
      colonna** in un unico `INSERT … ON CONFLICT DO UPDATE … RETURNING *`: una monotonia imposta
      **sulla riga** (`WHERE nuovo > corrente` sull'intera riga) farebbe fallire il test di contratto
      del caso misto — una metrica che sale mentre le altre scendono — e in quel caso il difetto sarebbe
      nella SQL, non nella suite

## T07f ⛔ L'istante normalizzato al confine

Due voci `accettata` di `IDEAS.md` portate dentro dall'umano il 23 ottobre 2026 — *"Normalizzare
l'istante al confine dell'adapter"* e *"Istante normalizzato UTC come tipo brandizzato"* — più la nota
sulla validità di calendario. Sono un task solo perché sono la stessa cosa: **un parser unico al
confine**.

**Perché è la voce più urgente dell'elenco.** PostgREST serializza un `timestamptz` come
`2026-11-03T06:00:00+00:00` — offset, non `Z` — e con precisione al microsecondo. Entrambe le forme
sono rifiutate da `parseUtcInstant`, e `findMatches` risponde a un istante illeggibile **omettendo
l'offerta** (`if (!istanteOfferto) continue;`). Quindi a T09 **ogni** offerta proveniente da Supabase
sparirebbe in silenzio e il motore tornerebbe `ok([])`: *"nessun collega compatibile"*, indistinguibile
da un risultato legittimo. È lo scenario che il `Result` è stato introdotto per evitare, aggirato dal
lato dell'offerta.

**Perché prima di T08 e non dentro T09:** qui si decide la forma canonica, e da quella dipendono la
semantica delle colonne, i tipi generati dallo schema e il seed di T17. Dopo, è una seconda migrazione
su uno schema già applicato — e la voce stessa si dà **S dentro, M scoperta dopo**.

**Criteri riletti contro il codice il 25 ottobre 2026, prima di aprire il task** (planner). Sei
correzioni e tre aggiunte, ciascuna con il motivo accanto e marcata *(25/10)*. La causa comune: i
criteri erano scritti sul modello in cui il parser **rifiuta** tutto ciò che non è canonico, e T07f
introduce un parser che **accetta e riporta**. Su quel modello nuovo, *"accettato dal parser"* non
vuol più dire *"canonico"*, e sette test di task chiusi (T03, T04, T06, T07d) pinnano un
comportamento che questo task rovescia apposta o rende irrappresentabile. Forma canonica, nomi e decisioni: `PROGRESS.md`, voce del 25 ottobre.

**Criteri di accettazione**
- [x] Un punto solo normalizza e valida l'istante, in `core/domain`: `normalizeUtcInstant`. Nessun
      consumatore ripete il controllo. Lo chiamano **solo i confini da cui entra una stringa grezza** —
      oggi `createTrip` (input del form e `Clock.now()`), da T09 l'adapter Supabase — e i consumatori
      leggono data, millisecondi e ordine da funzioni **totali** sul tipo brandizzato.
      Verifica: `rg "normalizeUtcInstant" app/src --glob '!*.test.ts'` elenca solo `instant.ts`,
      `domain/index.ts`, `create-trip.ts` e il modulo di fixture; `rg "parseUtcInstant|ISTANTE_UTC"
      app/src` non trova niente.
      *(25/10: il criterio non diceva chi può chiamare il parser, e `createTrip` è un confine, non un
      consumatore; resa verificabile con un comando.)*
- [x] `Trip`, `SeatOffer` e `TripRequest` portano un tipo che il compilatore **distingue** da `string`:
      una stringa non normalizzata non è assegnabile. Rompe le firme, ed è la ragione del ⛔.
      Verifica: un'asserzione di tipo per ciascuno dei quattro casi (il tipo stesso e i campi
      d'istante delle tre entità) fa fallire `typecheck` se la stringa diventa assegnabile.
      *(25/10: aggiunto il metodo di verifica. Un test a runtime non può vedere un tipo; un'asserzione
      che il compilatore valuta sì, e può fallire.)*
- [x] Il parser accetta le forme che PostgREST produce — offset `+00:00` e frazioni da **uno a sei**
      decimali, che Postgres scrive **senza gli zeri finali** (`.12`, non `.120000`) — e le riporta
      a una forma sola, **troncando** oltre il millisecondo. Un test le pinna come **stringhe
      letterali**: è il formato di un sistema esterno, non un dettaglio di gusto.
      *(25/10: precisati gli zeri finali e il troncamento. Un parser che accettasse solo `.sss` e
      `.ssssss` rifiuterebbe `2026-11-03T06:30:00.12+00:00`, cioè una riga su dieci a T09.)*
- [x] **La forma canonica è unica** — `YYYY-MM-DDTHH:mm:ss.sssZ`, sempre i millisecondi, larghezza
      fissa di 24 caratteri — e fra due istanti canonici il confronto lessicografico coincide con
      quello cronologico **senza eccezioni**. Oggi non è così: `...T06:00:00Z` e `...T06:00:00.000Z`
      sono entrambi canonici, sono lo stesso istante e si ordinano **al contrario** (`Z` è `0x5A`, `.`
      è `0x2E`). Un test dimostra la coppia che oggi sbaglia (le due forme producono **la stessa
      stringa**), un test di tabella dimostra che **ogni** uscita del parser ha la forma a larghezza
      fissa, ed è la trappola che aspetta T13.
      *(25/10: "senza eccezioni" non è verificabile come enunciato universale; lo diventa come
      proprietà della forma, a larghezza fissa, provata su ogni uscita.)*
- [x] Le date impossibili (`2026-02-31`, il 29 febbraio di un anno non bisestile) sono rifiutate al
      confine con errore tipizzato. T04 è il primo punto che le **persiste**: senza questo, a T09 è
      Postgres a rifiutare l'INSERT con un errore grezzo lato adapter, l'opposto di dove questo
      progetto vuole la validazione. Un test su `createTrip` con `2026-02-31T…` → `invalid-departure-at`
      e **zero scritture**
- [x] La suite di contratto verifica che gli istanti che **escono** dai port siano **già canonici**:
      il parser li riporta **identici** (punto fisso), su ogni lettura che porta un istante —
      `findById`, `listByOwner`, `listOpenOffers` — con almeno una fixture i cui millisecondi
      finiscono con zero (`.120Z`), che è la forma che PostgREST restituisce accorciata.
      *(25/10: "accettati dal parser" era la verifica giusta per il parser di oggi, che rifiuta. Con il
      parser di T07f, che **accetta** `+00:00`, un adapter che lasciasse uscire la stringa grezza di
      PostgREST passerebbe il criterio e romperebbe l'ordine lessicografico. Dichiarato: **su `memory`
      questo test non può fallire per costruzione** — il compilatore impedisce già all'adapter di
      emettere una stringa non brandizzata. Vale a T09, ed è lì che paga.)*
- [x] `test:unit` continua a girare **senza rete**
- [x] Le fixture scritte a mano si adeguano **in questo task**. **Il seed non esiste ancora** (T17):
      il tipo lo obbligherà a passare dal parser, e lo si scrive come criterio di T17.
      *(25/10: il criterio nominava un seed che nel repo non c'è.)*
- [x] *(25/10, aggiunto)* **I test chiusi che cambiano aspettativa sono elencati, uno per uno, con il
      motivo**, e nessun altro cambia. Sono quelli che pinnano il comportamento che T07f rovescia per
      decisione: in `create-trip.test.ts` *"una partenza / un rientro con microsecondi è rifiutato"* e
      *"senza millisecondi … accettato e non riscritto"* (il titolo del `describe`, *"mai convertiti"*,
      cade con loro); in `find-matches.test.ts` *"un'offerta con offset invece di Z viene omessa"* e
      *"istante della richiesta malformato: errore"* (stati non più rappresentabili, la cui intenzione
      passa ai test del parser); in `request-seat.test.ts` *"istante illeggibile nella trasferta
      dichiarata"*; in `compute-company-kpi.test.ts` *"una data di calendario impossibile"*. Senza
      questo criterio sarebbero modifiche a test per farli passare, che `CLAUDE.md` vieta
- [x] *(25/10, aggiunto)* `MatchError` perde `invalid-request-departure-at`, che diventa
      **irrappresentabile**, e `ARCHITECTURE.md` (§ Il motore di matching) è aggiornato nello stesso
      commit: un ramo che nessun input può raggiungere è un ramo che nessun test può verificare
- [x] *(25/10, aggiunto)* Criteri corrispondenti scritti su **T08** — colonne `timestamptz(3)`, così
      il DB non conserva una precisione che il dominio tronca, e un confronto SQL e uno JS sugli
      stessi due istanti non possono dare risposte diverse — e su **T17** — il seed passa da
      `normalizeUtcInstant`, non da letterali

⛔ Checkpoint: rompe le firme di `Trip`, `SeatOffer` e `TripRequest` e di ogni adapter che le
materializza. **Sciolto il 25 ottobre 2026 per delega dell'umano** (vedi `PROGRESS.md`).

## T07g La suite di contratto prova il guasto

Tre voci `accettata` di `IDEAS.md` portate dentro il 23 ottobre 2026 — *"Hook di guasto nella suite di
contratto"*, *"Le letture di lista omettono le righe invalide invece di passarle"*, *"Rendere l'unicità
dei `tripId` una garanzia della macchina"*. Un task solo perché vivono nello stesso file.

**Perché prima di T09.** Il criterio di T09 *"passa la stessa suite di contratto, senza modifiche alla
suite"* vale quanto vale la suite, e oggi il **percorso d'errore** dei repository è l'unico
comportamento del port che nessun test tocca: `storage-unavailable` è dichiarato nel tipo e non è
prodotto né asserito da nessuna parte. Non sappiamo se i due adapter lo tratterebbero allo stesso
modo, ed è proprio il caso che si manifesterà in demo, con il proxy aziendale di mezzo. Scoperto a T09,
l'unica via d'uscita sarebbe **adattare la suite** — che per `ARCHITECTURE.md` è il segnale che il port
è sbagliato.

**Criteri riletti contro il modello il 25 ottobre 2026, prima di aprire il task** (planner). Sette
correzioni e un'aggiunta, ciascuna marcata *(25/10)* con il motivo accanto. La causa comune: i criteri
erano scritti **prima** del modello a tratte (T04b) e di T07f, e il criterio sull'identità non diceva
**quali** operazioni rifiutare, mentre metà delle policy di T08 non è ancora decisa. Uno era
insoddisfacibile come scritto. Piano, decisioni e alternative: `PROGRESS.md`, voce del 25 ottobre.

**Criteri di accettazione**
- [x] `AmbienteDiContratto` guadagna `guasta()` / `ripristina()`, **obbligatori**, e `pulisci()`
      ripristina anche il guasto. **Nessuna asserzione esistente di `repository-contract.ts` cambia**,
      salvo l'unica elencata nel criterio sull'identità. Verifica:
      `git diff -U0 b118678 -- app/src/adapters/contract/repository-contract.ts | rg "^-.*expect"`
      restituisce solo quella riga. `memory.contract.test.ts` cambia solo nella costruzione
      dell'ambiente, nessuna asserzione.
      *(25/10: "i file che già lo usano restano verdi senza essere modificati" non era soddisfacibile.
      L'unico file che usa l'interfaccia è quello che la **implementa**, e un membro obbligatorio lo
      costringe a cambiare. Renderli opzionali l'avrebbe soddisfatto alla lettera, e a T09 un ambiente
      senza guasto salterebbe il test in verde, cioè proprio il verde falso che `CLAUDE.md` vieta.
      L'additività si prova sulle asserzioni. `pulisci` che ripristina: un test che cade fra `guasta` e
      `ripristina` lascerebbe su staging un `afterEach` eseguito sotto guasto, e lo staging sporco.)*
- [x] Un test di contratto esercita `storage-unavailable` su **ognuno dei quindici metodi** dei quattro
      repository (`TripRepository` 6, `MatchRequestRepository` 5, `ProfileRepository` 2,
      `PersonalBestsRepository` 2), e passa su `memory`. Per le **quattro scritture** (`save` di
      trasferte e candidature, `adjustLegSeats`, `raise`), dopo `ripristina()` lo storage è **quello di
      prima**. Il gemello su `supabase` resta un criterio di T09, dove l'adapter esisterà.
      `SessionGateway` è fuori: il suo errore è `gateway-unavailable`, non un `RepositoryError` (voce in
      `IDEAS.md`).
      *(25/10: "ogni lettura e ogni scrittura" contate e nominate. Aggiunto lo storage intatto: senza,
      passerebbe un adapter che scrive e poi riporta l'errore.)*
- [x] Le letture di **lista** omettono le righe che il dominio rifiuta (`makeTrip`, `makeTripLeg`,
      `validateMatchRequestStructure`), come già fa `listOpenOffers` per l'offerta con owner senza
      profilo. Il caso concreto, **nel modello a tratte**: una tratta con `seatsTotal: 2` e
      `seatsAvailable: 5` sotto una trasferta valida diventa oggi **un'offerta pubblicata con cinque
      posti**, perché `listOpenOffers` legge i posti dalla tratta senza validarla; e una trasferta
      riscritta invalida sopra tratte valide continua a produrre offerte. Ogni test ha accanto una riga
      **valida, seminata allo stesso modo**, che resta in lista, e legge con un'identità che **vede** la
      riga: altrimenti l'omissione sarebbe indistinguibile dal filtro d'identità. **Dove:** trasferte e
      tratte in `memory-trip-repository.test.ts`, perché con i CHECK di T08 quelle righe su Postgres non
      si possono costruire (è il precedente dichiarato in testa a quel file); le candidature nella suite
      di contratto, che ha già `seminaCandidaturaGrezza`. I doc dei port, di `RepositoryError` e degli
      adapter smettono di dire che le liste non validano: `rg -n -i "non valida(no)? riga per riga"
      app/src` (test **inclusi**) non trova niente. L'istante che il parser rifiuta è irraggiungibile su
      `memory` da T07f: è un'omissione dell'adapter Supabase, criterio di T09.
      *(25/10: il caso concreto era scritto sul modello di prima di T04b, quando i posti dell'offerta
      venivano da `Trip`. Oggi una trasferta grezza 2/5 senza tratte non produce **nessuna** offerta,
      quindi un test scritto alla lettera sarebbe stato verde senza cambiare una riga dell'adapter.
      Aggiunti dove vivono i test, il controllo positivo e il doc.)*
- [x] L'enunciato *"ciò che attraversa un port è valido"* vale per **ogni lettura che restituisce
      un'entità con un validatore di dominio**. Oltre alle tre già coperte (`trips.findById`, `findLeg`,
      `matchRequests.findById`), un test per ciascuna di `listByOwner`, `listOpenOffers`, `listByLeg`,
      `listByRequester` e `findByLegAndRequester`. Quest'ultima è una lettura **singola**: una riga
      invalida dà `invalid-record`, non `null`, perché un `null` farebbe credere a `requestSeat` che il
      collega non si sia mai candidato. Fuori, e dichiarati: `ProfileRepository` e
      `PersonalBestsRepository`, i cui tipi **non hanno un validatore** nel dominio (voce in `IDEAS.md`).
      Scriverne uno sarebbe un altro task.
      *(25/10: "ogni lettura" comprendeva letture di tipi senza invarianti di dominio, dove non c'è
      niente da omettere, e non diceva cosa fa una lettura singola che oggi non valida affatto.)*
- [x] L'unicità della coppia (`tripId`, `direction`) fra le offerte e quella della coppia (tratta,
      richiedente) fra le candidature sono **verificate dalla suite**, non soltanto dichiarate nel doc.
      Sono le due precondizioni su cui poggiano l'ordine totale di `findMatches` e lo stato che marca
      ogni offerta: con due righe della stessa coppia e stati diversi, lo stato mostrato dipenderebbe
      dall'ordine dell'array in ingresso.
      **Offerte:** dopo una sequenza di salvataggi della stessa trasferta (rientro tolto e rimesso, posti
      cambiati) e con una seconda trasferta, `listOpenOffers` non contiene due voci con la stessa coppia.
      Dichiarato: su `memory` lo garantisce già la `Map`, e il test paga a T09, contro una join che
      duplica le righe. **Candidature:** il doc di `MatchRequestRepository.save` dichiara il vincolo; un
      **secondo id** sulla stessa (tratta, richiedente) è rifiutato con `invalid-record` e lo storage
      resta intatto (`listByLeg` ha una riga, `findByLegAndRequester` torna il primo id). Controlli:
      stesso richiedente sull'altra tratta, e un altro richiedente sulla stessa tratta, accettati; lo
      **stesso** id (la ricandidatura) resta un upsert. Il test asserisce il `kind`, che distingue il
      rifiuto per unicità da quello per identità.
      *(25/10: "verificate dalla suite" non diceva come. La seconda garanzia non era vera nemmeno come
      dichiarazione: la voce di `IDEAS.md` la attribuiva all'upsert per id, che **non** impedisce due id
      sulla stessa coppia, e l'adapter memory oggi li accetta entrambi.)*
- [x] Ogni omissione lascia un commento che nomina il canale mancante e la voce di `IDEAS.md` che lo
      chiuderà (il port di osservabilità). **Nessun commento dichiara l'omissione osservabile**, perché
      oggi non lo è: un commento che promette più del codice è un difetto. Verifica:
      `rg -n "Port di osservabilit" app/src/adapters --glob '!*.test.ts'` ha almeno una riga in ciascuno
      dei quattro metodi che omettono (`listOpenOffers`, `listByOwner`, `listByLeg`, `listByRequester`);
      il reviewer legge ogni riga di `rg -n -i "osservabil" app/src/adapters app/src/core/ports` (test
      inclusi) e nessuna promette un canale che esiste.
      *(25/10: reso verificabile, con il perimetro della ricerca dichiarato. È la lezione di T07f.)*

**Criterio aggiunto il 23 ottobre 2026, dalla bocciatura di T07e** (decisione dell'umano: qui e non in
un task a sé, perché tocca gli stessi file e alza lo stesso standard — porta il task da S/M a M)
- [x] **L'ambiente di contratto in RAM registra l'identità corrente**, e gli adapter memory **rifiutano**
      le operazioni su dati altrui dove le RLS di T08 le rifiuteranno. Così un test di contratto scritto
      come se le RLS non esistessero diventa **rosso su `memory`**, non a T09.
      Il difetto che lo motiva è reale e di oggi: un test dei massimi scriveva e leggeva la riga di un
      altro profilo restando autenticato come il primo, ed era **verde a 448 test**. L'ha trovato una
      lettura del reviewer, non `verify`. A T09 sarebbe stato rosso in due punti, e la diagnosi sarebbe
      arrivata nel momento peggiore: con l'apparenza di un port sbagliato quando il port è sano, o con
      la tentazione di allentare la policy per far passare un test. Oggi la rete è **convenzione più
      reviewer** — rispettata in una dozzina di punti del file di contratto, imposta da niente.
      `memory.contract.test.ts` dichiara già che l'hook di identità esiste *"perché aggiungerlo dopo
      imporrebbe di riscrivere la suite"*: questo criterio gli dà i denti.
      *(25/10: il criterio non diceva **quali** operazioni, e "dove le RLS di T08 le rifiuteranno" su metà
      delle tabelle non è ancora deciso. In RAM si impone **solo ciò che T08 ha scritto**, più la lettura
      delle candidature, che la suite segue già per convenzione in ogni test. La tabella qui sotto diventa
      la policy che T08 deve implementare, e lo diventa come criterio di T08. Precisato anche **come** si
      rifiuta, perché su Postgres una lettura negata non è un errore: è una riga che non c'è.)*
      **Rifiuta**, con la policy di T08 che specchia:
      - `trips.save` se `ownerId` non è l'identità, o se l'id esiste già con un altro owner (RLS di
        scrittura su `trips`, upsert compreso);
      - `matchRequests.save`: la creazione solo dal richiedente; `pending` e `cancelled` solo dal
        richiedente della riga; `accepted` e `rejected` solo dall'owner della trasferta della tratta; in
        ogni caso `requesterTripId` deve essere una trasferta **del richiedente** (i due attori, e la
        policy su `requester_trip_id`);
      - `personalBests.raise` per un profilo che non è l'identità (massimi propri).
      Le scritture rifiutate tornano `storage-unavailable` e **non scrivono**. È ciò che `RepositoryError`
      prescrive già per *"permessi negati, RLS che blocca"*: nessun `kind` nuovo.
      **Filtra**, come fa una policy di lettura: `personalBests.findByProfile` di un altro profilo → zeri
      in `ok`; una candidatura è visibile **al richiedente e all'owner della trasferta**, altrimenti
      `findById` → `not-found`, le liste la omettono e `findByLegAndRequester` → `null`.
      **Non impone, dichiarato:** le letture di trasferte e profili (le offerte pubblicate devono essere
      leggibili da tutti, il resto T08 non l'ha deciso), `adjustLegSeats` (T08 non ha deciso chi lo
      esegue: l'accettazione lo chiama come owner, l'annullamento come richiedente), `SessionGateway`.
      Con identità nulla ogni scrittura è rifiutata e ogni lettura filtrata.
      **Test esistenti che cambiano, e solo questi:** la fixture `unaCandidatura`, il cui
      `requesterTripId` è oggi `` `trip-di-${requesterId}` ``, cioè una trasferta che non esiste, punta a
      una trasferta **vera** del richiedente, salvata da lui; il test *"requesterTripId sopravvive a
      scrittura e rilettura"* sostituisce il letterale `'trasferta-del-richiedente'` con una **seconda**
      trasferta vera del richiedente, distinta da quella di default (è la riga `expect` del primo
      criterio). Tutti e due sarebbero rossi a T09 anche senza questo task, per la foreign key e la
      colonna uuid: è la stessa classe del difetto di T07e.
      **La prova che il criterio ha i denti è una sonda:** togliere `comeUtente(altro)` dal test *"due
      profili hanno massimi indipendenti"*, cioè rimettere il difetto di T07e, rende rosso `verify`.
      Prima di questo task restava verde.
- [x] *(25/10, aggiunto)* **Criteri corrispondenti scritti su T08 e T09**, nella forma già usata da T07c,
      T07e e T07f. Su T08: il vincolo `UNIQUE (trip_id, direction, requester_id)`; le policy della
      tabella del criterio sull'identità; **deciso chi esegue il reintegro e l'incremento dei posti di
      `cancelRequest`**, che oggi gira con l'identità del richiedente, legge con `listByLeg` e riscrive
      righe di **altri** richiedenti (la policy dei due attori lo vieterebbe, e sotto RLS il reintegro
      tornerebbe `ok([])` **in silenzio**); e la compatibilità fra i CHECK e `seminaCandidaturaGrezza`.
      Su T09: l'ambiente Supabase implementa `guasta` / `ripristina`; la violazione di unicità diventa
      `invalid-record` e il rifiuto RLS `storage-unavailable`; le liste omettono le righe che il dominio
      rifiuta, istante illeggibile compreso (verificato dal reviewer: su Postgres quel ramo nessun test
      condiviso lo può costruire).

⛔ Emersi in pianificazione, il 25 ottobre 2026: `findByLegAndRequester` che valida (stringe il contratto
di una lettura), il secondo id sulla stessa coppia rifiutato con `invalid-record` (un `kind` esistente con
un significato in più), e la tabella delle policy in RAM, che diventa vincolante per T08. **Sciolti per
delega dell'umano** nella sessione del 25 ottobre: le raccomandazioni e le alternative sono in
`PROGRESS.md`. Nessuna firma di port cambia, e nessun `RepositoryError` nuovo.

## T07h Igiene di lint e identità

Tre voci di `IDEAS.md` portate dentro il 23 ottobre 2026. **Collocato dopo T07g e prima di T07b:** T07b
lascia nel codice le identità *"che il compilatore controlla"*, e oggi quella garanzia ha un buco in una
direzione — quindi va chiuso prima di costruirci sopra una tabella.

Fuori da questo task, dichiarato per non farlo cercare: la voce *"Deny rules anche sui `.claude/`
annidati"* resta non schedulata. Toccherebbe `.claude/settings.json`, che `CLAUDE.md` vieta di
modificare senza chiedere, e non è un freno di questo progetto ma dell'officina.

Fuori anche la voce *"Un modulo di sola fixture importato dalla produzione non lo ferma nessuno"*
(`proposta`, non schedulata): tocca lo stesso file, ma non è in questo task.

**Criteri di accettazione**
- [x] *(25/10, riscritto)* `'config'` esce da `GRAFO.usecases` e rientra **solo per
      `src/core/usecases/**/*.test.ts`**, come elemento a sé del grafo: la regola *"il core di
      produzione non importa `config/`"* la impone il lint, non il giudizio di chi rivede.
      *Motivo della correzione:* il testo diceva `src/core/**/*.test.ts`, che **allargava** i test di
      `domain/` (oggi non possono importare `config/`, perché `GRAFO.domain` non lo contiene). Gli unici
      sei file di `core/` che importano `config/` sono test di conformità in `core/usecases/`
      (`badge-`, `cascade-`, `create-trip-`, `kpi-`, `match-`, `note-config.test.ts`); nessun file di
      produzione del core lo importa (verificato il 25/10). `ARCHITECTURE.md` § Modularità, il paragrafo
      *"Un punto in cui lint e documento non coincidono"*, si riscrive: ora coincidono
- [x] *(25/10, precisato)* Il selettore anti-orologio copre **ogni accesso a un membro di `Date`**
      (`MemberExpression[object.name='Date']`), quindi `Date.parse`, `Date.UTC` e `Date.now`, su
      `src/core/**/*.ts` **test inclusi**, lo stesso perimetro della regola di oggi. Sono deterministici,
      ma `Date.parse` su forme non-ISO è *implementation-defined* e Hermes e V8 non si comportano allo
      stesso modo: è esattamente la scorciatoia che `instant.ts` esiste per evitare.
      *Motivo della precisazione:* il perimetro non era dichiarato. Oggi in `src/` **nessun codice**,
      test compresi, usa `Date.parse` o `Date.UTC`: `Date` compare solo in commenti (`clock.ts`,
      `calendar.ts`, `instant.ts`, `trip.ts`, `fixed-clock.test.ts`), quindi la regola non rende rosso
      niente di esistente
- [x] *(25/10, riscritto)* `src/__tests__/**` è un elemento dichiarato del grafo, **e**
      `boundaries/no-unknown-files` è attiva su `src/**/*.{ts,tsx}`. Oggi `src/__tests__/` è l'unico
      punto **di `src/`** in cui qualunque import è permesso: un test che vi finisse potrebbe cablare
      `ui/` con `adapters/` e il lint tacerebbe.
      *Motivo della correzione:* il testo diceva *"l'unico punto dell'albero"*, ed è falso: anche
      `App.tsx`, `index.ts` e `tests/**` stanno fuori dal grafo, perché il blocco di `boundaries` copre
      solo `src/`. Restano fuori da questo task (voce in `IDEAS.md`). Sul secondo punto: con i file di
      oggi `no-unknown-files` segnalerebbe **un file solo**, `src/__tests__/harness.test.ts`; con
      l'elemento dichiarato, nessuno
- [x] *(25/10, reso verificabile)* `PlantId` e `BadgeId` sono **derivati** dai rispettivi array
      (`as const`). Oggi l'annotazione protegge una direzione sola: aggiungere un membro alla union senza
      aggiungerlo all'array **non produce alcun errore**, e un ciclo su `PLANT_IDS` (KPI per
      stabilimento, seed di T17) salterebbe una sede senza fallire. Verifica: in `plant.ts` e in
      `badge.ts` ogni letterale d'identità compare **una volta sola** (`rg -c "'pomigliano'"` e
      `rg -c "'primo-viaggio'"` danno 1), e la sonda su `BADGE_IDS` dello step 4 del piano
      rende rosso `typecheck`
- [x] *(25/10, elencate)* **Ogni regola nuova è provata violandola**, come in F1.4: una regola di lint
      che nessuno ha visto scattare non è un freno. Le sonde sono quelle elencate in `PROGRESS.md`
      (pianificazione di T07h), ognuna con l'esito registrato. Le violazioni di prova non restano nel
      commit: `git diff --name-only` del commit elenca solo i file del piano
- [x] *(25/10, reso verificabile)* Nessun comportamento a runtime cambia: `test:unit` resta a **548 test
      in 31 suite**, e nessun file di test cambia. Se `verify` diventa rosso su un file esistente, si
      corregge il file: **la regola non si allenta**

## T07b ⛔ Parametri da tabella, niente valori compilati

Nasce da una decisione dell'umano del 14 ottobre 2026: *"tutti i dati devono poter essere configurabili
da tabelle dedicate, non voglio cose hard-codate"*. Il motivo pratico è concreto: oggi per ritarare un
numero prima del pitch servono una ricompilazione e una build EAS, e il piano gratuito ne concede 15 al
mese.

**Il confine, deciso con l'umano.** In tabella vanno i **valori** — numeri e testi. Restano nel codice
le **identità che il compilatore controlla**: i tre `PlantId`, gli stati come union di letterali, gli
id dei badge. Lì il tipo è ciò che rende un valore inesistente un **errore di compilazione** invece di
un dato sbagliato scoperto in demo, ed è una scelta deliberata di T01 su cui il reviewer ha costruito
in tre task.

**Perché prima di T08 e non dopo:** le tabelle dei parametri vanno disegnate insieme alle altre, in una
migrazione sola. Farlo dopo significa una seconda migrazione su uno schema già applicato.

**Il lavoro è minore di quanto sembri, e la ragione è nel codice già scritto:** ogni usecase riceve già
la propria config **come parametro** e la valida, con un errore tipizzato se è incoerente
(`invalid-config`, `invalid-tolerance`). Quindi il core non cambia: cambia solo **da dove arrivano i
valori**. L'architettura aveva già anticipato questo passaggio senza che fosse il suo scopo.

**Criteri riletti contro il modello il 25 ottobre 2026, prima di aprire il task** (planner). Sei
correzioni, un criterio spostato e quattro aggiunte, ciascuna marcata *(25/10)* con il motivo accanto.
Le cause sono tre. **Il vincolo di realtà:** lo schema non esiste (T08, ⛔ schema, e applicarlo a
staging richiede credenziali che l'agente non ha) e `@supabase/supabase-js` non è installato (T09, ⛔
dipendenza): ogni criterio che nominava la tabella, le RLS o l'adapter Supabase era insoddisfacibile qui,
cioè un verde falso. **Il grafo:** i tipi di config stanno in `core/usecases`, e `ports/` può importare
solo `domain/`, quindi un port non potrebbe restituirli senza spostarli. **I test di conformità:**
proteggono proprietà dei valori **compilati** (soglie ≥ 1, ogni coppia di plant risolvibile, nota
automatica entro il limite) che con la tabella non proteggono più la produzione, e vanno portate al
confine. Piano, forma del port e decisioni: `PROGRESS.md`, voce del 25 ottobre.

**Criteri di accettazione**
- [x] *(25/10, diviso)* Un port nuovo, **`ParameterRepository`**, con un solo metodo
      `load(): Promise<Result<AppParameters, RepositoryError>>` e **nessun metodo di scrittura**, come
      `ProfileRepository`: l'app i parametri li legge e basta. Adapter memory che serve le righe grezze
      ricevute nel costruttore, senza valori impliciti. La suite di contratto lo copre (criterio sotto).
      *Motivo:* "uno Supabase che li legge dalla tabella" richiede T08 e T09; è un criterio di **T09**.
- [x] *(25/10, completato e reso verificabile)* Passano dal port **tutti** i valori di `config/` di oggi:
      costo auto/giorno, prezzo carburante, consumo, **g CO₂/km** (la lista lo ometteva, ed è il numero
      della CO₂ in slide), distanze fra plant, tolleranza oraria, massimo posti offribili, limite delle
      note, testo della nota automatica, soglie **ed etichette** dei badge. `AppParameters` ha per campi
      i tipi che gli usecase già ricevono (`MatchConfig`, `CreateTripConfig`, `KpiConfig`, `NoteConfig`,
      `CascadeConfig`, `BadgeConfig`), spostati in `core/domain` e riesportati invariati da
      `core/usecases`. Verifica: `rg -n "from '(\.\./)+config'" app/src --glob '!**/*.test.ts' --glob
      '!**/contract/**'` non trova niente (test e suite di contratto **esclusi**, dichiarato), e `ui/`
      perde l'arco verso `config/` nel grafo del lint, provato da una sonda.
      *Motivo:* il criterio non aveva soggetto. Nessun chiamante di produzione degli usecase esiste — non
      c'è una schermata né una radice di composizione — quindi *"passano dalla tabella"* non poteva
      essere vero né falso. Oggi si può pretendere che i valori **non abbiano un'altra strada**: è il
      lint a chiuderla. Il chiamante vero è un criterio dei task di UI.
- [x] *(25/10, reso verificabile)* Restano nel codice le **identità**: `PlantId`, gli stati, gli id dei
      badge, le **chiavi dei parametri** (`PARAMETER_KEYS`) e il catalogo famiglia/metrica dei badge;
      restano costanti anche le unità e i minimi che definiscono un concetto (i 100 km del consumo, il
      posto minimo di un'auto, il bonus di plant derivato dalla finestra, T03). Verifica: un test pinna
      `PARAMETER_KEYS`; il parser rifiuta una riga con un `badgeId` o un plant fuori da `BADGE_IDS` /
      `PLANT_IDS`, o una chiave fuori da `PARAMETER_KEYS`: **la tabella non può creare un'identità**.
      *Motivo:* *"un test di conformità lo dichiara"* non diceva che cosa asserisce. Che un'identità
      resti nel codice si prova mostrando che la tabella non riesce ad aggiungerne una.
- [x] *(25/10, precisato)* **Un parametro mancante o malformato non passa in silenzio:** lo valida
      `parseParameters`, funzione pura in `core/domain`, che l'adapter **invoca** (su `memory` lo
      verifica il reviewer per lettura; a T09 l'equivalenza la prova la suite). Ogni caso ha un test in
      `core/domain`: chiave mancante; valore non numerico, **stringa `'30'` compresa**; fuori intervallo;
      chiave, badge o plant sconosciuti; coppia di distanze mancante, duplicata (anche invertita) o con
      plant uguali; etichetta vuota o con parola vietata; nota automatica che il controllo di lunghezza
      di `makeMatchRequest` rifiuterebbe con il limite **caricato**. Gli intervalli sono gli **stessi
      predicati** che gli usecase applicano già alla propria config, spostati una volta sola in
      `core/domain` e chiamati da entrambi: la sonda che muta il predicato della tolleranza rende rossi
      sia i test di `findMatches` sia quelli del parser. **Nessun valore di default**: un parametro
      mancante non è mai sostituito dal seed. L'errore è `RepositoryError` **`invalid-record`** con `id`
      = chiave del parametro e `detail` = motivo: nessun `kind` nuovo.
      *Motivo:* il testo non diceva quali errori, dove vive il controllo, né che le proprietà oggi
      garantite dai test di conformità sui valori compilati devono passare al confine. E un caso è
      concreto: **nessun usecase valida `NoteConfig.maxLength`**, e con `NaN` il confronto
      `length > maxLength` è sempre falso, cioè le note non avrebbero più limite.
- [x] `test:unit` continua a girare **senza rete**: gli usecase ricevono config come parametro, mai
      dal port. *(25/10: invariato.)*
- [x] *(25/10, diviso)* **Cambiando una riga il risultato di un usecase cambia.** Oggi, su `memory`:
      (a) nella suite di contratto, dopo `scriviParametriGrezzi` con una riga diversa, `load` restituisce
      il valore nuovo; (b) un test in `src/__tests__/` compone adapter memory → `load` → usecase: portata
      la tolleranza da 30 a 10, un'offerta a 20 minuti esce da `findMatches`; cambiata un'etichetta,
      `awardBadges` assegna il badge con il testo nuovo. Dichiarato: **su `memory` "senza ricompilare"
      non è dimostrabile**, perché la riga è un oggetto in RAM; lo è a T09 su staging (criterio lì).
      *Motivo:* la metà "senza ricompilare" richiede una tabella vera.
- [x] *(25/10, spostato su T08)* RLS: lettura per gli autenticati, **scrittura per nessuno** dall'app,
      nessun ruolo admin e nessuna schermata di configurazione: è **T08**. Qui resta la metà
      verificabile: il port non ha metodi di scrittura (reviewer per lettura), e in RAM, con identità
      nulla, le righe dei parametri **non sono visibili**, come sotto RLS: `load` → `invalid-record`.
      Test in `memory-conditions.test.ts`, perché l'ambiente di contratto non sa tornare a identità nulla
      (voce *"Un hook esci"* di `IDEAS.md`).
- [x] *(25/10, precisato)* **Anche le etichette dei badge passano dal port** (decisione dell'umano, 14
      ottobre 2026), e un testo con una parola vietata è **rifiutato con errore tipizzato al confine**
      (premi, buoni, euro, €, denaro, soldi, sconti, voucher, regali, bonus, rimborsi, ricompense,
      gratis, coupon, **ticket**, **welfare**). Oggi il criterio *"nessun badge implica premi, denaro o
      buoni"* è imposto da un test su **costanti compilate**: se i testi diventano modificabili dalla
      dashboard senza che il controllo li segua, l'unica garanzia contro una promessa che il prodotto
      non può mantenere svanisce **nel momento di massimo rischio**, la sera prima del pitch e dalla
      sola persona che ha accesso a quella dashboard. È un caso del criterio "un parametro malformato
      non passa in silenzio", non un meccanismo nuovo. Forma: `BadgeConfig` guadagna `labels`,
      `BADGE_CATALOG` perde `label`, e `awardBadges` rifiuta con il suo `invalid-config` un'etichetta
      vietata, con lo stesso predicato: nessun percorso produce un `Badge` che prometta un premio.
      `awardBadges` conserva la firma `(stats, config)`: cambia la forma di `BadgeConfig`, dichiarato.
      **Un test di tabella passa ciascuna delle sedici parole di questo criterio dentro un'etichetta e
      pretende il rifiuto.**
      *Motivo:* oggi la lista del test contiene `'ricompensa'`, che **non** intercetta *"ricompense"*:
      un'etichetta *"Ricompense per te"* passa. Il criterio elenca i plurali e il codice no.
- [x] *(25/10, reso verificabile)* La lista delle parole vietate vive in **un punto solo**,
      `core/domain/badge-label.ts`, importata da `parseParameters`, da `awardBadges` e dai test: due
      liste divergerebbero, e divergerebbero in silenzio. Verifica: `rg -n "'voucher'" app/src` (test
      **inclusi**) trova una riga sola, in quel file
- [x] *(25/10, aggiunto)* **`config/` diventa il seed, e una fonte sola.** Contiene solo
      `SEED_PARAMETERS`, in forma **grezza** (le stesse righe che `parseParameters` riceve), e nessun
      valore tipizzato per gli usecase. Serve all'ambiente memory, al test di composizione e, a T08,
      alla migrazione di seed, che ne è **derivata** e non riscritta. I sei test `*-config.test.ts`
      diventano un test solo, che passa il seed da `parseParameters` e pinna i valori iniziali; il
      mapping fra ogni vecchio `it` e il nuovo è in `PROGRESS.md`, e cadono soltanto le asserzioni
      *"l'annotazione è l'asserzione"*, che con un parser tipizzato non possono più fallire. I titoli
      dicono **seed**, non *produzione*: in produzione vale la tabella.
      *Motivo:* senza, a T08 il seed SQL e `config/` sarebbero due copie degli stessi numeri.
- [x] *(25/10, aggiunto)* **I test chiusi che cambiano sono elencati, e nessun altro:**
      `award-badges.test.ts` (le config di fixture guadagnano `labels`; la lista locale delle parole
      lascia il posto all'import; il test sul catalogo si sposta sulle etichette in config),
      `refresh-personal-bests.test.ts` (`configCon` guadagna `labels`), i sei `*-config.test.ts`
      (consolidati, criterio sopra), `memory.contract.test.ts` e `memory-conditions.test.ts` (il limite
      delle note viene dal seed, l'ambiente guadagna i due membri nuovi). Nessuna `expect` esistente
      della suite di contratto cambia: `git diff -U0 4a4bc11 --
      app/src/adapters/contract/repository-contract.ts | rg "^-.*expect"` non restituisce niente
- [x] *(25/10, aggiunto)* **L'inversione della decisione 3 di T03 è registrata come tale**: in
      `PROGRESS.md` e in `ARCHITECTURE.md` (§ Modularità: `config/` è il seed, il port nuovo,
      l'elemento `harness` allargato), con il motivo e cosa si perde — un valore sbagliato non è più un
      errore di compilazione ma un `invalid-record` al primo `load`
- [x] *(25/10, aggiunto)* **Criteri corrispondenti scritti su T08 e T09**, nella forma già usata da
      T07c, T07e, T07f e T07g: tabelle, RLS, seed derivato e CHECK compatibili con la suite su T08;
      adapter, ripristino dello staging e prova "senza ricompilare" su T09

⛔ Checkpoint: port nuovo, e rovescia la decisione di T03 che teneva i valori come letterali
verificabili a compile time. Il motivo per cui si rovescia è buono — un parametro che richiede una
build non è configurabile — ma va registrato come inversione e non come dettaglio. **Sciolto il 25
ottobre 2026 per delega dell'umano** (*"scegli l'opzione raccomandata"*), insieme ai ⛔ emersi in
pianificazione: i tipi di config spostati in `core/domain`, `BadgeConfig` con le etichette, il grafo
del lint ristretto per `ui/` e allargato per `src/__tests__/`. Raccomandazioni e alternative:
`PROGRESS.md`.

## T08 ⛔ Schema Supabase, migrazioni e RLS

Tabelle da `ARCHITECTURE.md`, come SQL versionato nel repo.
*(25/10: `invite_codes` esce e va a **T10**, che disegna l'accesso: una tabella oggi pre-impegnerebbe
policy di un flusso che non esiste. `plants` diventa un tipo enumerato, come le altre identità.)*

**Criteri riletti contro il modello il 25 ottobre 2026, prima di aprire il task** (planner). Sette
blocchi scritti in quattro giorni diversi; ogni correzione è marcata *(25/10)* con il motivo accanto.
Le cause: **duplicati** fra blocchi (la concorrenza due volte, le policy di `trips` e di `match_requests`
due volte, `maxLength` due volte), fusi; **forme SQL che PostgREST non esprime** (`seats_available +
:delta`, `GREATEST` in un upsert), che diventano funzioni del DB e quindi **contratto di T09**;
un'**affermazione falsa** (una policy non vale per migrazioni e seed, che girano come `postgres` e
scavalcano le RLS); un **tipo che arrotonda** (`timestamptz(3)`); un **metodo di verifica non
disponibile** (`supabase gen types --db-url` gira in Docker, da confermare allo step 0: ⛔ all'umano);
e i *"deciso…"*, sciolti per delega. Forma dello schema, piano, decisioni e alternative: `PROGRESS.md`,
voce *"T08 · pianificazione"*.

**Criteri di accettazione**
- [x] Le migrazioni sono file SQL tracciati in git, applicabili su un progetto vuoto.
      *(25/10, reso verificabile senza un secondo progetto, che non c'è: il piano gratuito ne ha due e
      l'altro è la demo.)* Vivono in `app/supabase/migrations/`; accanto, in `app/supabase/rollback/`,
      lo script che le annulla. Un test di integrazione apre una transazione su staging, esegue il
      revert e poi **tutte** le migrazioni in ordine, asserisce gli oggetti attesi e fa `ROLLBACK`: il
      DDL di Postgres è transazionale, quindi staging non cambia, e la prova vale prima e dopo la prima
      applicazione. Un secondo test pretende che nessuno di quei file contenga `begin`, `commit` o
      `rollback` come istruzione: renderebbero distruttiva la prima prova
- [x] Applicate su **staging** senza errori. *(25/10, reso verificabile:)* `npm run db:status` — wrapper
      della CLI che legge `SUPABASE_DB_URL` da `.env` senza stamparla — elenca ogni migrazione locale
      come applicata. Prima, un controllo in sola lettura che `public` non contenga tabelle. È il passo
      che **modifica staging**: lo esegue l'orchestratore, da solo
- [x] **RLS attiva su ogni tabella**, nessuna esclusa. *(25/10, perimetro dichiarato:)* un test legge dal
      catalogo **ogni** tabella degli schemi `public` e `private` e pretende la RLS attiva. Nessun
      elenco scritto nel test: una tabella nuova senza RLS lo fa cadere
- [x] Un test di integrazione dimostra che un utente **non** può leggere i dati di un altro oltre a
      quanto previsto. *(25/10: "quanto previsto" ora è scritto.)* `trips`, `trip_legs`, `profiles` e le
      tre tabelle dei parametri: `SELECT` per ogni `authenticated` (le offerte sono di tutti, e
      `listOpenOffers` fa la join sui profili: è il vincolo che il doc del port chiede a T08);
      `match_requests`: richiedente e owner della trasferta; `personal_bests`: solo i propri; `anon`:
      **zero righe** ovunque, non un errore (T09 lo mappa così, come `memory`). Per ogni tabella
      ristretta, una riga che il lettore non deve vedere **e** una che deve vedere
- [x] Un test dimostra che un utente non può modificare le trasferte altrui. *(25/10: fuso nel criterio
      delle policy di T07g più sotto, che lo dice meglio — upsert compreso.)*
- [x] Un test dimostra che un utente non può accettare richieste su offerte non sue. *(25/10: idem.)*
- [x] Il decremento di `seats_available` è atomico lato DB: un test di concorrenza non va sotto zero.
      *(25/10: è lo stesso criterio del test di concorrenza reale del 13/10, fuso lì.)*
- [x] I tipi TypeScript sono **generati** dallo schema, non scritti a mano. *(25/10, ⛔ aperto, non
      delegabile.)* Il comando previsto, `supabase gen types typescript --db-url`, esegue
      `postgres-meta` in un container Docker, che qui non c'è e non si installa senza admin (da
      confermare allo step 0). Le alternative chiedono una **credenziale nuova** (token personale per
      `--project-id`, valido su tutti i progetti dell'account, prod compresa) o un **passo umano**
      (download dalla dashboard): decide l'umano. Qualunque metodo: il file sta in
      `app/src/adapters/supabase/database.types.ts`, dentro l'elemento `adapters` del grafo, quindi
      `core/` e `ui/` non lo possono importare (reti già attive; una sonda lo mostra); e un'asserzione di
      tipo, valutata da `typecheck`, pretende che ogni enum generato coincida **nei due versi** con la
      union di dominio corrispondente: un membro aggiunto da una parte sola fa cadere `typecheck`

**Criteri aggiunti il 13 ottobre 2026, dal modello a tratte di T04b**
- [x] Esiste `trip_legs` con chiave primaria **composta** `(trip_id, direction)`, e `match_requests`
      la referenzia con una **foreign key composta** `(trip_id, direction)`: una candidatura su una
      tratta inesistente — per esempio sul rientro di una trasferta che non ha rientro — diventa
      impossibile **per costruzione**, non per un controllo lato client
      *(25/10: la foreign key è `RESTRICT`, deciso due criteri più sotto.)*
- [x] I `CHECK` replicano gli invarianti di `makeTripLeg`: `seats_available BETWEEN 0 AND seats_total`
- [x] Il decremento atomico è `UPDATE … SET seats_available = seats_available + :delta WHERE … AND
      seats_available + :delta BETWEEN 0 AND seats_total`, e **zero righe toccate è l'errore**: è la
      forma per cui `adjustLegSeats` è stata definita **relativa** e non assoluta.
      *(25/10, precisato dove vive, ed è contratto di T09:)* PostgREST non esprime un aggiornamento
      relativo a una colonna, quindi l'`UPDATE` sta nella funzione `adjust_leg_seats(trip_id,
      direction, delta)`, `security definer`, che T09 chiama al posto di una `PATCH`. Esiti: la tratta
      aggiornata; **zero righe** se il risultato esce da [0, `seats_total`] (→ `invalid-record`); errore
      `P0002` se la tratta non esiste (→ `not-found`); errore `42501` se chi chiama non è l'owner della
      trasferta **né** il richiedente di una candidatura `accepted` su quella tratta (→
      `storage-unavailable`, come un rifiuto RLS). Ordine dei controlli: esistenza, identità, limiti.
      `trip_legs` non ha policy di scrittura: la scrivono solo questa funzione e il trigger di
      materializzazione. Lo **specchio in RAM** (`memory` autorizza allo stesso modo) è in questo task,
      perché una RAM più permissiva del DB è la direzione pericolosa (T07g, N1)
- [x] **Deciso cosa accade quando una tratta viene eliminata e la referenzia una candidatura**, in
      qualunque stato. L'umano ha scelto l'**annullamento a cascata** con `resolvedBy: 'system'` e
      nota automatica, che è logica di prodotto e quindi di un usecase, non dell'adapter: qui va
      deciso se la foreign key è `RESTRICT` (e l'usecase annulla prima di salvare) o altro. **Non**
      `ON DELETE CASCADE`, scartato dall'umano perché è perdita silenziosa.
      *(25/10, deciso per delega:)* foreign key **`RESTRICT`**. Un `TripRepository.save` che toglierebbe
      una tratta referenziata da **una qualsiasi** candidatura è rifiutato con `invalid-record` e lascia
      lo storage intatto, **su entrambi gli adapter**: in RAM un controllo che guarda tutte le righe,
      come un indice (oggi `memory` elimina la tratta in silenzio); su Postgres la foreign key, dentro
      il trigger che materializza le tratte. Un test della suite di contratto lo prova con una
      candidatura **chiusa**, che è il caso che il guard sugli stati aperti non copriva. L'annullamento
      a cascata resta un criterio del task di **modifica trasferta**, che non esiste
- [x] Le RLS di **scrittura** su `trips` impongono `owner_id = auth.uid()`: `save` è un upsert con id
      fornito dal chiamante, quindi senza questo vincolo chi passa il `tripId` di un collega ne
      sovrascrive la trasferta. I criteri esistenti parlano di "non modificare le trasferte altrui",
      che una policy scritta solo su UPDATE lascia aggirabile da un upsert.
      *(25/10: coperto dal criterio delle policy di T07g, che lo estende al ramo `DO UPDATE`.)*
- [x] Le RLS di scrittura su `match_requests` vincolano i **due attori**: il richiedente per la
      creazione e l'annullamento, l'owner della trasferta per accettazione e rifiuto. In RAM
      l'`actorId` lo passa il chiamante, quindi i controlli degli usecase di T05 proteggono da una UI
      sbagliata e **non** da un client ostile. *(25/10: coperto dal criterio delle policy di T07g.)*
- [x] Foreign key `match_requests.requester_trip_id → trips.id`, **più** una policy che impone che
      quella trasferta sia **del richiedente**. È la metà DB della decisione dell'umano del 14 ottobre
      (l'altra metà è T07c): rende impossibile lo stato in cui il campo da cui dipendono tutti e
      quattro i KPI punta alla trasferta di un altro, anche per il seed e per le migrazioni.
      *(25/10, rafforzato: "anche per il seed e per le migrazioni" non era vero.)* Migrazioni, seed e
      dashboard girano come `postgres`, che **scavalca le RLS**: una policy non li ferma. Diventa una
      foreign key **composta** `(requester_trip_id, requester_id) → trips(id, owner_id)`, con `UNIQUE
      (id, owner_id)` su `trips`, che vale per chiunque scriva; **più** la policy, che scatta prima della
      foreign key e dà all'app lo stesso esito di `memory` (`storage-unavailable`). Un test prova
      entrambe: come `authenticated` il rifiuto RLS (`42501`), come `postgres` quello della foreign key
      (`23503`)
- [x] Un test di concorrenza **reale** su Postgres ripete l'interleaving di T05 su due connessioni: in
      RAM l'intercalatura è deterministica e scelta dal test, qui no.
      *(25/10, precisato:)* due connessioni, ciascuna con la sua transazione: A decrementa l'ultimo posto
      e tiene il lock, B tenta lo stesso e attende, A conferma, B ottiene **zero righe** — non un errore
      di `CHECK`, che vorrebbe dire una condizione `BETWEEN` caduta e salvata solo dal vincolo. Righe di
      test **confermate**, quindi ripulite (criterio sulla pulizia, in fondo)
- [x] **Abbassare `NOTE_CONFIG.maxLength` è una migrazione, non una modifica di configurazione**
      (decisione dell'umano, 14 ottobre 2026). Chi lo abbassa accorcia contestualmente le note che
      sforano, così nessuna riga resta inchiudibile — oggi le `save` degli usecase validano la riga
      intera, quindi una nota vecchia e troppo lunga bloccherebbe accettazione, rifiuto, annullamento e
      reintegro. La riga accorciata va **marcata come tale**: accorciare la nota di una persona
      significa riscrivere ciò che ha scritto, e una modifica silenziosa del dato di un utente è
      esattamente la classe di difetto che questo progetto rifiuta. Oggi è un no-op — nessun dato
      esiste ancora — ma la procedura va scritta prima che ne esista.
      *(25/10, deciso per delega e fuso con il criterio di T07b sul trigger:)* la procedura è una
      funzione `private.lower_note_max_length(n)`, eseguibile solo da `postgres` (cioè da una
      migrazione), che in una transazione: **rifiuta** se `cascade.autoRejectNote` sfora `n` (altrimenti
      `parseParameters` rifiuterebbe tutti i parametri al primo `load`); accorcia ogni nota oltre `n` a
      `n − 1` code point più `…`, così nessuna diventa una nota vuota — che le `save` rifiuterebbero —
      e l'accorciamento si vede **nel testo**; mette `notes_shortened = true` sulla riga (colonna del solo
      DB, che il dominio non legge); e solo dopo scrive il parametro. Abbassare il limite è quindi una
      migrazione che chiama la funzione. Un test, in una transazione annullata, la esegue su note
      seminate e verifica testo, marcatura e parametro, e il rifiuto sulla nota automatica

**Criteri aggiunti il 23 ottobre 2026, da tre voci di `IDEAS.md` portate dentro dall'umano**
- [x] I `CHECK` coprono anche `has_car = false ⇒ seats_total = 0`, non solo
      `seats_available BETWEEN 0 AND seats_total`. Oggi quell'invariante vive **solo in `makeTrip`**,
      cioè nel client: nel DB nulla impedisce la riga che lo viola, e una migrazione, uno script di
      seed o una query eseguita a mano la inserirebbero senza resistenza.
      *(25/10, perimetro:)* tutti gli invarianti di `makeTrip` — posti non negativi, `has_car = false ⇒
      seats_total = 0`, `seats_available <= seats_total` — e **solo** quelli: le regole di **creazione**
      di T04 (plant uguali, data nel passato, rientro prima della partenza) restano fuori, perché T04b ha
      dichiarato raggiungibile la trasferta degenere e un `CHECK` la renderebbe irrappresentabile
- [x] Un test di integrazione riproduce la **corsa fra la cascata e una candidatura concorrente** e
      pinna l'esito atteso: riga `pending` su una tratta a zero posti, chiudibile solo con un rifiuto
      motivato. Fra la lettura di `listByLeg` nella cascata e una `requestSeat` concorrente non c'è
      alcun lock, e su Postgres la corsa è **reale**, non intercalata in un event loop. Non è una
      decisione di prodotto di nessuno: segue dal fatto che `requestSeat` non rifiuta per posti a zero,
      e oggi vive solo in un commento di `request-seat.ts` e in `PROGRESS.md`.
      *(25/10, metodo:)* le stesse due connessioni, con l'intercalatura guidata dal test: l'owner legge le
      `pending` della tratta, un richiedente nuovo inserisce la sua e conferma, l'owner rifiuta quelle
      lette e conferma. Esito pinnato: la riga nuova resta `pending` su una tratta a zero; l'owner che
      prova ad accettarla ottiene **zero righe** da `adjust_leg_seats`; la rifiuta con nota, e riesce
- [x] **Deciso cosa accade alle candidature già chiuse quando la tratta viene eliminata.** La foreign
      key composta rifiuta la cancellazione finché esiste **una qualsiasi** riga che la referenzia,
      comprese le `rejected` e le `cancelled`: il guard di T05 sugli stati **aperti** chiude la
      divergenza fra i due adapter solo in parte, perché con sole righe chiuse `memory` elimina la
      tratta e Postgres no. Da scegliere fra un guard su qualunque candidatura e la cancellazione
      esplicita delle righe chiuse prima di eliminare la tratta — la seconda è logica di business,
      quindi del task di **modifica trasferta**, che non esiste ancora nel backlog.
      *(25/10, deciso per delega:)* **guard su qualunque candidatura**, cioè il criterio della tratta
      eliminata del blocco del 13/10. Scartata la cancellazione delle righe chiuse: è logica di un task
      che non esiste, e cancellerebbe la storia di un rifiuto motivato

**Criterio aggiunto il 23 ottobre 2026, dalla decisione sul trigger di T07e**
- [x] La tabella dei **massimi** delle metriche ha RLS che permette a ciascuno di leggere **e
      aggiornare i propri**, e a nessuno quelli di un altro. La metà in scrittura non è un dettaglio:
      l'umano ha deciso che i massimi li alza un usecase sul percorso di lettura della dashboard, quindi
      una policy scritta solo in lettura renderebbe il percorso inutilizzabile. Resta da decidere qui se
      il vincolo di monotonia è anche **lato DB** (un `UPDATE … WHERE nuovo > corrente`, dove "zero
      righe toccate" non è un errore ma il caso normale di un valore più basso), come per il decremento
      atomico dei posti: in RAM la monotonia è una funzione pura del dominio, e su Postgres sarebbe la
      seconda rete.
      *(25/10, deciso per delega: sì, lato DB, ma non con un `WHERE nuovo > corrente`,* che vale per
      riga e farebbe fallire il caso misto di T07e.) Due pezzi. L'alzata è la funzione
      `raise_personal_bests(…)`, `security invoker` — quindi sotto le policy della propria riga — con
      `INSERT … ON CONFLICT DO UPDATE … GREATEST` per colonna: PostgREST non esprime `GREATEST` in un
      upsert, quindi è **contratto di T09**. La seconda rete è un trigger `BEFORE UPDATE` che **rifiuta**
      qualunque scrittura che abbassi una colonna, contro una `PATCH` diretta del client. Test: l'alzata
      mista alza e non abbassa; un `UPDATE` diretto che abbassa è un errore; un altro profilo non legge
      (zero righe) e non scrive (errore RLS)

**Criterio aggiunto il 25 ottobre 2026, da T07f**
- [x] Ogni colonna istante è **`timestamptz(3)`**, non `timestamptz`. Il dominio tronca al
      millisecondo (`normalizeUtcInstant`), e una colonna a microsecondi conserverebbe una precisione
      che il dominio butta: due istanti uguali per `compareUtcInstants` potrebbero essere diversi per un
      `WHERE` o un `ORDER BY` in SQL, e lo stesso confronto darebbe due risposte a seconda di dove gira.
      Un test di integrazione scrive un istante con frazione oltre il millisecondo e lo rilegge troncato.
      *(25/10, corretto: `timestamptz(3)` **arrotonda**, non tronca.)* `…T23:59:59.9996Z` diventerebbe il
      giorno dopo, e il confronto per giorno di T07d darebbe in SQL una risposta diversa da JS: proprio
      il difetto che il criterio voleva chiudere, in una forma peggiore. Quindi `timestamptz` con
      `CHECK (col = date_trunc('milliseconds', col))`: una frazione oltre il millisecondo è **rifiutata**,
      non arrotondata in silenzio. Il test scrive `…T23:59:59.9996Z` e pretende il rifiuto, e rilegge
      intatto un istante con millisecondi che finiscono con zero (`.120`). Il dominio scrive sempre la
      forma canonica, quindi nessun percorso legittimo cade. La sonda: tornare a `timestamptz(3)` senza
      il `CHECK` rende rosso il test (la riga passa, arrotondata)

**Criteri aggiunti il 25 ottobre 2026, da T07g**
- [x] `match_requests` ha il vincolo **`UNIQUE (trip_id, direction, requester_id)`**: in RAM un secondo
      id sulla stessa coppia (tratta, richiedente) è rifiutato con `invalid-record`, e senza il vincolo
      nel DB la suite di contratto non passerebbe a T09. È la precondizione su cui poggiano l'ordine
      totale di `findMatches` e lo stato che marca ogni offerta
- [x] Le policy implementano **la tabella del criterio sull'identità di T07g**, che in RAM è già imposta
      e diventa qui vincolante: scrittura su `trips` solo dall'owner (upsert compreso); su
      `match_requests` creazione, `pending` e `cancelled` dal richiedente, `accepted` e `rejected`
      dall'owner della trasferta, `requester_trip_id` sempre del richiedente; `raise` sui massimi solo
      propri; lettura delle candidature al richiedente e all'owner, dei massimi solo propri. **Una
      scrittura negata è un errore, una lettura negata è una riga assente**: è il modo in cui la suite
      in RAM le distingue.
      *(25/10, precisato come, perché una policy da sola non basta:)* la `WITH CHECK` vede solo la riga
      nuova e la `USING` non vede lo stato nuovo, quindi le condizioni sulla riga **vecchia** che `memory`
      già impone (il richiedente di prima per `pending`/`cancelled`, l'owner di prima per
      `accepted`/`rejected`) le impone un trigger `BEFORE UPDATE`, attivo solo per i ruoli dell'app
      (`authenticated`, `anon`) e non dentro le funzioni `security definer`. Senza, un owner potrebbe
      riscrivere come `pending` e a proprio nome la candidatura di un collega sulla sua trasferta: in RAM
      è rifiutato, e la suite sarebbe rossa a T09. Ogni regola ha un test positivo e uno negativo.
      Anche le letture **non** imposte da T07g sono ora decise (criterio di lettura, in testa): tutti gli
      `authenticated` leggono trasferte, tratte e profili. Lo specchio in RAM si aggiorna in questo task:
      con identità nulla `memory` filtra anche quelle, come Postgres con `anon` (oggi non lo fa)
- [x] **Deciso chi esegue il reintegro e l'incremento dei posti di `cancelRequest`.** Oggi gira con
      l'identità del richiedente, legge con `listByLeg` la tratta dell'owner e riscrive righe di
      **altri** richiedenti (`restoreSystemRejected`), più `adjustLegSeats(+1)` sulla tratta dell'owner.
      Con le policy qui sopra la `save` è vietata, e con la lettura ristretta `listByLeg` vede solo la
      riga del richiedente: il reintegro tornerebbe **`ok([])` in silenzio**, l'annullamento riesce e gli
      altri restano rifiutati per sempre. Nessun test di usecase lo vede, perché i fake non hanno
      identità. Vie naturali: una funzione lato DB (`security definer`, con i suoi controlli) o una
      policy dedicata alle transizioni `resolvedBy: 'system'`. Un test di integrazione riproduce
      l'annullamento con un rifiutato dal sistema in coda e pinna il reintegro.
      *(25/10, deciso per delega.)* L'**incremento** lo esegue `adjust_leg_seats`, che autorizza il
      richiedente di una candidatura `accepted` su quella tratta: `cancelRequest` fa il +1 **prima** di
      scrivere `cancelled`, quindi in quel momento la riga è ancora `accepted` (e così la compensazione
      −1 dopo una `save` fallita). Il **reintegro** lo esegue `restore_system_rejected(trip_id,
      direction)`, `security definer`: riporta a `pending`, con la risoluzione azzerata, le righe
      `rejected` con `resolved_by = 'system'` della tratta **solo se** la tratta ha posti liberi, e
      restituisce gli id. È sicura per qualunque `authenticated`, perché fa soltanto ciò che la regola di
      T05 dice comunque. Scartata la **policy dedicata**: dovrebbe far leggere al richiedente le righe —
      e le note — degli altri, contro la decisione dell'umano sulla visibilità della nota, e una `WITH
      CHECK` non sa limitare la scrittura al solo cambio di stato. Il test, come richiedente: `UPDATE`
      diretto delle righe degli altri → **zero righe** (è il silenzio che il criterio descrive); la
      funzione → tornano `pending`; su una tratta a zero posti la funzione non tocca niente.
      **⛔ Dipendenza mancante, segnalata e non risolta qui:** l'usecase oggi reintegra con `listByLeg`
      + `save`, e sotto RLS continuerebbe a tornare `ok([])`. Perché chiami la funzione serve un metodo
      del port `MatchRequestRepository` (nota del 25/10 sulla voce *"La cascata e il reintegro scrivono
      N righe una alla volta"* di `IDEAS.md`): cambio d'interfaccia, decisione dell'umano, da schedulare
      **prima di T09**
- [x] I `CHECK` sono compatibili con le righe che la suite costruisce con `seminaCandidaturaGrezza`:
      o la riga seminata è rappresentabile sotto i CHECK, o il test che la usa è dichiarato
      *solo memory* con il motivo, come i test sulle liste invalide di trasferte e tratte.
      *(25/10, deciso:)* i `CHECK` replicano gli invarianti di `validateMatchRequestStructure` — nota di
      risoluzione e `resolved_by` insieme o nessuno; `pending` senza risoluzione — quindi la riga che la
      suite semina (`cancelled` con nota e senza `resolvedBy`) **non è rappresentabile**: verifica forte
      prima di tutto, uno stato impossibile vale più di un'omissione provata. I quattro test che la usano
      (*"una riga strutturalmente invalida nello storage da invalid-record in lettura"* e i tre di
      *"letture di righe invalide"*) si spostano in `memory-match-request-repository.test.ts` con il
      motivo nel commento, e `seminaCandidaturaGrezza` esce da `AmbienteDiContratto`, dove non ha altri
      usi. Sono gli **unici** test chiusi che cambiano per questo criterio, e le loro asserzioni si
      ritrovano identiche nel file nuovo. Nessun `CHECK` sulle note vuote né sulla lunghezza: la prima
      la decide `trim()` di JavaScript, che un `btrim` non riproduce; la seconda è un parametro

**Criteri aggiunti il 25 ottobre 2026, da T07b**
- [x] **Le tabelle dei parametri** (scalari, distanze fra plant, badge), nella forma decisa qui, con RLS
      attiva: **`SELECT` per `authenticated`**, nessuna policy di `INSERT`/`UPDATE`/`DELETE` per i ruoli
      dell'app, niente per `anon`. Il gate è la dashboard, che ha solo l'umano: nessun ruolo admin nel
      modello. Un test di integrazione dimostra che un autenticato legge, che `anon` non legge, e che una
      `UPDATE` dall'app **non cambia la riga** — sotto RLS una `UPDATE` senza policy tocca zero righe
      senza errore, quindi il test rilegge il valore invece di aspettarsi un errore.
      *(25/10, forma decisa per delega:)* `parameters(key parameter_key primary key, value jsonb not
      null)` con `value` numero o testo; `plant_distances(from_plant_id, to_plant_id, km)`, una riga per
      coppia **non ordinata**; `badge_parameters(badge_id primary key, threshold, label)`. Le chiavi, i
      plant e i badge sono tipi enumerati: un refuso nella dashboard è rifiutato **mentre lo si scrive**,
      non al primo `load` in demo. Scartata la riga unica a colonne tipizzate: ripete l'elenco delle
      chiavi nel DDL, rende irrappresentabile il parametro mancante (che `parseParameters` già tratta) e
      fa di ogni parametro nuovo una migrazione di colonna. Nessuna `REVOKE` di `SELECT` ad `anon`: deve
      vedere **zero righe**, non un errore, come chiede T09
- [x] **Il seed dei parametri è derivato da `SEED_PARAMETERS`**, non riscritto a mano: uno script genera
      la migrazione di seed, e un test unitario senza rete confronta il file SQL committato con l'output
      dello script. Così `config/` e la migrazione non divergono. Dopo l'applicazione, la tabella è la
      fonte a runtime e può divergere dal seed per decisione dell'umano.
      *(25/10, precisato:)* il generatore è una funzione pura in `app/src/adapters/supabase/` (la forma
      delle righe è un problema di Postgres, non del core), eseguita da uno script `node` **senza
      dipendenze nuove** (Node 24 esegue TypeScript con la rimozione dei tipi; se non regge, il ripiego è
      allo step 5 del piano). Un secondo test, di integrazione e in una transazione annullata, applica la
      migrazione e pretende che le righe lette, passate a `parseParameters`, diano **lo stesso**
      `AppParameters` del seed: prova che jsonb conserva numeri, testo e accenti. **Dopo l'applicazione il
      seed è congelato:** una migrazione applicata non si riscrive, quindi una modifica di
      `SEED_PARAMETERS` fa cadere il test apposta, e cosa farne è una decisione (voce in `IDEAS.md`)
- [x] I `CHECK` delle tabelle dei parametri sono compatibili con i casi della suite di contratto di T07b
      (una coppia di distanze mancante, un'etichetta con una parola vietata), e **nessun CHECK replica
      la lista delle parole vietate**: sarebbe la seconda lista, in un secondo linguaggio. Se un caso
      diventa irrappresentabile, il test è dichiarato *solo memory* con il motivo.
      *(25/10: P3 e P4 restano rappresentabili — una riga che manca, un testo — e nessun `CHECK` guarda
      le etichette. I `CHECK` ci sono su tipo del valore, soglie intere ≥ 1, km finiti ≥ 0, coppie con
      plant diversi: casi che la suite non costruisce e che `parse-parameters.test.ts` già copre.)*
- [x] **Abbassare `note.maxLength` resta una migrazione** (decisione del 14 ottobre), ma con T07b è anche
      una riga modificabile dalla dashboard: un trigger o un vincolo impedisce di portarlo sotto la
      lunghezza della nota più lunga esistente, così l'unica via resta la procedura che accorcia e marca
      le note. Un test di integrazione prova il rifiuto.
      *(25/10: un trigger su `parameters`, che misura in caratteri — code point, come il dominio — anche
      la dashboard, che gira come `postgres`. La procedura è la funzione del criterio del 13/10.)*

**Criteri aggiunti il 25 ottobre 2026, dalla pianificazione di T08** — vincoli che i port chiedevano già
a T08 nei loro doc, e i controlli che rendono il resto verificabile
- [x] Foreign key `trips.owner_id → profiles.id` e `profiles.id → auth.users(id)`. La prima la chiede il
      doc di `listOpenOffers`: senza, *"offerta con owner inesistente"* è uno stato possibile e
      l'omissione diventa una perdita silenziosa. La seconda lega l'identità delle RLS (`auth.uid()`) al
      profilo
- [x] Le tratte le **materializza il DB**, con un trigger su `trips`, nella semantica che il doc di
      `TripRepository.save` fissa: una tratta con l'auto senza rientro, due con rientro, nessuna senza
      auto; contatore **preservato** sulle esistenti e `seats_total` aggiornato; un contatore preservato
      fuori dal nuovo totale fa fallire l'intero salvataggio. Così `save` resta un upsert su `trips`, che
      PostgREST esprime, e la scrittura delle tratte è atomica con quella della trasferta. Un test per
      caso, compreso il rientro tolto con una candidatura sulla tratta (rifiutato, criterio del 13/10)
- [x] Ogni funzione `security definer` ha `search_path` vuoto e nomi qualificati; `EXECUTE` è revocato a
      `public` e ad `anon` su **ogni** funzione, e concesso ad `authenticated` solo sulle tre che l'app
      chiama (`adjust_leg_seats`, `restore_system_rejected`, `raise_personal_bests`). Le altre stanno in
      uno schema `private`, che PostgREST non espone. Un test, come `anon`, pretende il rifiuto su
      ciascuna delle tre; uno, come `authenticated`, su `private.lower_note_max_length`
- [x] `test:int` **fallisce** senza `SUPABASE_DB_URL`, con un messaggio che dice dove metterla: la
      variabile entra nell'elenco di `credenziali.test.ts` (unica modifica a quel test, dichiarata: lo
      stringe, non lo allenta) e in `.env.example` con un valore finto. Solo i test di concorrenza
      scrivono righe **confermate**: profili di test riconoscibili (email `@t08.test.invalid`, nomi
      dichiaratamente fittizi), cancellati alla fine, più una pulizia all'avvio dei residui di
      un'esecuzione interrotta. Tutti gli altri girano in una transazione annullata. Nessun test tocca
      righe che non ha creato, né le tabelle dei parametri fuori da una transazione annullata
- [x] **Ogni policy, vincolo, trigger e funzione è provato togliendolo:** le sonde del piano, ciascuna
      con l'esito registrato in `PROGRESS.md`. Una policy tolta che non fa cadere nessun test è una
      policy non verificata
- [x] `ARCHITECTURE.md` § Modello dati smette di essere una bozza e descrive lo schema applicato; i doc
      dei port e degli adapter memory che dicono *"a T08 sarà…"* o *"T08 non ha deciso…"*
      (`adjustLegSeats`, `raise`, `listOpenOffers`, `save`, `memory-conditions.ts`) dicono cosa è, nello
      stesso commit. Verifica: `rg -n "T08 non ha deciso" app/src` (test **inclusi**) non trova niente

⛔ Checkpoint obbligatorio: cambio di schema DB. *(25/10: l'applicazione a staging l'ha decisa l'umano —
la esegue l'agente, con la CLI. Le altre scelte sono delegate con la regola "l'opzione raccomandata".
Restano all'umano: il metodo dei tipi generati, che chiede Docker o una credenziale nuova; il cambio di
port del reintegro; e la dipendenza di test, se non accetta la raccomandazione.)*

## T08b ⛔ Il reintegro passa da un metodo del port

Nasce dalla pianificazione di T08 (25 ottobre 2026). **Collocato dopo T08 e prima di T09.** Sotto le RLS
di T08, `cancelRequest` gira con l'identità del **richiedente** e reintegra con `listByLeg` + `save` su
righe di **altri** richiedenti: `listByLeg` vede solo la sua riga, il reintegro torna **`ok([])` in
silenzio**, l'annullamento riesce e gli altri restano rifiutati per sempre. T08 scrive la funzione del DB
`restore_system_rejected` (`security definer`, agisce solo se la tratta ha posti liberi, restituisce gli
id); questo task le dà un chiamante.

**Criteri di accettazione**
- [ ] `MatchRequestRepository` guadagna un metodo per il reintegro sulla tratta (nome e firma decisi
      nella pianificazione), che ritorna le candidature reintegrate o un `RepositoryError`. Nessun
      `kind` nuovo, salvo motivazione scritta
- [ ] `restoreSystemRejected` / `cancelRequest` lo usano al posto di `listByLeg` + `save` sulle righe
      altrui; i test di T05 sul reintegro restano verdi **senza cambiare aspettativa**
- [ ] L'adapter memory lo implementa con le stesse regole della funzione del DB (solo righe
      `rejected` con `resolvedBy: 'system'`, solo se la tratta ha posti liberi), e la suite di contratto
      lo prova **come richiedente**: è il caso che oggi in RAM passerebbe e sotto RLS no
- [ ] La suite di contratto resta additiva (nessuna `expect` tolta)

⛔ Checkpoint: cambia l'interfaccia di un port.

## T09 Adapter Supabase

Implementazione dei port con `@supabase/supabase-js`.

**Criteri di accettazione**
- [ ] Passa **la stessa suite di contratto** dell'adapter memory, senza modifiche alla suite
- [ ] Nessuna logica di business nell'adapter: solo traduzione (verificato dal reviewer)
- [ ] URL e chiavi letti da `config`, iniettati, **nessuna chiave nel codice**
- [ ] Un errore di rete si presenta come errore tipizzato del port, non come eccezione Supabase grezza
- [ ] `core/` continua a non importare `@supabase/supabase-js` (verificato dal lint)

**Criteri aggiunti il 25 ottobre 2026, da T07g**
- [ ] L'ambiente di contratto Supabase implementa **`guasta()` / `ripristina()`**, obbligatori
      nell'interfaccia: il test di `storage-unavailable` su ogni lettura e scrittura gira anche qui, e
      `pulisci()` ripristina il guasto
- [ ] La violazione del vincolo di unicità di T08 diventa **`invalid-record`**, il rifiuto di una policy
      **`storage-unavailable`**, una lettura negata una riga assente: la stessa mappatura che la suite
      pretende da `memory`
- [ ] Le letture di lista **omettono** le righe che il dominio rifiuta, istante illeggibile compreso.
      Su Postgres quel ramo nessun test condiviso lo può costruire (i CHECK e il tipo della colonna lo
      impediscono): lo si verifica con un test dell'adapter sulla funzione di traduzione, e il commento
      che accompagna l'omissione nomina il canale di osservabilità mancante come in `memory`

**Criteri aggiunti il 25 ottobre 2026, da T07b**
- [ ] L'adapter Supabase di `ParameterRepository` legge le tabelle di T08 e passa le righe a
      `parseParameters`; **nessun fallback** e nessun valore di `config/` nell'adapter: `rg -n
      "SEED_PARAMETERS" app/src/adapters/supabase` (test **inclusi**) non trova niente
- [ ] L'ambiente di contratto Supabase implementa `scriviParametriGrezzi` con credenziali di servizio fuori
      dall'app, e `pulisci()` riporta le tabelle dei parametri **allo stato di prima del test**
      (fotografia), non al seed: lo staging può contenere valori ritarati dall'umano, e una suite che li
      sovrascrivesse cambierebbe i numeri della demo
- [ ] **"Senza ricompilare", la metà di T07b che serviva una tabella vera:** un test di integrazione
      aggiorna una riga con le credenziali di servizio, una nuova `load` **dello stesso processo**
      restituisce il valore nuovo e `findMatches` cambia risultato; poi ripristina
- [ ] Una `load` senza sessione vede zero righe e torna `invalid-record`, la stessa mappatura di
      `memory`: la suite non va adattata
- [ ] L'adapter Supabase di `MatchRequestRepository` riceve il `NoteConfig` da `AppParameters.notes`
      caricato, non da `config/`

**Criteri aggiunti il 25 ottobre 2026, dalla pianificazione di T08** — il contratto del DB che l'adapter
chiama, che non è più solo tabelle
- [ ] `adjustLegSeats` chiama la funzione `adjust_leg_seats` e ne traduce gli esiti: zero righe →
      `invalid-record`, `P0002` → `not-found`, `42501` → `storage-unavailable`. `raise` chiama
      `raise_personal_bests`. `save` di una trasferta è un upsert su `trips`: le tratte le scrive il
      trigger di T08, e l'adapter **non** scrive `trip_legs`
- [ ] Una violazione di `CHECK` o di foreign key in scrittura (`23514`, `23503`) diventa
      `invalid-record`, come quella di unicità: è il caso della tratta tolta con candidature (T08)
- [ ] `pulisci()` cancella **solo** le righe create dalla suite — i suoi profili di test e ciò che li
      riguarda — e non *"lo stato vuoto"* del progetto: su uno staging condiviso cancellerebbe ciò che
      non ha scritto. Stessa regola dei test di concorrenza di T08
- [ ] `seminaCandidaturaGrezza` non esiste più nell'ambiente (T08, `CHECK` sulle candidature): non va
      implementata

**Criterio aggiunto il 25 ottobre 2026, dalla review intermedia di T08**
- [ ] **Anche la `save` di `MatchRequestRepository` è un upsert** (`INSERT … ON CONFLICT (id) DO UPDATE`),
      non una `PATCH`: su una riga che la policy nega, l'upsert dà **42501** → `storage-unavailable`,
      come in `memory`. Una `PATCH` toccherebbe **zero righe senza errore**, e la suite di contratto lo
      leggerebbe come un successo falso. Lo stesso per ogni scrittura dell'adapter: zero righe toccate
      dove ci si aspetta una riga è un errore, mai un `ok`

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
- [ ] *(25/10, da T08)* La tabella dei codici invito, le sue RLS e la creazione del profilo collegato a
      `auth.users` sono di **questo** task: T08 non crea `invite_codes`, perché il flusso d'accesso non è
      disegnato e una tabella oggi ne pre-impegnerebbe le policy

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

**Criterio aggiunto il 25 ottobre 2026, da T07b** — il soggetto che il secondo criterio di T07b non
aveva: questo è il primo task che chiama un usecase con config.
- [ ] La config arriva da `ParameterRepository.load()` **dopo l'accesso**, mai da `config/` (il lint lo
      impone già); se `load` fallisce la schermata mostra un errore esplicito, **nessun valore di
      default**

> **⚠️ I criteri di T13 e T14 precedono le decisioni del 13–14 ottobre 2026 e vanno riscritti prima di
> aprirli**, come è stato fatto per T05. Non menzionano: le **note** (`requestNote` facoltativa quando
> si candida, `resolutionNote` obbligatoria quando si rifiuta), il **tetto di digitazione con contatore
> dei caratteri residui**, le offerte già candidate che restano in lista **grigie e spuntate** o
> **rosse** e non cliccabili, le **due tratte** andata e ritorno come righe distinte, e le due
> transizioni pilotate dal sistema (auto-rifiuto al riempimento, reintegro). Aprirli così com'è
> produrrebbe codice verde contro un modello che non esiste più: è esattamente il modo in cui cinque
> criteri su otto di T05 erano diventati sbagliati senza che nessun test lo dicesse.

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

> ⚠️ **Un criterio qui sotto è diventato falso con T07e, e va riscritto prima di aprire il task.**
> *"I numeri coincidono con quelli calcolati da T06 e **T07** sugli stessi dati"* era vero quando i badge
> si calcolavano sulle statistiche correnti. Da T07e i badge si assegnano sui **massimi storici**, quindi
> i due numeri **possono differire per costruzione** — è il punto del task, non un difetto. Preso alla
> lettera, quel criterio chiederebbe a T15 di dimostrare un'uguaglianza che T07e ha reso falsa: un
> criterio che produce codice **verde e sbagliato**, o un test che non può passare. Riscriverlo **prima**,
> non durante.

- [ ] Mostra viaggi condivisi, CO₂ evitata, saving generato, badge ottenuti
- [ ] I numeri coincidono con quelli calcolati da T06 e T07 sugli stessi dati (test) — ⚠️ **da riscrivere**
      prima di aprire il task, vedi il riquadro sopra
- [ ] I valori stimati sono **dichiarati come stime** in schermata
- [ ] Utente senza viaggi → stato vuoto con zeri, nessun errore

**Criterio aggiunto il 23 ottobre 2026, dal criterio corrispondente di T07e**
- [ ] La schermata **dichiara** che le statistiche mostrate sono quelle **correnti** mentre i badge sono
      assegnati sui **massimi storici**, quindi i due numeri possono differire: stessa onestà con cui
      dichiara che saving e CO₂ sono stime. Un test ispeziona il testo. Senza questa riga, un collega
      vedrebbe "1 viaggio condiviso" accanto a un badge che ne richiede cinque e penserebbe a un errore

> **Vincolo deciso dall'umano il 14 ottobre 2026:** i **parametri** di `config/` non si mostrano alla
> platea. La dashboard mostra i **KPI**, eventualmente come gauge, mai i valori da cui derivano. Il
> criterio esistente *"è visibile che saving e CO₂ sono stime da parametri configurabili"* resta e non
> è in conflitto: dichiarare che un numero è una stima derivata da parametri non richiede di mostrare i
> parametri — ed è anzi ciò che la rende credibile senza aprire il cofano in sede di pitch.
> Se un giorno servirà una UI di configurazione, è **admin-only**; oggi non esiste e non va costruita,
> perché i parametri sono letterali compilati e non c'è nessun tab da proteggere.

## T16 UI dashboard aziendale

> ⚠️ *(25/10, da T08)* **Con le RLS di T08 nessun utente legge le candidature di tutti**, e
> `computeCompanyKpi` ne ha bisogno: chiamato con ciò che un collega vede, darebbe KPI parziali, verdi e
> sbagliati. Va deciso **prima** di aprire il task come esporre i dati aggregati — voce *"I KPI aziendali
> hanno bisogno di candidature che la RLS non lascia leggere"* in `IDEAS.md`.

- [ ] Mostra trasferte registrate, match proposti, match accettati, auto evitate, giorni evitati, saving €, CO₂
- [ ] I numeri coincidono con T06 sugli stessi dati (test)
- [ ] È visibile che saving e CO₂ sono stime da parametri configurabili
- [ ] DB vuoto → tutti zeri, nessun crash e nessun `NaN`

**Criterio aggiunto il 23 ottobre 2026** (voce `accettata` di `IDEAS.md`, *"I parametri di
configurazione non si mostrano alla platea"*)
- [ ] I valori di `config/` — costo noleggio al giorno, g CO₂/km, distanze fra plant, soglie dei badge —
      **non compaiono** in nessuna schermata che vedrà la platea: la dashboard mostra i **KPI**, non i
      parametri da cui derivano. Convive con il criterio qui sopra, e anzi lo regge: dichiarare che
      saving e CO₂ sono stime derivate da parametri **non** richiede di mostrare i parametri, ed è ciò
      che rende la dichiarazione credibile senza aprire il cofano in sede di pitch. Un "lato admin"
      **non esiste nel modello** (`Profile` ha `id`, `displayName`, `plantId` e nessun ruolo) e per la
      demo non serve: questo è un vincolo su cosa **non** costruire

## T17 Seed dimostrativo

Dataset sintetico sulle tratte del pilota, **disattivabile**.

**Criteri di accettazione**
- [ ] Il seed è uno script separato, non parte dell'avvio dell'app
- [ ] Popola trasferte sulle tratte Pomigliano–Foggia–Grottaglie con almeno un match plausibile
- [ ] Nessun nome di persona reale: tutti i profili sono dichiaratamente fittizi
- [ ] Eseguito due volte non duplica i dati (idempotente)
- [ ] Esiste un modo documentato per svuotare i dati di seed
- [ ] L'app funziona correttamente **anche** con il seed non applicato
- [ ] *(25/10, da T07f)* Gli istanti del seed passano da `normalizeUtcInstant`, non da letterali
      assegnati a mano: il tipo `UtcInstant` lo impone sul percorso che attraversa il dominio, ma uno
      script che scrivesse direttamente in SQL lo aggirerebbe, ed è lì che una forma non canonica
      entrerebbe senza resistenza
- [ ] *(25/10, da T08)* Ogni profilo del seed ha un utente in `auth.users` (foreign key di T08), con
      email fittizia in un dominio `.invalid`; le tratte nascono dal trigger su `trips`, non da insert
      dirette; e lo svuotamento rispetta l'ordine delle foreign key `RESTRICT` (candidature, trasferte,
      profili, utenti)

## T18 ⛔ Build APK e prova su device

**Criteri di accettazione**
- [ ] `eas build -p android --profile preview` produce un APK scaricabile
- [ ] L'APK si installa su un telefono Android reale
- [ ] Sul telefono gira il percorso completo di [PRD.md](PRD.md) § "Definizione di successo"
- [ ] Il keystore è salvato e il backup è **fuori** da questa macchina e fuori dal repo
- [ ] Il package id è `com.softwareoffice.traveltogether`
- [ ] La prova è stata fatta sul device su cui verrà mostrata la demo

⛔ Azione irreversibile: la prima build fissa il keystore e il package id.
