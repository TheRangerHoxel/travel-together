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
- **Stato** — proposta

### Rendere l'unicità dei `tripId` una garanzia della macchina
- **Cosa** — o `findMatches` ritorna un `MatchError` `duplicate-offer-id`, o il port dichiara l'unicità e la suite di contratto la verifica.
- **Perché** — rilievo del reviewer su T03: l'ordine totale usa `tripId` come ultima chiave, quindi se due offerte lo condividessero il comparatore tornerebbe `0` e il criterio "nessuna dipendenza dall'ordine di input" cadrebbe per quella classe di input — oltre a mostrare la stessa trasferta due volte. Oggi la precondizione è dichiarata nel doc, garantita a monte da uno storage indicizzato per id, e **non verificata da nessun test**: è un presupposto non protetto in una funzione il cui output pilota una schermata.
- **Impatto** — `core/usecases/find-matches.ts` oppure `adapters/contract`. Reversibile.
- **Costo** — S.
- **Stato** — proposta

### Stringere il lint su `config/` e sull'orologio
- **Cosa** — due regole: togliere `'config'` da `GRAFO.usecases` riammettendolo solo per `src/core/**/*.test.ts`; ed estendere il selettore anti-orologio a `MemberExpression[object.name='Date']`.
- **Perché** — rilievo del reviewer su T03. La prima: la regola "il core di produzione non importa `config/`" è oggi affidata al giudizio di chi rivede, ma `CLAUDE.md` dice che dove è esprimibile come lint deve imporla il lint — e qui lo è. La seconda: il selettore attuale cattura `new Date()` e `Date.now()`, ma lascia passare `Date.parse` e `Date.UTC`; sono deterministici, però `Date.parse` su forme non-ISO è *implementation-defined* e Hermes e V8 non si comportano allo stesso modo — cioè proprio la scorciatoia che `instant.ts` esiste per evitare.
- **Impatto** — `app/eslint.config.js`. Reversibile. Da provare violando entrambe le regole, come per F1.4.
- **Costo** — S.
- **Stato** — proposta

### Preferenza di matching per genere
- **Cosa** — filtro opzionale per condividere l'auto solo con colleghi dello stesso genere.
- **Perché** — il documento la cita come leva di adozione per gli utenti più riservati, ed è un bisogno reale su un viaggio di 2–3 ore con uno sconosciuto.
- **Impatto** — `core/domain` (profilo), `core/usecases` (vincoli di matching), UI preferenze. Reversibile. Non rompe interfacce se aggiunta come preferenza opzionale. **Sotto GDPR il genere è dato particolarmente delicato**: su un pilota con persone vere richiede base giuridica e informativa.
- **Costo** — S sul codice, L sulla conformità.
- **Stato** — proposta

### Matching di gruppo
- **Cosa** — il sistema accorpa più trasferte compatibili e propone **chi** dovrebbe noleggiare, invece di attendere che qualcuno abbia già l'auto.
- **Perché** — massimizza i noleggi evitati: nel modello asimmetrico attuale, se nessuno ha ancora noleggiato, nessun match avviene. È il caso in cui il risparmio è più grande.
- **Impatto** — riscrive `findMatches` da funzione di ricerca a problema di assegnazione. Tocca il cuore del prodotto. Reversibile solo prima che la UI dipenda dalla forma dei risultati.
- **Costo** — L.
- **Stato** — proposta

### Integrazione SAP Concur
- **Cosa** — intercettare la richiesta auto dentro il workflow travel e proporre il pooling in quel momento.
- **Perché** — è la novità vera della proposta originale: il matching come suggerimento contestuale e non invasivo, non come app da aprire di propria iniziativa. Senza questo, l'adozione dipende dalla buona volontà.
- **Impatto** — nuovo adapter dietro `TripRepository`; il core non cambia (è esattamente ciò per cui esiste la dependency inversion). Richiede accesso API che oggi non abbiamo.
- **Costo** — L, e bloccato da un vincolo esterno.
- **Stato** — proposta

### Distanze reali e percorsi su mappa
- **Cosa** — sostituire la tabella statica di distanze con distanze calcolate, e mostrare il percorso.
- **Perché** — CO₂ e saving più credibili, e abilita le deviazioni di percorso (prendere un collega lungo la strada).
- **Impatto** — nuova dipendenza esterna con quote o costi, contro il vincolo "tutto gratuito". `config/` e `core/usecases` (KPI).
- **Costo** — M.
- **Stato** — proposta

### Notifiche push sulle candidature
- **Cosa** — avvisare chi offre posti quando arriva una candidatura, e il richiedente quando viene accettato.
- **Perché** — senza notifiche il flusso richiede che l'utente riapra l'app per scoprire cosa è successo: è il punto dove un'app di coordinamento muore.
- **Impatto** — nuovo port `Notifier` con adapter Expo Notifications. Non rompe nulla se aggiunto dietro interfaccia.
- **Costo** — M.
- **Stato** — proposta

### Le letture di lista omettono le righe invalide invece di passarle
- **Cosa** — nei repository, far saltare dalle liste le righe che violano gli invarianti di dominio, come già si fa per l'offerta con owner senza profilo.
- **Perché** — rilievo del reviewer su T02. Oggi `findById` valida ma le liste no, quindi l'enunciato "un `Trip` che arriva da un port è valido" è vero per una lettura e falso per l'altra. Il caso concreto che lo rende serio: `listOpenOffers` proietta senza validare, quindi una riga corrotta con `seatsTotal: 2` e `seatsAvailable: 5` diventa **un'offerta pubblicata con cinque posti**, entra in `findMatches` e ci resta — e il collega scopre il problema quando si candida. Omettere tiene insieme il degrado proporzionato e la garanzia che ciò che attraversa il port è valido.
- **Impatto** — `adapters/*`. Nessun cambio di interfaccia. Il costo è la perdita silenziosa, cioè lo stesso problema di osservabilità della voce qui sotto.
- **Costo** — S.
- **Stato** — proposta

### Port di osservabilità (`Logger` / `Telemetry`)
- **Cosa** — un port per registrare i degradi silenziosi, con adapter console in sviluppo.
- **Perché** — rilievo del reviewer su T02: esistono già tre rami che degradano **senza lasciare traccia** — l'offerta con owner mancante omessa, la riga invalida che attraversa una lista, lo `storage-unavailable` tradotto. In tutti e tre non manca il tipo d'errore: manca il canale per accorgersene. In una demo dal vivo, un'offerta che sparisce senza spiegazione è indistinguibile da un bug del matching.
- **Impatto** — nuovo port in `core/ports`, adapter in `adapters/`. Non rompe interfacce esistenti. Si lega alla voce "hook di guasto nella suite di contratto".
- **Costo** — M.
- **Stato** — proposta

### CHECK constraint nel DB a specchio degli invarianti di `Trip`
- **Cosa** — in T08, vincoli SQL che replicano gli invarianti di `makeTrip`: `has_car = false ⇒ seats_total = 0`, `seats_available BETWEEN 0 AND seats_total`.
- **Perché** — rilievo del reviewer su T02: oggi quegli invarianti vivono solo in `makeTrip`, cioè nel client. Nel DB nulla impedisce la riga che li viola — una migrazione, uno script di seed o una query eseguita a mano la inserirebbero senza resistenza. T05 ha già un criterio su due accettazioni concorrenti che non devono portare i posti sotto zero: la difesa definitiva su quello è lato DB, non lato client.
- **Impatto** — migrazioni SQL di T08. Reversibile. Nessun effetto sul codice TypeScript.
- **Costo** — S, e va deciso dentro T08 che è già un checkpoint ⛔.
- **Stato** — proposta

### Hook di guasto nella suite di contratto
- **Cosa** — aggiungere `guasta()` / `ripristina()` ad `AmbienteDiContratto` e un test di contratto che verifichi il ramo `storage-unavailable` su entrambi gli adapter.
- **Perché** — rilievo del reviewer su T02: il percorso d'errore dei repository è **l'unico comportamento del port che nessun test tocca**. Oggi `storage-unavailable` è dichiarato nel tipo ma non prodotto né asserito da nessuna parte, quindi non sappiamo se i due adapter lo tratterebbero allo stesso modo — ed è proprio il caso che si manifesterà in demo, con il proxy aziendale di mezzo.
- **Impatto** — `adapters/contract` e l'ambiente di ciascun adapter. Reversibile, non rompe interfacce.
- **Costo** — S su memory, M su supabase (serve un modo di simulare il guasto).
- **Stato** — proposta

### `Trip` come tipo opaco, per rendere il costruttore inaggirabile
- **Cosa** — separare `TripFields` (campi grezzi, input) da `Trip` (tipo brandizzato, output di `makeTrip`), così il compilatore impedisce di costruire un `Trip` saltando la validazione.
- **Perché** — rilievo del reviewer su T01: oggi `makeTrip(campi: Trip): Result<Trip, …>` ha input e output dello stesso tipo, quindi qualunque modulo può scrivere un letterale e aggirare gli invarianti. Il commento nel codice ora lo dichiara, ma una raccomandazione non è una garanzia. Conta soprattutto per gli adapter, che materializzano `Trip` da storage: un record invalido che arriva dal DB non è meno invalido di uno scritto a mano.
- **Impatto** — `core/domain` e **ogni** adapter che ricostruisce entità. Reversibile, ma **rompe la firma**: farlo dopo T02 è un checkpoint ⛔.
- **Costo** — S adesso, M dopo T02.
- **Stato** — proposta

### Derivare `PlantId` e `BadgeId` dai rispettivi array
- **Cosa** — `const PLANT_IDS = [...] as const; type PlantId = (typeof PLANT_IDS)[number]`, invece di dichiarare union e array separatamente.
- **Perché** — rilievo del reviewer su T01: oggi l'annotazione `readonly PlantId[]` protegge una direzione sola. Un valore sbagliato nell'array non compila, ma **aggiungere un membro alla union senza aggiungerlo all'array non produce alcun errore**: l'array diventa silenziosamente incompleto, e un futuro ciclo su `PLANT_IDS` (seed T17, KPI per stabilimento T06) salterebbe una sede senza fallire. Nota: `as const` non ricade nel divieto di `as` delle convenzioni, che riguarda l'assertion usata per zittire il compilatore — qui restringe i letterali e *aumenta* il controllo.
- **Impatto** — `core/domain/plant.ts` e `badge.ts`. Reversibile, non rompe interfacce.
- **Costo** — S.
- **Stato** — proposta

### Classificazione dell'errore quando mancano sia auto sia capienza
- **Cosa** — decidere quale errore vince quando più invarianti di `Trip` sono violati insieme.
- **Perché** — rilievo del reviewer su T01: `hasCar: false, seatsTotal: 0, seatsAvailable: 2` viene respinto correttamente, ma con `seats-available-exceeds-total`, mentre la causa leggibile per l'utente è "non hai l'auto". Non è un difetto di correttezza — nessun dato invalido passa — è il messaggio che la UI mostrerà a essere fuorviante.
- **Impatto** — `core/domain/trip.ts` e la mappatura errori → testi italiani. Da valutare quando quella mappatura esisterà (T11–T12), non prima.
- **Costo** — S.
- **Stato** — proposta

### Deny rules anche sui `.claude/` annidati
- **Cosa** — estendere le deny rules da `./.claude/**` a `**/.claude/**` e `**/AGENTS.md`, così la prima rete copre anche le cartelle di configurazione che arrivano dentro un pacchetto scaricato.
- **Perché** — scoperto in F1.3: il template Expo crea `app/.claude/settings.json` (che abilita un plugin di Claude Code) e `app/AGENTS.md` (istruzioni all'agente). Le deny rules attuali usano percorsi relativi alla radice e **non** li coprono; li ha intercettati solo l'hook, che fa match sulla sottostringa `.claude/settings` ovunque compaia. Le reti sovrapposte hanno funzionato — ma una delle due aveva un buco, e conviene chiuderlo invece di contare sull'altra.
- **Impatto** — solo `.claude/settings.json` dell'officina. Reversibile. Nessun effetto sul codice applicativo. Da valutare se il rumore sui falsi positivi (ogni pacchetto che spedisce un `AGENTS.md`) valga la copertura.
- **Costo** — S.
- **Stato** — proposta

### Sovrapposizione del rientro come terza componente di punteggio
- **Cosa** — aggiungere `returnAt` a `SeatOffer` e usare la sovrapposizione della durata della trasferta nel punteggio di `findMatches`, con pesi dichiarati in `config/`.
- **Perché** — il `PRD.md` elenca **tre** componenti di punteggio morbido (vicinanza dell'orario, sovrapposizione della durata, stesso plant di appartenenza), ma `SeatOffer` espone solo `departureAt`: la seconda è oggi inesprimibile e i criteri di T03 in `TASKS.md` non la citano. Chi legge il PRD e poi il codice trova una componente mancante senza spiegazione. Sul prodotto conta: due colleghi che partono insieme ma rientrano a tre giorni di distanza condividono solo l'andata, e il punteggio oggi non lo distingue.
- **Impatto** — `core/domain/seat-offer.ts` (campo nuovo), `TripRepository.listOpenOffers` e i due adapter (la proiezione deve portare `returnAt`), `findMatches` e la suite di contratto. **Rompe l'interfaccia `SeatOffer`**: dopo T09 è un checkpoint ⛔. Richiede anche di rendere espliciti i pesi fra le tre componenti, che oggi non esistono perché la dominanza fra plant e orario è ottenuta per costruzione.
- **Costo** — M.
- **Stato** — proposta

### Istante normalizzato UTC come tipo brandizzato
- **Cosa** — un tipo `Instant` (stringa brandizzata) prodotto da un unico parser in `core/domain`, al posto di `departureAt: string` su `Trip`, `SeatOffer` e `TripRequest`.
- **Perché** — la decisione di T02 (`PROGRESS.md`) è che il confronto lessicografico fra istanti è corretto **solo** su stringhe normalizzate UTC con la `Z`: `2026-11-03T07:00:00+01:00` e `2026-11-03T06:00:00Z` sono lo stesso istante e due stringhe diverse. Oggi il tipo è `string`, quindi la garanzia vive nelle convenzioni e in un controllo a runtime ripetuto da ogni consumatore (T03 lo fa, T04 dovrà rifarlo). Con un tipo brandizzato la validazione avviene una volta al confine e il compilatore impedisce di confrontare una stringa non normalizzata. È la variante dell'idea "`Trip` come tipo opaco" applicata al tempo, dove l'errore è più insidioso perché il dato *sembra* giusto.
- **Impatto** — `core/domain` (nuovo modulo + tre entità), ogni adapter che materializza entità, i fixture dei test. Reversibile ma **rompe le firme**: dopo T02 è un checkpoint ⛔.
- **Costo** — M.
- **Stato** — proposta

### Escludere dai match le offerte già partite
- **Cosa** — far sparire dalle proposte le offerte il cui `departureAt` è nel passato, decidendo **dove**: un vincolo in più in `findMatches` con l'istante passato come dato, oppure un filtro nell'orchestratore che legge il `Clock`.
- **Perché** — `findMatches` è pura e non ha orologio per scelta, quindi oggi un'offerta di ieri resta un match valido a tempo indeterminato. T04 impedisce di *creare* una trasferta nel passato, ma non impedisce al tempo di passare dopo la creazione: con il seed di T17 e una demo mostrata giorni dopo, la schermata dei match può proporre un viaggio già avvenuto. Nessuno dei tredici criteri di T03 lo copre, quindi non è un difetto di T03 — è una decisione mancante.
- **Impatto** — se entra in `findMatches`, cambia la firma (quarto/quinto parametro) e va deciso prima che T13 dipenda dalla forma; se resta nell'orchestratore, nessuna firma cambia ma la regola finisce fuori dal core, dove nessun test puro la copre. Reversibile.
- **Costo** — S.
- **Stato** — proposta

### Repo separati per progetto
- **Cosa** — quando arriverà il progetto #2, spostare ogni progetto in un repo proprio.
- **Perché** — oggi `auto/build` è condiviso tra officina e progetti: con due progetti attivi, i commit si mescolano e il revert perde precisione.
- **Impatto** — struttura del repo, configurazione `.claude`, remote. Reversibile ma laborioso.
- **Costo** — M.
- **Stato** — proposta
