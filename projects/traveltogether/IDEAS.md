# IDEAS — TravelTogether

Registro delle proposte. **Niente qui dentro entra nello scope da solo.**

Le proposte le approva **solo l'umano**. Quando una voce viene marcata `accettata`, diventa un task in
[TASKS.md](TASKS.md) con criteri di accettazione verificabili: **solo allora** entra nel loop.
Finché non lo è, per il loop non esiste.

Una proposta non ferma e non rallenta il task in corso: si annota e si va avanti.
**Niente duplicati:** se l'idea è già qui, non va riscritta.

## Formato di ogni voce

```markdown
### <titolo breve>
- **Cosa** — la proposta in una riga.
- **Perché** — problema che risolve o valore che aggiunge.
- **Impatto** — moduli toccati, è reversibile?, rompe interfacce esistenti?
- **Costo** — S / M / L.
- **Stato** — proposta → accettata / rifiutata / rimandata
```

Stati: `proposta` (default, scritto dall'agente) · `accettata` / `rifiutata` / `rimandata`
(**solo l'umano**).

---

## Proposte

Voci nate durante la Fase 0, tutte derivate da tagli di scope decisi con te.
Sono già elencate come fuori scope in [PRD.md](PRD.md): qui restano tracciate per non perderle.

### Normalizzare l'istante al confine dell'adapter — ⚠️ rischio concreto per T09
- **Cosa** — aggiungere a T09 il criterio di accettazione: *la suite di contratto verifica che `listOpenOffers` restituisca istanti accettati da `parseUtcInstant`*.
- **Perché** — rilievo del reviewer su T03, ed è il più urgente dell'elenco. PostgREST serializza un `timestamptz` come `2026-11-03T06:00:00+00:00` (offset, non `Z`) e con precisione al **microsecondo**. Entrambe le forme vengono rifiutate dal parser, e `findMatches` risponde a un istante illeggibile omettendo l'offerta: a T09 **ogni** offerta proveniente da Supabase sparirebbe in silenzio e il motore tornerebbe `ok([])` — "nessun collega compatibile", indistinguibile da un risultato legittimo. È esattamente lo scenario che il `Result` è stato introdotto per evitare, aggirato dal lato dell'offerta.
- **Impatto** — `adapters/supabase` e la suite di contratto. Il buco si chiude dove va chiuso, nell'adapter, e `findMatches` resta pura. Estende la voce "Istante normalizzato UTC come tipo brandizzato": va scritta come sua continuazione, non come doppione.
- **Costo** — S se affrontata dentro T09, M se scoperta dopo.
- **Stato** — `accettata` — **schedulata dall'umano il 23 ottobre 2026: è `T07f`**, insieme alla voce
  *"Istante normalizzato UTC come tipo brandizzato"*, perché sono lo stesso lavoro. Collocata **prima di
  T08**, non dentro T09, così la forma canonica è decisa prima dello schema e del seed.

### Rendere l'unicità dei `tripId` una garanzia della macchina
- **Cosa** — o `findMatches` ritorna un `MatchError` `duplicate-offer-id`, o il port dichiara l'unicità e la suite di contratto la verifica.
- **Perché** — rilievo del reviewer su T03: l'ordine totale usa `tripId` come ultima chiave, quindi se due offerte lo condividessero il comparatore tornerebbe `0` e il criterio "nessuna dipendenza dall'ordine di input" cadrebbe per quella classe di input — oltre a mostrare la stessa trasferta due volte. Oggi la precondizione è dichiarata nel doc, garantita a monte da uno storage indicizzato per id, e **non verificata da nessun test**: è un presupposto non protetto in una funzione il cui output pilota una schermata.
- **Impatto** — `core/usecases/find-matches.ts` oppure `adapters/contract`. Reversibile.
- **Nota (13 ottobre 2026, dalla pianificazione di T04b) — la precondizione si sposta e se ne aggiunge una seconda.** Con le tratte il `tripId` **non è più unico fra le offerte** (due tratte della stessa trasferta lo condividono), quindi l'ultima chiave dell'ordine totale diventa l'identità di tratta e la garanzia da verificare è su quella, non su `tripId`. Inoltre, caduta l'esclusione per candidatura esistente, `findMatches` non cerca più *se esiste* una candidatura bloccante ma *quale* stato attaccare al risultato: se per la stessa coppia (tratta, richiedente) arrivassero due righe con stati diversi, lo stato mostrato dipenderebbe dall'ordine dell'array in ingresso — lo stesso difetto di questa voce, su un altro input. L'unicità è garantita dall'upsert documentato in `MatchRequestRepository.save`, e come sopra **non è verificata da nessun test**.
- **Costo** — S.
- **Stato** — `accettata` — **schedulata dall'umano il 23 ottobre 2026: è un criterio di `T07g`**, nella
  forma della nota del 13 ottobre (identità di tratta, non `tripId`) e con la seconda precondizione, la
  coppia (tratta, richiedente).

### Stringere il lint su `config/` e sull'orologio
- **Cosa** — due regole: togliere `'config'` da `GRAFO.usecases` riammettendolo solo per `src/core/**/*.test.ts`; ed estendere il selettore anti-orologio a `MemberExpression[object.name='Date']`.
- **Perché** — rilievo del reviewer su T03. La prima: la regola "il core di produzione non importa `config/`" è oggi affidata al giudizio di chi rivede, ma `CLAUDE.md` dice che dove è esprimibile come lint deve imporla il lint — e qui lo è. La seconda: il selettore attuale cattura `new Date()` e `Date.now()`, ma lascia passare `Date.parse` e `Date.UTC`; sono deterministici, però `Date.parse` su forme non-ISO è *implementation-defined* e Hermes e V8 non si comportano allo stesso modo — cioè proprio la scorciatoia che `instant.ts` esiste per evitare.
- **Impatto** — `app/eslint.config.js`. Reversibile. Da provare violando entrambe le regole, come per F1.4.
- **Costo** — S.
- **Stato** — `accettata` — **schedulata dall'umano il 23 ottobre 2026: è un criterio di `T07h`**,
  entrambe le regole, entrambe da provare violandole.

### Preferenza di matching per genere
- **Cosa** — filtro opzionale per condividere l'auto solo con colleghi dello stesso genere.
- **Perché** — il documento la cita come leva di adozione per gli utenti più riservati, ed è un bisogno reale su un viaggio di 2–3 ore con uno sconosciuto.
- **Impatto** — `core/domain` (profilo), `core/usecases` (vincoli di matching), UI preferenze. Reversibile. Non rompe interfacce se aggiunta come preferenza opzionale. **Sotto GDPR il genere è dato particolarmente delicato**: su un pilota con persone vere richiede base giuridica e informativa.
- **Costo** — S sul codice, L sulla conformità.
- **Stato** — `accettata`

### Matching di gruppo
- **Cosa** — il sistema accorpa più trasferte compatibili e propone **chi** dovrebbe noleggiare, invece di attendere che qualcuno abbia già l'auto.
- **Perché** — massimizza i noleggi evitati: nel modello asimmetrico attuale, se nessuno ha ancora noleggiato, nessun match avviene. È il caso in cui il risparmio è più grande.
- **Impatto** — riscrive `findMatches` da funzione di ricerca a problema di assegnazione. Tocca il cuore del prodotto. Reversibile solo prima che la UI dipenda dalla forma dei risultati.
- **Costo** — L.
- **Stato** — `rifiutata`

### Integrazione SAP Concur
- **Cosa** — intercettare la richiesta auto dentro il workflow travel e proporre il pooling in quel momento.
- **Perché** — è la novità vera della proposta originale: il matching come suggerimento contestuale e non invasivo, non come app da aprire di propria iniziativa. Senza questo, l'adozione dipende dalla buona volontà.
- **Impatto** — nuovo adapter dietro `TripRepository`; il core non cambia (è esattamente ciò per cui esiste la dependency inversion). Richiede accesso API che oggi non abbiamo.
- **Costo** — L, e bloccato da un vincolo esterno.
- **Stato** — `rifiutata`

### Distanze reali e percorsi su mappa
- **Cosa** — sostituire la tabella statica di distanze con distanze calcolate, e mostrare il percorso.
- **Perché** — CO₂ e saving più credibili, e abilita le deviazioni di percorso (prendere un collega lungo la strada).
- **Impatto** — nuova dipendenza esterna con quote o costi, contro il vincolo "tutto gratuito". `config/` e `core/usecases` (KPI).
- **Costo** — M.
- **Stato** — `accettata`

### Notifiche push sulle candidature
- **Cosa** — avvisare chi offre posti quando arriva una candidatura, e il richiedente quando viene accettato.
- **Perché** — senza notifiche il flusso richiede che l'utente riapra l'app per scoprire cosa è successo: è il punto dove un'app di coordinamento muore.
- **Impatto** — nuovo port `Notifier` con adapter Expo Notifications. Non rompe nulla se aggiunto dietro interfaccia.
- **Costo** — M.
- **Stato** — `accettata`

### Le letture di lista omettono le righe invalide invece di passarle
- **Cosa** — nei repository, far saltare dalle liste le righe che violano gli invarianti di dominio, come già si fa per l'offerta con owner senza profilo.
- **Perché** — rilievo del reviewer su T02. Oggi `findById` valida ma le liste no, quindi l'enunciato "un `Trip` che arriva da un port è valido" è vero per una lettura e falso per l'altra. Il caso concreto che lo rende serio: `listOpenOffers` proietta senza validare, quindi una riga corrotta con `seatsTotal: 2` e `seatsAvailable: 5` diventa **un'offerta pubblicata con cinque posti**, entra in `findMatches` e ci resta — e il collega scopre il problema quando si candida. Omettere tiene insieme il degrado proporzionato e la garanzia che ciò che attraversa il port è valido.
- **Impatto** — `adapters/*`. Nessun cambio di interfaccia. Il costo è la perdita silenziosa, cioè lo stesso problema di osservabilità della voce qui sotto.
- **Costo** — S.
- **Stato** — `accettata` — **schedulata dall'umano il 23 ottobre 2026: è un criterio di `T07g`**. La
  perdita silenziosa che questa voce accetta come costo resta aperta: la chiude il port di osservabilità
  qui sotto, che **non** è schedulato.

### Port di osservabilità (`Logger` / `Telemetry`)
- **Cosa** — un port per registrare i degradi silenziosi, con adapter console in sviluppo.
- **Perché** — rilievo del reviewer su T02: esistono già tre rami che degradano **senza lasciare traccia** — l'offerta con owner mancante omessa, la riga invalida che attraversa una lista, lo `storage-unavailable` tradotto. In tutti e tre non manca il tipo d'errore: manca il canale per accorgersene. In una demo dal vivo, un'offerta che sparisce senza spiegazione è indistinguibile da un bug del matching.
- **Impatto** — nuovo port in `core/ports`, adapter in `adapters/`. Non rompe interfacce esistenti. Si lega alla voce "hook di guasto nella suite di contratto".
- **Costo** — M.
- **Stato** — `accettata`

### CHECK constraint nel DB a specchio degli invarianti di `Trip`
- **Cosa** — in T08, vincoli SQL che replicano gli invarianti di `makeTrip`: `has_car = false ⇒ seats_total = 0`, `seats_available BETWEEN 0 AND seats_total`.
- **Perché** — rilievo del reviewer su T02: oggi quegli invarianti vivono solo in `makeTrip`, cioè nel client. Nel DB nulla impedisce la riga che li viola — una migrazione, uno script di seed o una query eseguita a mano la inserirebbero senza resistenza. T05 ha già un criterio su due accettazioni concorrenti che non devono portare i posti sotto zero: la difesa definitiva su quello è lato DB, non lato client.
- **Impatto** — migrazioni SQL di T08. Reversibile. Nessun effetto sul codice TypeScript.
- **Costo** — S, e va deciso dentro T08 che è già un checkpoint ⛔.
- **Stato** — **accettata e schedulata dall'umano il 23 ottobre 2026: è un criterio di T08.** Il
  `BETWEEN` c'era già fra i criteri di T08 dal modello a tratte; quello che si aggiunge è
  `has_car = false ⇒ seats_total = 0`, che viveva solo in `makeTrip`.

### Hook di guasto nella suite di contratto
- **Cosa** — aggiungere `guasta()` / `ripristina()` ad `AmbienteDiContratto` e un test di contratto che verifichi il ramo `storage-unavailable` su entrambi gli adapter.
- **Perché** — rilievo del reviewer su T02: il percorso d'errore dei repository è **l'unico comportamento del port che nessun test tocca**. Oggi `storage-unavailable` è dichiarato nel tipo ma non prodotto né asserito da nessuna parte, quindi non sappiamo se i due adapter lo tratterebbero allo stesso modo — ed è proprio il caso che si manifesterà in demo, con il proxy aziendale di mezzo.
- **Impatto** — `adapters/contract` e l'ambiente di ciascun adapter. Reversibile, non rompe interfacce.
- **Costo** — S su memory, M su supabase (serve un modo di simulare il guasto).
- **Stato** — `accettata` — **schedulata dall'umano il 23 ottobre 2026: è `T07g`**, dove porta la metà
  `memory`. La metà `supabase` resta un criterio di T09, perché lì l'adapter esisterà.

### `Trip` come tipo opaco, per rendere il costruttore inaggirabile
- **Cosa** — separare `TripFields` (campi grezzi, input) da `Trip` (tipo brandizzato, output di `makeTrip`), così il compilatore impedisce di costruire un `Trip` saltando la validazione.
- **Perché** — rilievo del reviewer su T01: oggi `makeTrip(campi: Trip): Result<Trip, …>` ha input e output dello stesso tipo, quindi qualunque modulo può scrivere un letterale e aggirare gli invarianti. Il commento nel codice ora lo dichiara, ma una raccomandazione non è una garanzia. Conta soprattutto per gli adapter, che materializzano `Trip` da storage: un record invalido che arriva dal DB non è meno invalido di uno scritto a mano.
- **Impatto** — `core/domain` e **ogni** adapter che ricostruisce entità. Reversibile, ma **rompe la firma**: farlo dopo T02 è un checkpoint ⛔.
- **Costo** — S adesso, M dopo T02.
- **Stato** — `accettata`

### Derivare `PlantId` e `BadgeId` dai rispettivi array
- **Cosa** — `const PLANT_IDS = [...] as const; type PlantId = (typeof PLANT_IDS)[number]`, invece di dichiarare union e array separatamente.
- **Perché** — rilievo del reviewer su T01: oggi l'annotazione `readonly PlantId[]` protegge una direzione sola. Un valore sbagliato nell'array non compila, ma **aggiungere un membro alla union senza aggiungerlo all'array non produce alcun errore**: l'array diventa silenziosamente incompleto, e un futuro ciclo su `PLANT_IDS` (seed T17, KPI per stabilimento T06) salterebbe una sede senza fallire. Nota: `as const` non ricade nel divieto di `as` delle convenzioni, che riguarda l'assertion usata per zittire il compilatore — qui restringe i letterali e *aumenta* il controllo.
- **Impatto** — `core/domain/plant.ts` e `badge.ts`. Reversibile, non rompe interfacce.
- **Costo** — S.
- **Stato** — `accettata` — **schedulata dall'umano il 23 ottobre 2026: è un criterio di `T07h`**,
  collocato prima di T07b perché quel task tiene le identità nel codice proprio per questa garanzia.

### Classificazione dell'errore quando mancano sia auto sia capienza
- **Cosa** — decidere quale errore vince quando più invarianti di `Trip` sono violati insieme.
- **Perché** — rilievo del reviewer su T01: `hasCar: false, seatsTotal: 0, seatsAvailable: 2` viene respinto correttamente, ma con `seats-available-exceeds-total`, mentre la causa leggibile per l'utente è "non hai l'auto". Non è un difetto di correttezza — nessun dato invalido passa — è il messaggio che la UI mostrerà a essere fuorviante.
- **Impatto** — `core/domain/trip.ts` e la mappatura errori → testi italiani. Da valutare quando quella mappatura esisterà (T11–T12), non prima.
- **Costo** — S.
- **Stato** — `accettata`

### Deny rules anche sui `.claude/` annidati
- **Cosa** — estendere le deny rules da `./.claude/**` a `**/.claude/**` e `**/AGENTS.md`, così la prima rete copre anche le cartelle di configurazione che arrivano dentro un pacchetto scaricato.
- **Perché** — scoperto in F1.3: il template Expo crea `app/.claude/settings.json` (che abilita un plugin di Claude Code) e `app/AGENTS.md` (istruzioni all'agente). Le deny rules attuali usano percorsi relativi alla radice e **non** li coprono; li ha intercettati solo l'hook, che fa match sulla sottostringa `.claude/settings` ovunque compaia. Le reti sovrapposte hanno funzionato — ma una delle due aveva un buco, e conviene chiuderlo invece di contare sull'altra.
- **Impatto** — solo `.claude/settings.json` dell'officina. Reversibile. Nessun effetto sul codice applicativo. Da valutare se il rumore sui falsi positivi (ogni pacchetto che spedisce un `AGENTS.md`) valga la copertura.
- **Costo** — S.
- **Stato** — `accettata`

### Andata e ritorno sono due offerte indipendenti, non una
- **Cosa** — l'unità di offerta e di candidatura diventa la **tratta** (andata, ritorno) e non la trasferta: `SeatOffer` e `MatchRequest` si riferiscono a una tratta, ognuna con i propri posti disponibili. Un passeggero può prendere l'andata da un collega e il ritorno da un altro, oppure una sola delle due.
- **Perché** — requisito di prodotto dell'umano (13 ottobre 2026). Il caso reale: chi offre sta via 3 giorni, a chi cerca ne servono 2, quindi il rientro non coincide — e oggi **l'intero passaggio è inutilizzabile anche se l'andata combacia perfettamente**. Il modello attuale non lo rende scomodo, lo rende inesprimibile: `SeatOffer` ha un solo `departureAt` e un solo `seatsAvailable`, `MatchRequest` punta a `tripId`. Due conseguenze concrete, non teoriche. (1) Su T05: con la candidatura legata alla trasferta, il collega che prende **entrambe** le tratte dalla stessa persona risulta una "doppia candidatura sulla stessa offerta" e viene rifiutato dal criterio di T05 — cioè il caso migliore per organizzarsi diventa l'unico vietato. (2) I posti sono indipendenti per tratta: un'auto da 4 posti ha 4 posti all'andata **e** 4 al ritorno, non 4 in tutto; con un solo contatore, accettare un passeggero per la sola andata consuma anche un posto del rientro.
- **Impatto** — `core/domain/seat-offer.ts` e `match-request.ts` (identità della tratta al posto di `tripId`), `TripRepository.listOpenOffers` (da una trasferta con auto e rientro proietta **due** offerte), i due adapter, la suite di contratto, T05 (decremento e doppia candidatura per tratta), T08 (schema), T13–T14 (UI). **`findMatches` non cambia**: confronta già un solo `departureAt` per offerta, e la scelta di T03 di tenere `SeatOffer` come proiezione stretta invece del `Trip` intero è esattamente ciò che rende la cosa economica nel motore. L'unicità richiesta dall'ordine totale si sposta da `tripId` a identità di tratta. **Rompe `SeatOffer` e `MatchRequest`**: dopo T02 è un checkpoint ⛔. `Trip` **non** cambia (resta `departureAt` + `returnAt`), quindi **T04 non è toccato**.
- **Costo** — M. Da collocare **prima di T05**, che ne dipende per due criteri su otto.
- **Stato** — `accettata`

### Sovrapposizione del rientro come terza componente di punteggio
- **Cosa** — aggiungere `returnAt` a `SeatOffer` e usare la sovrapposizione della durata della trasferta nel punteggio di `findMatches`, con pesi dichiarati in `config/`.
- **Perché** — il `PRD.md` elenca **tre** componenti di punteggio morbido (vicinanza dell'orario, sovrapposizione della durata, stesso plant di appartenenza), ma `SeatOffer` espone solo `departureAt`: la seconda è oggi inesprimibile e i criteri di T03 in `TASKS.md` non la citano. Chi legge il PRD e poi il codice trova una componente mancante senza spiegazione. Sul prodotto conta: due colleghi che partono insieme ma rientrano a tre giorni di distanza condividono solo l'andata, e il punteggio oggi non lo distingue.
- **Impatto** — `core/domain/seat-offer.ts` (campo nuovo), `TripRepository.listOpenOffers` e i due adapter (la proiezione deve portare `returnAt`), `findMatches` e la suite di contratto. **Rompe l'interfaccia `SeatOffer`**: dopo T09 è un checkpoint ⛔. Richiede anche di rendere espliciti i pesi fra le tre componenti, che oggi non esistono perché la dominanza fra plant e orario è ottenuta per costruzione.
- **Nota (13 ottobre 2026) — in parte superata dalla voce "Andata e ritorno sono due offerte indipendenti".** Questa voce assumeva **una** offerta che copre una trasferta con rientro, e usava la sovrapposizione delle durate per misurare quanto le due si somigliano. Con le tratte indipendenti il bisogno è soddisfatto a monte: il rientro è un'offerta a sé, confrontata sul proprio orario dai vincoli duri che già esistono, e due colleghi che rientrano a tre giorni di distanza non hanno bisogno di essere penalizzati nel punteggio — semplicemente non si incontrano sulla tratta di rientro. Quello che resta di utile qui è **l'opposto di una penalità**: un bonus per chi può prendere entrambe le tratte dallo stesso collega, che è la preferenza dichiarata dall'umano ("se posso partire e tornare con la stessa persona è meglio per organizzarsi"). Da riscrivere in quella forma quando questa voce diventerà un task, non da implementare come stava.
- **Costo** — M.
- **Stato** — `accettata`

### Istante normalizzato UTC come tipo brandizzato
- **Cosa** — un tipo `Instant` (stringa brandizzata) prodotto da un unico parser in `core/domain`, al posto di `departureAt: string` su `Trip`, `SeatOffer` e `TripRequest`.
- **Perché** — la decisione di T02 (`PROGRESS.md`) è che il confronto lessicografico fra istanti è corretto **solo** su stringhe normalizzate UTC con la `Z`: `2026-11-03T07:00:00+01:00` e `2026-11-03T06:00:00Z` sono lo stesso istante e due stringhe diverse. Oggi il tipo è `string`, quindi la garanzia vive nelle convenzioni e in un controllo a runtime ripetuto da ogni consumatore (T03 lo fa, T04 dovrà rifarlo). Con un tipo brandizzato la validazione avviene una volta al confine e il compilatore impedisce di confrontare una stringa non normalizzata. È la variante dell'idea "`Trip` come tipo opaco" applicata al tempo, dove l'errore è più insidioso perché il dato *sembra* giusto.
- **Impatto** — `core/domain` (nuovo modulo + tre entità), ogni adapter che materializza entità, i fixture dei test. Reversibile ma **rompe le firme**: dopo T02 è un checkpoint ⛔.
- **Nota (13 ottobre 2026, da T04) — la forma canonica non è unica, e questo rende il problema più grave di come era scritto sopra.** `parseUtcInstant` accetta i millisecondi come **opzionali**: `...T06:00:00Z` e `...T06:00:00.000Z` sono entrambi canonici e sono lo stesso istante, ma come stringhe sono diversi e l'ordine è **invertito** (`Z` è `0x5A`, `.` è `0x2E`, quindi `"06:00:00.000Z"` risulta *minore* di `"06:00:00Z"`). Quindi l'enunciato su cui si fonda tutto — "fra istanti canonici il confronto lessicografico coincide con quello cronologico" — è vero **solo a forma dei millisecondi uguale**, e il dominio non la garantisce. Nessun bug attuale: `createTrip` confronta gli `Instant` e non le stringhe, e `findMatches` passa sempre da `parseUtcInstant`. È però una trappola per T13 (ordinare i "prossimi viaggi", filtrare `departureAt >= clock.now()`: sbagliano sui pareggi, perché `clock.now()` ha sempre i millisecondi e un `Trip` salvato può non averli). Delimitazione, per non propagare un allarme sbagliato: su Postgres la colonna è `timestamptz`, quindi `ORDER BY` e i confronti SQL sono semantici e non ne soffrono — il rischio è solo lato JS. **La decisione da prendere qui è una fra due:** stringere il parser a millisecondi obbligatori (rompe le fixture scritte a mano e il seed di T17), oppure normalizzare in un punto solo, che è esattamente ciò che questa voce propone.
- **Nota (13 ottobre 2026, dal reviewer di T04) — validità di calendario.** `parseUtcInstant` accetta date impossibili (`2026-02-31`, il 29 febbraio di un anno non bisestile): è una scelta dichiarata di T03, legittima perché lì nessun conto attraversava i giorni. Ma **T04 è il primo punto che le persiste**: fino a ieri una data impossibile attraversava solo una funzione pura, da adesso finisce nello storage. A T09 Postgres rifiuterebbe l'INSERT con un errore grezzo lato adapter, invece che con un errore tipizzato lato core — l'esatto contrario di dove questo progetto vuole la validazione. Il rimedio vive qui, nel parser unico al confine.
- **Costo** — M.
- **Stato** — `accettata` — **schedulata dall'umano il 23 ottobre 2026: è `T07f`**, insieme alla voce
  *"Normalizzare l'istante al confine dell'adapter"*. Lì finiscono anche le due note qui sopra: la forma
  canonica unica e la validità di calendario.

### Escludere dai match le offerte già partite
- **Cosa** — far sparire dalle proposte le offerte il cui `departureAt` è nel passato, decidendo **dove**: un vincolo in più in `findMatches` con l'istante passato come dato, oppure un filtro nell'orchestratore che legge il `Clock`.
- **Perché** — `findMatches` è pura e non ha orologio per scelta, quindi oggi un'offerta di ieri resta un match valido a tempo indeterminato. T04 impedisce di *creare* una trasferta nel passato, ma non impedisce al tempo di passare dopo la creazione: con il seed di T17 e una demo mostrata giorni dopo, la schermata dei match può proporre un viaggio già avvenuto. Nessuno dei tredici criteri di T03 lo copre, quindi non è un difetto di T03 — è una decisione mancante.
- **Impatto** — se entra in `findMatches`, cambia la firma (quarto/quinto parametro) e va deciso prima che T13 dipenda dalla forma; se resta nell'orchestratore, nessuna firma cambia ma la regola finisce fuori dal core, dove nessun test puro la copre. Reversibile.
- **Costo** — S.
- **Stato** — `da discutere`

### Repo separati per progetto
- **Cosa** — quando arriverà il progetto #2, spostare ogni progetto in un repo proprio.
- **Perché** — oggi `auto/build` è condiviso tra officina e progetti: con due progetti attivi, i commit si mescolano e il revert perde precisione.
- **Impatto** — struttura del repo, configurazione `.claude`, remote. Reversibile ma laborioso.
- **Costo** — M.
- **Stato** — `accettata`

### Le offerte già candidate restano in lista con il loro stato, invece di sparire
- **Cosa** — `findMatches` **non** esclude più le offerte su cui il richiedente ha già una candidatura: le restituisce con lo stato attaccato, e la UI le disegna non cliccabili — grigie con la spunta se `pending`/`accepted`, rosse se `rejected`, con la nota di rifiuto accanto. L'esclusione passa da vincolo duro a stato di presentazione.
- **Perché** — requisito di prodotto dell'umano (13 ottobre 2026): *"se ho già inviato una candidatura a un'offerta mi dovrebbe apparire nella lista ma come già spuntata in grigio e non ri-cliccabile"*, e per un rifiuto *"non più cliccabile ma rossa, tra le proposte se ancora compatibile con la ricerca"*. Un'offerta che sparisce non può essere disegnata grigia: per mostrarne lo stato bisogna che arrivi alla schermata. Risolve anche la domanda aperta su `rejected`: il rosso non è cliccabile, quindi dopo un rifiuto non si rinvia. La doppia candidatura si misura quindi su **tre** stati — `pending`, `accepted`, `rejected` — e **non** su `cancelled`, che l'umano ha deciso essere ricliccabile (vedi la voce *"Annullamento, riempimento e visibilità della nota"*). Resta più larga di "pendente o accettata", che era la lettura in discussione, e il buco temuto (il collega vede il match, si candida, riceve un errore) non è raggiungibile dalla UI perché la riga non è cliccabile: il controllo nell'usecase resta come seconda rete, non come messaggio da leggere.
- **Impatto** — **modifica due criteri di accettazione di T03, già committato, approvato e spuntato**: "richiedente con richiesta già `pending`/`accepted` su quell'offerta → nessun match". Non è un difetto di T03 (era la lettura corretta del PRD di allora) ma un cambio di requisito, da emendare in `TASKS.md` e registrare in `PROGRESS.md`, non da applicare in silenzio. Cambia la forma del ritorno di `findMatches` (ogni `ScoredMatch` porta lo stato della candidatura), quindi è un **⛔ sul contratto**. Gli altri vincoli duri restano: plant, data e finestra oraria continuano a filtrare, come dice l'umano stesso con "se ancora compatibile con la ricerca".
- **Costo** — S sul motore (si toglie un `continue` e si aggiunge un campo), M contando l'emendamento di T03 e la UI.
- **Stato** — `accettata`
- **Le tre decisioni che questa voce lasciava aperte sono state sciolte dall'umano il 13 ottobre 2026:** vedi la voce *"Annullamento, riempimento e visibilità della nota"*. In particolare **cade** l'eccezione che avevo proposto per l'offerta che si riempie: non serve più tenere visibile un'offerta a posti esauriti, perché la candidatura `pending` viene rifiutata automaticamente e il suo stato vive nella lista personale del richiedente.

### Annullamento, riempimento e visibilità della nota
- **Cosa** — tre regole decise dall'umano il 13 ottobre 2026, che completano le due voci precedenti.
  1. **`cancelled` non fa sparire l'offerta e la rende di nuovo cliccabile.** La richiesta "torna indietro": chi offre l'auto non la vede più fra quelle ricevute, e il richiedente può ricandidarsi.
  2. **Quando l'auto si riempie, le candidature `pending` su quella tratta passano a `rejected`** con una **nota automatica** del tipo "la macchina è stata riempita", più una notifica.
  3. **La nota di rifiuto la legge solo chi aveva mandato la richiesta**, non gli altri passeggeri.
- **Perché** — chiudono tre buchi segnalati sulla voce *"Le offerte già candidate restano in lista"*. La (1) evita che annullare sia una trappola. La (2) sostituisce, meglio, l'eccezione che avevo proposto io: invece di tenere visibile un'offerta esaurita, si chiude la candidatura e si dice perché — uno stato che si spiega da sé invece di una riga che resta appesa. La (3) tiene il testo libero dentro la riga di chi l'ha ricevuto, che è anche l'unico posto dove è lecito stia.
- **Impatto, e qui ci sono tre cose non ovvie.**
  1. **La (1) corregge la regola della doppia candidatura**, che avevo scritto come "qualunque stato abbia": `cancelled` **non** blocca. Gli stati bloccanti sono `pending`, `accepted`, `rejected`. Da cui anche una domanda di modello: ricandidarsi dopo un annullamento riporta la **stessa riga** da `cancelled` a `pending` (coerente con l'upsert già documentato in `MatchRequestRepository.save`, e necessario perché `findByTripAndRequester` ritorna una riga sola), oppure ne crea una nuova. La prima è l'unica compatibile col port così com'è.
  2. **La (2) introduce la prima transizione di stato non causata da un utente.** Oggi ogni transizione è un'azione (`requestSeat`, `acceptRequest`, `rejectRequest`); questa è un effetto collaterale dell'accettazione **di un altro**: `acceptRequest`, quando consuma l'ultimo posto, deve rifiutare a cascata tutte le altre `pending` di quella tratta. È logica di T05, e aggiunge un criterio che oggi non c'è. Ne segue che le note hanno **due autori possibili**, l'owner e il sistema: va deciso se la riga registra chi ha rifiutato, perché "nota obbligatoria di chi rifiuta" non si applica a un rifiuto senza autore umano.
  3. **La notifica della (2) ha un costo che le altre due decisioni non hanno.** Richiede il port `Notifier` e l'adapter Expo Notifications della voce *"Notifiche push sulle candidature"* — `accettata` ma **M**, con una dipendenza nuova (⛔). Senza notifica il comportamento resta corretto e osservabile (il richiedente vede il rosso con la nota quando riapre l'app): la notifica è un **miglioramento separabile**, e conviene non farne un prerequisito di T05.
  4. **La (3) è un criterio per T08, non codice.** La nota vive su `MatchRequest`, quindi la visibilità è una policy RLS: la riga è leggibile dal suo `requester_id` e dall'owner della trasferta, da nessun altro. Il modello non cambia — è una policy da scrivere e da provare con un test di integrazione, come gli altri criteri di T08.
- **Costo** — S per (1) e (3), M per (2) se si include la notifica, S se la notifica si separa.
- **Stato** — `accettata`
- **Quarta regola, decisa dall'umano subito dopo:** annullare una candidatura **già `accepted`** richiede una **nota obbligatoria**, manda una **notifica a chi ha l'auto**, e **restituisce il posto** (`seatsAvailable` +1). Chiude il buco che avevo segnalato (T05 aveva il decremento in accettazione e nessun incremento in annullamento) e aggiunge due criteri a T05.
- **Conseguenza di modello, e qui c'è una scelta da fare.** Le note obbligatorie sono ora **due**, su due azioni diverse e di due attori diversi: il rifiuto (owner) e l'annullamento dopo accettazione (requester). Più quella facoltativa di chi si candida. Due forme possibili:
  - **(A) campi fissi su `MatchRequest`**: `requestNote` (facoltativa, di chi si candida) + `resolutionNote` (obbligatoria quando la riga si chiude per rifiuto o per annullamento-dopo-accettazione) + `resolvedBy: 'owner' | 'requester' | 'system'`. Una riga sola, compatibile con l'upsert già documentato, e `resolvedBy` chiude anche la domanda aperta su *chi* ha rifiutato.
  - **(B) un registro di transizioni** (entità nuova: evento, autore, nota, istante). Modello più ricco e con storia, ma è una tabella in più a T08 e un port in più.
  Per un MVP da pitch la (A) basta e costa S; la (B) è la forma giusta solo se servirà la storia delle transizioni. **Raccomandata la (A).**
- **Buco nuovo, conseguenza diretta di questa regola e della (2):** un collega auto-rifiutato perché *"la macchina è stata riempita"* **non può ricandidarsi**, perché `rejected` blocca — ma se poi qualcuno annulla e un posto si libera, quel collega resta fuori per un incidente di tempismo e non per una decisione di nessuno. Con `resolvedBy` la distinzione è esprimibile: un rifiuto `system` potrebbe **non** bloccare la ricandidatura, mentre un rifiuto `owner` sì. È una decisione di prodotto, non di codice, e va presa entro T05.
- **La notifica ora serve in due flussi** (auto-rifiuto per riempimento, annullamento dopo accettazione). Resta separabile per la demo — lo stato è durevole e visibile riaprendo l'app — ma il secondo flusso è quello in cui l'assenza di notifica **costa davvero**: chi offre l'auto sta pianificando un viaggio e perde un passeggero senza avere alcun motivo per ricontrollare la lista. Separabile per il pitch, necessaria per un pilota vero.

### Note sulla candidatura e sul rifiuto
- **Cosa** — due campi di testo libero su `MatchRequest`: una nota **facoltativa** di chi si candida, e una nota **obbligatoria** di chi rifiuta.
- **Perché** — requisito di prodotto dell'umano (13 ottobre 2026). La nota di chi si candida serve a dire le cose che il matching non modella ("parto dal parcheggio nord", "ho un bagaglio grosso"). Quella di chi rifiuta è obbligatoria perché un rifiuto muto, su un viaggio fra colleghi, è peggio di un'assenza di risposta: la riga rossa in lista deve poter spiegare sé stessa.
- **Impatto** — `core/domain/match-request.ts`, `MatchRequestRepository` (le note viaggiano con la riga), i due adapter, la suite di contratto, lo schema di T08, T13 e T14. Su T05: **aggiunge** un criterio ("rifiuto senza nota → errore tipizzato") e modifica il #3, che oggi descrive il rifiuto come la sola transizione di stato. Tocca la **stessa entità** del passaggio alle tratte, quindi conviene schedularle insieme: due cambi di firma sulla stessa interfaccia in due task separati significano due ⛔ e due giri di adapter per lo stesso file.
- **Costo** — S sul dominio, M contando adapter, schema e UI.
- **Stato** — `accettata`
- **Nota operativa** — il testo libero di una demo dal vivo finisce su un proiettore: il seed di T17 deve avere note sintetiche e innocue, e il limite di lunghezza va deciso in `config/` invece che scoperto quando qualcuno incolla tre paragrafi in una riga di lista.

### Validare la lunghezza delle note solo in scrittura, non in lettura
- **Cosa** — separare gli invarianti **strutturali** di `MatchRequest` (validati sempre, in lettura e in scrittura) dal **limite di lunghezza** della nota (validato solo in scrittura); oppure far validare in lettura con un `NoteConfig` permissivo.
- **Perché** — rilievo del reviewer su T04b. `findById` valida la riga riletta contro la config **corrente** e traduce il fallimento in `invalid-record`. Per gli invarianti strutturali è giusto e simmetrico a `MemoryTripRepository`. Per la lunghezza no: `maxLength` è una **soglia tarabile**, e `PROGRESS.md` dichiara che il valore (280) verrà deciso davvero a T13, su un telefono. Il giorno in cui qualcuno lo porta a 140, ogni candidatura con una nota più lunga **già scritta** — seed di T17 compreso — diventa illeggibile: `findById` ritorna `invalid-record` e le schermate di T13/T14 mostrano un errore su un dato che **era valido quando è stato scritto**. Un parametro di prodotto non deve poter rendere illeggibili dati già scritti: è la differenza fra un invariante e una soglia.
- **Impatto** — `core/domain/match-request.ts` e i due adapter. Nessun cambio di firma dei port.
- **Costo** — S.
- **Stato** — `accettata` — **diventata un criterio di T05** il 13 ottobre 2026, e **soddisfatta a metà**: vedi la voce seguente, che è la sua continuazione.

### Validare le note solo sui campi che la scrittura imposta
- **Cosa** — i quattro usecase di T05 e le due transizioni di sistema validano la lunghezza **soltanto** della nota che stanno scrivendo (`resolutionNote` per rifiuto e annullamento, `requestNote` per la candidatura) e lasciano passare quella che **transitano**.
- **Perché** — **continuazione della voce precedente, non un doppione.** T05 ha sistemato la lettura: una nota scritta con limite 280 si rilegge intatta anche dopo che il limite è scceso a 10. Ma tutte le `save` degli usecase chiamano `makeMatchRequest` sulla **riga intera**, che valida entrambe le note: quindi dopo un abbassamento del limite una riga con `requestNote` vecchia e lunga non si può più **accettare, rifiutare, annullare né reintegrare**, e in cascata finisce in `unclosed` con `note-too-long`. Una riga che non si può modificare è un grado **peggio** di una che non si può leggere: si congela nel momento in cui qualcuno la sta chiudendo. Il criterio di T05 è soddisfatto alla lettera — quelle sono scritture — ma non nello scopo, ed è il criterio a essere scritto troppo stretto: va riscritto da *"si rilegge senza `invalid-record`"* a *"si rilegge **e si può chiudere**"*, altrimenti la metà che manca scompare dal tracciamento.
- **Non è un difetto latente che scatta da solo:** serve che un umano abbassi `NOTE_CONFIG.maxLength` sotto la lunghezza di una nota già scritta, e finché il limite è 280 note più lunghe non possono esistere. E quando scatta **non è silenzioso**: errore tipizzato che conserva la violazione originale, e nelle transizioni di sistema la riga compare in `unclosed` con la causa.
- **Impatto** — `core/domain/match-request.ts` e i quattro usecase. Nessun cambio di firma dei port. Da decidere **prima di T12**, che scriverà la mappatura errori → testi italiani.
- **Costo** — S.
- **Stato** — proposta

### Limite alla digitazione della nota, con contatore dei caratteri residui
- **Cosa** — nel campo nota la digitazione si **ferma** al massimo (l'umano ha indicato ~255 caratteri) e accanto compare un **contatore dei caratteri ancora disponibili**. L'utente non può scrivere una nota che verrà rifiutata.
- **Perché** — decisione di prodotto dell'umano del 14 ottobre 2026. Oggi una nota fuori limite è rifiutata **dopo** l'invio, con un errore tipizzato: funziona, ma fa scoprire il vincolo nel momento peggiore, quando il testo è già scritto. Un contatore sposta il vincolo prima della scrittura, che è dove un limite non dà fastidio.
- **Dove** — **criterio del task che definirà la schermata delle note**, come chiesto dall'umano. Attenzione: quel task **non esiste ancora**. Le note si scrivono in due punti diversi — `requestNote` quando si candida (T13) e `resolutionNote` quando si rifiuta o si annulla una candidatura accettata (T14) — e **né T13 né T14 menzionano le note**, perché i loro criteri sono stati scritti prima che le note esistessero. Vanno riscritti prima di aprirli, come è stato fatto per T05.
- **⚠️ Cosa questa misura NON chiude, e va detto:** il contatore impedisce di scrivere note troppo lunghe **da qui in avanti**, ma **non** risolve il caso che l'ha fatta nascere — una nota scritta quando il limite era 280 che diventa inchiudibile se il limite scende a 140. Quelle righe esistono già e nessun contatore le raggiunge. Il residuo resta aperto: vedi la voce *"Validare le note solo sui campi che la scrittura imposta"*, oppure si chiude dichiarando il limite **non abbassabile** sotto il tetto di digitazione, che con questa decisione diventa una scelta coerente invece di una rinuncia.
- **Impatto** — `ui/` e i criteri di T13/T14. Il tetto di digitazione deve venire dallo **stesso** `NOTE_CONFIG.maxLength` del dominio, non da una costante nel componente: due numeri che devono restare d'accordo sono il modo in cui divergono.
- **Costo** — S.
- **Stato** — `accettata`

### I parametri di configurazione non si mostrano alla platea
- **Cosa** — i valori di `config/` (costo noleggio/giorno, g CO₂/km, distanze, soglie dei badge) sono visibili **solo lato admin**, mai nelle schermate che vedrà la platea del pitch. La dashboard aziendale mostra i **KPI**, eventualmente come gauge, e non i parametri da cui derivano.
- **Perché** — decisione di prodotto dell'umano del 14 ottobre 2026.
- **Oggi non c'è niente da nascondere, e questo cambia la natura della voce:** i parametri sono **letterali compilati** in `config/`, non valori modificabili a runtime, quindi un "tab configurativo" **non esiste**. La decisione è quindi un **vincolo su cosa non costruire**: se un giorno servirà una UI di configurazione, è admin-only e non è nello scope della demo.
- **Conseguenza da sapere:** un "lato admin" **non esiste nel modello**. `Profile` ha `id`, `displayName`, `plantId` e nessun ruolo. Un gate admin richiederebbe un campo ruolo su `Profile`, una policy RLS che lo rispetti, e un ⛔ di contratto. Per la demo non serve: non c'è nessuna schermata di configurazione da proteggere.
- **Compatibile con il criterio di T16 già scritto** (*"è visibile che saving e CO₂ sono stime da parametri configurabili"*): dichiarare che sono stime derivate da parametri **non** richiede di mostrare i parametri. Le due cose convivono, e la seconda è anzi ciò che rende la prima credibile senza aprire il cofano in sede di pitch.
- **Impatto** — criteri di T16, e un vincolo negativo su T15/T16. Nessun codice oggi.
- **Costo** — XS come vincolo, M se un giorno servirà davvero il gate admin.
- **Stato** — `accettata` — **schedulata dall'umano il 23 ottobre 2026: è un criterio di T16**, come
  vincolo su cosa non costruire. Nessun codice oggi.

### `storage-failed` di `requestSeat` deve dire quale lettura è fallita
- **Cosa** — aggiungere a `RequestSeatError.storage-failed` un campo che nomina il punto: `'leg' | 'existing-request' | 'requester-trip'`.
- **Perché** — rilievo del reviewer su T07c. `requestSeat` ha ora **tre** letture che collassano nello stesso errore — `findLeg`, `findByLegAndRequester`, `findById` — e l'errore porta solo la causa grezza del repository. Con un lettore era irrilevante; con tre si perde l'informazione nel punto in cui serve: in demo *"storage non disponibile"* senza sapere **cosa** non era disponibile è il genere di diagnosi che costa dieci minuti davanti a una platea. Si lega alla voce sul port di osservabilità, che risolve lo stesso problema per i degradi silenziosi, quindi può aspettare quella.
- **Impatto** — `core/usecases/request-seat.ts` e i suoi test.
- **Costo** — XS.
- **Stato** — proposta

### Un divieto su un file di test condiviso quasi mai protegge lo scope
- **Cosa** — nota operativa per come si scrivono i brief: i divieti di modifica si applicano alla **logica** di un task chiuso, non ai suoi **fake**. Se un fake condiviso è troppo debole per il task nuovo, la modifica **additiva** è la soluzione giusta, e la prova da pretendere è *"gli altri file che lo usano restano verdi senza essere modificati"*.
- **Perché** — **quarto episodio della stessa famiglia** in una sessione: il port separato in T04b (per non toccare il fake di `create-trip.test.ts`), la collisione di `legKey` che non esiste, `lookupDistance` duplicata in T07 (per non toccare T06), e un wrapper locale in T07c (per non toccare lo spia condiviso). Dato aggiunto dal reviewer: **in tre casi su quattro il divieto riguardava file di test o di supporto**, e la soluzione imposta era peggiore del rischio evitato — *"i fake non sono scope, sono strumenti"*. Completa la regola già scritta in `PROGRESS.md`: non vietare meno, **nominare il motivo del divieto**. Si lega alla voce sui fake condivisi dei port.
- **Impatto** — nessun codice. Il modo di scrivere i brief ai subagent, ed è un risparmio su ogni task futuro.
- **Costo** — XS.
- **Stato** — proposta

### Il presidio sui testi dei badge deve seguire i testi dentro T07b
- **Cosa** — decidere se le **etichette** dei badge passano in tabella e, se sì, spostare il controllo sulle parole vietate al **confine di lettura** dei parametri, con errore tipizzato.
- **Perché** — rilievo del reviewer su T07. Oggi il criterio *"nessun badge implica premi, denaro o buoni"* è imposto da un test che ispeziona **costanti compilate** in `BADGE_CATALOG`. T07b dichiara che in tabella vanno "i valori — numeri **e testi**", elenca le soglie dei badge e il testo della nota automatica, ma **non** le etichette: la questione è aperta e va sciolta **prima** di scrivere la migrazione. Se i testi diventano modificabili dalla dashboard Supabase senza che il controllo li segua, l'unica garanzia contro una promessa che il prodotto non può mantenere svanisce **nel momento di massimo rischio** — la sera prima del pitch, dall'unica persona che ha accesso a quella dashboard.
- **Impatto** — criteri di T07b e l'adapter dei parametri. Il criterio *"un parametro malformato non passa in silenzio"* esiste già in T07b, e questo ne è un caso.
- **Costo** — S se deciso dentro T07b, M se scoperto dopo.
- **Stato** — proposta

### Un test diretto del criterio "primo viaggio" con la config di produzione
- **Cosa** — un `it` che passa `BADGE_CONFIG` ad `awardBadges` con `sharedTrips: 1` e pretende `['primo-viaggio']`.
- **Perché** — rilievo del reviewer su T07. Il criterio è coperto da **tre** test in composizione — la soglia di produzione pinnata a 1, il confine che assegna, l'end-to-end che però imposta la soglia a mano invece di usare `BADGE_CONFIG` — e la catena è completa, quindi non è un buco. Ma nessun test **si legge come il criterio**, e `primo-viaggio` è il badge nominato nei criteri e quello che si vedrà in demo: vale avere il test che somiglia alla frase che deve garantire.
- **Impatto** — due righe in `badge-config.test.ts`.
- **Costo** — XS.
- **Stato** — proposta

### Validare `requesterTripId`: esistenza, appartenenza, assenza di auto
- **Cosa** — `requestSeat` verifica la trasferta indicata (esiste, è **del richiedente**, ha `hasCar: false`) e rifiuta con errore tipizzato; T08 aggiunge la foreign key `requester_trip_id → trips.id` e la policy che impone l'appartenenza.
- **Perché** — rilievo del reviewer su T06, ed è **il campo meno protetto e più pesante del modello**. È obbligatorio e non vuoto, e lì si fermano i controlli: nessuno verifica che quella trasferta esista, che sia di chi si candida o che sia senza auto. `requestSeat` ha già `deps.trips` in mano e non la interroga; il dominio non può, perché non ha accesso allo storage. Conseguenze, **tutte con `verify` verde**: un riferimento alla trasferta **di un collega**, o a una più **lunga** della propria, gonfia giorni, km, CO₂ e saving senza che nulla protesti — e sono i quattro numeri della dashboard aziendale; un id inesistente fa fallire l'**intero** calcolo con `unknown-requester-trip`, cioè un dato sbagliato di una riga spegne la dashboard. Oggi irraggiungibile da un utente solo perché nessuna UI esiste.
- **Impatto** — `core/usecases/request-seat.ts` e il suo tipo d'errore, più criteri su T08. Nessun cambio di firma dei port.
- **Costo** — S nell'usecase, S a T08. Da fare **prima di T12**, che costruirà il form da cui quel campo arriverà.
- **Stato** — proposta

### La trasferta degenere nei dati spegne la dashboard aziendale
- **Cosa** — due criteri: su **T17** il seed non contiene trasferte con `fromPlantId == toPlantId`; su **T16** la dashboard distingue "tabella distanze incompleta" da "tutti zeri".
- **Perché** — rilievo del reviewer su T06. `lookupDistance(config, a, a)` cerca una coppia che nella tabella non esiste per costruzione, quindi una trasferta con partenza uguale a destinazione fra le auto evitate produce `missing-distance` e **l'intero** `computeCompanyKpi` ritorna errore. `createTrip` rifiuta `same-plant`, quindi la via d'ingresso non è l'utente: sono `seminaGrezzo`, una migrazione e **il seed di T17**, che è lo scenario realistico. La scelta "errore tipizzato invece di zero" è giusta e deliberata — uno zero farebbe sparire una tratta reale mostrando una cifra plausibile e al ribasso — ma va **dichiarata dove verrà incontrata**, cioè in schermata.
- **Impatto** — criteri di T16 e T17. Nessun codice.
- **Costo** — XS.
- **Stato** — proposta

### L'errore sulla tabella distanze non dice quale coppia è rotta
- **Cosa** — aggiungere `fromPlantId`/`toPlantId` al payload di `invalid-config / distanceKm`.
- **Perché** — rilievo del reviewer su T06. L'errore gemello `missing-distance` nomina già entrambi i plant; questo no. Con tre sedi il valore rotto si trova a occhio, ma con la tabella **da file** di T07b diventerà "un valore della tabella è rotto, cercalo". L'asimmetria si noterà solo quando darà fastidio, ed è una riga: il tipo dell'errore è già un'unione discriminata che la regge.
- **Impatto** — `core/usecases/compute-company-kpi.ts` e i suoi test.
- **Costo** — XS.
- **Stato** — proposta

### Annullare una trasferta deve chiudere le candidature che la riguardano
- **Cosa** — quando una trasferta passa a `cancelled`, le candidature collegate vanno chiuse: quelle **ricevute** sulle sue tratte (chi offriva non c'è più) e quelle **inviate** dal suo proprietario come passeggero (il viaggio non si fa più, quindi il posto va restituito a chi l'aveva concesso).
- **Perché** — scoperto in T06. Oggi nessun usecase annulla una trasferta, quindi lo stato `cancelled` è raggiungibile solo da `seminaGrezzo`, da una migrazione o dal seed di T17 — ma `TripStatus` ha quel valore proprio perché le trasferte si annullano, e il flusso arriverà. Senza la chiusura a cascata restano **candidature accettate su un viaggio che non esiste più**: chi offriva tiene un posto occupato da nessuno, e chi si era candidato vede "accettata" una tratta che non partirà. È la stessa famiglia del caso già deciso per la **tratta** che scompare (annullamento a cascata con `resolvedBy: 'system'` e nota automatica), applicata all'intera trasferta, e la soluzione coerente è la stessa: un usecase che chiude prima e salva dopo, **non** logica nell'adapter.
- **Impatto** — un usecase nuovo (`cancelTrip`), che non esiste in nessun task del backlog; `leg-system-transitions.ts` guadagna una terza funzione; criteri su T08 per le RLS di scrittura. Si lega al task di **modifica trasferta**, anch'esso non ancora nel backlog: sono due facce dello stesso buco, e conviene schedularle insieme.
- **Costo** — M.
- **Stato** — proposta

### La corsa fra la cascata e una candidatura concorrente va dichiarata nei test di T08
- **Cosa** — un caso nei test di integrazione di T08 che riproduca "candidatura che arriva subito dopo l'esaurimento dei posti" e pinni l'esito atteso: riga `pending` su una tratta a zero posti, chiudibile solo con un rifiuto motivato.
- **Perché** — rilievo del reviewer su T05. Fra la lettura di `listByLeg` nella cascata e una `requestSeat` concorrente non c'è alcun lock. **Non è una decisione di prodotto di nessuno:** segue dal fatto che `requestSeat` non rifiuta per posti a zero — scelta fatta perché `findMatches` omette le tratte esaurite e il prodotto gestisce l'auto piena con la cascata. Sul piano del prodotto è accettabile e **non** produce uno stato bloccato: chi offre l'auto la vede in `listByLeg`, se prova ad accettarla ottiene `no-seats-available`, e la chiude con un rifiuto motivato — che è esattamente ciò per cui la nota obbligatoria esiste. Ma è un percorso in cui l'utente si candida e **poi** scopre che non c'era posto, e oggi vive solo in un commento di `request-seat.ts` e in `PROGRESS.md`. Su Postgres la corsa è **reale**, non intercalata in un event loop.
- **Impatto** — criteri di T08. Nessun codice.
- **Costo** — S.
- **Stato** — **accettata e schedulata dall'umano il 23 ottobre 2026: è un criterio di T08.**

### Decidere cosa accade alle candidature quando una tratta scompare
- **Cosa** — fissare, **prima** della migrazione di T08, il comportamento della coppia (tratta eliminata, candidature esistenti su di essa): `ON DELETE CASCADE`, oppure `save` che rifiuta la nuova forma se esistono candidature aperte, oppure annullamento a cascata con `resolvedBy: 'system'` (che sarebbe comportamento di T05).
- **Perché** — rilievo del reviewer su T04b, ed è un **buco di copertura della suite condivisa**, non un difetto del codice. Oggi `MemoryTripRepository.save` elimina in silenzio le tratte che la nuova forma non prevede (auto tolta, rientro tolto), e la suite di contratto lo verifica. Ma T04b pre-impegna per T08 una **foreign key composta** `match_requests(trip_id, direction) → trip_legs(trip_id, direction)`: su Postgres, eliminare una tratta che ha candidature solleva una violazione di vincolo, quindi `save` ritornerebbe un errore **dove in RAM ritorna `ok`**. La suite non lo intercetta perché nessun test combina "tratta eliminata" con "candidatura esistente su quella tratta": i due blocchi sono separati. A T09 l'unica via d'uscita sarebbe **adattare la suite**, che per `ARCHITECTURE.md` è il segnale che il port è sbagliato.
- **Impatto** — migrazioni di T08 (già ⛔), `adapters/*`, un caso in più nella suite di contratto, e **un criterio in più su T08**.
- **Costo** — S per decidere ora, M se scoperta a T09.
- **Stato** — `accettata` — **deciso il 13 ottobre 2026: annullamento a cascata** con `resolvedBy: 'system'` e nota automatica, non `ON DELETE CASCADE` né un rifiuto secco.
- **Nota (13 ottobre 2026, dalla pianificazione di T05) — la foreign key blocca *ogni* candidatura, non solo quelle aperte.** Il criterio portato in T05 dice che `save` rifiuta se la nuova forma eliminerebbe una tratta con candidature **aperte**. Su Postgres, senza `ON DELETE CASCADE` (scartato), la FK composta rifiuta la cancellazione della tratta finché esiste **una qualsiasi** riga che la referenzia, comprese quelle `rejected` e `cancelled`. Quindi il guard sugli stati aperti chiude la divergenza fra i due adapter solo in parte: con sole righe chiuse, `memory` eliminerebbe la tratta e Postgres no. Da decidere insieme al criterio: guard su qualunque candidatura, oppure cancellazione esplicita delle righe chiuse prima di eliminare la tratta (che è di nuovo logica di business, quindi del task di modifica trasferta).
- **Nota: la decisione non ha un innesco oggi, e questo ne determina la collocazione.** L'annullamento a cascata richiede un usecase di **modifica trasferta** che nessun task del backlog prevede: `save` è chiamato solo da `createTrip`, dove non esistono né tratte né candidature preesistenti. Non può stare nell'adapter, perché un `save` che annulla candidature è logica di business in un repository, vietata dal criterio di T09. Quindi: diventa un criterio del task di **modifica trasferta** quando quel task esisterà (annulla prima, salva dopo), e nel frattempo T05 porta il criterio che **`save` rifiuta** con errore tipizzato se la nuova forma eliminerebbe una tratta con candidature aperte — rete che rende impossibile dimenticare la cascata, e unico comportamento su cui i due adapter concordano, perché su Postgres la foreign key composta rifiuterebbe comunque.
- **Il residuo è stato schedulato dall'umano il 23 ottobre 2026: è un criterio di T08** — le righe
  **chiuse**, che la FK blocca comunque e che il guard di T05 sugli stati aperti non copre. La scelta fra
  guard su qualunque candidatura e cancellazione esplicita delle righe chiuse si fa lì.

### Atomicità e idempotenza dell'accettazione, non solo del contatore
- **Cosa** — a T05/T08, far avvenire in **una sola** operazione (funzione lato DB o transazione) la transizione di stato della candidatura **e** il delta sui posti; e far verificare da un test la protezione dal doppio decremento, invece di affidarla all'ordine delle chiamate.
- **Perché** — rilievo del reviewer su T04b. `adjustLegSeats(…, delta)` difende il **contatore** dalla concorrenza — a T08 diventa un `UPDATE … seats_available + :delta BETWEEN 0 AND seats_total` dove "zero righe toccate" è l'errore — ma **non lega** il decremento al cambio di stato. Due conseguenze: un'accettazione interrotta fra le due scritture lascia un posto consumato senza candidatura accettata; e il delta è idempotente a zero ma **non a ripetizione**, quindi due chiamate decrementano due volte. Ciò che oggi impedisce il doppio decremento è il controllo sullo stato `accepted` nel chiamante, non la firma. Il criterio di T05 "nessun doppio decremento" poggia quindi sul chiamante, ed è esattamente il genere di garanzia che qui si preferisce spostare nella macchina.
- **Impatto** — `core/usecases` di T05, migrazioni di T08.
- **Costo** — M.
- **Stato** — proposta

### Vietare agli agenti di manipolare i file di testo via shell
- **Cosa** — una regola operativa: i file si modificano con gli **strumenti di modifica**, non con comandi di shell. In particolare, negli script PowerShell non si usano nomi di variabile o di comando di **una sola lettera**, e non si fanno round-trip di lettura/riscrittura di un file di testo.
- **Aggiornamento (14 ottobre 2026): tre episodi in due giorni, tutti della stessa famiglia.** (1) Uno script del developer ha usato `R`, alias di `Invoke-History`, svuotando e cancellando sei file fra cui uno di un commit approvato. (2) Io ho usato `Set-Content` per spuntare delle caselle in `TASKS.md`: il round-trip ha letto UTF-8 come ANSI e ha riscritto **mojibake su ogni carattere accentato** del file. (3) Uno script di sonda del developer ha introdotto un **BOM** in un `.ts`, che passa il lint e rompe altrove. In tutti e tre i casi il danno è stato recuperabile **solo perché il lavoro precedente era committato**, e in due casi su tre è stato scoperto guardando il diff e non da `verify`.
- **Cosa fare in pratica:** usare gli strumenti di modifica; se serve una trasformazione su un file, farla con Python specificando l'encoding in modo esplicito (`io.open(..., encoding="utf-8", newline="\n")`), che è l'unica forma che non ha trappole su questa macchina; e controllare il **diff atteso** dopo ogni trasformazione — un diff più grande del previsto è il segnale.
- **Perché** — incidente reale durante T04b: uno script del developer ha usato `R`, che su Windows PowerShell è **alias di `Invoke-History`**. Ha riesesguito comandi precedenti, svuotando `trip-repository.ts` e cancellando altri cinque file, fra cui `create-trip.test.ts` del commit di T04 già approvato. Nessun danno permanente **solo perché T04 era committato**: `git restore` ha recuperato tutto. Se il lavoro fosse stato ancora nel working tree sarebbe stato irrecuperabile. Altri alias di una lettera con lo stesso potenziale: `r`, `h` (`Get-History`), `sl` (`Set-Location`), `ri` (`Remove-Item`).
- **Impatto** — una riga di regola operativa, più eventualmente una deny rule o un controllo nell'hook sui comandi che contengono identificatori di una lettera. Nessun effetto sul codice applicativo.
- **Costo** — S.
- **Stato** — proposta

### Fake condivisi dei port per i test di `core/`
- **Cosa** — un modulo di fake dei port riusabile dai test di `core/**` (orologio fisso, repository-spia che registra le scritture), collocato **dentro** `core/` per non violare il divieto `core/ → adapters/`.
- **Perché** — scoperto in T04. Il lint vieta a `core/**` di importare `adapters/` **anche nei test**, con due reti indipendenti (verificato dal reviewer su `eslint.config.js`, non assunto): quindi `FixedClock` e l'adapter memory sono inutilizzabili dai test degli usecase, e ogni test si riscrive i propri fake. Con T05 (tre usecase, due repository) la duplicazione passa da "un po'" a sistematica, e fake divergenti fra test significano lo stesso contratto verificato in modi diversi dentro lo stesso core. Rilievo collegato: il fake di `TripRepository` scritto in T04 è **più debole del port** — `save` scrive senza validare, mentre il doc del port dichiara validazione prima della scrittura con `invalid-record`. Oggi è innocuo perché `makeTrip` precede sempre `save`, ma la suite non si accorgerebbe se un usecase passasse a `save` un `Trip` non validato.
- **Impatto** — solo file di test, nessun cambio di interfaccia. Reversibile.
- **Costo** — S.
- **Stato** — proposta
- **Nota (14 ottobre 2026, precedente creato da T05) — questo modulo esiste già a metà, e il task futuro deve ASSORBIRLO invece di crearne un secondo.** T05 ha prodotto `core/usecases/request-test-fakes.ts`, fake spia di `TripRepository` e `MatchRequestRepository` usato dai **sette** file di test di T05; `create-trip.test.ts` è rimasto con i propri fake locali. Il reviewer l'ha giudicato accettabile — non è questa voce implementata senza approvazione, perché quella propone un modulo **trasversale** che unifichi anche i fake esistenti — ma se il task futuro ne creasse un secondo, il motivo per cui questa idea esiste (*"fake divergenti verificano lo stesso contratto in modi diversi"*) si realizzerebbe proprio mentre la si implementa. **Vincolo scoperto, da sapere prima di provare a spostarlo:** la collocazione in una cartella di produzione è **forzata**. Un `src/core/testing/` non sarebbe un elemento dichiarato in `boundaries/elements`, e con `default: 'disallow'` nessuno potrebbe importarlo; un `.test.ts` verrebbe eseguito da jest come suite vuota. Quindi il task richiede anche una modifica a `eslint.config.js`, cioè un ⛔.

### Accumulare gli errori di validazione invece di ritornare il primo
- **Cosa** — `createTrip` (e gli usecase di validazione in genere) ritorna l'elenco delle violazioni invece del primo errore che scatta.
- **Perché** — rilievo del reviewer su T04. T12 ha il criterio *"ogni errore di validazione di T04 produce un messaggio visibile in schermata"*: con il primo-che-scatta l'utente corregge un campo, ripreme invia, scopre il secondo errore, e così via. È la **continuazione** della voce "Classificazione dell'errore quando mancano sia auto sia capienza", non un doppione: quella decide *quale* errore vince quando più regole cadono insieme, questa elimina la domanda restituendoli tutti.
- **Impatto** — firma di `createTrip` e di ogni suo chiamante. **Rompe l'interfaccia**: dopo T12 è un checkpoint ⛔. Da decidere prima che T12 scriva la mappatura errori → testi italiani.
- **Costo** — M.
- **Stato** — proposta

### Il contatore dei posti su `Trip` resta un doppione dopo il passaggio alle tratte
- **Cosa** — togliere `seatsAvailable` da `Trip` (o ridurlo a una capienza per tratta, non decrementabile) una volta che i posti vivono sulla tratta, e spostare l'invariante `seatsAvailable <= seatsTotal` sul contatore di tratta.
- **Perché** — continuazione della voce *"Andata e ritorno sono due offerte indipendenti"*, che spiega perché un contatore solo non basta ma non dice cosa fare di **quello che resta**. Con i posti per tratta nessuno decrementa più `Trip.seatsAvailable`: resta un campo che esiste, è leggibile, e dopo la prima accettazione dice il falso. È la classe di difetto peggiore per questo progetto — un campo che mente è peggio di un campo assente — e i consumatori naturali sono le schermate T13–T14, che mostrerebbero "3 posti liberi" su una tratta che ne ha 2. Fuori da T04b per un motivo preciso: rimuoverlo rompe un criterio di accettazione di T04, già committato e spuntato.
- **Impatto** — `core/domain/trip.ts` e `makeTrip`, `createTrip` (T04), i due adapter, la suite di contratto, lo schema di T08. **Rompe l'interfaccia `Trip`**: è un ⛔. Reversibile.
- **Costo** — M.
- **Stato** — proposta

### Le candidature ricevute lette per owner, non una tratta alla volta
- **Cosa** — un metodo in più su `MatchRequestRepository` che elenchi le candidature su **tutte** le trasferte di un collega, accanto alla lettura per tratta.
- **Perché** — scoperto pianificando T04b. Con le candidature chiavate sulla tratta, `listByTrip` diventa per-tratta, e la schermata di T14 ("chi offre posti vede le candidature ricevute") deve fare **due** letture per ogni trasferta con rientro: N trasferte diventano 2N chiamate più la lettura delle trasferte. In RAM è gratis, su Supabase è il classico N+1 e sul free tier l'egress è contato. Nessuno dei quattro criteri di T14 lo richiede oggi, quindi non entra in T04b: va deciso prima che T14 scriva la schermata.
- **Impatto** — `core/ports/match-request-repository.ts` (metodo **additivo**, non rompe firme), i due adapter, la suite di contratto, e a T08 una policy RLS che permetta all'owner di leggere le candidature sulle proprie trasferte senza elencarne gli id a una a una.
- **Costo** — S.
- **Stato** — proposta

### RLS di scrittura su `match_requests` vincolate ai due attori
- **Cosa** — criterio di accettazione in più per T08: le policy di **INSERT e UPDATE** su `match_requests` devono imporre che il richiedente scriva solo righe con `requester_id = auth.uid()`, e che la chiusura di una riga (`accepted` / `rejected` con `resolved_by = 'owner'`) sia permessa solo all'owner della trasferta che offre la tratta.
- **Perché** — scoperto pianificando T05. I quattro usecase impongono "solo il proprietario accetta o rifiuta" e "solo il richiedente annulla" confrontando un `actorId` passato da chi chiama: in RAM non c'è nulla che lo imponga, e non deve esserci. Ma `MatchRequestRepository.save` è un **upsert con id fornito dal chiamante**, quindi un client che chiama il repository invece dell'usecase può sovrascrivere qualunque riga, compresa quella di un collega, saltando tutti e quattro i controlli. È la stessa falla già registrata per `trips` (voce *"RLS di scrittura su `trips` vincolate all'owner"*), su un'altra tabella e con due attori invece di uno. I criteri attuali di T08 coprono la lettura ("non può leggere i dati di un altro") e l'accettazione su offerte non proprie, ma non la scrittura diretta di una riga altrui.
- **Impatto** — migrazioni SQL di T08, che è già un checkpoint ⛔. Nessun effetto sul codice TypeScript. Si lega al punto 4 della voce *"Annullamento, riempimento e visibilità della nota"*, che riguarda la **lettura** della nota: qui si tratta della scrittura.
- **Costo** — S.
- **Stato** — proposta

### La cascata e il reintegro scrivono N righe una alla volta
- **Cosa** — un'operazione di aggiornamento **in blocco** sulle candidature di una tratta (un metodo in più su `MatchRequestRepository`, o una funzione lato DB), al posto del ciclo "leggi la lista, salva riga per riga".
- **Perché** — scoperto pianificando T05. Le due transizioni pilotate dal sistema (auto-rifiuto al riempimento, reintegro quando i posti tornano > 0) si implementano come `listByLeg` seguita da una `save` per ogni riga interessata. In RAM è gratis; su Supabase sono 1 + N round-trip per una sola accettazione, su un free tier dove l'egress è contato, e soprattutto **N scritture indipendenti**: se la terza fallisce, le prime due restano applicate e la tratta resta a metà. Una scrittura sola rende il fallimento parziale impossibile invece che gestito.
- **Impatto** — `core/ports/match-request-repository.ts` (metodo **additivo**, non rompe firme, ma è un ⛔ sul contratto), i due adapter, la suite di contratto, e gli usecase di T05 come chiamanti. Si lega alla voce *"Atomicità e idempotenza dell'accettazione"*: quella lega stato e posti, questa lega fra loro le righe della stessa cascata.
- **Costo** — M.
- **Stato** — proposta

### `src/__tests__/` è fuori dal grafo dei confini
- **Cosa** — o dichiarare `src/__tests__/**` come elemento nel grafo di `eslint-plugin-boundaries` (con un suo insieme di import permessi), o attivare `boundaries/no-unknown-files` così che un file fuori dagli elementi dichiarati faccia fallire il lint.
- **Perché** — scoperto pianificando T05. I pattern di `boundaries/elements` coprono `src/core/**`, `src/adapters/**`, `src/ui/**` e `src/config/**`; `src/__tests__/harness.test.ts` non corrisponde a nessuno, e le due reti anti-adapter di `no-restricted-imports` sono applicate solo a `src/core/**` e `src/ui/**`. Quella cartella è quindi l'unico punto dell'albero in cui **qualunque** import è permesso: un test che vi finisse potrebbe cablare `ui/` con `adapters/` e il lint tacerebbe. Non è un difetto attuale (contiene un solo test dell'harness, senza import), ed è anche l'unico posto dove un test end-to-end in RAM sarebbe *lecito* — ragione in più per decidere la regola invece di scoprirla usandola.
- **Impatto** — `app/eslint.config.js`. Reversibile, nessun effetto sul codice applicativo. Da provare violando la regola, come per F1.4.
- **Costo** — S.
- **Stato** — **accettata e schedulata dall'umano il 23 ottobre 2026: è un criterio di `T07h`.**

### RLS di scrittura su `trips` vincolate all'owner
- **Cosa** — criterio di accettazione in più per T08: le policy di **INSERT e UPDATE** su `trips` devono imporre `owner_id = auth.uid()`.
- **Perché** — rilievo del reviewer su T04. `TripRepository.save` ha semantica **upsert** e l'`id` lo fornisce chi chiama (decisione di T04, presa proprio per non aggiungere un port e non incorrere in un ⛔). Conseguenza: un chiamante che passa il `tripId` di un collega **ne sovrascrive la trasferta**, e nel core non c'è nulla che lo impedisca — né deve esserci, è il DB il posto giusto. I sette criteri attuali di T08 non lo coprono: dicono "un utente non può modificare le trasferte altrui", che una policy scritta solo su UPDATE lascia aggirabile da un upsert con id altrui.
- **Impatto** — migrazioni SQL di T08, che è già un checkpoint ⛔. Nessun effetto sul codice TypeScript.
- **Costo** — S.
- **Stato** — proposta

### Il vincolo di T07d non guarda il capo non richiesto della trasferta
- **Cosa** — decidere se la compatibilità debba confrontare **anche** il capo che non si sta chiedendo: oggi chi chiede l'andata vede confrontati solo i due `departureAt`, e il proprio `returnAt` può stare a sei giorni da quello dell'offerente.
- **Perché** — dichiarato dal developer di T07d, non trovato da `verify`, che era verde. Il caso dei numeri del task è chiuso perché cambiano i plant (Pomigliano→Grottaglie contro Pomigliano→Foggia). Resta aperta la variante con **gli stessi plant e lo stesso giorno di partenza**: tratta di un giorno, trasferta dichiarata di sei, candidatura sull'andata → **accettata**, e T06 accredita comunque sei giorni di noleggio evitati, perché la base di calcolo è la trasferta del passeggero. **Non è un difetto di T07d:** il vincolo scelto è per definizione quello dei vincoli duri di `findMatches`, e `findMatches` **proporrebbe** quell'offerta — stringere qui vorrebbe dire rifiutare qualcosa che l'app ha suggerito, cioè proprio ciò che il task si vietava.
- **La decisione è di prodotto e ha due vie, con prezzi diversi.** Confrontare anche il capo non richiesto rompe *"ho chiesto solo l'andata"*, che è la ragione per cui le due tratte sono offerte indipendenti. Lasciare il vincolo dov'è e **limitare lato KPI** i giorni accreditabili a quelli della tratta effettivamente condivisa è una modifica a T06, non a T07d, e non toglie niente all'utente.
- **Impatto** — `core/usecases/request-seat.ts` oppure `compute-company-kpi.ts`. Il comportamento attuale è **pinnato** dal test *"il confronto è sul capo della direzione"*: se si cambia, quel test cambia con una decisione scritta e non in silenzio.
- **Costo** — S nell'usecase, M se la correzione va lato KPI.
- **Stato** — proposta

### L'indipendenza del reviewer non è strutturale come `OFFICINA.md` dichiara
- **Cosa** — decidere cosa fare del fatto che il reviewer **può scrivere file**: `OFFICINA.md` dichiara *"l'indipendenza del reviewer è strutturale, non dichiarata: non ha strumenti di scrittura"*, ma fra i suoi strumenti c'è la shell, e con la shell si scrive.
- **Perché** — scoperto nella review di T07d, il 23 ottobre 2026, e non da un incidente: il reviewer ha prodotto il suo rilievo più importante **eseguendo i mutanti**, cioè modificando il sorgente, lanciando i test e ripristinando. Il rilievo è corretto, il lavoro è stato restituito pulito e l'ho verificato io sul working tree (`git diff --numstat` della dimensione attesa, entrambi i rami della riga mutata intatti). Ma due enunciati del sistema sono falsi come sono scritti: il reviewer **non** è privo di strumenti di scrittura, quindi la sua impossibilità di *"scivolare nel ruolo di chi ha scritto il codice"* è una convenzione e non una proprietà della macchina; e la regola *"non manipolare file di testo con comandi di shell"* è stata aggirata proprio dall'agente che dovrebbe farla rispettare.
- **Il punto delicato è che la sonda era utile.** Senza eseguire i mutanti, N1 non sarebbe uscito: due mutanti sopravvissuti su otto sono precisamente la differenza fra un task verde e un task verificato. Quindi la via non è togliere la sonda, è decidere **chi la esegue e con quali reti**. Tre forme: (a) il reviewer **chiede** la sonda e la esegue il developer, con il reviewer che ne legge l'esito — costa un giro e conserva l'indipendenza; (b) il reviewer la esegue, e l'orchestratore **verifica il working tree dopo ogni review** come ho fatto qui, trasformando la convenzione in un controllo; (c) una sonda di mutazione diventa uno **step di `verify`** su un insieme dichiarato di mutanti, e allora non la esegue nessun agente a mano.
- **Impatto** — `OFFICINA.md` (l'enunciato sull'indipendenza, che oggi promette più di quello che il sistema ottiene), `CLAUDE.md` (la regola sulla shell), e `.claude/agents/reviewer.md`. **Nessun effetto sul codice applicativo.** Una modifica alle deny rules o agli strumenti del reviewer è un ⛔: la decide l'umano.
- **Costo** — XS per (a), S per (b), M per (c).
- **Stato** — **decisa dall'umano il 23 ottobre 2026: forma (a)** — se al reviewer serve una sonda, la
  chiede nel verdetto e la esegue il developer. `OFFICINA.md` e `CLAUDE.md` sono stati corretti nello
  stesso giro: la frase sull'indipendenza non dice più *"non ha strumenti di scrittura"*, che era falsa,
  ma *"non modifica il codice"*, con l'episodio e la regola scritti sotto. La forma (c) — una sonda di
  mutazione come step di `verify` — **resta aperta** come proposta: sarebbe la rete più forte e non
  dipenderebbe da chi si ricorda di chiedere.

### Una proiezione sola da `Trip` a `TripRequest` e `SeatOffer`, in `core/domain`
- **Cosa** — una funzione pura condivisa che, data una trasferta e una direzione, produca la faccia "richiesta" (`TripRequest`) e la faccia "offerta" (`SeatOffer`), più un criterio su T12/T13 che imponga di passare da lì.
- **Perché** — rilievo del reviewer su T07d. La faccia **offerta** è proiettata dagli adapter e la suite di contratto la pinna con date distinte (`repository-contract.ts`: rientro con plant invertiti e `departureAt === returnAt`). La faccia **richiesta** invece **non esiste in produzione**: oggi vive solo come assunzione dentro un test (`richiestaDel` in `request-seat.test.ts`), su come T12/T13 costruiranno `TripRequest`. Se T13 la costruisse **senza invertire i plant sul rientro**, la proprietà di non-regressione di T07d svanirebbe **in silenzio** e nessun test di quel file lo direbbe: il vincolo resterebbe verde mentre la schermata cerca il rientro sulla tratta sbagliata. È l'unico punto di auto-riferimento che resta nel task.
- **Impatto** — `core/domain` (funzione nuova), `findMatches` e i suoi chiamanti come consumatori, criteri su T12/T13. Additivo, nessuna firma rotta.
- **Costo** — S adesso, M se scoperto quando T13 esiste.
- **Stato** — proposta

### Un fake le cui fixture non distinguono due campi rende invisibile una classe di mutanti
- **Cosa** — regola per i fake condivisi dei test: quando un predicato sceglie **fra due campi**, le fixture devono rendere quei due campi **distinguibili**, altrimenti nessun test può accorgersi che il codice legge quello sbagliato. Dove serve, un test di conformità sul fake che lo dichiari.
- **Perché** — è il meccanismo esatto di N1 su T07d. Nel fake degli usecase l'offerente aveva `departureAt` alle 07:00 e `returnAt` alle 17:00 **dello stesso giorno UTC**; il predicato confronta il giorno, quindi i due capi erano lo stesso valore e **due mutanti su otto sopravvivevano** con 418 test verdi. La suite di contratto non ha il problema — lì le due date sono in giorni diversi e pinnate come stringhe letterali — quindi la lacuna è **solo nei fake di `core/usecases`**, che non hanno lo stesso standard. Si lega a **T07g**, che alza lo standard della suite di contratto, e alla voce sui fake condivisi dei port.
- **Il contrario della regola, da sapere prima di "aggiungere copertura".** Non ogni riga senza test è una lacuna: in `trasfertaCompatibile` le due guardie difensive sul capo dell'offerente (`=== null` e l'istante illeggibile) **non sono pinnate da nessun test, e non devono esserlo** — cancellarle non produce un mutante eseguibile ma un **errore di typecheck** sotto `strict`, perché `parseUtcInstant` non accetta `null` e `.date` non si legge su un risultato nullable. Lì la verifica è il compilatore, che è la rete più forte delle due. Se un domani qualcuno cerca copertura su quelle righe, la risposta è *"sono già verificate"*, **non** allentare il tipo per poterle testare.
- **Impatto** — `core/usecases/request-test-fakes.ts` e il modo di scrivere le fixture. Nessun cambio di interfaccia.
- **Costo** — XS come regola, S se si vuole un test di conformità sul fake.
- **Stato** — proposta

### Su `memory` niente impedisce a un test di contratto di agire con l'identità sbagliata
- **Cosa** — far sì che `AmbienteDiContratto` in RAM **registri** l'identità corrente e che gli adapter memory **rifiutino** le scritture e le letture altrui dove le RLS di T08 le rifiuteranno. Così un test di contratto scritto come se le RLS non esistessero diventa **rosso su `memory`**, non a T09.
- **Perché** — rilievo del reviewer dopo la review di T07e, dove questa classe di difetto si è manifestata: un test dei massimi scriveva e leggeva la riga di un altro profilo restando autenticato come il primo, ed era **verde a 448 test**. L'ha trovato una lettura, non `verify`. Su Supabase quel test sarebbe rosso in due punti, e la diagnosi arriverebbe nel momento peggiore — a T09, con l'apparenza di un port sbagliato quando il port è sano, o peggio con la tentazione di allentare la policy per far passare un test. Oggi la rete è **convenzione più reviewer**: la convenzione è rispettata in una dozzina di punti del file di contratto, ma niente la impone.
- **Impatto** — `adapters/contract` e l'ambiente dell'adapter memory, più gli adapter in RAM per i controlli di appartenenza. Solo file di test e adapter memory: **nessun effetto sul codice di produzione**. Si lega a **T07g**, che alza lo standard della suite di contratto, ed è il presidio strutturale di `memory.contract.test.ts`, che già dichiara che l'hook di identità esiste *"perché aggiungerlo dopo imporrebbe di riscrivere la suite"*.
- **Costo** — M.
- **Stato** — **accettata e schedulata dall'umano il 23 ottobre 2026: è un criterio di `T07g`**, non un
  task a sé, perché tocca gli stessi file e alza lo stesso standard. Porta T07g da S/M a M.

### Una lettura negata dalle RLS sarà indistinguibile da "nessun massimo"
- **Cosa** — decidere, a T08 o T09, se una lettura **negata** dei massimi debba essere distinguibile da una riga assente, oppure se il contratto *"riga assente → zeri in `ok`"* valga anche per il rifiuto.
- **Perché** — rilievo del reviewer su T07e. La scelta *"riga assente = zeri in `ok`"* è sana in RAM e dichiarata nel doc del port, con un argomento vero per costruzione: gli zeri non assegnano badge, perché `awardBadges` rifiuta una soglia `< 1`. Ma a T09, sotto le RLS di T08, una lettura **negata** produrrà anch'essa `ok(zeri)`: un errore di **autorizzazione** si presenterebbe come un **dato legittimo**. Oggi irrilevante — l'usecase legge solo il proprio profilo, e in realtà non legge affatto — ed è proprio per questo che va deciso prima che qualcuno costruisca una schermata sopra quel silenzio. Non è coperta dalla voce *"Se la scrittura dei massimi fallisce, la dashboard personale perde i badge"*, che riguarda la scrittura.
- **Impatto** — doc del port, adapter Supabase, criteri di T08/T09. Nessun cambio di firma se la decisione è *"resta così e lo si dichiara"*.
- **Costo** — XS per decidere, S se la negata deve diventare un errore tipizzato.
- **Stato** — proposta

### Il test dei duplicati sul percorso nuovo copre tre badge su sei
- **Cosa** — portare la fixture del test dei duplicati di `refresh-personal-bests.test.ts` a **tutti e sei** i badge, su due esecuzioni, così un test solo si legge come il criterio.
- **Perché** — rilievo del reviewer su T07e, e **non è un buco**: la proprietà forte è conservata per costruzione (si itera il catalogo, non si accumula), l'accumulo fra due esecuzioni è escluso da un test, e il ramo conducente è coperto dal test di T07 sulla funzione. Il criterio è quindi soddisfatto **in composizione**. Ma il test che dovrebbe leggersi come *"i duplicati restano non rappresentabili"* esercita solo i tre badge da passeggero: un id ripetuto nel ramo **conducente** del catalogo non lo vedrebbe. Stessa famiglia della voce *"Un test diretto del criterio «primo viaggio» con la config di produzione"*: la catena è completa, ma nessun test somiglia alla frase che deve garantire.
- **Impatto** — una fixture in `refresh-personal-bests.test.ts`. Nessun codice di produzione.
- **Costo** — XS.
- **Stato** — proposta

### Il giorno del confronto è quello UTC, non il giorno nel fuso di chi viaggia
- **Cosa** — decidere se *"stesso giorno"* significhi stesso giorno **UTC** (oggi) o stesso giorno nel fuso di chi viaggia, in `findMatches` e nel vincolo di T07d che lo rispecchia.
- **Perché** — dichiarato dal developer di T07d. `parseUtcInstant` espone `date` come giorno UTC, `calendar.ts` conta i giorni su quella stessa stringa, e i vincoli duri di `findMatches` confrontano quella. In Italia (UTC+1/+2) una partenza fra mezzanotte e le due locali cade nel giorno UTC **precedente**: due colleghi che partono alle 01:00 e alle 03:00 locali dello stesso giorno stanno in due giorni UTC diversi e **non si incontrano mai**, qualunque sia la tolleranza oraria.
- **Perché non è un allarme, e va detto per non farlo diventare urgente a sproposito:** una trasferta di lavoro parte alle 6 o alle 7 del mattino, quindi oggi il caso è irraggiungibile con dati realistici. È un'asimmetria da **decidere** prima che qualcuno la incontri con un seed notturno o una demo su orari insoliti, non un difetto da correggere adesso.
- **Impatto** — `core/domain/instant.ts` (o un fuso dichiarato in `config/`), `findMatches`, il vincolo di T07d, e i criteri di T13 che ordinano e filtrano per data. Nessun cambio di firma se la decisione è *"resta UTC e lo si dichiara in schermata"*. Si lega a `T07f`, che è il punto in cui la forma dell'istante viene toccata.
- **Costo** — XS se la decisione è dichiarare, M se il giorno diventa locale.
- **Stato** — proposta

### La suite di contratto non pinna `listByLeg` su una tratta inesistente
- **Cosa** — un test nella suite di contratto che fissi cosa risponde `listByLeg` quando la tratta non esiste (per esempio il rientro di una trasferta senza rientro): lista vuota in `ok`, non `not-found`, e lo stesso su entrambi gli adapter.
- **Perché** — scoperto pianificando T07e. Il doc del port descrive *quali* candidature `listByLeg` restituisce, ma non dice niente sulla tratta assente, e nessuno dei test di contratto la interroga: in RAM il filtro su una `Map` dà `[]`, su PostgREST una `select` con due `eq` dà zero righe, quindi **oggi i due adapter concordano per caso, non per contratto**. Chi scrive un usecase che enumera le tratte di una trasferta (T07e lo fa per leggere le candidature ricevute, T14 lo farà per la schermata) deve scegliere fra fidarsi di un comportamento non pinnato o duplicare la regola *"il ritorno esiste solo se `returnAt` non è nullo"* — che è esattamente la regola che vive già in `TripRepository.save` e in `listOpenOffers`. Si lega a **T07g**, che alza lo standard della suite.
- **Impatto** — `adapters/contract/repository-contract.ts` (test additivo, nessuna asserzione esistente toccata) e il doc di `MatchRequestRepository.listByLeg`. Nessun cambio di firma.
- **Costo** — S.
- **Stato** — proposta

### `PersonalBests` è strutturalmente identico a `PersonalStats`, e il compilatore non li distingue
- **Cosa** — rendere il tipo dei massimi **distinguibile** dal tipo delle statistiche correnti (brand, tipo opaco, o un campo marcatore), e far sì che `awardBadges` accetti solo ciò che è dichiarato come massimo.
- **Perché** — conseguenza dichiarata della pianificazione di T07e. Il criterio chiede un tipo con un **nome proprio** e che `awardBadges` **non cambi firma**: le due cose insieme obbligano i massimi a restare strutturalmente assegnabili a `PersonalStats` (stesse quattro metriche più `profileId`). Il nome protegge chi legge, non chi scrive: passare le statistiche correnti dove serve il massimo — cioè il difetto che il task esiste per impedire — **compila**. Oggi il rischio è contenuto perché l'unico punto di composizione è un usecase solo; diventa reale quando T15 avrà in mano entrambi i valori nella stessa schermata. Stessa famiglia di *"Istante normalizzato UTC come tipo brandizzato"* e di *"`Trip` come tipo opaco"*, su un tipo nuovo.
- **Impatto** — `core/domain/personal-bests.ts`, la firma di `awardBadges` (quindi **rompe un'interfaccia**: è un ⛔), `refreshPersonalBests` e i test di T07. Reversibile.
- **Costo** — S se fatto subito dopo T07e, M dopo che T15 esiste.
- **Stato** — proposta

### I massimi storici non hanno una via di correzione
- **Cosa** — decidere se esista un modo di **abbassare o azzerare** un massimo (operazione di amministrazione, migrazione dichiarata, o niente affatto), e scriverlo dove lo troverà chi se lo chiederà.
- **Perché** — scoperto pianificando T07e. La monotonia è l'invariante del task: per costruzione nessun percorso dell'app può far scendere un massimo. Il rovescio è che un massimo **sbagliato** è permanente — un seed dimostrativo generoso (T17), una candidatura accettata per errore, un bug di `computePersonalStats` corretto dopo — e con lui il badge che ne deriva. Non è un difetto del task: è il prezzo della proprietà che il task compra, e va reso visibile prima che qualcuno lo scopra con dati in mano. Si lega alla decisione dell'umano su T08 (*"la monotonia è anche lato DB?"*): se lo è, la correzione richiede comunque credenziali di servizio.
- **Impatto** — nessun codice applicativo se la decisione è *"non si corregge, e lo si dichiara"*; una procedura di migrazione in T08 e una nota in T17 altrimenti. Nessun cambio di firma.
- **Costo** — XS per dichiarare, S per una procedura.
- **Stato** — proposta

### Se la scrittura dei massimi fallisce, la dashboard personale perde i badge
- **Cosa** — decidere cosa mostra T15 quando `refreshPersonalBests` ritorna `storage-failed`: niente badge, i badge calcolati sulle statistiche correnti (degrado dichiarato in schermata), o l'ultimo massimo letto senza alzarlo.
- **Perché** — conseguenza della decisione dell'umano del 23 ottobre 2026 sul trigger: i massimi li alza il percorso di **lettura** della dashboard, quindi un guasto in scrittura rende indisponibile anche la **lettura** dei badge. Le tre vie non sono equivalenti: calcolare i badge sulle statistiche correnti riapre esattamente il buco del badge che si ritira (per una volta sola, e senza che nessuno lo sappia); una sezione vuota è onesta ma in demo sembra *"non hai badge"*; mostrare il massimo letto senza alzarlo è il degrado migliore ma richiede che il port abbia una lettura separata dalla scrittura — che con la forma pianificata in T07e **ce l'ha** (`findByProfile`). Va deciso prima che T15 scriva la schermata, non durante.
- **Impatto** — criteri di T15 e il contratto di `refreshPersonalBests` (un errore in più o un esito degradato nel tipo di ritorno). Additivo se deciso prima di T15.
- **Costo** — S.
- **Stato** — proposta
