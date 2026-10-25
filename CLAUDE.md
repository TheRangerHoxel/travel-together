# Officina Software — regole operative

Regole valide per ogni progetto dell'officina. Vincolanti, non consigli.
Il funzionamento del sistema a fasi è in [OFFICINA.md](OFFICINA.md).

**Gerarchia di priorità, in quest'ordine:**
verifica forte > reversibilità > osservabilità > performance > tutto il resto.

Quando due regole sembrano in conflitto, vince quella più in alto in questa lista.

---

## Git e reversibilità

- Lavora su `auto/build`. **Mai su `main`.** `main` lo mergia l'umano.
- Commit **solo** a `verify` verde. Un task = un commit. Il messaggio cita l'id del task.
  Formato: `T03: descrizione breve` oppure `F1.2: descrizione breve`.
- Test rossi → **correggi in avanti**, non rollbackare: non è stato pubblicato niente di rotto.
- Commit verde che si rivela sbagliato dopo → `git revert <sha>`. **Mai** `reset --hard`.

**Vietati in automatico:** `git push --force`, `git reset --hard`, `git clean -fdx`, push su `main`,
commit di file credenziali. Tre reti sovrapposte li fermano: deny rules, hook `PreToolUse`,
branch protection su `main`.

Non disabilitare, modificare o aggirare l'hook guard e `.claude/settings.json`. Se un comando serve e
l'hook lo blocca, **chiedi all'umano**, non rimuovere il freno.

## Verifica

Un solo comando: `npm run verify` = `lint` + `typecheck` + `test:unit` + `test:int` + `smoke`.

- **DoD di un task:** `verify` verde **e** tutti i criteri di accettazione del task soddisfatti.
- Un test che non può girare **fallisce rumorosamente**. Non si salta in verde, non si marca skip
  silenzioso: un verde falso è peggio di un rosso.
- Non modificare un test per farlo passare. Se il test è sbagliato, dillo e spiega perché.
- **Un commento che promette più di quello che il codice ottiene è un difetto**, e il reviewer lo boccia
  come boccia un test che non può fallire. Vale per gli invarianti dichiarati impossibili ma
  raggiungibili, per le garanzie di sicurezza sovrastimate e per le previsioni su task futuri: qualcuno
  le rileggerà come garanzie e ci costruirà sopra.

## Scope

- Fai **solo** ciò che è nel task corrente di `TASKS.md`. Niente feature "utili" non richieste.
- Un miglioramento che ti viene in mente → una voce in `IDEAS.md`, e **avanti col task**.
- Le proposte in `IDEAS.md` **non entrano nello scope da sole**. Solo l'umano le approva; quando le
  marca `accettata` diventano task in `TASKS.md`. Finché non lo sono, per il loop non esistono.
- Niente duplicati in `IDEAS.md`: se l'idea c'è già, non riscriverla.
- **Prima di aprire un task, rileggi i suoi criteri contro il modello attuale.** Criteri scritti prima
  di un cambio di modello producono codice **verde e sbagliato**: in Fase 2 cinque criteri su otto di
  T05 erano diventati sbagliati senza che nessun test lo dicesse. Se sono obsoleti si riscrivono
  **prima**, non durante.

## Circuit breaker

Dopo **3 round senza progresso** sullo stesso task: **fermati ed escala all'umano.**
Scrivi in `PROGRESS.md` cosa hai provato e perché non è passato. Non ritentare all'infinito.

"Senza progresso" = `verify` resta rosso sullo stesso punto, o il reviewer boccia per la stessa ragione.

## Osservabilità

Aggiorna `PROGRESS.md` **a ogni ciclo**: cosa hai fatto, cosa è fallito, perché, decisioni prese.
È il registro che permette all'umano di capire cosa è successo senza rileggere i diff.

## Checkpoint umani ⛔

Fermati e chiedi **prima** di:

- cambi di schema DB o migrazioni
- nuove dipendenze (qualsiasi, non solo quelle pesanti)
- modifiche a contratti, interfacce pubbliche o API
- installazioni di software
- qualsiasi azione irreversibile

## Domande all'umano

Ogni dubbio, perplessità o decisione aperta si pone **come domanda a risposta multipla**
(`AskUserQuestion`), non come prosa. L'umano non deve rileggere un testo lungo per capire cosa gli
viene chiesto di specificare.

- La **raccomandazione** è la prima opzione, marcata `(Raccomandato)`.
- Il contesto che serve a decidere sta **dentro l'opzione** (descrizione, o `preview` per confronti
  concreti), non in un paragrafo da leggere prima.
- **Non** si scrive un'opzione "Altro": il campo a risposta libera lo aggiunge lo strumento da sé, ed
  è sempre disponibile all'umano.
- Massimo 4 domande per giro. Se i dubbi sono più di quattro si pongono i più **bloccanti** e si dice
  quali restano fuori.
- Ciò che l'agente può decidere da sé **non** diventa una domanda: si decide, si dichiara in una riga
  e si va avanti. Le domande sono per ciò che cambia il lavoro e che solo l'umano può sciogliere.

Vale per i dubbi, non per i resoconti: l'esito di un task si riporta normalmente, e le decisioni
prese restano in `PROGRESS.md`.

## Brief ai subagent

- **Un divieto di modifica deve nominare il motivo.** Quattro volte in Fase 2 un divieto ha prodotto
  una soluzione peggiore del rischio che evitava, perché *"non toccare il task X"* è stato letto come
  *"non toccare nemmeno i suoi test"*: ne sono uscite una duplicazione, un port inventato e un wrapper
  inutile. Non vietare meno: dire **perché**.
- **Un divieto su un file di test condiviso quasi mai protegge lo scope:** i fake non sono scope, sono
  strumenti. Se un fake è troppo debole per il task nuovo, la modifica **additiva** è la soluzione
  giusta, e la prova da pretendere è *"gli altri file che lo usano restano verdi senza essere
  modificati"* — un fake modificato male non rompe la compilazione, rompe il **significato** dei test
  di qualcun altro.
- **Chiedi di dichiarare** le deviazioni dal brief, le sonde non eseguite e i cambi di comportamento.
  In Fase 2 i difetti veri sono emersi da **dichiarazioni volontarie**, non da `verify`: una sonda non
  fatta e dichiarata è recuperabile, una non fatta e taciuta no.
- **Se un vincolo del brief costringe a duplicare o a inventare, il subagent si ferma e lo dice.**
  Scrivilo nel brief: è l'unica rete contro i divieti sbagliati di chi lo scrive.
- **Non manipolare file di testo con comandi di shell.** Tre episodi in due giorni: un identificatore
  di una lettera (`R` = `Invoke-History`) che ha cancellato sei file, un round-trip di encoding che ha
  riempito un `.md` di mojibake, un BOM in un `.ts`. Usa gli strumenti di modifica; per una
  trasformazione, Python con l'encoding esplicito; e **controlla che il diff sia della dimensione
  prevista** — un diff più grande del previsto è il segnale.
- **Un testo multilinea o con virgolette non si passa come argomento a un comando nativo: si scrive un
  file e si passa il percorso.** PowerShell 5.1 sgualcisce le virgolette doppie, e il comando riceve il
  testo **spezzato sugli spazi**: un `git commit -m` così è fallito con ogni parola del messaggio
  interpretata come un pathspec. È stato innocuo solo perché git si rifiuta di fare le cose a metà.
- **Al reviewer non si chiede di mutare il sorgente.** Se gli serve una sonda, la chiede nel verdetto e
  la esegue il developer: il motivo è in [OFFICINA.md](OFFICINA.md), sotto i tre agenti.

## Interruzioni e ripresa

**Il loop non si risveglia da sé.** L'agente agisce su eventi: un messaggio dell'umano, un subagent che
finisce, o una sveglia programmata **prima**. Un limite di sessione interrompe il turno e **nessuno
riprova**, perché il reset non è un evento che qualcuno ascolta. L'interruzione non si può rendere
impossibile: si rende **economica**.

- **All'inizio di ogni sessione di loop si arma un heartbeat** (`CronCreate`, ricorrente, ogni 15
  minuti su minuti non tondi). Scatta solo a sessione inattiva: se trova un subagent fermato da un limite
  di utilizzo lo fa ripartire con `SendMessage`, se il loop è fermo senza una domanda all'umano in
  sospeso esegue il passo successivo, altrimenti non fa niente. È il risveglio che il reset del limite
  non dà da solo. **Limiti dichiarati:** l'heartbeat vive quanto il processo di Claude Code — se la
  finestra viene chiusa, la ripresa resta manuale — e **scade da solo dopo 7 giorni**: una sessione più
  lunga lo riarma (`CronList` per controllare che ci sia). Non scavalca i checkpoint ⛔.
- **Il lavoro approvato si committa subito.** Un task verde e approvato dal reviewer **non** resta nel
  working tree mentre si fa altro: è l'unica cosa che un'interruzione può distruggere. Con questa
  regola si perde al massimo un giro di review in corso, che si rifà.
- **Su una macchina nuova, o dopo un `git pull` che cambia `tools/setup.py`:** `py tools/setup.py` dalla
  radice (Node e Supabase CLI in `tools/`, versioni e SHA256 fissati nello script, binari fuori da git),
  poi `npm ci` in `app/`. Gli strumenti stanno **dentro il repo** perché il lavoro si alterna fra due
  macchine; in ogni shell si mettono `tools/node` e `tools/supabase` in testa al PATH. Il `.env` non
  viaggia: va creato su ciascuna macchina.
- **Ripresa, in quest'ordine:** `CLAUDE.md`, `OFFICINA.md`, la **coda** di `PROGRESS.md`, `TASKS.md`,
  poi `git log -1` e `git status`, poi `npm run verify`. Lo stato vero è **il registro più il working
  tree**: non si ricostruisce a memoria, e non si riparte dal report di un subagent — un report dice
  cosa un agente credeva di aver fatto, il working tree dice cosa c'è.
- **`verify` non è eseguibile fuori da questa macchina.** `test:int` richiede le credenziali di staging
  in `.env`, che è in `.gitignore`. Quindi una ripresa automatica **in cloud non può chiudere un
  task**: non può ottenere `verify` verde, e a verify rosso non si committa. Una ripresa programmata ha
  senso solo **locale**.

## Sicurezza

- `.env` in `.gitignore`. Segreti e config fuori dal codice, iniettati a runtime.
- Mai committare: `.env*`, keystore (`*.jks`, `*.keystore`), `*.pem`, `*.p12`, chiavi `service_role`.
- Nel codice non devono comparire chiavi letterali, nemmeno nei test o nei commenti.
- Il reviewer **segnala ogni nuova dipendenza**, con nome, motivo e peso.

## Modularità

Confini netti, dipendenze in una direzione sola, niente import circolari.
Dependency inversion sui punti che cambieranno: il core dipende da interfacce, non da implementazioni.
Un modulo = una responsabilità.

**La modularità è un criterio di accettazione, non un consiglio.** Dove è esprimibile come regola di
lint, è il lint a imporla e `verify` a fallire. Dove non lo è, il reviewer boccia.

## Performance e token

- Model routing per ruolo: planner e reviewer su modello forte, developer su modello economico.
- Delega a subagent le operazioni rumorose (lettura log, ricerche, output verbosi).
- Questo file resta snello. Le istruzioni lunghe vanno in skill on-demand, non always-on.
- Parallelismo **solo** con git worktree isolati, uno per agente. Altrimenti sequenziale.
