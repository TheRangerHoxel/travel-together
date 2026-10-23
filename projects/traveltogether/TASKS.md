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

**Criteri di accettazione**
- [ ] Esiste un port per leggere e aggiornare il **massimo** di ogni metrica per profilo, con adapter
      memory, e la suite di contratto condivisa lo copre
- [ ] L'aggiornamento è **monotono**: scrivere un valore più basso del massimo memorizzato non lo
      abbassa. Un test lo dimostra, ed è l'invariante su cui poggia tutto il task
- [ ] `awardBadges` **non cambia firma**: resta una funzione pura su `PersonalStats` e config. Chi la
      chiama le passa il massimo invece delle statistiche correnti
- [ ] Un test dimostra il caso che il task esiste per impedire: statistiche che **scendono** (una
      trasferta annullata) → i badge **restano**
- [ ] I duplicati restano **non rappresentabili**: il criterio di T07 non si indebolisce, e un test lo
      riafferma sul percorso nuovo
- [ ] **T15 dichiara in schermata** che le statistiche mostrate e quelle che assegnano i badge possono
      essere due numeri diversi, con la stessa onestà con cui dichiara che saving e CO₂ sono stime
- [ ] Criterio corrispondente su **T08**: la tabella dei massimi, con RLS che permette a ciascuno di
      leggere i propri

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

**Criteri di accettazione**
- [ ] Un punto solo normalizza e valida l'istante, in `core/domain`. Nessun consumatore ripete il
      controllo: oggi lo fa T03 e ogni nuovo chiamante dovrebbe rifarlo
- [ ] `Trip`, `SeatOffer` e `TripRequest` portano un tipo che il compilatore **distingue** da `string`:
      una stringa non normalizzata non è assegnabile. Rompe le firme, ed è la ragione del ⛔
- [ ] Il parser accetta le forme che PostgREST produce — offset `+00:00` e frazioni oltre il
      millisecondo — e le riporta a una forma sola. Un test le pinna come **stringhe letterali**:
      è il formato di un sistema esterno, non un dettaglio di gusto
- [ ] **La forma canonica è unica**, e fra due istanti canonici il confronto lessicografico coincide
      con quello cronologico **senza eccezioni**. Oggi non è così: `...T06:00:00Z` e `...T06:00:00.000Z`
      sono entrambi canonici, sono lo stesso istante e si ordinano **al contrario** (`Z` è `0x5A`, `.`
      è `0x2E`). Un test dimostra la coppia che oggi sbaglia, ed è la trappola che aspetta T13
- [ ] Le date impossibili (`2026-02-31`, il 29 febbraio di un anno non bisestile) sono rifiutate al
      confine con errore tipizzato. T04 è il primo punto che le **persiste**: senza questo, a T09 è
      Postgres a rifiutare l'INSERT con un errore grezzo lato adapter, l'opposto di dove questo
      progetto vuole la validazione
- [ ] La suite di contratto verifica che gli istanti che **escono** dai port siano accettati dal parser.
      È il criterio che la voce di `IDEAS.md` chiedeva per T09, pagato una volta per tutte
- [ ] `test:unit` continua a girare **senza rete**
- [ ] Le fixture scritte a mano e il seed si adeguano **in questo task**, non in T17: la voce dichiara
      che stringere la forma le rompe, e lasciarle rotte sposterebbe il costo su un task che non lo sa

⛔ Checkpoint: rompe le firme di `Trip`, `SeatOffer` e `TripRequest` e di ogni adapter che le
materializza.

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

**Criteri di accettazione**
- [ ] `AmbienteDiContratto` guadagna `guasta()` / `ripristina()`, **additivi**: i file che già lo usano
      restano verdi **senza essere modificati**, ed è la prova da pretendere
- [ ] Un test di contratto esercita `storage-unavailable` su ogni lettura e ogni scrittura dei port, e
      passa su `memory`. Il gemello su `supabase` resta un criterio di T09, dove l'adapter esisterà
- [ ] Le letture di **lista** omettono le righe che violano gli invarianti di dominio, come già fa
      `listOpenOffers` per l'offerta con owner senza profilo. Il caso concreto: una riga con
      `seatsTotal: 2` e `seatsAvailable: 5` diventa oggi **un'offerta pubblicata con cinque posti**,
      entra in `findMatches` e ci resta — e il collega lo scopre quando si candida
- [ ] L'enunciato *"ciò che attraversa un port è valido"* vale per **ogni** lettura e non solo per
      `findById`: un test per ciascuna
- [ ] L'unicità della coppia (`tripId`, `direction`) fra le offerte e quella della coppia (tratta,
      richiedente) fra le candidature sono **verificate dalla suite**, non soltanto dichiarate nel doc.
      Sono le due precondizioni su cui poggiano l'ordine totale di `findMatches` e lo stato che marca
      ogni offerta: con due righe della stessa coppia e stati diversi, lo stato mostrato dipenderebbe
      dall'ordine dell'array in ingresso
- [ ] Ogni omissione lascia un commento che nomina il canale mancante e la voce di `IDEAS.md` che lo
      chiuderà (il port di osservabilità). **Nessun commento dichiara l'omissione osservabile**, perché
      oggi non lo è: un commento che promette più del codice è un difetto

## T07h Igiene di lint e identità

Tre voci di `IDEAS.md` portate dentro il 23 ottobre 2026. **Collocato dopo T07g e prima di T07b:** T07b
lascia nel codice le identità *"che il compilatore controlla"*, e oggi quella garanzia ha un buco in una
direzione — quindi va chiuso prima di costruirci sopra una tabella.

Fuori da questo task, dichiarato per non farlo cercare: la voce *"Deny rules anche sui `.claude/`
annidati"* resta non schedulata. Toccherebbe `.claude/settings.json`, che `CLAUDE.md` vieta di
modificare senza chiedere, e non è un freno di questo progetto ma dell'officina.

**Criteri di accettazione**
- [ ] `'config'` esce da `GRAFO.usecases` e rientra solo per `src/core/**/*.test.ts`: la regola *"il
      core di produzione non importa `config/`"* la impone il lint, non il giudizio di chi rivede
- [ ] Il selettore anti-orologio copre anche `Date.parse` e `Date.UTC`. Sono deterministici, ma
      `Date.parse` su forme non-ISO è *implementation-defined* e Hermes e V8 non si comportano allo
      stesso modo: è esattamente la scorciatoia che `instant.ts` esiste per evitare
- [ ] `src/__tests__/**` è un elemento dichiarato nel grafo dei confini, oppure
      `boundaries/no-unknown-files` è attiva. Oggi è l'unico punto dell'albero in cui **qualunque**
      import è permesso: un test che vi finisse potrebbe cablare `ui/` con `adapters/` e il lint
      tacerebbe
- [ ] `PlantId` e `BadgeId` sono **derivati** dai rispettivi array. Oggi l'annotazione protegge una
      direzione sola: aggiungere un membro alla union senza aggiungerlo all'array **non produce alcun
      errore**, e un ciclo su `PLANT_IDS` (KPI per stabilimento, seed di T17) salterebbe una sede senza
      fallire
- [ ] **Ogni regola nuova è provata violandola**, come in F1.4: una regola di lint che nessuno ha visto
      scattare non è un freno. Le violazioni di prova non restano nel commit
- [ ] Nessun comportamento a runtime cambia. Se `verify` diventa rosso su un file esistente, si
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

**Criteri di accettazione**
- [ ] Un port nuovo per leggere i parametri, con un adapter memory che li serve da fixture e uno
      Supabase che li legge dalla tabella
- [ ] Passano dalla tabella: costo auto/giorno, prezzo carburante, consumo, distanze fra plant,
      tolleranza oraria del matching, massimo posti offribili, limite lunghezza note, testo della nota
      automatica, soglie dei badge
- [ ] Restano nel codice, e un test di conformità lo dichiara: `PlantId`, gli stati, gli id dei badge
- [ ] **Un parametro mancante o malformato nella tabella non passa in silenzio:** errore tipizzato al
      confine, come per ogni altro dato che arriva dallo storage. È il rischio che la decisione di T03
      voleva evitare tenendo i valori come letterali, e qui si paga con una validazione al confine
- [ ] `test:unit` continua a girare **senza rete**: gli usecase ricevono config da fixture, mai dalla
      tabella
- [ ] Un test dimostra che **cambiando una riga della tabella** il risultato di un usecase cambia,
      senza ricompilare
- [ ] RLS: lettura per tutti gli autenticati, **scrittura per nessuno** dall'app. Il gate è l'accesso
      alla dashboard Supabase, che ha solo l'umano: nessun ruolo admin nel modello e nessuna schermata
      di configurazione nell'app
- [ ] **Anche le etichette dei badge passano in tabella** (decisione dell'umano, 14 ottobre 2026), e
      **l'adapter che le legge rifiuta con errore tipizzato** un testo che contiene una parola vietata
      (premi, buoni, euro, €, denaro, soldi, sconti, voucher, regali, bonus, rimborsi, ricompense,
      gratis, coupon, **ticket**, **welfare**). Oggi il criterio *"nessun badge implica premi, denaro o
      buoni"* è imposto da un test su **costanti compilate**: se i testi diventano modificabili dalla
      dashboard senza che il controllo li segua, l'unica garanzia contro una promessa che il prodotto
      non può mantenere svanisce **nel momento di massimo rischio**, la sera prima del pitch e dalla
      sola persona che ha accesso a quella dashboard. È un caso del criterio "un parametro malformato
      non passa in silenzio", non un meccanismo nuovo
- [ ] La lista delle parole vietate vive in **un punto solo**, condiviso fra il test del catalogo e la
      validazione dell'adapter: due liste divergerebbero, e divergerebbero in silenzio

⛔ Checkpoint: port nuovo, e rovescia la decisione di T03 che teneva i valori come letterali
verificabili a compile time. Il motivo per cui si rovescia è buono — un parametro che richiede una
build non è configurabile — ma va registrato come inversione e non come dettaglio.

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

**Criteri aggiunti il 13 ottobre 2026, dal modello a tratte di T04b**
- [ ] Esiste `trip_legs` con chiave primaria **composta** `(trip_id, direction)`, e `match_requests`
      la referenzia con una **foreign key composta** `(trip_id, direction)`: una candidatura su una
      tratta inesistente — per esempio sul rientro di una trasferta che non ha rientro — diventa
      impossibile **per costruzione**, non per un controllo lato client
- [ ] I `CHECK` replicano gli invarianti di `makeTripLeg`: `seats_available BETWEEN 0 AND seats_total`
- [ ] Il decremento atomico è `UPDATE … SET seats_available = seats_available + :delta WHERE … AND
      seats_available + :delta BETWEEN 0 AND seats_total`, e **zero righe toccate è l'errore**: è la
      forma per cui `adjustLegSeats` è stata definita **relativa** e non assoluta
- [ ] **Deciso cosa accade quando una tratta viene eliminata e la referenzia una candidatura**, in
      qualunque stato. L'umano ha scelto l'**annullamento a cascata** con `resolvedBy: 'system'` e
      nota automatica, che è logica di prodotto e quindi di un usecase, non dell'adapter: qui va
      deciso se la foreign key è `RESTRICT` (e l'usecase annulla prima di salvare) o altro. **Non**
      `ON DELETE CASCADE`, scartato dall'umano perché è perdita silenziosa
- [ ] Le RLS di **scrittura** su `trips` impongono `owner_id = auth.uid()`: `save` è un upsert con id
      fornito dal chiamante, quindi senza questo vincolo chi passa il `tripId` di un collega ne
      sovrascrive la trasferta. I criteri esistenti parlano di "non modificare le trasferte altrui",
      che una policy scritta solo su UPDATE lascia aggirabile da un upsert
- [ ] Le RLS di scrittura su `match_requests` vincolano i **due attori**: il richiedente per la
      creazione e l'annullamento, l'owner della trasferta per accettazione e rifiuto. In RAM
      l'`actorId` lo passa il chiamante, quindi i controlli degli usecase di T05 proteggono da una UI
      sbagliata e **non** da un client ostile
- [ ] Foreign key `match_requests.requester_trip_id → trips.id`, **più** una policy che impone che
      quella trasferta sia **del richiedente**. È la metà DB della decisione dell'umano del 14 ottobre
      (l'altra metà è T07c): rende impossibile lo stato in cui il campo da cui dipendono tutti e
      quattro i KPI punta alla trasferta di un altro, anche per il seed e per le migrazioni
- [ ] Un test di concorrenza **reale** su Postgres ripete l'interleaving di T05 su due connessioni: in
      RAM l'intercalatura è deterministica e scelta dal test, qui no
- [ ] **Abbassare `NOTE_CONFIG.maxLength` è una migrazione, non una modifica di configurazione**
      (decisione dell'umano, 14 ottobre 2026). Chi lo abbassa accorcia contestualmente le note che
      sforano, così nessuna riga resta inchiudibile — oggi le `save` degli usecase validano la riga
      intera, quindi una nota vecchia e troppo lunga bloccherebbe accettazione, rifiuto, annullamento e
      reintegro. La riga accorciata va **marcata come tale**: accorciare la nota di una persona
      significa riscrivere ciò che ha scritto, e una modifica silenziosa del dato di un utente è
      esattamente la classe di difetto che questo progetto rifiuta. Oggi è un no-op — nessun dato
      esiste ancora — ma la procedura va scritta prima che ne esista

**Criteri aggiunti il 23 ottobre 2026, da tre voci di `IDEAS.md` portate dentro dall'umano**
- [ ] I `CHECK` coprono anche `has_car = false ⇒ seats_total = 0`, non solo
      `seats_available BETWEEN 0 AND seats_total`. Oggi quell'invariante vive **solo in `makeTrip`**,
      cioè nel client: nel DB nulla impedisce la riga che lo viola, e una migrazione, uno script di
      seed o una query eseguita a mano la inserirebbero senza resistenza
- [ ] Un test di integrazione riproduce la **corsa fra la cascata e una candidatura concorrente** e
      pinna l'esito atteso: riga `pending` su una tratta a zero posti, chiudibile solo con un rifiuto
      motivato. Fra la lettura di `listByLeg` nella cascata e una `requestSeat` concorrente non c'è
      alcun lock, e su Postgres la corsa è **reale**, non intercalata in un event loop. Non è una
      decisione di prodotto di nessuno: segue dal fatto che `requestSeat` non rifiuta per posti a zero,
      e oggi vive solo in un commento di `request-seat.ts` e in `PROGRESS.md`
- [ ] **Deciso cosa accade alle candidature già chiuse quando la tratta viene eliminata.** La foreign
      key composta rifiuta la cancellazione finché esiste **una qualsiasi** riga che la referenzia,
      comprese le `rejected` e le `cancelled`: il guard di T05 sugli stati **aperti** chiude la
      divergenza fra i due adapter solo in parte, perché con sole righe chiuse `memory` elimina la
      tratta e Postgres no. Da scegliere fra un guard su qualunque candidatura e la cancellazione
      esplicita delle righe chiuse prima di eliminare la tratta — la seconda è logica di business,
      quindi del task di **modifica trasferta**, che non esiste ancora nel backlog

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
- [ ] Mostra viaggi condivisi, CO₂ evitata, saving generato, badge ottenuti
- [ ] I numeri coincidono con quelli calcolati da T06 e T07 sugli stessi dati (test)
- [ ] I valori stimati sono **dichiarati come stime** in schermata
- [ ] Utente senza viaggi → stato vuoto con zeri, nessun errore

> **Vincolo deciso dall'umano il 14 ottobre 2026:** i **parametri** di `config/` non si mostrano alla
> platea. La dashboard mostra i **KPI**, eventualmente come gauge, mai i valori da cui derivano. Il
> criterio esistente *"è visibile che saving e CO₂ sono stime da parametri configurabili"* resta e non
> è in conflitto: dichiarare che un numero è una stima derivata da parametri non richiede di mostrare i
> parametri — ed è anzi ciò che la rende credibile senza aprire il cofano in sede di pitch.
> Se un giorno servirà una UI di configurazione, è **admin-only**; oggi non esiste e non va costruita,
> perché i parametri sono letterali compilati e non c'è nessun tab da proteggere.

## T16 UI dashboard aziendale
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

## T18 ⛔ Build APK e prova su device

**Criteri di accettazione**
- [ ] `eas build -p android --profile preview` produce un APK scaricabile
- [ ] L'APK si installa su un telefono Android reale
- [ ] Sul telefono gira il percorso completo di [PRD.md](PRD.md) § "Definizione di successo"
- [ ] Il keystore è salvato e il backup è **fuori** da questa macchina e fuori dal repo
- [ ] Il package id è `com.softwareoffice.traveltogether`
- [ ] La prova è stata fatta sul device su cui verrà mostrata la demo

⛔ Azione irreversibile: la prima build fissa il keystore e il package id.
