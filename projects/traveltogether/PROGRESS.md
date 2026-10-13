# PROGRESS — TravelTogether

Registro di esecuzione. Aggiornato **a ogni ciclo**: cosa è stato fatto, cosa è fallito, perché,
quali decisioni sono state prese. Serve a ricostruire la storia senza rileggere i diff.

Formato di ogni voce: data · task · esito · cosa è fallito e perché · decisioni.

---

## 2026-10-12 — Fase 0 · Idea → Spec

**Esito:** file di Fase 0 prodotti, in attesa del cancello ⛔.

**Fatto**
- Intervista in tre giri: idea, vincoli infrastrutturali, dettagli del dominio.
- Letto il documento `TravelTogheter.docx` (proposta interna Leonardo, BU Aerostrutture).
- Prodotti: `CLAUDE.md` e `OFFICINA.md` dell'officina, `.gitignore`, `.claude/settings.json`,
  i tre agenti, l'hook `guard-git.py`, e per il progetto `PRD.md`, `ARCHITECTURE.md`, `TASKS.md`,
  `IDEAS.md`, questo file e il `CLAUDE.md` di progetto.

**Verificato, non assunto**
- Macchina: solo **Python 3.12.3**. `git`, `node`, `npm`, `docker`, `gh` **assenti**; nessun diritto
  di amministratore. → git diventa il prerequisito F1.1, Docker è escluso, Supabase locale impossibile.
- Free tier letti sulle pagine ufficiali: Supabase (500 MB DB, 2 progetti attivi, **pausa a 1 settimana
  di inattività**) ed Expo (15 build Android/mese, 1.000 MAU per gli update OTA).
- Hook `guard-git.py` provato su **28 casi**: 28/28 corretti. Verifica la logica del guard, **non** il
  suo cablaggio in Claude Code — quello si prova in F1.2 eseguendo un comando vietato.

**Decisioni prese**
- Stack Expo/React Native + TypeScript su Supabase. Determinante il vincolo no-admin: EAS Build
  compila in cloud, quindi non serve toolchain Android locale.
- Hook scritto in **Python e non in PowerShell**: un `.py` non è soggetto all'ExecutionPolicy, che su
  Windows Enterprise gestito può essere imposta via GPO.
- Reviewer **senza strumenti di scrittura**: l'indipendenza dal developer diventa strutturale invece
  che dichiarata.
- Confini di modularità imposti dal **lint** invece che dal giudizio del reviewer.
- Tagli allo scope decisi con l'umano: fuori SAP Concur, alberi piantati, buoni welfare. Dentro i badge.

**Aperto / da decidere**
- Dove si scarica l'APK: il repo è privato, quindi le GitHub Release non sono pubbliche.
- Se i telefoni della demo sono aziendali e gestiti via MDM, il sideload di un APK potrebbe non passare.

**Prossimo passo:** ⛔ approvazione dei file di Fase 0, poi F1.1 (installazione di git e Node).

---

## 2026-10-12 — F1.1 · Prerequisiti (parziale, **bloccato su git**)

**Esito:** Node installato e funzionante. **git bloccato da policy aziendale.** Task non chiuso.

**Fatto**
- Package id fissato dall'umano: `com.softwareoffice.traveltogether` (aggiornato in `ARCHITECTURE.md` e T18).
- Node LTS **v24.21.0 "Krypton"** scaricato da nodejs.org, **SHA256 verificato** contro
  `SHASUMS256.txt` ufficiale (corrisponde), estratto in `%LOCALAPPDATA%\Programs\nodejs`,
  aggiunto al PATH **utente** (nessun admin richiesto).
- Verificato: `node --version` → v24.21.0 · `npm --version` → 11.19.0.

**Fallito, e perché**
- **Zscaler** (proxy aziendale) blocca i download dalle release GitHub:
  - `PortableGit-...7z.exe` → interstiziale "Are you sure you want to visit this site?",
    categoria "Professional Services", filetype exe. Richiede un **click umano in un browser**.
  - `MinGit-...64-bit.zip` → connessione chiusa dall'host, poi **403** forzando TLS 1.2.
- Non è un problema tecnico da aggirare: è una policy aziendale, e la decisione spetta all'umano.
  Il download di git va fatto **a mano dal browser**, dove l'interstiziale si può accettare.

**Verificato perché determinante per lo stack**
- `npm ping` → **PONG 515 ms**; `registry.npmjs.org` raggiungibile (4,1 MB di metadati scaricati).
  Lo stack Expo/npm sopravvive al proxy: il blocco riguarda **solo** le release GitHub.

**Rischi nuovi, da tenere d'occhio**
- `gh` (GitHub CLI) è distribuito anch'esso come asset di release GitHub → probabilmente bloccato.
  Il repo privato va quindi creato **dall'umano dal browser**, come già previsto in F1.2.
- MinGit **non include** Git Credential Manager. Per autenticarsi a GitHub serve un PAT; da preferire
  `credential.helper wincred` (store cifrato di Windows) rispetto a `store` (file in chiaro).
- Da verificare a T18: se il proxy blocca anche il download dell'APK prodotto da EAS Build.

---

## 2026-10-12 — F1.1 · Prerequisiti · **COMPLETO** ✅

**Esito:** tutti i criteri di accettazione soddisfatti, nessun privilegio di amministratore usato.

| Criterio | Risultato |
|---|---|
| `git --version` | git version 2.56.0.windows.2 |
| `node --version` ≥ 20 | v24.21.0 |
| `npm --version` | 11.19.0 |
| `eas --version` | eas-cli/24.12.1 win32-x64 |
| Nessun admin | confermato: tutto in `%LOCALAPPDATA%\Programs`, PATH utente |

**Come è stato sbloccato git**
L'umano ha scaricato a mano `MinGit-2.56.0.2-64-bit.zip` dal browser, accettando l'interstiziale
Zscaler. **SHA256 verificato** contro l'hash pubblicato nelle note di release ufficiali:
`da35e72aa21c005a5a0d298cfbae110bc1609a815730ea0dde84b01a1b3cd3be` — corrisponde.
Estratto in `%LOCALAPPDATA%\Programs\MinGit`.

**Correzione a un'annotazione precedente**
MinGit **include** Git Credential Manager (`git-credential-manager.exe` e `git-credential-wincred.exe`).
Per il push non serve un PAT in chiaro: GCM gestisce il flusso OAuth dal browser.

**Igiene repo:** `.gitignore` esteso con `MinGit-*.zip`, `PortableGit-*.exe`, `node-v*-win-x64.zip`,
così gli archivi di installazione scaricati a mano non finiscono nel repo.

---

## 2026-10-12 — F1.2 · **BLOCCATO: serve riavvio della sessione**

**Fatto**
- `git init -b main` eseguito: repo inizializzato in `C:/D/Python Projects/officina-software/.git/`.
- `.gitignore` verificato con `git check-ignore`: `MinGit-*.zip` e `*.docx` sono ignorati.
  `git status` elenca solo i 5 path previsti (`.claude/`, `.gitignore`, `CLAUDE.md`, `OFFICINA.md`, `projects/`).

**Scoperto provando, non leggendo — due problemi, stessa causa**

1. **L'hook guard non è attivo in questa sessione.** `.claude/settings.json` è stato creato
   *durante* la sessione, e Claude Code legge hook e deny rules all'avvio. Prova: `git add
   secrets/app.keystore` (caso coperto **solo** dall'hook, non dalle deny rules) non è stato
   intercettato — è arrivato fino a git. Quindi i criteri di F1.2 sui freni **non sono ancora
   verificati**, e non vanno dati per buoni.
2. **Il PATH aggiornato non raggiunge i processi figli.** La modifica è persistita correttamente nel
   registro (entrambe le voci presenti), ma il processo Claude Code è partito prima e i nuovi shell
   ereditano il suo ambiente. Ogni comando richiede un prefisso PATH esplicito per trovare `git`.

**Scoperta collaterale:** esiste una **quarta rete** non prevista nel piano — il classificatore interno
di Claude Code ha bloccato `git push origin HEAD:main` con motivo `[Git Destructive]`, indipendentemente
dalla nostra configurazione.

**Configurato dopo che l'umano ha fornito i dati**
- `user.name = therangerhoxel`, `user.email = alessandro.cinque.smart@gmail.com`,
  `credential.helper = manager` (GCM, incluso in MinGit) — tutto **repo-local**, non globale:
  la configurazione git del resto della macchina non viene toccata.
- `remote.origin.url = https://github.com/TheRangerHoxel/travel-together.git`

**Commit creati** (branch `auto/build`)
- `406d7e2` — F1.2: commit iniziale con i file di Fase 0 (14 file, nessun codice applicativo)
- `7dd8e05` — F1.2: `.gitattributes` per normalizzare i fine riga a LF

`main` è fermo a `406d7e2`; `auto/build` è a `7dd8e05`. Working tree pulito.

**Perché `.gitattributes` adesso e non dopo**
`core.autocrlf` era `true` (default di MinGit): git convertiva LF↔CRLF in modo implicito. Su un
progetto JS questo riempie i diff di righe che nessuno ha toccato e fa litigare lint e prettier con
git. Fissarlo prima che arrivi il codice costa zero; dopo richiede un commit di rinormalizzazione su
tutto l'albero. F1.2 ha quindi due commit invece di uno: deliberato, preferito a un `--amend`.

**Mancante per chiudere F1.2 — tutto dipende dal riavvio**
- [ ] Riavvio sessione: carica hook e deny rules, e risolve il PATH ereditato
- [ ] Verifica dei freni **eseguendo** i comandi vietati (il criterio centrale di F1.2)
- [ ] Verifica che `$CLAUDE_PROJECT_DIR` si risolva su Windows; altrimenti percorso assoluto
- [ ] `git push -u origin main` — **lo fa l'umano**: l'agente non pusha su main
- [ ] Branch protection su `main` — lo fa l'umano su GitHub
- [ ] `git push -u origin auto/build` — lo fa l'agente, ed è anche la prova che il freno
      non blocca il flusso normale

---

## 2026-10-12 — F1.2 · verifica dei freni dopo il riavvio · **ANCORA BLOCCATO** ⛔

**Esito:** il riavvio ha risolto il PATH, **non** l'hook. Deny rules attive, **hook guard inerte**.
F1.2 resta aperto: i criteri sui freni non sono verificabili finché l'hook non scatta.

**Verificato eseguendo, non leggendo**

| Sonda | Rete attesa | Risultato |
|---|---|---|
| `git add secrets/app.keystore` | **solo hook** | ❌ **passato** fino a git (`pathspec did not match`) |
| `git add --force probe-nonexistent.keystore` | deny rules | ✅ bloccato: `Permission to use PowerShell ... denied` |
| `Read(.env)` | deny rules | ✅ bloccato: `denied by your permission settings` |
| `Read(.gitignore)` (controllo) | nessuna | ✅ letto, quindi il blocco su `.env` è la deny rule e non un errore di path |

Il caso discriminante è il primo: `git add secrets/app.keystore` è coperto **solo** dall'hook.
È arrivato a git. Quindi l'hook non interviene, e non è stato nemmeno il classificatore interno a
fermarlo (il suo messaggio è diverso, e qui non c'è stato alcun messaggio di blocco).

**Causa accertata: `$CLAUDE_PROJECT_DIR` non si risolve su Windows**

```
$env:CLAUDE_PROJECT_DIR  →  stringa vuota
python -I "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-git.py"
  →  can't open file 'C:\.claude\hooks\guard-git.py': [Errno 2] No such file or directory  (exit 2)
```

La variabile si espande a vuoto e il percorso collassa su `C:\.claude\...`, che non esiste.
Spiegazione più probabile: su Windows il comando dell'hook passa per `cmd.exe`, dove la sintassi
`$VAR` non è espansione di variabile ma testo letterale.

**La logica del guard è sana: il problema è solo il cablaggio.**
Invocato col percorso assoluto e stdin reale, sullo stesso caso discriminante risponde corretto:

```json
{"permissionDecision": "deny",
 "permissionDecisionReason": "Tentativo di mettere in staging un file di credenziali. ..."}
```

Nota su un falso allarme da evitare in futuro: passando l'evento con una pipe di stringa PowerShell
(`'{...}' | python`), stdin arriva vuoto e il guard risponde `ask` con "evento illeggibile". È il suo
fallback corretto — non un bug — ma non va confuso con un `deny`. I test vanno fatti con un file reale
su stdin (`cmd /c type ev.json | python ...`).

**Fix necessario, e perché non l'ho applicato io**
In `.claude/settings.json`, `hooks.PreToolUse[0].hooks[0].command` deve diventare:

```
python -I "C:\D\Python Projects\officina-software\.claude\hooks\guard-git.py"
```

Non l'ho toccato: `Edit`/`Write` su `.claude/settings.json` sono vietati dalle deny rules, dall'hook
stesso e da `CLAUDE.md` ("non si rimuove il freno, si chiede all'umano"). La modifica la fa l'umano.
Che il freno protegga se stesso anche quando è rotto è il comportamento giusto, non un intralcio.

**Seconda ipotesi da escludere dopo il fix**
Se con il percorso assoluto l'hook resta inerte, la causa non è il path ma la registrazione: gli hook
di progetto richiedono approvazione esplicita (`/hooks`), mentre le deny rules dello stesso file sono
attive comunque. Sarebbe coerente con quanto osservato. Si distingue solo riprovando la sonda.

**Decisione:** fermo qui e non procedo. Un freno non verificato va trattato come assente, e il resto
di F1.2 include proprio i push. Prossimo passo: l'umano corregge `command`, si riavvia la sessione,
si ripete la sonda `git add secrets/app.keystore` e si pretende il messaggio di `guard-git.py`.

---

## 2026-10-12 — F1.2 · **REGRESSIONE: settings.json invalido, deny rules cadute** 🔴

**Esito:** il percorso assoluto è stato messo, ma senza escaping JSON. Il file non parsa più e
Claude Code ha scartato **l'intera** configurazione. Ora non c'è **nessun** freno locale attivo.

**Cosa è stato scritto**
```json
"command": "python -I \"C:\D\Python Projects\officina-software\.claude\hooks\guard-git.py\""
```
In JSON `\D`, `\P`, `\o`, `\.`, `\h`, `\g` non sono escape validi:
```
json.decoder.JSONDecodeError: Invalid \escape: line 55 column 39 (char 1724)
```

**Prova che le deny rules sono cadute** — stesso comando, stessa sessione, prima e dopo la modifica:

| Momento | `git add --force probe-nonexistent.keystore` |
|---|---|
| prima (JSON valido) | ✅ `Permission to use PowerShell ... has been denied` |
| adesso (JSON invalido) | ❌ **passato** a git (`pathspec did not match`) |

**Due lezioni, entrambe non ovvie**
1. Un `settings.json` malformato non degrada: **azzera tutto**. Le deny rules funzionavano e sono
   sparite insieme all'errore di sintassi dell'hook. Un file di configurazione dei freni va validato
   (`python -m json.tool`) **prima** di considerarlo attivo.
2. Il file è **riletto a caldo**: le deny rules erano attive a inizio sessione e sono cadute senza
   riavvio. Quindi dopo il fix conviene ritentare la sonda subito, prima di assumere che serva
   un riavvio per gli hook.

**Fix:** usare gli slash in avanti, che Windows e Python accettano e che non hanno trappole di escaping:
```json
"command": "python -I \"C:/D/Python Projects/officina-software/.claude/hooks/guard-git.py\""
```

Anche con i freni spenti non ho modificato `settings.json`: è esattamente la situazione in cui
approfittare di un freno rotto sarebbe il comportamento sbagliato. Resta in mano all'umano.

---

## 2026-10-12 — F1.2 · **FRENI VERIFICATI** ✅

**Esito:** con `command` corretto a slash in avanti, il JSON torna valido e **tutte e due** le reti
locali sono attive. Verificato eseguendo i comandi vietati, non leggendo i file.

| Criterio F1.2 | Sonda | Rete che ha fermato | Esito |
|---|---|---|---|
| hook cablato | `git add secrets/app.keystore` | **hook** (solo lui copre questo caso) | ✅ |
| `git reset --hard` bloccato | idem | **hook**, messaggio specifico | ✅ |
| `git push --force` bloccato | `git push --force origin auto/build` | **hook**, messaggio specifico | ✅ |
| push su `main` bloccato | `git push origin main` | **hook**, messaggio specifico | ✅ |
| deny rules attive | `Read(.env)` (l'hook non ispeziona le letture) | **deny rules** | ✅ |
| commit iniziale su `main` | `git log --oneline --all` | — | ✅ `406d7e2 (main)` |
| branch corrente | `git branch --show-current` | — | ✅ `auto/build` |
| `.env` non tracciato | `git status --porcelain` | — | ✅ assente |

I messaggi di blocco sono quelli di `guard-git.py` (`PreToolUse:PowerShell hook error: ...` con il
testo del `permissionDecisionReason`), **non** il blocco generico del classificatore: è questo che
distingue "hook attivo" da "fermato da qualcos'altro".

Prima delle sonde distruttive ho copiato `PROGRESS.md` non committato nello scratchpad. Si è rivelato
superfluo — i freni hanno tenuto — ma il costo era nullo e l'alternativa era scommettere.

**`$CLAUDE_PROJECT_DIR`: conclusione**
Non si risolve nel comando dell'hook su questa macchina. Il percorso assoluto con **slash in avanti**
è la forma che funziona e che non ha trappole di escaping JSON. Da usare come default su Windows.

**Conseguenza operativa scoperta ora: l'agente non può committare `settings.json`.**
La regola `\.claude[\\/](?:hooks|settings)` dell'hook blocca anche `git add .claude/settings.json`.
È coerente con il principio (il loop non tocca i propri freni) e va accettata, non aggirata: le
modifiche a `settings.json` le committa l'umano. Da non "risolvere" con un `git commit -a`, che
passerebbe solo perché la stringa del comando non nomina il file.

**Falso positivo annotato, nessuna azione**
Il classificatore interno ha bloccato `git ls-remote origin` come `[Git Destructive]`, pur essendo
in sola lettura. Non è una nostra regola e non si disattiva; va solo saputo, per non confonderlo con
un problema di rete o di credenziali.

**Stato del remoto**
`git ls-remote --heads origin` → exit 0, nessun branch elencato. Il repo GitHub esiste, è
raggiungibile, le credenziali funzionano (GCM) ed è **vuoto**: nessun push è ancora avvenuto.

**Manca solo l'umano per chiudere F1.2**
- [x] `git push -u origin main` — lo fa l'umano, l'agente non pusha su main
- [x] Branch protection su `main` su GitHub, poi il criterio "push diretto su main rifiutato dal server"
- [x] Commit di `.claude/settings.json` (l'hook impedisce all'agente di metterlo in staging)
- [x] Poi l'agente fa `git push -u origin auto/build`: ultimo criterio di F1.2, e prova che il freno
      non blocca il flusso normale

---

## 2026-10-12 — F1.2 · Repo, branch e freni · **COMPLETO** ✅

**Esito:** tutti i criteri di accettazione soddisfatti. Le tre reti sono in piedi e provate.

**Fatto dall'umano**
- `git push -u origin main` → `refs/heads/main` a `406d7e2` sul remoto. GCM ha gestito l'OAuth.
- Branch protection su `main` configurata su GitHub.
- `288946b` — F1.2: hook guard con percorso assoluto a slash in avanti.

**Fatto dall'agente**
- `git push -u origin auto/build` → `* [new branch] auto/build -> auto/build`, tracking impostato.

| Criterio F1.2 | Esito |
|---|---|
| `git log --oneline` mostra il commit iniziale su `main` | ✅ `406d7e2 (origin/main, main)` |
| `git branch --show-current` risponde `auto/build` | ✅ |
| `git status` non elenca `.env` | ✅ |
| `git push --force` bloccato dall'hook, messaggio leggibile | ✅ |
| `git reset --hard` bloccato dall'hook | ✅ |
| `git push origin main` bloccato dall'hook | ✅ |
| `git push origin auto/build` **funziona** | ✅ |
| Push diretto su `main` rifiutato dal server | ✅ osservato, vedi sotto |

**Terza rete: rifiuto osservato, non dedotto**
Ruleset `main protetto` su GitHub: enforcement `Active`, **bypass list vuota**, target `main`,
regole `Require a pull request before merging` + `Block force pushes` + `Restrict deletions`.
Prova eseguita dall'umano dal suo terminale:

```
git push origin auto/build:main
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Changes must be made through a pull request.
 ! [remote rejected] auto/build -> main (push declined due to repository rule violations)
```

`git ls-remote` dopo il tentativo: `main` fermo a `406d7e2`. Il rifiuto non ha lasciato nulla dietro.

**Il primo test proposto era invalido: va ricordato, non cancellato**
Il tentativo precedente era `git push --force origin 406d7e2:main`, scelto perché no-op (`main` era
già a `406d7e2`) e quindi innocuo se la protezione fosse mancata. Ha risposto `Everything up-to-date`:
git ha visto il ref remoto già coincidente e **non ha contattato il server**. Un push che non aggiorna
alcun ref non può essere rifiutato, quindi il test dava lo stesso output con la protezione attiva e
con la protezione assente — zero potere discriminante.

La regola generale che ne esce: **un test di un freno deve poter fallire.** Se è costruito per essere
innocuo al punto da non produrre l'evento che il freno dovrebbe intercettare, non misura il freno:
misura solo sé stesso. Vale per le prove dell'hook quanto per i test di `verify`, ed è lo stesso
principio per cui F1.4 pretende di vedere il lint diventare rosso violando ogni regola.

**Limite strutturale, confermato**
Le tre reti sono in serie, quindi le prime due impediscono all'agente di collaudare la terza:
`git push origin auto/build:main` contiene `main` e l'hook lo ferma prima di GitHub. La terza rete
è verificabile **solo** dall'umano. Non è un difetto da correggere, ma va saputo: su quel criterio
il sistema non può autocertificarsi, e se un giorno le prime due venissero disattivate è l'unica
che resta in piedi.

**Nota sul piano GitHub:** la branch protection su repo **privati** richiede storicamente un piano a
pagamento. Qui è stata configurata senza problemi, quindi il piano la consente. Se in futuro il repo
venisse ricreato su un account Free, la terza rete cadrebbe silenziosamente: da ricontrollare, non
da assumere.

**Perché questo commit non passa da `verify`**
`npm run verify` non esiste ancora: viene costruito in F1.7. Per i task di Fase 1 che precedono
l'harness il DoD sono i criteri di accettazione eseguiti a mano, come sopra. È l'unica finestra in cui
questo è legittimo, e si chiude con F1.7.

**Prossimo passo:** ⛔ cancello di F1.2. F1.3 (scaffold Expo + TypeScript strict) **non** è aperto:
porta dipendenze nuove, che sono un checkpoint umano.

---

## 2026-10-12 — F1.3 · Scaffold Expo + TypeScript strict · **COMPLETO** ✅

| Criterio | Risultato |
|---|---|
| `npx tsc --noEmit` esce 0 | ✅ exit 0 |
| Le cartelle esistono, ognuna con un file indice | ✅ 7 cartelle, 7 `index.ts` |
| `strict` e `noUncheckedIndexedAccess` attivi | ✅ verificati sulla **config risolta** |
| Nessuna dipendenza oltre a Expo + TypeScript | ✅ 6 dirette, esattamente quelle approvate |

**L'installazione in tre passi, per far approvare un numero e non un'intenzione**
Il problema di approvare "Expo" è che le 6 dipendenze dirette ne trascinano centinaia, e nessuno le
conosce prima di risolvere l'albero. Quindi: (1) `create-expo-app --no-install` scrive solo i file del
template, (2) `npm install --dry-run` stampa il totale senza toccare il disco → **467 pacchetti**,
(3) `npm install` vero, solo dopo l'ok. L'installazione reale ha aggiunto esattamente 467: il dry-run
non ha mentito. Da riusare come procedura per ogni dipendenza futura.

**Il template porta configurazione dell'agente — l'ha fermata l'hook**
`create-expo-app` ha creato anche `app/.claude/settings.json`, che abilita il plugin
`expo@claude-plugins-official`, e `app/AGENTS.md`, istruzioni rivolte all'agente. Nessuno dei due era
nel perimetro approvato: sono dipendenze **dell'ambiente dell'agente**, scaricate dalla rete e attive
da sole. Entrambi rimossi dall'umano.

Le deny rules **non** li coprivano (usano percorsi relativi alla radice); li ha intercettati l'hook,
che fa match sulla sottostringa `.claude/settings` ovunque compaia nel percorso. Verificato con una
sonda in lettura: bloccato. Le reti sovrapposte hanno fatto il loro mestiere, ma il buco nella prima
è reale → proposta in `IDEAS.md`, non implementata (tocca i freni, quindi è dell'umano).

Nota di attrito, risolta cancellando: `AGENTS.md` prescriveva Expo Router con le route in `src/app/`,
in conflitto con la struttura `app/src/{core,adapters,ui,config}` di `ARCHITECTURE.md` — ed è guida
generica, visto che `expo-router` non è nemmeno fra le dipendenze del template `blank-typescript`.

**`noUncheckedIndexedAccess` dimostrato violandolo, non leggendolo**
Un flag scritto nel `tsconfig.json` non prova nulla: il file eredita da `expo/tsconfig.base` e
l'ereditarietà può sovrascrivere. Due verifiche invece di una:
1. `tsc --showConfig` → `strict = True`, `noUncheckedIndexedAccess = True` nella config **risolta**
2. un file di prova con `const first: number = xs[0]` → `error TS2322: Type 'number | undefined' is
   not assignable to type 'number'`, exit 2. Rimosso subito, `tsc` torna a 0.

È la stessa regola imparata col test invalido della branch protection: **una verifica che non può
fallire non è una verifica.**

**22 vulnerabilità npm: registrate, non "risolte"**
`npm audit` → 15 high, 7 moderate. Le radici sono poche: `braces`/`micromatch` (ReDoS) via metro,
`node-forge` via `@expo/code-signing-certificates`, più `uuid` e `xcode`. **Tutte in tooling di
build** — bundler e CLI — non nel codice che finisce nell'APK, che contiene il bundle JS e non metro.

**Nessun fix è non-breaking:** per ognuna `fixAvailable` è un cambio di major. `npm audit fix --force`
declasserebbe `expo` e `react-native`, cioè uscirebbe dal perimetro approvato e romperebbe lo stack
per sanare un rischio che non raggiunge l'utente. **Non eseguito, deliberatamente.** Siamo già
sull'SDK più recente (Expo 57): non esiste una versione più sana da scegliere oggi.
Da rivalutare a T18, quando la build dell'APK renderà concreto cosa viene davvero spedito.

**Rischio noto per F1.4:** il template porta TypeScript `~6.0.3`, una major recente. Gli eslint plugin
potrebbero non supportarla. Se F1.4 fallisce lì, la causa è questa e non la configurazione del lint.

**Igiene verificata, non assunta:** `node_modules/` è ignorato (da `app/.gitignore`), e il
`.gitignore` di radice copre i segreti anche dentro `app/` — confermato con `git check-ignore` su
`app/.env`, `app/release.keystore`, `app/service-account.json`. In staging vanno 21 file, tutti attesi.

**Prossimo passo:** F1.4 (lint con regole di confine). Porta `eslint` + `eslint-plugin-boundaries`:
⛔ nuovo perimetro di dipendenze da approvare.

---

## 2026-10-12 — F1.4 · Lint con regole di confine · **COMPLETO** ✅

| Criterio | Risultato |
|---|---|
| `npm run lint` esce 0 sul codice pulito | ✅ exit 0 |
| File di prova in `core/` che importa `adapters/` → lint rosso | ✅ fermato da **due** regole |
| File di prova in `core/` che chiama `Date.now()` → lint rosso | ✅ `no-restricted-syntax`, su `Date.now()` **e** `new Date()` |
| File di prova in `ui/` che importa `adapters/` → lint rosso | ✅ fermato da **due** regole |
| I file di prova rimossi prima del commit | ✅ 4 prove rimosse, lint e typecheck tornano verdi |

Coperto anche il quarto vincolo di `ARCHITECTURE.md`: `core/` che importa `@supabase/supabase-js`
→ lint rosso.

**Perimetro approvato dall'umano:** `eslint`, `typescript-eslint`, `eslint-plugin-boundaries`,
`eslint-config-expo`. Dry-run prima dell'installazione: 89 pacchetti con i soli tre, **259** con
`eslint-config-expo`. Il delta di 170 è stato mostrato prima di decidere, non dopo.

**`eslint@10` è incompatibile con `eslint-config-expo` — diagnosticato, non indovinato**
Primo `npm run lint`: `TypeError: contextOrFilename.getFilename is not a function`.
Causa: `eslint-plugin-react@7.37.5`, annidato dentro `eslint-config-expo`, dichiara
`peer eslint: ... || ^9.7` — non supporta la 10. npm l'ha installata lo stesso perché il peer di
`eslint-config-expo` è troppo largo (`>=8.10`) e il conflitto è stato risolto annidando.

Correzione in avanti, non rollback: **eslint pinnato a `9.39.5`**, che soddisfa tutti e quattro i
pacchetti approvati. È un cambio di versione dentro il perimetro, non una dipendenza nuova.
Lezione: un `peerDependencies` largo non è una garanzia di compatibilità, è solo una dichiarazione
di chi pubblica. La compatibilità si verifica eseguendo.

**Lo script `postinstall` non è stato approvato, e non serviva**
`unrs-resolver@1.12.2` (via `eslint-config-expo` → `eslint-import-resolver-typescript`) chiede di
eseguire `node postinstall.js` all'installazione: è il vettore classico della supply chain, e npm 11
lo blocca per default. Installato **senza** concederlo, poi verificato: `require('unrs-resolver')`
carica il binding nativo correttamente (arriva dalle dipendenze opzionali precompilate).
Principio applicato: non si concede un permesso finché non è dimostrato necessario.

**`import/no-unresolved` disattivata, con motivo scritto nella config**
Il resolver TypeScript di `eslint-config-expo` espone un'interfaccia che la sua stessa versione di
`eslint-plugin-import` non sa caricare (`invalid interface loaded as resolver`). Non è un problema
nostro: è un'incoerenza interna a quel pacchetto. Disattivata perché `tsc --noEmit` (step `typecheck`
di `verify`) verifica la risolvibilità degli import con l'informazione di tipo completa, cioè meglio.
Una regola che grida al lupo su ogni file viene ignorata, ed è peggio di una regola assente.

**Due reti sui confini, non una**
`boundaries/dependencies` costruisce il grafo dei moduli; `no-restricted-imports` e
`no-restricted-syntax` (core di eslint, zero dipendenze) lavorano sulla **stringa** di import e non
richiedono risoluzione dei moduli. Se la configurazione del plugin avesse un buco, le seconde
reggono lo stesso. Nelle prove entrambe hanno segnalato, indipendentemente.
Sintassi migrata a quella v7 (`policies` con selettori a oggetto): la forma legacy funzionava ma
emetteva warning di deprecazione a ogni esecuzione, e il rumore costante erode il segnale.

**`default: 'disallow'`** è deliberato: un modulo nuovo nasce **isolato** invece che libero. Va
dichiarato cosa può importare, non cosa non può.

**25 vulnerabilità (1 critical) — valutate con prova, non con una stima**
La `critical` è `handlebars`, e **non** arriva da `eslint-config-expo`: arriva da
`eslint-plugin-boundaries` → `@boundaries/elements`. Verificato nel pacchetto come viene usato:
serve ai template nei selettori (`{{ variableName }}`), risolti su **la nostra stessa config** e sui
path dei file. Nessun input esterno lo raggiunge, e gira solo a lint-time, mai nell'APK.
`fixAvailable` è breaking per tutte. Non eseguito `npm audit fix --force`.

L'alternativa — rinunciare al plugin e tenere solo `no-restricted-imports` — è stata considerata e
scartata: scambierebbe una CVE dev-time contenuta con regole fragili sul vincolo architetturale più
importante del progetto. Una regola di confine che non intercetta `../../../adapters` fa più danno
di una CVE in un tool di sviluppo.

**Debito segnalato: `typescript-eslint` risulta inutilizzato.**
`eslint-config-expo` porta già `@typescript-eslint/parser` nelle proprie dipendenze, e
`eslint.config.js` non lo importa mai. Era sensato quando il perimetro erano tre pacchetti; è
diventato ridondante aggiungendo `eslint-config-expo`. **Non rimosso**: togliere una dipendenza è un
cambio di perimetro e lo decide l'umano.

**Prossimo passo:** F1.5 (test runner). Porta `jest`, `jest-expo`, `@testing-library/react-native`:
⛔ nuovo perimetro da approvare.

---

## 2026-10-12 — Correzione dei problemi aperti di F1.4

L'umano ha sospeso il cancello sulle installazioni **per questa sessione** e ha chiesto di chiudere
i problemi aperti. Registrato perché è una deroga, non la nuova regola: dal prossimo giro i
checkpoint sulle dipendenze tornano in vigore.

**CVE `critical` chiusa con un override chirurgico, non con `audit fix --force`**
`@boundaries/elements` pinna `handlebars` a `4.7.9`; la `4.7.10` è pubblicata e corretta.
Aggiunto in `package.json`:

```json
"overrides": { "handlebars": "4.7.10", "braces": "3.0.3", "micromatch": "4.0.8", "node-forge": "1.4.0" }
```

Risultato: 25 → 24 vulnerabilità, **critical a zero**. `lint` e `typecheck` restano verdi.

**Le 24 che restano: siamo al pavimento, non alla pigrizia**
Gli advisory radice sono solo tre, e per nessuno esiste un rimedio sensato:
- `braces@3.0.3` e `node-forge@1.4.0` sono **già le ultime pubblicate** e restano segnalate: non
  esiste una versione sana da installare.
- `uuid@7.0.3` arriva da `xcode@3.0.1`, il tool che manipola i progetti **iOS**. Compiliamo solo
  Android: quel codice non viene mai eseguito. Forzarlo a `14.x` romperebbe `xcode` (dalla v9 è
  sparito il default export) per zittire un avviso su un percorso che non percorriamo.

**`typescript-eslint` rimosso:** `eslint-config-expo` porta già `@typescript-eslint/parser` e la
config non lo importava mai.

---

## 2026-10-12 — F1.5 · Test runner · **COMPLETO** ✅

| Criterio | Risultato |
|---|---|
| `npm run test:unit` esegue almeno un test ed esce 0 | ✅ 3 test, exit 0 |
| Un test deliberatamente rotto fa uscire il comando ≠ 0 | ✅ exit 1, prova rimossa |
| `test:unit` non effettua **nessuna** chiamata di rete | ✅ **imposto**, vedi sotto |

**Il divieto di rete è imposto, non dichiarato**
Il criterio diceva "verificabile: gira con rete disattivata". Staccare la rete è però una verifica
che qualcuno deve *ricordarsi* di fare, e che quindi prima o poi non si fa. In `jest.setup.unit.js`
`fetch`, `XMLHttpRequest` e `WebSocket` sono sostituiti con funzioni che sollevano un errore che dice
cosa fare. Il vincolo fallisce da solo, a ogni esecuzione, e nomina la chiamata che ha tentato di uscire.

`src/__tests__/harness.test.ts` verifica **la guardia stessa**. È un test dell'harness e non del
prodotto, e vale la pena averlo perché la guardia è invisibile: nessun altro test la nomina, e una
configurazione sbagliata la spegnerebbe in silenzio lasciando tutto verde.

**`test:int` separato da `test:unit`** perché hanno prerequisiti diversi: il primo deve girare
sempre, il secondo richiede staging. Senza credenziali `test:int` **fallisce** con un messaggio che
elenca le variabili mancanti e dice dove metterle. Non si salta: un test saltato in silenzio si
presenta come un verde, e un verde falso è peggio di un rosso.

---

## 2026-10-12 — F1.6 · Smoke test · **COMPLETO** ✅

| Criterio | Risultato |
|---|---|
| `npm run smoke` esce 0 | ✅ |
| Un import rotto fa fallire lo smoke | ✅ coperto da `expo export`, che non bundla |
| Il render test asserisce su un testo realmente in schermata | ✅ `getByText(/Open up App\.tsx/i)` |

Due livelli, come previsto: (a) `expo export --platform android` → 580 moduli bundlati, `dist`
prodotta; (b) render della root con `@testing-library/react-native`.

**Ostacolo risolto:** `render()` è **asincrona** da RNTL v14. Destrutturarla senza `await` restituisce
una Promise e le query non esistono (`getByText is not a function`). Anche `screen` non risulta
associato in questa versione: si usano le query ritornate da `await render(...)`.

L'asserzione è su un testo reale e non su "nessun errore": un componente che renderizza il vuoto non
solleva eccezioni e passerebbe un test scritto così. Cambierà con T11, ed è giusto che si muova con
la UI invece di restare generica per non doverla toccare mai.

---

## 2026-10-12 — F1.7 · `verify` unificato · **COMPLETO** ✅ (rosso per progetto)

| Criterio | Risultato |
|---|---|
| `npm run verify` è un comando unico | ✅ `node scripts/verify.js` |
| Rompendo uno step, esce ≠ 0 e **dice quale** | ✅ provato: `step caduti: lint, test:int` |
| Senza credenziali staging, `verify` **fallisce** | ✅ `step caduti: test:int` |

**Perché uno script e non una catena di `&&`**
Quando una catena cade, il terminale mostra l'errore dell'ultimo comando e tocca a chi legge capire
quale anello si è rotto. `scripts/verify.js` (stdlib di Node, zero dipendenze) dà un nome allo step
caduto, e non si ferma al primo rosso: sapere che cadono tre step è informazione diversa dal sapere
che ne cade uno, e costa qualche secondo.

**`verify` è rosso, ed è il comportamento corretto.** L'unico step che cade è `test:int`, perché il
progetto Supabase di staging non esiste ancora. Non è un difetto da nascondere con uno skip: è
esattamente ciò che `ARCHITECTURE.md` prescrive. Il verde di Fase 1 arriverà quando l'umano avrà
creato staging — e sarà un verde vero.

**Aggiunto `"types": ["jest"]` a `tsconfig.json`:** senza, `tsc` non vedeva `describe`/`it`/`expect`
nei file di test e `typecheck` cadeva. Verificato con `tsc --showConfig` che `strict` e
`noUncheckedIndexedAccess` restano attivi dopo la modifica.

**Due script `postinstall` mai approvati:** `unrs-resolver` (verificato: non serve, il binding nativo
arriva dalle dipendenze opzionali) e `@parcel/watcher` (watch mode di jest — i test girano con `--ci`,
quindi non serve). Tutta la Fase 1 gira senza aver concesso esecuzione di codice in installazione.

**⛔ Cancello di fine Fase 1.** Azioni che restano all'umano, elencate nella risposta in chat:
progetto Supabase staging, file `.env`, e `.env.example` (bloccato dalle deny rules, che non
distinguono `.env.example` da `.env`).

---

## 2026-10-12 — ⛔ Fine Fase 1 · `verify` **VERDE**

L'umano ha creato il progetto Supabase di staging, il file delle variabili d'ambiente e il template
nel repo. `npm run verify` → tutti e cinque gli step passati, **exit code 0** verificato a parte
(il criterio parla del codice di uscita, non del messaggio).

`test:int` passa perché staging esiste davvero, non perché sia stato saltato. È la differenza fra un
harness che misura e uno che si autocertifica, ed è la ragione per cui la Fase 1 viene prima della logica.

**Correzione a una guida che stavo per dare sbagliata:** jest **non** legge i file dotenv da solo —
li carica Expo quando avvia l'app o costruisce il bundle, ma `jest` gira fuori da quel percorso.
Senza `jest.setup.int.js` (che usa `@expo/env`, la stessa implementazione di Expo, così la precedenza
fra file e variabili di sistema è identica a quella a runtime) `test:int` sarebbe rimasto rosso con
le credenziali presenti, e il messaggio d'errore avrebbe mandato a cercare nel posto sbagliato.
Verificato in due metà prima di scrivere la guida: il loader legge un file da disco, e il test passa
quando le variabili ci sono.

**Chiavi ruotate dall'umano** dopo essere state condivise in chat: `secret key` e password del DB.
`.env` contiene solo URL e chiave pubblicabile, quindi la rotazione non lo ha toccato.

---

# FASE 2 — Prodotto

## 2026-10-12 — T01 · Modello di dominio · **COMPLETO** ✅

| Criterio | Risultato |
|---|---|
| `npx tsc --noEmit` esce 0 | ✅ con `strict` + `noUncheckedIndexedAccess` |
| Nessun import da `adapters/`, `ui/` o librerie esterne in `core/domain` | ✅ solo path relativi interni |
| Stati di `MatchRequest` union di letterali | ✅ `pending \| accepted \| rejected \| cancelled` |
| Test: `seatsAvailable > seatsTotal` rifiutato dal costruttore | ✅ più i confini `3/3` e `3/0` |
| Test: trasferta senza auto non può offrire posti | ✅ più il caso ammesso `false, 0/0` |

`verify` verde: 10 test unitari in 2 suite.

**Il planner è stato saltato, deliberatamente.** `OFFICINA.md` dice "scompone il task, **se serve**":
T01 aveva già in `TASKS.md` criteri di accettazione verificabili, che sono esattamente l'output del
planner. Il reviewer invece non è opzionale ed è stato eseguito.

**Decisioni di modellazione, da ritrovare senza rileggere il diff**

1. **Il tempo è una stringa ISO 8601, non un `Date`.** `core/` non può usare l'orologio di sistema
   (lo impone il lint), e un `Date` è mutabile e si porta dietro il fuso della macchina. Qui le date
   sono dati confrontabili e deterministici; il tempo "adesso" entrerà dal port `Clock` in T02.

2. **Invarianti di vita separati dalle regole di creazione.** `makeTrip` fa rispettare ciò che è vero
   *sempre* (posti non negativi, disponibili ≤ totali, niente posti senza auto). Le regole di T04
   (data nel passato, plant uguali, massimo 8 posti) valgono solo *alla creazione* e restano a T04.
   Conseguenza per chi scriverà T04: `createTrip` deve **delegare** a `makeTrip` e aggiungere solo le
   regole di prodotto, non riscrivere i controlli di segno. Due definizioni della stessa regola in due
   punti è il modo in cui divergono.

3. **`negative-seats` è dentro T01 anche se non è fra i criteri.** Senza quel controllo i due
   invarianti richiesti avrebbero un buco dimostrabile: `seatsTotal: -2, seatsAvailable: -3,
   hasCar: true` passerebbe entrambi e `makeTrip` restituirebbe `ok` su una trasferta priva di senso.
   Non aggiunge una regola di prodotto: **chiude** quella richiesta dal criterio.

4. **`PlantId` è una union di letterali dentro `core/domain`**, mentre `ARCHITECTURE.md` mette i plant
   in `config/`. I due non si contraddicono se si separa **identità** da **dati**: il dominio sa
   *quali* stabilimenti esistono, `config/` saprà come si chiamano e quanto distano. Il prezzo è che
   aggiungere una sede richiede toccare il codice — accettabile per un pilota a tre sedi decise, e la
   condizione che farebbe cadere la scelta è scritta nel file. Il guadagno: un plant inesistente è un
   errore di compilazione invece che un dato sbagliato scoperto a runtime.

5. **I file del dominio si importano direttamente fra loro**, non attraverso `index.ts`. È ciò che
   evita il ciclo barrel → foglia → barrel. Da mantenere nei task successivi.

**Reviewer: APPROVATO**, cinque criteri su cinque, `verify` rieseguito da lui. Due rilievi accolti
subito perché contraddicevano un principio già applicato in Fase 1:

- Il commento su `makeTrip` dichiarava di essere "l'unico modo" di ottenere un `Trip` valido: **falso**,
  perché input e output sono lo stesso tipo e un letterale aggira la validazione. Corretto in un
  avvertimento esplicito agli adapter, che sono i moduli che materializzano entità da storage.
- Un test *"conserva i campi, senza mutarli"* **non poteva fallire**: `makeTrip` restituisce la stessa
  reference, quindi confrontava un oggetto con se stesso e sarebbe passato anche mutando l'input.
  Riscritto confrontando con una copia scattata prima della chiamata. È la stessa regola imparata col
  test invalido della branch protection in F1.2.

Tre riserve non bloccanti annotate in `IDEAS.md`, nessuna implementata: tipo opaco per `Trip`,
derivazione di `PlantId`/`BadgeId` dai rispettivi array, classificazione dell'errore quando mancano
sia auto sia capienza.

**Prossimo passo:** T02 (port e adapter memory), che introduce la suite di contratto condivisa.

---

## 2026-10-12 — T02 · Port e adapter memory · **COMPLETO dopo due bocciature** ✅

| Criterio | Risultato |
|---|---|
| Esistono i 5 port | ✅ `TripRepository`, `MatchRequestRepository`, `ProfileRepository`, `SessionGateway`, `Clock` |
| `core/ports` solo interfacce e tipi | ✅ `index.ts` usa solo `export type`: non emette runtime |
| Suite di contratto condivisa, la stessa che userà Supabase | ✅ dopo due round di correzioni, vedi sotto |
| La suite gira senza rete | ✅ **imposto** dalla guardia in `jest.setup.unit.js`, non promesso |
| `Clock` iniettabile, sostituito da un orologio fisso | ✅ stessa domanda, esiti opposti al variare dell'orologio |

`verify` verde: 45 test unitari in 5 suite.

**Il reviewer ha bocciato due volte. Entrambe aveva ragione, e il `verify` era verde entrambe le volte.**

### Round 1 — sei bloccanti

Il più grave era invisibile ai test: `MemoryTripRepository` **fabbricava** `ownerPlantId` con un
ripiego sul plant di partenza, e il metodo che avrebbe dovuto popolarlo non era chiamato da nessuna
parte. Quindi *ogni* offerta usciva con un valore inventato, e nessuna asserzione guardava quel campo.
Avrebbe fatto danno a T03: il criterio "l'offerta con stesso plant di appartenenza precede quella con
plant diverso" sarebbe stato scritto e verificato su un dato inventato — plausibile, quindi invisibile.

Correzione: join vera attraverso il port `ProfileRepository`, semantica di **inner join** (profilo
mancante → offerta omessa, nessun ripiego). Test con un collega che appartiene a Foggia e parte da
Pomigliano: col vecchio codice è rosso.

Gli altri cinque: `AmbienteDiContratto` che non reggeva Supabase, test che non potevano fallire, il
gateway con i codici disattivati in una struttura separata, doc dei port che promettevano
comportamenti inesistenti, adapter che non passava da `makeTrip` nonostante T01 lo prescrivesse.

### Round 2 — due residui della stessa famiglia, più un'inadempienza di processo

I due residui riguardavano l'**identità** con cui la suite opera. `comeUtente` è un no-op in RAM, e
un no-op non esercita pressione: due blocchi di test assumevano uno stato di sessione mai richiesto
e scrivevano candidature a nome di un collega diverso dall'autenticato. Su Postgres la policy
sensata è `requester_id = auth.uid()`, quindi a T09 ci saremmo trovati davanti a due strade, entrambe
cattive: modificare la suite (violando il criterio) **oppure allentare la policy per far passare i
test**. La seconda è il modo in cui nascono le fughe di dati.

Regola adottata e applicata ovunque: *ogni scrittura è eseguita dall'identità che possiederà la riga,
ogni lettura dall'identità che il doc del port dichiara di servire; nessun test assume uno stato di
sessione che non ha chiesto.*

**L'inadempienza è mia e non ha attenuanti:** non avevo aggiornato questo file per T02, né nel primo
round né nel secondo, mentre per T01 l'avevo fatto. L'osservabilità è terza nella gerarchia di
`CLAUDE.md`, sopra la performance, e la regola dice "a ogni ciclo". L'ha trovata il reviewer.

### Decisioni di progetto, da ritrovare senza rileggere i diff

1. **`ProfileRepository` non ha `save`.** Su Supabase i profili nascono da `auth.users` via trigger, e
   un client che inserisse una riga `profiles` con id arbitrario verrebbe respinto dalle RLS. Metterci
   un `save` avrebbe significato scrivere un metodo che l'adapter vero non può onorare. Il
   provisioning è amministrazione, e passa dall'ambiente di test, non dal port.

2. **`Clock.now()` è ISO 8601 normalizzato UTC, con la `Z`.** Il dominio confronta gli istanti come
   stringhe, e il confronto lessicografico coincide con quello cronologico **solo** a offset uguale:
   `2026-11-03T07:00:00+01:00` e `2026-11-03T06:00:00Z` sono lo stesso istante ma due stringhe
   diverse. Funzionava per caso, perché tutte le fixture usavano `+01:00`. T03 (finestra di
   tolleranza, confine incluso) e T04 (partenza nel passato) ci si fondano.

3. **La validazione avviene al confine dello storage.** `save` valida prima di scrivere e rifiuta con
   `invalid-record` lasciando lo storage intatto; `findById` valida in lettura, perché un record
   invalido che arriva dal DB non è meno invalido di uno scritto a mano — ed è lì che si presenterà
   davvero. Le letture di **liste** non validano riga per riga, deliberatamente: far fallire
   un'intera schermata per una riga incoerente è un degrado sproporzionato.

4. **Gli id hanno forma uuid anche in RAM.** `'trip-1'` non è inseribile in una colonna uuid, e su
   Postgres un id malformato non dà `not-found` ma un errore di sintassi — cioè il test "su id
   inesistente ritorna not-found" sarebbe caduto a T09, sull'adapter, non sul codice.

5. **`listOpenOffers` è una proiezione, non una ricerca.** Nessun filtro su plant, data od orario:
   quelli sono i vincoli duri del matching e stanno in `findMatches`, funzione pura. Nessun filtro su
   `hasCar`: per invariante di `Trip`, posti disponibili implicano l'auto, e un predicato
   irraggiungibile non è difesa — è codice che nessun test può coprire.

6. **Due vincoli scritti nel doc del port per T08**, perché non vengano riscoperti a mano: le RLS su
   `trips` devono permettere la lettura delle offerte pubblicate di tutti i colleghi (altrimenti
   `findMatches` non vede nulla e la suite, in RAM, non se ne accorge), e serve la foreign key
   `trips.owner_id -> profiles.id` (senza, l'omissione dell'inner join diventa perdita silenziosa).

### Quello che la suite di contratto NON prova, e va detto

**Non dà, e non può dare, alcuna evidenza sulle RLS.** Prova che il port è onorabile dall'identità
giusta. La verifica delle policy è `test:int` su staging, ed è un criterio di T08. Chi legge un verde
di `test:unit` non deve concluderne che le policy funzionano.

Due test sono **specifici dell'adapter memory**, fuori dalla suite condivisa: il ramo "profilo
mancante" e il ramo "lo storage contiene già un record invalido". Su Postgres saranno irraggiungibili
per foreign key e CHECK constraint, quindi un test condiviso non potrebbe nemmeno costruirli — ma in
RAM quei rami esistono, e un ramo che nessun test tocca è un ramo di cui non sappiamo nulla.

### Round 3 — approvato, con un residuo segnalato come circuit breaker

Il reviewer ha **approvato** i cinque criteri, ma ha registrato un residuo della stessa famiglia delle
due bocciature precedenti e l'ha segnalato all'umano invece di bocciare una terza volta, come
prescrive la regola. Il circuit breaker non è scattato nel senso stretto — c'è stato progresso reale a
ogni round, e la ragione della bocciatura è cambiata ogni volta — ma la **famiglia** del problema era
la stessa per tre giri: *l'identità con cui la suite di contratto opera*.

Il residuo: il test di upsert sulle candidature scriveva la transizione `pending → accepted`
dall'identità del **richiedente**. T05 dice esplicitamente che accettare spetta solo a chi offre, e
"un altro utente riceve errore". Su Supabase quella scrittura sarebbe respinta, e a T09 ci sarebbero
state due strade, entrambe cattive: modificare la suite, o **allentare la policy RLS per far passare
il test**.

**Corretto subito invece di rimandarlo.** La transizione provata è ora `pending → cancelled`, che
appartiene senza ambiguità al richiedente e prova l'upsert altrettanto bene. Non è stato un quarto
round di review: la correzione era già specificata, e spedire un test che mette pressione su T08
perché scriva una policy più larga sarebbe stato un debito pagato in sicurezza.

Chiusi anche i tre rilievi minori: le scritture di setup pretendono `ok` anche nei test
memory-specifici; documentato perché `MemoryMatchRequestRepository.findById` non valida (`MatchRequest`
non ha invarianti in T01, quindi non è una dimenticanza); e scritto nel doc di `seminaGrezzo` che **il
seed di T17 non deve usarlo** — è la porta sul retro che qualcuno sarà tentato di usare perché più
diretta, scavalcando il confine di validazione appena stabilito.

### Il tetto di ciò che una suite condivisa può dimostrare

Due osservazioni del reviewer che non sono difetti ma vanno capite:

- `toHaveLength(1)` nel test di upsert **non può fallire in RAM** (la `Map` è indicizzata per id), ma
  può fallire su Supabase, dove una `insert` invece di una `upsert` darebbe due righe o una violazione
  di chiave. Un'asserzione che non può fallire su un adapter ma può sull'altro è legittima in una
  suite condivisa: è diverso da una che non può fallire da nessuna parte.
- `listByRequester`, letto come il richiedente, su Supabase sarebbe soddisfatto **anche da un adapter
  che ignora il parametro**, perché a filtrare sarebbero le RLS. Non si può fare meglio da qui: la
  costruzione inversa verrebbe bloccata dalla policy. È un'altra faccia del fatto che la suite non
  prova nulla sulle policy.

**Prossimo passo:** T03, il motore di matching. È il pezzo di maggior valore del prodotto e ha tredici
criteri su tre dimensioni (vincoli duri, punteggio, purezza): è il primo task che merita davvero il
planner.

---

## 2026-10-12 — T03 · Motore di matching · **COMPLETO** ✅

`verify` verde: **88 test unitari in 8 suite** (erano 45). I criteri sono **15**, non 13 come avevo
scritto: 9 vincoli duri, 4 di punteggio, 2 di purezza. Li ha ricontati il planner.

**Il planner è servito, e si è fermato dove doveva.** Ha prodotto il piano e poi si è bloccato su due
checkpoint ⛔ prima di far scrivere una riga di codice, perché toccavano un contratto approvato in
Fase 0. L'umano ha deciso su entrambi.

### Le tre decisioni approvate prima di implementare

1. **La firma non poteva soddisfare due dei suoi stessi criteri.** `findMatches(richiesta, offerte,
   config)` non riceveva le candidature esistenti, ma due criteri escludono un'offerta se il
   richiedente ha già una richiesta `pending` o `accepted` su di essa. Ora ha quattro parametri e
   ritorna `Result`. `ARCHITECTURE.md` aggiornato: il documento era in ritardo sul backlog, non il
   contrario.
2. **`core/usecases` non importa `config/` nel codice di produzione**, benché il lint lo permetta. La
   contraddizione fra documento e lint l'ha trovata il planner leggendo `eslint.config.js`, non
   assumendolo. L'unico arco vive nel test di conformità.
3. **I valori di config sono letterali**, non variabili d'ambiente: una soglia di tolleranza non è un
   segreto, e via `.env` sarebbe `string | undefined` a runtime, cioè non verificabile a compile time.

### Decisioni prese in corsa, diverse dal piano

- **Millisecondi invece di secondi.** Il piano calcolava il punteggio in secondi; l'implementazione usa
  millisecondi, perché è l'unità in cui il parser restituisce già `millisOfDay` e perché evita una
  divisione che reintrodurrebbe la virgola mobile. Conseguenza visibile: i punteggi pinnati nel test
  sono `3_600_001` e `1_200_000`.
- **`instant.ts` sta in `domain/`, non in `usecases/`.** T04 ("partenza nel passato") avrà bisogno
  dello stesso parser: due implementazioni della stessa regola in due punti è il modo in cui divergono —
  la stessa lezione già scritta per `makeTrip` e le regole di creazione di T04.
- **T03 ha toccato un file di T01.** Il commento di `Trip.departureAt` mostrava un esempio con offset
  `+01:00`, cioè la forma che questo task rende invalida: un commento che pubblicizza la forma sbagliata
  è una trappola, e correggerlo nel task che ha creato la divergenza è la scelta giusta.

### Il punteggio è a dominanza, non a somma pesata

`score = finestra − delta + (stessoPlant ? finestra+1 : 0)`, tutto intero.

Il criterio "l'offerta con stesso plant di appartenenza precede quella con plant diverso" è enunciato
**senza condizioni**. Con pesi configurabili sarebbe vero solo finché il peso del plant supera
l'escursione della vicinanza oraria: chi un domani abbassasse quel numero in `config/` invertirebbe la
semantica di un criterio di accettazione **con tutti i test verdi**, perché i test usano fixture di
config e non i valori di produzione. Il bonus è quindi derivato dalla finestra e non configurabile.

Il reviewer ha verificato l'algebra: la dominanza è violata solo se `finestra + 1 + dy ≤ dx`, ma il
vincolo duro impone `dx ≤ finestra` e `dy ≥ 0` — contraddizione per **ogni** input accettato. Nessun
valore di `toleranceMinutes` la rompe, overflow compreso.

### Ambiguità di `TASKS.md` risolta per interpretazione

"Ordinamento **stabile** a parità di punteggio" e "**nessuna dipendenza dall'ordine di input**" sono in
tensione: un sort stabile *conserva* l'ordine di input, cioè ne dipende. Si è adottato un **ordine
totale** con `tripId` come ultima chiave, perché è l'unica lettura in cui il criterio ha un test capace
di fallire: stesso insieme, input permutato, output identico. Su Postgres, poi, l'ordine delle righe
senza `ORDER BY` non è garantito: senza ultima chiave la lista si riordinerebbe fra due aperture della
stessa schermata, e si presenterebbe come "l'app è instabile" invece che come un bug del matching.

### Le due sonde

- **Campo di `MATCH_CONFIG` rinominato** → `tsc` rosso con `TS2741: Property 'toleranceMinutes' is
  missing`. Il legame tipo↔valori esiste davvero.
- **`new Date()` dentro `find-matches.ts`** → lint rosso con il messaggio sull'orologio.

Il reviewer ha verificato anche il presupposto della prima: `tsc --listFiles` include i file di test,
quindi la protezione è reale. E ha delimitato la seconda: il selettore cattura `new Date()` e
`Date.now()`, **non** `Date.parse` né `Date.UTC`. Il criterio dice "verificato dal lint", ma la
copertura vera è distribuita su tre step di `verify` — lint per l'orologio, la guardia di `test:unit`
per la rete, Metro che non risolve `node:fs` per il filesystem. Nel complesso più forte di quanto il
criterio chieda, ma non per il meccanismo che il criterio nomina.

### Bocciatura al primo round, per una trappola che avevo creato io

Il reviewer ha approvato il motore riga per riga e ha bocciato per **tre cose fuori dai file nuovi**:

1. **La fixture `trasfertaValida` di T01 usava ancora `+01:00`.** Avevo ristretto il contratto di
   `Trip.departureAt` a UTC, corretto il commento, e lasciato il controesempio una riga sotto — nel
   punto dove fa danno. Chi scriverà T04 parte da quella fixture perché si chiama "valida": avrebbe
   confrontato un offset con una `Z` ottenendo una risposta sbagliata e plausibile, test verde.
   Nessuna asserzione dipendeva da quei due valori, il che è anche la prova che **nessun test oggi
   pinna il formato di `departureAt` su `Trip`**.
2. **Nessuna voce di esecuzione in `PROGRESS.md`** — la seconda volta dopo T02. La regola è vincolante
   e l'osservabilità sta sopra la performance nella gerarchia. Non è ambiguità: è disattenzione mia,
   due volte sullo stesso adempimento.
3. Le 15 caselle di `TASKS.md` da spuntare.

**Prossimo passo:** T04 (creazione trasferta). Vincolo che gli arriva da qui: deve **delegare** a
`makeTrip` per gli invarianti e usare `parseUtcInstant` per la data nel passato, non riscrivere né
l'uno né l'altro. E deve normalizzare gli istanti in scrittura, altrimenti produce dati che il motore
di matching ometterà in silenzio.

---

## 2026-10-12 — Fine sessione · stato e decisioni aperte

Scritto per la sessione successiva. Working tree pulito, `origin/auto/build` allineato a `e6ff157`,
nessun commit in attesa di push.

**Fatto:** Fase 0 → Fase 1 completa (`verify` verde con credenziali staging reali) → T01, T02, T03.
88 test unitari, 1 di integrazione, 1 di smoke.

### Decisioni che aspettano l'umano

1. **Autonomia fino a T08.** Chiesta e non ancora risposta. Il tratto T04→T07 è logica pura, senza
   dipendenze nuove e senza ⛔: può girare senza chiedere il permesso fra un task e l'altro. Il ciclo
   developer → `verify` → reviewer resterebbe intero per ogni task; salta solo la domanda in mezzo.
   Da sapere prima di decidere: il reviewer ha bocciato T02 due volte e T03 una, **sempre con `verify`
   verde**. Il loop funziona, ma è il reviewer a reggerlo, non l'harness.

2. **`IDEAS.md` ha 12 proposte, nessuna approvata.** La più urgente è *"Normalizzare l'istante al
   confine dell'adapter"*: PostgREST serializza i `timestamptz` con offset `+00:00` e microsecondi, che
   `parseUtcInstant` rifiuta — a T09 ogni offerta da Supabase sparirebbe in silenzio e il motore
   direbbe "nessun collega compatibile". Costa S dentro T09, M se scoperta dopo.

3. **`rejected` e T05.** Una candidatura `rejected` non blocca il match (il PRD dice "pendente o
   accettata"), quindi `findMatches` ripropone l'offerta. Ma T05 ha il criterio "doppia candidatura
   sulla stessa offerta → rifiutata": se T05 lo leggesse come "esiste già una riga", il collega
   vedrebbe il match, si candiderebbe e riceverebbe un errore. Decisione di prodotto, da prendere
   entro T05.

4. **Terza componente di punteggio del PRD inesprimibile.** Il PRD elenca tre componenti di punteggio
   morbido; la seconda ("sovrapposizione della durata, rientro compatibile") non è calcolabile perché
   `SeatOffer` espone solo `departureAt`. Fuori dai criteri di T03, annotata in `IDEAS.md`. Chi legge
   il PRD e poi il codice troverà una componente in meno.

### Attriti noti dell'ambiente, da non riscoprire

- Le deny rules bloccano la scrittura di `.env.example`, che invece **deve** stare nel repo: lo crea
  l'umano. L'hook lo gestisce correttamente, è la deny rule a essere più grossolana.
- L'hook blocca `git add .claude/settings.json`: le modifiche ai freni le committa l'umano.
- Il classificatore interno di Claude Code blocca `git ls-remote` come `[Git Destructive]`: falso
  positivo, non è una nostra regola.
- `$CLAUDE_PROJECT_DIR` non si risolve negli hook su Windows: serve il percorso assoluto con slash in
  avanti.
- Piping di stringhe PowerShell verso `python` perde stdin: usare un file reale.

---

## 2026-10-12 — T03 · **PIANIFICAZIONE** (nessun codice scritto) ⛔ in attesa di approvazione

Il planner ha scomposto T03 in sei step. Il piano completo è nella risposta in chat; qui restano le
decisioni e i checkpoint, perché vincolano il developer e vanno ritrovati senza rileggere la chat.

**Tre nodi sciolti, con ciò che ne consegue**

1. **La firma di `ARCHITECTURE.md` non basta.** Due criteri parlano delle candidature già esistenti del
   richiedente, che `findMatches(richiesta, offerte, config)` non riceve. Proposto un **quarto
   parametro** `candidature: readonly MatchRequest[]`, con `config` ultimo, e il ritorno che diventa
   `Result<readonly ScoredMatch[], MatchError>` (serve un canale d'errore per l'istante non
   normalizzato e per la config incoerente). Scartato infilarle dentro `TripRequest`: sono un'altra
   entità, con un altro repository e un altro ciclo di vita, e l'oggetto andrebbe assemblato comunque.
   **Entrambe le modifiche richiedono di aggiornare `ARCHITECTURE.md` § "Il motore di matching":
   checkpoint umano, il piano non parte prima.**

2. **`TripRequest` non è un buco di T01.** T01 ha consegnato le sei entità elencate nei suoi criteri;
   `TripRequest` compare solo nella firma del motore. Va definito in T03, in
   `core/domain/trip-request.ts`, come **proiezione simmetrica a `SeatOffer`**: solo i campi che
   partecipano ai vincoli duri e al punteggio (`requesterId`, `requesterPlantId`, `fromPlantId`,
   `toPlantId`, `departureAt`). Chi lo costruisce da un `Trip` è affare di T13, non di T03.

3. **`MatchConfig`: il tipo nel core, i valori in `config/`.** Verificato su `eslint.config.js` e non
   assunto: il grafo permette `usecases → config`, mentre `ARCHITECTURE.md` e il commento di
   `core/usecases/index.ts` dicono "dipende SOLO da domain/ e ports/". **I due documenti e il lint non
   concordano, e la cosa va decisa dall'umano.** Il piano tiene la riga stretta: il codice di
   produzione del core **non** importa `config/` (riceve la config come parametro); l'unico arco
   `usecases → config` vive in un test di conformità, che è ciò che rende verificabile dalla macchina
   la regola "niente valori magici" — senza di esso `config/` esporterebbe un oggetto che nessuno
   confronta con il tipo, perché `config/` non può importare il core.

**Decisione di progetto che vale la pena ritrovare:** la dominanza fra "stesso plant" e "orario più
vicino" è ottenuta **per costruzione** e non con pesi configurabili. `proximityPoints = tolleranza_s −
delta_s` (intero, 0..tolleranza_s) e il bonus di plant è `tolleranza_s + 1`: il caso peggiore con lo
stesso plant batte sempre il caso migliore con plant diverso. Niente float (nessuna parità finta,
nessun epsilon) e nessun peso che un domani qualcuno possa abbassare in `config/` invertendo in
silenzio la semantica di un criterio di accettazione.

**Ambiguità in `TASKS.md` risolta per interpretazione:** "ordinamento stabile a parità di punteggio"
e "nessuna dipendenza dall'ordine di input" sono in tensione — un sort stabile *conserva* l'ordine di
input. Si adotta un **ordine totale** con `tripId` come ultima chiave: è l'unica lettura in cui il
criterio ha un test capace di fallire (stesso insieme di offerte permutato → output identico).

**Tre proposte annotate in `IDEAS.md`**, nessuna implementata: sovrapposizione del rientro nel
punteggio (richiede `returnAt` su `SeatOffer`, che non esiste), istante normalizzato come tipo
brandizzato, esclusione delle offerte già partite.

**Domanda aperta all'umano, di prodotto e non di codice:** una candidatura `rejected` non blocca il
match (il PRD parla di "pendente o accettata"), quindi `findMatches` ripropone l'offerta — ma T05 ha
il criterio "doppia candidatura sulla stessa offerta → rifiutata". Se T05 lo legge come "esiste già una
riga", il collega vede un match, si candida e riceve un errore. Da decidere entro T05.

---

## 2026-10-13 — T04 · Creazione trasferta · `verify` verde, in attesa del reviewer

`verify` **verde, exit code 0, rieseguito da me** e non solo dal developer: 128 test unitari in 10 suite
(erano 88), 1 di integrazione, 1 di smoke.

**Autonomia concessa dall'umano** sul tratto T04→T07: non si chiede il permesso *fra* un task e
l'altro, ma il ciclo developer → `verify` → reviewer → commit resta intero per ciascuno. Il reviewer
non salta: ha bocciato T02 due volte e T03 una, **sempre con `verify` verde**.

**Il planner è stato saltato, come per T01:** i sette criteri in `TASKS.md` erano già verificabili,
cioè erano già l'output del planner.

| Criterio T04 | Come è coperto |
|---|---|
| Auto e 3 posti → `seatsAvailable == 3` | ✅ più `seatsTotal` 3 e `status: 'published'` |
| Senza auto → `hasCar false`, nessun posto | ✅ `seatsTotal` e `seatsAvailable` a 0 |
| Plant partenza = destinazione → rifiutata | ✅ `same-plant`, con il `plantId` nel payload |
| Partenza nel passato secondo `Clock` → rifiutata | ✅ −1 ms rifiutato, **uguale accettato**, +1 ms accettato; un test cambia *solo* l'orologio |
| Rientro precedente alla partenza → rifiutata | ✅ −1 ms rifiutato, **uguale accettato**, `null` accettato |
| Posti ≤ 0 o > 8 con auto → rifiutata | ✅ confini 0/1/8/9; un test usa una config con massimo 4 |
| Ogni rifiuto è un errore tipizzato | ✅ ogni test pretende il `kind` esatto, e che lo storage sia rimasto vuoto |

### Decisioni, da ritrovare senza rileggere i diff

1. **Istanti: validare e rifiutare, non convertire** — opzione (a), decisa dall'umano. `createTrip`
   passa `departureAt`, `returnAt` **e** `clock.now()` a `parseUtcInstant` e rifiuta con errore
   tipizzato ciò che non è canonico. Nessun convertitore, nessuna aritmetica di calendario, nessun
   `Date` nel core. La conversione dal fuso locale è **onere del form di T12**: scritto qui perché
   chi scriverà quel form non lo deve riscoprire leggendo il codice.
   Perché anche `clock.now()`: un confronto silenziosamente sbagliato è esattamente il guasto che la
   guardia previene, e un port con un adapter difettoso non è meno pericoloso di un input sporco.

2. **L'id arriva da chi chiama, e questo evita un ⛔.** `TripRepository.save` prende un `Trip`
   completo e fra i cinque port non c'è un generatore di id. Aggiungerne uno sarebbe stato un cambio
   di contratto, cioè un checkpoint umano. `CreateTripInput` include quindi l'`id`: T04 si è chiuso
   senza toccare nessuna interfaccia.

3. **`maxSeatsOffered` sta in `config/`, non nel codice.** Il massimo di 8 è una soglia, e
   `CLAUDE.md` vieta i valori magici. Stesso pattern di `MatchConfig`/`MATCH_CONFIG` di T03: il tipo
   in `core/usecases`, i valori in `config/`, il codice di produzione del core **non** importa
   `config/` e l'unico arco vive nel test di conformità. Il minimo di 1 posto resta una costante:
   zero posti non è un'offerta, non è una soglia da tarare.

4. **`status: 'published'` alla creazione.** `TripStatus` non ha una bozza, e gli altri due stati
   (`cancelled`, `completed`) descrivono la fine della vita. Una trasferta creata deve poter comparire
   subito fra le offerte del matching.

5. **Posti > 0 senza auto: rifiutati, non azzerati.** Ignorare un input è il modo in cui l'utente
   scopre dopo che i suoi dati sono stati cambiati. `makeTrip` resta la seconda rete, e un valore
   *negativo* senza auto non è una regola di T04: ci arriva e lo rifiuta `makeTrip` con
   `negative-seats`, come prescrive la delega.

### Il rilievo che conta più del task: **la forma canonica non è unica**

`parseUtcInstant` accetta i millisecondi come **opzionali**, quindi `...T06:00:00Z` e
`...T06:00:00.000Z` sono entrambi canonici e sono lo stesso istante. Ma come stringhe non sono
uguali, e l'ordine è pure **invertito**: `Z` è `0x5A`, `.` è `0x2E`, quindi `"06:00:00.000Z"` risulta
**minore** di `"06:00:00Z"`.

Conseguenza: l'enunciato su cui si fonda tutto dall'inizio — "fra istanti canonici il confronto
lessicografico coincide con quello cronologico" — **è vero solo a forma dei millisecondi uguale**,
e il dominio non la garantisce. L'ha trovato il developer sul confine "partenza uguale ad adesso",
dove il confronto fra stringhe dà il verdetto sbagliato. `createTrip` lo evita confrontando gli
`Instant` (data, poi `millisOfDay`) e non le stringhe; c'è un test che fallirebbe col confronto naive.

Correzione a una cosa che avevo detto in chat all'umano: **no**, un tab "prossimi viaggi" non è
gratuito oggi. Ordinare per `departureAt` come stringhe e filtrare con `departureAt >= clock.now()`
sbagliano proprio sui pareggi, perché `clock.now()` ha sempre i millisecondi e un `Trip` salvato può
non averli. Nessun bug **attuale**: `findMatches` passa da `parseUtcInstant` e confronta `date` per
uguaglianza e `millisOfDay` per distanza, quindi T03 è salvo, e nessun altro punto del core confronta
quelle stringhe. È una trappola per T13, non un difetto in produzione.

Delimitato per non propagare un allarme sbagliato: su Postgres la colonna è `timestamptz`, quindi
`ORDER BY` e i confronti SQL sono semantici e **non** soffrono di questo. Il rischio è solo lato JS.

Annotato come nota alla voce `IDEAS.md` *"Istante normalizzato UTC come tipo brandizzato"* invece che
come voce nuova: il rimedio è quello, e `CLAUDE.md` vieta i duplicati. La decisione da prendere lì è
se **stringere il parser** (millisecondi obbligatori) o **normalizzare** in un punto solo.

### Deviazione del developer dal brief, accettata

Gli avevo detto di usare `FixedClock` e l'adapter memory nei test. Non si può: il lint vieta a
`core/**` di importare `adapters/`, **test compresi**, con due regole indipendenti. Ha scritto due
fake locali che implementano i port, e il fake del repository registra i salvataggi — il che ha reso
possibile asserire, su ogni rifiuto, che **nulla è stato scritto**. Ha rispettato il freno invece di
chiedere di allentarlo: è il comportamento giusto. Il prezzo è un po' di codice duplicato nei test:
il developer l'ha segnalato a me, e **io** l'ho scritto in `IDEAS.md` come voce *"Fake condivisi dei
port per i test di `core/`"*, insieme al rilievo del reviewer che il fake di `TripRepository` è più
debole del port che implementa (`save` scrive senza validare). Non risolto qui.

### Cosa `verify` verde NON dimostra

Nulla sulle RLS e nulla sul percorso Supabase: `createTrip` è stato esercitato su fake in RAM. Il
`test:int` verde è quello di F1.7, non copre T04. E non è stato esercitato nessun chiamante reale:
chi produce l'`id` e chi converte l'istante dal fuso locale non esistono ancora — arrivano a T12.

### Round 1 di review — **BOCCIATO**, `verify` verde. Di nuovo.

Quarta volta in Fase 2 che il reviewer boccia o segnala **con `verify` verde** (due volte T02, una T03,
una qui). È il dato che conta sull'affidabilità dell'harness: misura ciò che sa misurare, e i difetti
che restano sono quelli che nessun test può vedere perché riguardano *la coerenza fra ciò che il
codice dichiara e ciò che fa*. Il reviewer ha rieseguito `verify` per conto proprio ed è verde anche
per lui: 128 test, exit 0.

Ha confermato per lettura, non per lint verde, le cose che il lint non copre: `grep -w Date` su tutto
`core/` dà 5 occorrenze, **tutte in commenti** — zero `Date.parse`, zero `Date.UTC`, cioè la
scorciatoia che il selettore non intercetta non è stata usata. E ha verificato che il divieto
`core/ → adapters/` vale davvero anche nei test, con due reti indipendenti in `eslint.config.js`.

**B1 — regola duplicata, accolto.** `create-trip.ts` rifiutava `!hasCar && seatsOffered > 0`, che è
**lo stesso predicato** dell'invariante di `makeTrip` (`seatsTotal = seatsOffered`), mentre il commento
d'intestazione del file dichiarava di delegarlo. Il file smentiva se stesso, ed era il vincolo numero
uno che avevo dato al developer. Non è estetica: il `kind` `'seats-offered-without-car'` viveva in
**due** union con payload diversi, e la seconda arriva annidata in `trip-invariant-violated.violation`
— la mappatura errori → testi di T12 avrebbe visto lo stesso nome in due forme a due livelli. Peggio:
input fratelli finivano in strati diversi (`seatsOffered: 2` senza auto = regola di T04,
`seatsOffered: -1` senza auto = invariante delegato).
Scelta la **delega piena**: il controllo sparisce, l'input arriva a `makeTrip` e viene rifiutato lì.
La motivazione originale ("rifiutati, non azzerati") resta soddisfatta — la delega non azzera niente,
cambia solo la forma dell'errore. Regola che ne esce, spiegabile in una riga: **ogni invariante di
`Trip` esce come `trip-invariant-violated`, ogni regola di creazione esce col proprio `kind`.**

**B2 — errore mio, non del developer.** Avevo scritto qui sopra che la duplicazione dei fake era
"segnalata in `IDEAS.md` dal developer". Il developer l'aveva segnalata **a me**; in `IDEAS.md` non
c'era niente. Il registro dichiarava un'azione non eseguita — lo stesso difetto che pretendiamo di non
avere nel codice, applicato al diario. La voce ora esiste e la frase è stata corretta dicendo chi ha
fatto cosa. Vale la pena notare *come* è stato trovato: il brief al reviewer gli chiedeva di
controllare che il codice facesse ciò che `PROGRESS.md` dichiara. Ha trovato il contrario — una
dichiarazione senza codice.

**B3 — governance, risolto in parte da me.** Il reviewer ha segnalato che la ri-triage di `IDEAS.md`
(17 cambi di stato) viaggiava dentro l'albero di lavoro di T04, e che non poteva stabilirne l'autore:
se fosse stata di un agente sarebbe la violazione più grave del diff, perché nessun agente può
marcare `accettata` una propria proposta. **È dell'umano**, dichiarato da lui in chat. Il reviewer non
poteva saperlo, e aver chiesto invece di assumere è il comportamento corretto.
Resta valido il resto del rilievo: *un commit = un task*, quindi la triage e la voce nuova sulle
tratte **non** entrano nel commit di T04, che contiene solo codice. E resta aperta la cosa seria:
15 voci `accettata` e **zero** task corrispondenti in `TASKS.md`, mentre `CLAUDE.md` dice che finché
non sono task "per il loop non esistono". Il caso imminente non è teorico: la voce *"Andata e ritorno
sono due offerte indipendenti"* dichiara di dover stare **prima di T05**, e T05 è il prossimo task.

**Non bloccanti annotati in `IDEAS.md`**, nessuno implementato: fake condivisi dei port,
accumulo degli errori di validazione invece del primo, validità di calendario nel parser, RLS di
scrittura su `trips` vincolate all'owner. L'ultima è la più sostanziosa: `save` è un **upsert** e l'id
arriva da chi chiama, quindi chi passa il `tripId` di un collega ne sovrascrive la trasferta. Nel core
non c'è nulla che lo impedisca, né deve esserci — è il DB il posto giusto, e i sette criteri attuali
di T08 non lo coprono.

Accolto anche un non bloccante dentro lo stesso giro (N1): il test che uccide il confronto
lessicografico usava un `clock.now()` **senza** millisecondi, che il contratto di `Clock` vieta. Il
test era quindi corretto ma non interamente legale. Aggiunto un caso con entrambi i lati conformi.

### Round 2 di review — **APPROVATO** ✅

`verify` verde, 129 test (128 + quello di N1), exit 0, rieseguito indipendentemente dal developer, da
me e dal reviewer. Il conteggio **non doveva scendere**: la correzione di B1 ha cambiato
l'*aspettativa* di un test esistente, non l'ha rimosso. Un test sparito dopo una correzione è il
primo posto dove guardare, e qui non è avvenuto.

Il reviewer non ha verificato leggendo il file corretto: ha fatto `grep` su **tutto** `app/src` per
escludere che la regola fosse stata riscritta altrove invece che eliminata. `seats-offered-without-car`
vive ora in una sola union, prodotto in un solo punto (`trip.ts:73`). E ha confermato che il commento
d'intestazione di `create-trip.ts` è vero parola per parola: le tre regole che dichiara delegate sono
in `makeTrip` e in nessun altro posto, le quattro che dichiara proprie sono in `createTrip` e in
nessun altro posto.

**La sonda su N1 è stata rifatta dal reviewer con `node -e`**, invece di fidarsi del developer:
`'...07:00:00Z' < '...07:00:00.001Z'` è `false` (quindi il naive **accetterebbe** una partenza che va
rifiutata) e `'...06:00:00.000Z' < '...06:00:00Z'` è `true` (quindi rifiuterebbe un confine che va
accettato). Codici carattere confermati: `.` = 46, `Z` = 90. Poi ha ripercorso tutti gli altri
confronti del file per verificare che sotto il mutante non ne cadano né più né meno di due, ed ha
eseguito il solo file per controllare il denominatore: 38 test. "2 su 38" era esatto in entrambi i
numeri.

**Composizione dei commit, decisa con il reviewer:** `PROGRESS.md` va nel commit di T04 — è il diario
del task, e `CLAUDE.md` chiede che sia aggiornato a ogni ciclo, quindi appartiene al suo record.
`IDEAS.md` va in un commit **separato**, perché contiene la triage dell'umano (17 cambi di stato, non
mia) più le quattro voci nate da questa review: non sono separabili senza staging parziale, e nessuna
delle due appartiene a T04.

**Riserve non bloccanti lasciate dove sono, senza azione:** la tautologia `x toBe x` in
`create-trip-config.test.ts` (il legame vero è l'annotazione di tipo verificata da `tsc`, come nel
`match-config.test.ts` già approvato in T03), la condizione ridondante per il narrowing a
`create-trip.ts:145`, l'ordine primo-errore-che-scatta (ora affrontato alla radice da una voce di
`IDEAS.md`), e `MIN_SEATS_WITH_CAR` costante.

**Prossimo passo: ⛔ fermo prima di T05, e non per una regola generica.** La richiesta dell'umano del
13 ottobre (andata e ritorno come offerte indipendenti) rende **sbagliati due degli otto criteri di
T05** così come sono scritti: "doppia candidatura sulla stessa offerta → rifiutata" classificherebbe
come doppione il collega che prende entrambe le tratte dalla stessa persona — il caso che l'umano ha
indicato come il migliore diventerebbe l'unico vietato — e `seatsAvailable` è un contatore solo,
quindi accettare un passeggero per la sola andata consumerebbe anche un posto del rientro.
Serve la decisione dell'umano su **dove** collocare quel lavoro: task nuovo prima di T05, oppure T05
riscritto per tratte. L'autonomia concessa copre T04→T07 ma non autorizza a riscrivere i criteri di un
task, che è lavoro di pianificazione.

---

## 2026-10-13 — Tre decisioni di prodotto dell'umano, e una conseguenza su T03

Nessun codice scritto. Registrate qui perché cambiano la forma del lavoro che aspetta T05, e due di
esse toccano criteri di accettazione di task **già chiusi**.

**Le decisioni, come le ha date l'umano**
1. Una candidatura già inviata non fa sparire l'offerta: resta in lista, **grigia e spuntata**, non
   cliccabile. Un rifiuto la lascia in lista **rossa**, non cliccabile, "se ancora compatibile con la
   ricerca".
2. Chi rifiuta una candidatura **deve** scrivere una nota.
3. Chi si candida **può** scrivere una nota, facoltativa.

**La conseguenza che l'umano non aveva in mente, e che vale la pena non perdere:** la prima decisione
**inverte due criteri di accettazione di T03**, committato, approvato e spuntato — "richiedente con
richiesta già `pending`/`accepted` su quell'offerta → nessun match". Un'offerta che sparisce non può
essere disegnata grigia: per mostrarne lo stato deve arrivare alla schermata. Non è un difetto di T03,
era la lettura corretta del `PRD.md` di allora; è un cambio di requisito, e va emendato in `TASKS.md`
con una nota, non applicato in silenzio. Cambia anche la forma del ritorno di `findMatches` (ogni
`ScoredMatch` porta lo stato della candidatura), quindi è un ⛔ sul contratto.
Cade **solo** l'esclusione per candidatura esistente: plant, data e finestra oraria continuano a
filtrare, come dice l'umano stesso con "se ancora compatibile con la ricerca".

**La domanda su `rejected`, aperta da T03, è risolta — in una direzione che non era fra le opzioni in
discussione.** Siccome sia il grigio sia il rosso sono **non cliccabili**, una candidatura non si
rinvia mai, nemmeno dopo un rifiuto. Il criterio #5 di T05 diventa scrivibile in una riga: *doppia
candidatura = esiste già una riga per quella tratta e quel richiedente, **qualunque** stato abbia.*
Più larga di "pendente o accettata", e il buco temuto (il collega vede il match, si candida, riceve un
errore) non è nemmeno raggiungibile dalla UI, perché la riga non è cliccabile. Il controllo
nell'usecase resta come seconda rete, non come messaggio che l'utente leggerà.

**Tre buchi segnalati all'umano, non colmati da me** (sono prodotto): cosa accade a `cancelled` — se
annullare rende l'offerta di nuovo cliccabile, o se annullare è una trappola; che un'offerta che si
riempie sparisce portandosi via la candidatura `pending` del richiedente, perché il vincolo
`seatsAvailable == 0` resta; e chi è autorizzato a leggere la nota di rifiuto.

**Effetto sullo scheduling, ed è l'informazione utile.** Sono ora **tre** cambi approvati che cadono
sulle **stesse due interfacce** (`SeatOffer` e `MatchRequest`) e tutti e tre sono ⛔ di contratto:
passaggio alle tratte, stato della candidatura nel ritorno di `findMatches`, campi nota. Farli come
tre task separati significa tre checkpoint e tre giri di adapter e suite di contratto sugli stessi
file. Questo rafforza l'opzione "un task di modello prima di T05" rispetto a quando era stata
proposta: non è più infrastruttura costruita prima del suo consumatore, è il raggruppamento di tre
requisiti approvati che toccano lo stesso punto.

---

## 2026-10-13 — I tre buchi sciolti, e una **correzione** a quanto scritto un'ora prima

Nessun codice scritto. L'umano ha risposto ai tre buchi di prodotto segnalati sopra.

1. **`cancelled`** non fa sparire l'offerta e la rende **di nuovo cliccabile**: la richiesta "torna
   indietro" e chi offre l'auto non la vede più fra quelle ricevute.
2. **Quando l'auto si riempie**, le candidature `pending` su quella tratta passano a `rejected` con una
   **nota automatica** ("la macchina è stata riempita") e una notifica.
3. **La nota di rifiuto** la legge **solo** chi aveva mandato la richiesta, non gli altri passeggeri.

### Correzione a un'annotazione precedente (commit `6b9cee7`)

Nella voce qui sopra avevo scritto che il criterio #5 di T05 diventava *"esiste già una riga per quella
tratta e quel richiedente, **qualunque** stato abbia"*, perché credevo che né il grigio né il rosso
fossero ricliccabili. **È sbagliato:** la risposta (1) rende `cancelled` ricliccabile. Gli stati che
bloccano una nuova candidatura sono **tre** — `pending`, `accepted`, `rejected` — e `cancelled` non è
fra loro. Resta comunque più larga di "pendente o accettata", che era la lettura originariamente in
discussione. Corretto anche in `IDEAS.md`, nel punto dove la formulazione sbagliata avrebbe guidato chi
scrive T05.

### La risposta (2) è migliore della soluzione che avevo proposto io

Avevo proposto un'eccezione al vincolo `seatsAvailable == 0 → nessun match`, per tenere visibile
l'offerta su cui il richiedente ha una riga pendente. **Non serve più, e l'eccezione è stata
rimossa dalle proposte.** Rifiutare la candidatura con una nota che dice perché produce uno stato che
si spiega da sé, invece di una riga che resta appesa a un'offerta esaurita, e lascia intatto un
vincolo duro di T03. Meno codice e meno casi speciali nel motore.

### Tre conseguenze della (2) che vanno sapute prima di scrivere T05

- **È la prima transizione di stato non causata da un utente.** Oggi ogni transizione è un'azione
  (`requestSeat`, `acceptRequest`, `rejectRequest`); questa è un effetto collaterale
  dell'accettazione **di un altro collega**: `acceptRequest`, quando consuma l'ultimo posto, deve
  rifiutare a cascata tutte le altre `pending` di quella tratta. Aggiunge un criterio a T05.
- **Le note hanno due autori possibili**, l'owner e il sistema. "Nota obbligatoria di chi rifiuta"
  non si applica a un rifiuto senza autore umano, quindi va deciso se la riga registra *chi* ha
  rifiutato.
- **La notifica ha un costo che le altre due risposte non hanno:** richiede il port `Notifier` e
  l'adapter Expo Notifications, cioè una dipendenza nuova (⛔) e una voce di `IDEAS.md` di costo M.
  Senza notifica il comportamento resta corretto e osservabile — il richiedente vede il rosso con la
  nota quando riapre l'app. Raccomandato: **non farne un prerequisito di T05**, tenerla separabile.

### Buco nuovo, scoperto rispondendo

**Annullare una candidatura già `accepted` deve restituire il posto** (`seatsAvailable` +1). T05 ha il
decremento in accettazione e nessun incremento in annullamento, e la risposta (1) rende quel percorso
raggiungibile: senza l'incremento chi offriva perde un passeggero e tiene il posto occupato da nessuno.
Da decidere entro T05, insieme al fatto che una `cancelled` dopo `accepted` è l'unico caso in cui la
cascata del punto precedente potrebbe dover girare **al contrario** (un posto si libera, ma le
candidature già auto-rifiutate restano rifiutate).

### Risposta dell'umano, subito dopo: il buco è chiuso

Annullare una candidatura **già `accepted`** richiede **nota obbligatoria**, **notifica a chi ha
l'auto** e **restituisce il posto** (`seatsAvailable` +1). Due criteri nuovi per T05 oltre
all'incremento.

**Conseguenza di modello, con una scelta da fare.** Le note obbligatorie sono ora due, su azioni
diverse e di attori diversi — il rifiuto (owner) e l'annullamento dopo accettazione (requester) —
più quella facoltativa di chi si candida. Due forme: **(A)** campi fissi su `MatchRequest`
(`requestNote` facoltativa, `resolutionNote` obbligatoria alla chiusura, `resolvedBy:
'owner' | 'requester' | 'system'`), una riga sola e compatibile con l'upsert già documentato;
**(B)** un registro di transizioni, entità nuova con storia, tabella in più a T08. Per un MVP da pitch
basta la (A), e `resolvedBy` chiude **anche** la domanda aperta su chi ha rifiutato. Raccomandata (A).

**Buco nuovo, conseguenza diretta.** Un collega auto-rifiutato perché "la macchina è stata riempita"
non può ricandidarsi, perché `rejected` blocca. Ma se poi qualcuno annulla e un posto si libera, quel
collega resta fuori per un **incidente di tempismo** e non per una decisione di qualcuno. Con
`resolvedBy` la distinzione diventa esprimibile: un rifiuto `system` potrebbe non bloccare la
ricandidatura, un rifiuto `owner` sì. Decisione di prodotto, da prendere entro T05.

**Sulla notifica, aggiornamento al giudizio dato un'ora prima.** Ora serve in due flussi. Resta
separabile per la demo, ma il secondo è quello in cui la sua assenza **costa davvero**: chi offre
l'auto sta pianificando un viaggio e perde un passeggero senza avere motivo di ricontrollare la lista.
Separabile per il pitch, necessaria per un pilota vero. La raccomandazione non cambia (fuori da T05),
la motivazione sì: non è più "non serve", è "non serve *ancora*".

---

## 2026-10-13 — Quattro decisioni prese, **T04b** aperto, T03 emendato

Nessun codice scritto. L'umano ha risposto a quattro domande poste come scelte.

| Domanda | Risposta |
|---|---|
| Raggruppamento dei sei cambi approvati | **Task di modello prima di T05** (come raccomandato) |
| Un rifiuto automatico blocca la ricandidatura? | **No: la riga torna da sola a `pending`** (≠ raccomandazione) |
| La notifica entra in T05? | **No, task separato** (come raccomandato) |
| Emendare i due criteri di T03 | **Sì, con nota datata** (come raccomandato) |

### Il reintegro automatico è migliore di quello che avevo raccomandato io

Avevo raccomandato "un rifiuto `system` non blocca la ricandidatura", e avevo messo come
controindicazione del reintegro automatico una domanda di ordinamento: *se le righe auto-rifiutate
sono più dei posti liberati, chi rientra?* **La domanda non esiste.** Il reintegro porta a `pending`,
non ad `accepted`: tornano candidati **tutti**, e sceglie chi offre l'auto — che è esattamente il suo
ruolo in T05. Nessun criterio di equità da inventare, nessun ordine da decidere, e il collega escluso
per un incidente di tempismo non deve nemmeno accorgersi di dover riprovare.

### Tre conseguenze, da sapere prima di scrivere T05

1. **`resolvedBy` diventa portante, non informativo.** Solo i rifiuti `system` si reintegrano, quelli
   `owner` no: senza quel campo la regola non è esprimibile. Questo **chiude** la scelta fra le due
   forme delle note: la forma (A) — campi fissi `requestNote`, `resolutionNote`, `resolvedBy` — non è
   più una preferenza di costo, è un requisito funzionale. La forma (B), il registro di transizioni,
   resta disponibile ma non serve.
2. **Il reintegro deve azzerare `resolutionNote` e `resolvedBy`**, perché la riga torna aperta: i
   campi vanno nullable e resettabili, ed è un criterio di T05.
3. **È la seconda transizione pilotata dal sistema.** Scatta quando i posti di una tratta passano da
   0 a >0 con righe auto-rifiutate presenti. Oggi l'unico evento che la innesca è l'annullamento di
   una candidatura `accepted`: non esiste un percorso di modifica dei posti di una trasferta, quindi
   il trigger è uno solo e il criterio è scrivibile in modo preciso.

**Annotato per il task delle notifiche, che resta fuori da T05:** reintegro → accettazione →
riempimento → nuovo auto-rifiuto è un ciclo legittimo, ma con le push attive manderebbe due messaggi
contraddittori in pochi secondi ("sei di nuovo in gara", "la macchina è stata riempita"). Non è un
problema di T05 — senza notifiche il ciclo è silenzioso e lo stato finale è corretto — ma chi scriverà
il task delle notifiche deve saperlo, perché è il genere di cosa che si scopre in demo.

### T04b aperto in `TASKS.md`

Criteri su tre dimensioni: modello a tratte, stato della candidatura in lista, note. Porta **solo** il
modello e la forma dei dati; i comportamenti (cascata, reintegro, annullamento con nota e posto
restituito) sono di T05. `Trip` non cambia — T04 resta intatto — e l'algoritmo di `findMatches` non
cambia, solo la sua firma di ritorno. Verificato leggendo invece di assumere: `TripRequest` non cambia
nemmeno, perché descrive già una tratta sola (`fromPlantId`, `toPlantId`, `departureAt`).

Numerato **T04b** e non inserito come nuovo T05: rinumerare da T05 a T18 invaliderebbe ogni
riferimento già scritto in `PROGRESS.md`, `IDEAS.md` e `ARCHITECTURE.md`, per un guadagno estetico.

### T03 emendato, non riscritto

I due criteri restano **spuntati** e barrati, con una nota datata sopra: T03 era stato consegnato
correttamente contro il requisito di allora, ed è il requisito a essere cambiato. Cancellarli avrebbe
nascosto che una decisione è stata ribaltata; lasciarli senza nota avrebbe prodotto un documento che
contraddice il codice senza dire perché. Gli altri sette vincoli duri di T03 sono intatti e restano
sotto test di non-regressione in T04b.
