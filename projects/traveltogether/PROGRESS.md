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

---

## 2026-10-13 — T04b · **PIANIFICAZIONE**. Un criterio mio non era soddisfacibile

Nessun codice scritto. Il planner ha scomposto T04b in sette step e ha trovato un blocco che avevo
mancato **scrivendo i criteri io stesso**.

### Il criterio che non si poteva soddisfare

Avevo scritto: *"I posti sono per tratta: un test decrementa i posti dell'andata e dimostra che quelli
del ritorno sono invariati"*, e nello stesso task avevo dichiarato che `Trip` non cambia. I due sono
incompatibili: esiste **un** solo `Trip.seatsAvailable`, e `listOpenOffers` proietta da lì
(`memory-trip-repository.ts:81-82`, verificato eseguendo il grep e non sulla parola del planner). Due
offerte dalla stessa trasferta leggerebbero lo stesso numero, quindi il test chiesto dal criterio non
è scrivibile — e l'unico modo di farlo "passare" sarebbe costruire due `SeatOffer` in RAM e constatare
che sono oggetti distinti, cioè **un test che non può fallire.**

È la stessa famiglia del difetto per cui il reviewer ha bocciato T04: un documento che smentisce se
stesso. Stavolta era nel task e non nel codice, l'ho scritto io, e l'ha preso il planner prima che
costasse una riga. È il motivo per cui il planner esiste e perché su T03 era già servito allo stesso
modo.

### Le quattro decisioni dell'umano

| Domanda | Risposta |
|---|---|
| Dove vivono i posti di una tratta | **Riga di stato di tratta** (`TripLeg`) — come raccomandato |
| Ricandidatura dopo annullamento | **Riusa la stessa riga**, `cancelled` → `pending` |
| Nota di soli spazi | **Rifiutata con errore tipizzato**, non normalizzata |
| Il ⛔ allargato | **Approvato**, task corretto e via |

Scartate con motivo, non per preferenza: il **contatore-override** introduce un default implicito (a
T08 un `LEFT JOIN` con `COALESCE`) in un progetto che tratta l'implicito come difetto; i **posti
derivati dalle candidature `accepted`** metterebbero il conteggio dentro `listOpenOffers`, cioè logica
di business in un adapter — vietata dal criterio di T09 e già rifiutata dal doc del port per i vincoli
duri — e renderebbero **indifendibile lato DB** il criterio di T05 sulle due accettazioni concorrenti,
perché un conteggio non si vincola con un `CHECK`.

### Le decisioni di modello argomentate dal planner, accolte

- **L'identità della tratta è la coppia `tripId` + `direction`, non un `legId` sintetico.** Così
  l'unicità è una *conseguenza* del modello e non un'asserzione. L'argomento decisivo: una tratta è una
  **proiezione**, quindi `listOpenOffers` la ricostruisce a ogni lettura — un id generato cambierebbe
  fra due aperture della stessa schermata, e un id memorizzato richiederebbe comunque un vincolo di
  unicità sulla coppia, cioè la coppia con una colonna in più. A T08: chiave primaria composta
  `trip_legs(trip_id, direction)`, bersaglio della foreign key composta di `match_requests`, che rende
  **impossibile per costruzione** una candidatura sul rientro di una trasferta senza rientro.
- **`listByTrip` diventa `listByLeg`, e non servono entrambe.** Argomentato dai criteri di T14, non
  dalla simmetria: "i posti disponibili mostrati diminuiscono" e "esauriti i posti, lo dichiara in
  schermata" sono per tratta, e una lista per trasferta non ha un numero da accompagnare. Il
  consumatore non scritto in T14 ma reale è T05: la cascata deve leggere le `pending` di *quella*
  tratta, e senza `listByLeg` quel filtro finirebbe nel chiamante — il sintomo che `CLAUDE.md` chiama
  "manca un port".
- **La direzione non entra né nei vincoli duri né nel punteggio.** Nei vincoli sarebbe un predicato
  irraggiungibile (plant e data discriminano già la direzione), ed è lo stesso argomento con cui il
  doc di `listOpenOffers` rifiuta il filtro su `hasCar`. **La dimostrazione di dominanza del punteggio
  di T03 regge parola per parola**: il passaggio alle tratte cambia *quali* offerte entrano nel ciclo
  e *quale* chiave rompe i pareggi, non la funzione che assegna il numero. Il test che pinna il valore
  numerico non si tocca, ed è la prova che l'algoritmo non è cambiato.

### Due cose trovate dal planner leggendo il codice, entrambe entrate nei criteri

1. **La trasferta degenere è raggiungibile.** `makeTrip` **non** vieta `fromPlantId == toPlantId`: è
   una regola di creazione di T04 (`same-plant`), non un invariante. Quindi una trasferta con partenza
   uguale a destinazione è costruibile da `seminaGrezzo`, da una migrazione, dal seed di T17 — e per
   quella trasferta andata e ritorno hanno **gli stessi plant**, quindi entrambe le tratte matchano la
   stessa richiesta con lo stesso punteggio e lo stesso `tripId`. È esattamente la classe di input su
   cui il comparatore attuale ritorna `0`. Non è un'ipotesi: è un test.
2. **Il limite della nota va misurato in code point.** `'👍'.length === 2`, quindi contare le unità di
   stringa farebbe consumare quattro caratteri a due emoji e il conteggio applicato non sarebbe quello
   mostrato all'utente.

### ⛔ corretto, perché l'avevo sottostimato

Il task diceva "quattro interfacce". Sono **cinque**: si aggiunge `TripRepository`, che guadagna un
metodo per il contatore di tratta e vede `listOpenOffers` cambiare semantica. Più un'entità di dominio
nuova e la forma di una tabella di T08 pre-impegnata. `TASKS.md` emendato.

### Variazione rispetto a un pattern che il task stesso cita

Il limite della nota segue il pattern di `MatchConfig` nella sostanza — tipo nel core, valori in
`config/`, un solo arco in un test di conformità — ma **non nella collocazione**: `GRAFO.domain` in
`eslint.config.js` è `['domain']`, quindi se la validazione della nota vive nel costruttore di dominio
(dove sta, per coerenza con `makeTrip`) il tipo del limite deve stare in `core/domain` e non in
`core/usecases`. Il test di conformità, che deve importare `config/`, va in `core/usecases`. Non è una
violazione dei confini: è il lint che impone la collocazione, e va scritto per non farlo scoprire in
review.

### Cosa `verify` verde non potrà dimostrare, elencato dal planner

Nulla sulle RLS e nulla sul percorso Supabase (l'adapter non esiste: T09), quindi il criterio sulla
suite condivisa è **metà verificabile** — si prova che passa su `memory` e che non contiene nulla di
specifico della RAM; che passi su Supabase senza modifiche resta una promessa. Nessun comportamento
(cascata, reintegro, annullamento) è esercitato: il modello li rende **esprimibili**, e che *solo* i
rifiuti `system` si reintegrino — il motivo per cui `resolvedBy` è portante — non è provato prima di
T05. Nessuna presentazione: che lo stato arrivi nel risultato non dimostra che una riga sia disegnata
grigia o rossa.

**Il limite più serio, e va detto perché deriva dalla forma scelta:** la nota obbligatoria **non è
difendibile dal modello**. "Chi rifiuta deve scrivere una nota" dipende dallo *stato precedente* della
riga, che i campi fissi non conservano: una riga `cancelled` non dice se veniva da `pending` (nota non
richiesta) o da `accepted` (nota obbligatoria). Non è esprimibile come invariante di riga, quindi
`makeMatchRequest` non può imporla — la impone l'usecase di T05, e T04b **non** prova che un rifiuto
muto sia impossibile. È il prezzo dei campi fissi contro il registro di transizioni.

**E un rischio di T09 che raddoppia restando invisibile:** la tratta di ritorno è l'unico consumatore
di `Trip.returnAt`, e per `returnAt` vale tutto ciò che è già scritto su `departureAt` — PostgREST
serializza con offset e microsecondi, `parseUtcInstant` rifiuta entrambe le forme, `findMatches` omette
in silenzio. Da T04b in avanti un `returnAt` non canonico fa sparire **metà** delle offerte senza un
errore, e in RAM la suite non può accorgersene perché le fixture sono canoniche per costruzione.

Tre voci scritte dal planner in `IDEAS.md`, tutte `proposta`: il contatore dei posti su `Trip` che
resta un doppione, le candidature ricevute lette per owner invece di una tratta alla volta, e una nota
datata sulla voce dell'unicità dei `tripId`, la cui precondizione si sposta sull'identità di tratta.

---

## 2026-10-13 — T04b · implementazione dei sette step, `verify` verde, in attesa del reviewer

`verify` verde, exit 0: **192 test unitari** in 13 suite (erano 129 a fine T04), 1 int, 1 smoke.
Rieseguito da me dopo ogni giro, non solo dal developer.

### Incidente di perdita dati, risolto — e perché va scritto qui

Uno script PowerShell del developer ha usato `R`, che su Windows PowerShell è **alias di
`Invoke-History`**. Ha svuotato `trip-repository.ts` e cancellato `repository-contract.ts`,
`memory-trip-repository.ts`, `memory.contract.test.ts`, `ports/index.ts` e `create-trip.test.ts` —
cioè anche un file del commit di T04, già revisionato e approvato.

Il developer ha ripristinato i sei file da HEAD con `git restore` e rifatto a mano le proprie
modifiche. **Non ho preso per buona la dichiarazione**: HEAD contiene T04 approvato, quindi il diff
contro HEAD è la prova. Verificato eseguendo:

| Controllo | Esito |
|---|---|
| File mancanti (`git status`, voci `D`) | ✅ nessuna |
| `create-trip.test.ts` vs HEAD | ✅ **esattamente 2 inserzioni**, i due metodi nel fake `RepoSpia` |
| `trip.ts`, `create-trip.ts`, `eslint.config.js` vs HEAD | ✅ diff **vuoto** |
| `verify` | ✅ verde, 192 test, exit 0 |

**L'incidente non ha lasciato danni, e la ragione è strutturale, non fortuna:** il lavoro di T04 era
**committato**. Se fosse stato ancora nel working tree, `R` avrebbe cancellato lavoro irrecuperabile.
È il valore della regola "un task = un commit a `verify` verde" nel momento in cui serve, non quando
si scrive. Da ricordare per la gerarchia di `CLAUDE.md`: la reversibilità è seconda **sopra**
l'osservabilità e la performance, e qui ha pagato da sola.

Per il futuro: gli script degli agenti su Windows PowerShell non devono usare identificatori di una
lettera. `R` è `Invoke-History`, e il nome di variabile più innocuo del mondo riesegue comandi
precedenti. Annotato in `IDEAS.md`.

### Le due deviazioni del developer, risolte in direzioni opposte

1. **Il port separato è rientrato.** Aveva messo `findLeg`/`adjustLegSeats` su un `TripLegRepository`
   nuovo, e il motivo era un **vincolo del mio brief** (avevo vietato di toccare `create-trip.test.ts`,
   il cui fake `RepoSpia` non implementava i metodi nuovi) e non un ragionamento di design. Decisione
   dell'umano: su `TripRepository`, come il checkpoint approvato. Il ciclo di vita di una tratta non
   deve stare a cavallo di due port quando è `save` a crearla, e nell'adapter memory la separazione era
   nominale — una classe implementava entrambi sullo stesso storage. Autorizzate le due righe nel fake.
2. **Su `legKey` aveva ragione lui e il mio brief era sbagliato.** Gli avevo chiesto un test che
   dimostrasse una collisione con un `tripId` contenente il separatore. **Quella collisione non
   esiste**, verificato: se le direzioni coincidono coincidono i `tripId`; se differiscono, le stringhe
   finiscono una in `outbound` e l'altra in `return`, e nessuna è suffisso dell'altra. Ha asserito la
   proprietà vera invece di fabbricare un test su una premessa falsa. Terza volta in questa sessione
   che il documento sbagliato è mio.

### Decisioni del developer dove il brief lasciava margine, tenute

- **`adjustLegSeats(tripId, direction, delta)` è relativa, non assoluta.** Un `setLegSeats(n)`
  imporrebbe "leggi, calcola, riscrivi", e due accettazioni concorrenti venderebbero due volte
  l'ultimo posto. Col delta, a T08 diventa un solo
  `UPDATE trip_legs SET seats_available = seats_available + :delta WHERE ... AND seats_available +
  :delta BETWEEN 0 AND seats_total`, e "zero righe toccate" **è** l'errore. È il criterio di T05 sulla
  concorrenza difeso dalla **forma della firma** invece che da un commento.
- **Un caso che il brief non prevedeva**, trovato implementando la preservazione dei contatori: se la
  trasferta viene risalvata con **meno** posti totali di quelli già consumati sulla tratta, `save`
  ritorna `invalid-record` e non scrive nulla, invece di produrre una tratta incoerente. Documentato
  nel doc di `save`.
- **`maxLength: 280`** scelto dal developer perché il brief non lo indicava. Sta in `config/`, quindi
  si cambia lì; il valore giusto lo dirà T13 su un telefono vero.

### Due cose che il developer ha corretto da sé, e valgono più dei test che hanno prodotto

- **Una sonda che non discriminava.** La prima prova sul conteggio in code point usava cinque emoji e
  **restava verde** sostituendo `Array.from(testo).length` con `testo.length`: il test non misurava
  niente. L'ha rifatta con sei emoji e ha ottenuto il rosso. Ha trovato da solo un test incapace di
  fallire, che è la regola che questo progetto applica più di ogni altra.
- **Non ha usato `seminaGrezzo` per la trasferta degenere**, come gli avevo detto, perché
  `seminaGrezzo` **non materializza le tratte** e quindi la trasferta non produrrebbe offerte: il test
  sarebbe passato per il motivo sbagliato. Nel contratto il caso passa da `save` (che accetta
  `from == to`, perché non è un invariante di `makeTrip`); in `find-matches.test.ts` sono due offerte
  letterali, perché `core/` non può importare un adapter.

Circa trenta sonde eseguite in totale, ognuna con mutazione, rosso verificato e ripristino.

### Correzione mia prima di chiamare il reviewer

Il banner di non-regressione diceva *"I sette vincoli che continuano a OMETTERE"* elencandone **sei**,
con il settimo criterio di T03 — l'orario esattamente al limite — nascosto in una parentesi. Ma quel
criterio è di **segno opposto**: al limite l'offerta **deve** essere un match. Tenerlo fra gli omessi
conflaterebbe una regola che esclude con una che include. Riscritto contando i due gruppi a parte e
citando l'emendamento del 13 ottobre, così chi legge il blocco sa perché sono sette e non nove.
L'imprecisione l'ha segnalata il developer nel proprio report, invece di lasciarla passare.

### Cosa `verify` verde **non** dimostra

Oltre a quanto già elencato in pianificazione: nessun comportamento di T05 è esercitato (cascata,
reintegro, annullamento), quindi che *solo* i rifiuti `system` si reintegrino — il motivo per cui
`resolvedBy` è portante — resta non provato. La nota obbligatoria al rifiuto **non** è difendibile dal
modello, perché dipende dallo stato precedente della riga: la impone T05. E `Trip.seatsAvailable` è
ora un valore iniziale che nessuno aggiorna più: `listOpenOffers` legge dalle tratte, quindi il campo
non mente a nessuno oggi, ma a T08 va deciso se la colonna esiste ancora su `trips`.

### Round 1 di review — **APPROVATO**, nessun bloccante

`verify` rieseguito dal reviewer: verde, 192 test, exit 0. **Prima volta in Fase 2 che un task passa
senza bocciature**, e vale la pena notare che è anche il più grande (cinque interfacce pubbliche, una
entità di dominio nuova, 63 test aggiunti).

**Il controllo sull'incidente è il più accurato della sessione, e ha escluso una cosa che io non
potevo escludere col diff.** Il reviewer non si è fidato del numero 192:

1. **Conteggi di `it(` per file, HEAD contro working tree:** nessuno è **scceso**.
   `create-trip.test.ts` è a 35 come a HEAD, con il diff delle sole 2 inserzioni nel fake.
2. **Le 19 righe cancellate** in `repository-contract.ts` — il file ricostruito da zero — isolate una
   per una: sono **soltanto** le tre firme rinominate e la riscrittura di un fixture. Nessun blocco
   `it(` preesistente rimosso; i tre che compaiono fra le cancellazioni ricompaiono col nome nuovo.
3. **Il vettore che il conteggio totale non rivelerebbe**, e che non avevo pensato io: un file di test
   nuovo non intercettato da `testMatch` resterebbe **fuori dal runner senza far rumore**. Ha eseguito
   i file uno per uno e la somma fa **192 esatti**, quindi non c'è né una suite nascosta né una
   contata due volte. La contabilità chiude all'unità.
4. **I file ripristinati e non modificati** (`ports/index.ts`, `eslint.config.js`) sono assenti da
   `git status`, quindi `git restore` li ha riportati bit per bit — che è anche la prova che il
   divieto `core/ → adapters/` non è stato allentato per far passare i test nuovi.

**Un test aggiunto dopo l'approvazione, ed è giusto dichiararlo.** Il reviewer ha segnalato come non
bloccante (N3) che la **precedenza** fra due criteri di T04b non era né commentata né pinnata:
`seatsAvailable <= 0 → continue` precede il calcolo dello stato, quindi chi ha una candidatura
`accepted` sull'ultimo posto **non vede più** quell'offerta in lista. La scelta è giusta — il criterio
emendato dice di non omettere *a causa della candidatura*, e qui si omette per i posti — ma non era
protetta da niente. Ho aggiunto il commento e l'`it` nella forma che il reviewer stesso ha specificato.

**La sonda su quel test è stata eseguita, e la mutazione scelta è quella che discrimina.** Togliere il
controllo sui posti avrebbe fatto cadere anche il test di T03, quindi non avrebbe provato che il test
nuovo serve. Ho usato invece la mutazione realistica — una candidatura che **scavalca** il filtro sui
posti (`seatsAvailable <= 0 && !giàCandidato`) — e il risultato è **un solo test rosso, il mio**, con
gli altri 39 verdi compreso quello di T03. Cioè il test nuovo intercetta una mutazione che nessun
altro test vede: è la differenza fra un test che aggiunge copertura e uno che ne duplica.

**Quattro non bloccanti, tre diventati voci di `IDEAS.md`** (nessuna implementata):

- **La lunghezza della nota è validata anche in lettura.** `findById` valida la riga riletta contro la
  config **corrente**: il giorno in cui `maxLength` scende da 280 a 140, ogni nota già scritta più
  lunga — seed di T17 compreso — diventa `invalid-record`, e le schermate mostrano un errore su un
  dato che **era valido quando è stato scritto**. È la differenza fra un invariante e una soglia, e
  `PROGRESS.md` dichiara già che quel numero verrà ritarato dopo T13: l'innesco è previsto.
- **Cancellare una tratta con candidature aperte: i due adapter divergeranno.** In RAM `save` elimina
  le tratte in silenzio e la suite lo verifica; con la foreign key composta che questo task
  pre-impegna, Postgres solleverebbe una violazione **nello stesso punto**. Nessun test combina
  "tratta eliminata" con "candidatura su quella tratta", quindi la suite condivisa non lo vede — e a
  T09 l'unica uscita sarebbe *adattare la suite*, che per `ARCHITECTURE.md` è il segnale che il port
  è sbagliato. Va deciso prima della migrazione, e merita un criterio in più su T08.
- **`adjustLegSeats` difende il contatore, non l'accettazione.** L'atomicità copre il delta, non la
  coppia "transizione di stato + decremento": un'accettazione interrotta fra le due scritture lascia
  un posto consumato senza candidatura accettata. E il delta è idempotente a zero ma **non a
  ripetizione**: ciò che impedisce il doppio decremento è il controllo di stato nel chiamante, non la
  firma. Il criterio di T05 poggia quindi sul chiamante.
- Nit non sanato: `memory-trip-repository.test.ts` ha perso il newline finale.

**Nota di merito registrata dal reviewer**, e la sottoscrivo: il developer ha trovato da sé una sonda
che non discriminava, e ha **disobbedito a due istruzioni del mio brief nel verso giusto** — la
collisione di `legKey`, che non esiste e che un agente meno attento avrebbe fabbricato per compiacere
il brief; e `seminaGrezzo` per la trasferta degenere, che avrebbe reso il test verde per il motivo
sbagliato perché non materializza le tratte.

---

## 2026-10-13 — Nuova regola di comunicazione, e i criteri di T05 riscritti

### I dubbi si pongono come domande a risposta multipla

Richiesta esplicita dell'umano: *"non voglio leggere tutto il testo per capire cosa devo
specificare"*. Scritta in `CLAUDE.md` dell'officina, § "Domande all'umano", perché valga per ogni
progetto e sia visibile ai subagent. In sintesi: `AskUserQuestion` invece di prosa, raccomandazione
come prima opzione, il contesto **dentro** l'opzione e non in un paragrafo prima, nessuna opzione
"Altro" scritta a mano (il campo libero lo aggiunge lo strumento), massimo quattro domande per giro.

Due limiti messi nella regola per non trasformarla nel suo opposto: ciò che l'agente può decidere da
sé **non** diventa una domanda — si decide, si dichiara in una riga e si va avanti — e la regola vale
per i dubbi, non per i resoconti.

### Tre decisioni, due come raccomandate e una diversa

1. **Annullare una `accepted` fa scattare il reintegro.** Confermato: è lo stesso evento già deciso
   (posti della tratta da 0 a > 0), quindi non è una regola nuova ma la conferma dell'innesco.
2. **Tratta che scompare: annullamento a cascata con nota automatica** — **non** la mia
   raccomandazione, che era `save` che rifiuta. Vedi sotto: la scelta è migliore per l'utente ma non
   ha un innesco oggi.
3. **La lunghezza delle note sarà validata solo in scrittura.** Entra in T05 come correzione.

### La seconda risposta non è implementabile adesso, e il perché conta

L'annullamento a cascata richiede un usecase di **modifica trasferta** che **nessun task del backlog
prevede**: oggi `save` è chiamato solo da `createTrip`, dove non esistono né tratte né candidature
preesistenti. Quindi una tratta non può sparire in nessun flusso di prodotto attuale, e il
comportamento scelto non ha un trigger da cui partire.

E non può stare nell'adapter: un `save` che annulla candidature sarebbe logica di business dentro un
repository, vietata dal criterio di T09 e già rifiutata dal doc del port per i vincoli duri.

**Decisione mia, dichiarata invece di richiesta come quarta domanda:** metto in T05 il criterio che
`save` **rifiuti** con errore tipizzato se la nuova forma eliminerebbe una tratta con candidature
aperte. Non è la risposta alla domanda dell'umano — è la rete che rende impossibile **dimenticare**
l'annullamento a cascata, ed è l'unico comportamento su cui i due adapter concordano, perché su
Postgres la foreign key composta rifiuterebbe comunque. L'annullamento a cascata diventerà un criterio
del task di modifica trasferta, quando esisterà: cancella prima, salva dopo. Il guard non lo
contraddice, lo precede.

### I criteri di T05 riscritti

Gli otto originali erano scritti quando l'unità di offerta era la **trasferta**: cinque nominavano un
`seatsAvailable` che ora esiste per tratta, e uno avrebbe classificato come doppione il collega che
prende andata **e** ritorno dalla stessa persona — il caso che l'umano ha indicato come il migliore.
Sostituiti da un elenco su cinque dimensioni: candidatura, accettazione e rifiuto, annullamento, le
due transizioni pilotate dal sistema, e le correzioni portate da T04b.

Il reintegro porta a `pending` e **non** ad `accepted`, quindi non serve nessun criterio di precedenza
fra le righe reintegrate: tornano candidate tutte e sceglie chi offre l'auto. È la ragione per cui la
scelta dell'umano sul reintegro automatico non ha introdotto la domanda di ordinamento che temevo.

**Resta aperta e non bloccante:** la schedulazione del task di modifica trasferta, e delle altre voci
`accettata` di `IDEAS.md`. Da porre come domanda quando T05 sarà chiuso, per non consumare un giro di
domande su qualcosa che non blocca.

---

## 2026-10-13 — T05 · **PIANIFICAZIONE** in sette step. Un altro criterio mio scritto male

Nessun codice. Il planner ha scomposto T05 e ha formulato le proprie decisioni aperte **come opzioni
selezionabili**, come prescrive la sezione nuova di `CLAUDE.md`: la regola ha funzionato al primo giro.

### Ordine degli step, e il perché

Prima le **quattro azioni dell'utente** (`requestSeat`, `rejectRequest`, `acceptRequest`,
`cancelRequest`), poi le **due transizioni di sistema** (cascata e reintegro), poi le correzioni di
T04b. Motivo non ovvio: il reintegro è osservabile **solo** se esistono insieme una riga
`rejected`/`system` — che la produce la cascata — e un evento che riporta i posti sopra zero, che lo
produce l'annullamento di una `accepted`. Metterli adiacenti e per ultimi dà un solo punto in cui
nasce la scrittura con `resolvedBy: 'system'`, e permette al test del **ciclo completo** (accetta →
riempi → cascata → annulla → reintegro → riaccetta) di esistere nello step che lo chiude.

### Un altro criterio che avevo scritto male, e stavolta sul lato Postgres

Avevo messo in T05: *"`save` rifiuta se la nuova forma eliminerebbe una tratta con candidature
**aperte**"*. **Sbagliato.** Su Postgres la foreign key composta blocca la cancellazione di una tratta
finché esiste **qualsiasi** riga che la referenzia, comprese le `rejected` e le `cancelled`. Un guard
limitato alle aperte non avrebbe chiuso la divergenza fra i due adapter: l'avrebbe spostata sulle righe
chiuse, dove `memory` elimina la tratta e Postgres no — e `verify` verde non lo mostrerebbe fino a T09.

**Decisione dell'umano: il criterio esce da T05 e va a T08**, dove lo schema si scrive e dove la
semantica della foreign key è una scelta e non un'ipotesi. Nel frattempo il percorso è
**irraggiungibile**: `save` è chiamato solo da `createTrip`, dove non esistono né tratte né candidature
preesistenti. Aggiunti a T08 sette criteri che il modello a tratte ha prodotto: chiave primaria e
foreign key composte, i `CHECK`, la forma dell'`UPDATE` atomico, la decisione sulla tratta eliminata,
e le RLS di **scrittura** su `trips` e `match_requests`.

### La seconda domanda l'ho chiusa io, e il motivo è che la risposta esisteva già

Il planner chiedeva dove vive il test di interleaving, perché **nessun file dentro il grafo dei confini
può vedere insieme un usecase e l'adapter vero**: verificato su `eslint.config.js`,
`adapters: ['domain','ports','adapters','config']` (senza `usecases`) e `usecases` senza `adapters`,
con due reti indipendenti. Le opzioni erano un fake dentro `core/`, oppure `src/__tests__/` che è fuori
dal grafo, oppure il fake più un criterio su T08.

**Non l'ho girata all'umano** perché T08 ha **già** il criterio *"il decremento di `seats_available` è
atomico lato DB: un test di concorrenza non va sotto zero"* — verificato leggendolo. Quindi la terza
opzione non aggiungeva niente e la prima è la scelta: fake fedele dentro `core/usecases`, e la
copertura dichiarata come **composta** — la suite di contratto prova che l'adapter vero rispetta i
limiti del delta, questo test prova che l'usecase si fida dell'esito del delta e non di una lettura
propria. Niente zona di test senza confini.

### Le decisioni di progetto del piano, accolte

- **Posti prima, stato dopo, in `acceptRequest`.** È l'unico ordine che rende vero il criterio sulla
  concorrenza: il decremento è la sola operazione con ammissione atomica, quindi deve stare sulla
  porta. Se la transizione venisse prima, due accettazioni diventerebbero entrambe `accepted` e il
  criterio "i posti non vanno sotto zero" sarebbe vero per il contatore e **falso per il prodotto** —
  due passeggeri su un posto. E il danno residuo è conservativo: resta un posto consumato da nessuno
  (capacità persa, visibile, recuperabile) invece di una candidatura accettata senza posto
  (sovravendita, non recuperabile perché la riga `accepted` blocca il ritentativo, e si manifesta il
  giorno della trasferta davanti a una persona).
- **Cascata e reintegro in un modulo condiviso**, due funzioni nominate con un chiamante ciascuna, non
  un dispatcher. Il dispatcher unico avrebbe avuto, dentro `acceptRequest`, un ramo "posti > 0 →
  reintegra" **irraggiungibile**: perché una riga `system` esista i posti devono essere stati a 0, e
  perché un'accettazione lasci posti > 0 devono essere stati ≥ 2. È lo stesso argomento con cui il doc
  di `listOpenOffers` rifiuta il filtro su `hasCar`. Quello che si evita duplicando non è il ciclo —
  dieci righe — è la **politica di fallimento parziale**, che deve esistere una volta sola.
- **L'identità entra come campo dell'input** (`actorId`), non dal `SessionGateway`: è il pattern di
  `createTrip`, e il gateway resta ciò che la UI usa per *ottenere* l'identità prima di chiamare.
- **Il testo della nota automatica sta in `config/`**, con un test di conformità che verifica che stia
  entro `maxLength` **in code point**: senza, il giorno in cui il limite scende la cascata fallirebbe
  con `note-too-long` su un testo che nessun utente ha scritto.
- **`acceptRequest` ritorna anche l'elenco delle righe auto-rifiutate**, per rendere la cascata
  asseribile dall'esterno invece di dedotta rileggendo le altre righe.

### Cosa il piano dichiara che `verify` verde non potrà dimostrare

Oltre al solito su RLS e Supabase: **nulla sulla concorrenza reale** — un event loop, un processo, uno
store sincrono e un'intercalatura scelta dal test, quindi il nome del test deve dire *interleaving* e
non *concorrenza*, perché un test che desse l'impressione di provare la difesa lato DB sarebbe peggio
di nessun test. **Nulla sull'atomicità della coppia stato+posti:** l'ordine scelto limita il danno, la
compensazione lo riduce, nessuno dei due lo elimina. E due accettazioni concorrenti della **stessa**
riga restano capaci di decrementare due volte, perché `save` è un upsert incondizionato e non esiste
un compare-and-set: è la voce I3 di `IDEAS.md`, lasciata `proposta`.

Tre voci nuove scritte dal planner in `IDEAS.md`, tutte `proposta`: RLS di scrittura su
`match_requests`, la cascata che scrive N righe una alla volta senza transazione, e `src/__tests__/`
che è fuori dal grafo dei confini.

---

## 2026-10-13 — T05 · sette step implementati, `verify` verde, in attesa del reviewer

`verify` verde, exit 0: **261 test unitari** in 21 suite (erano 193 a fine T04b), 1 int, 1 smoke.
Rieseguito da me dopo ciascuno dei due giri. Scope verificato: `core/ports` ed `eslint.config.js` con
diff **vuoto**; `core/domain` toccato solo in `match-request.ts` e nel suo indice, come autorizzato
per S7.

### Le due transizioni di sistema sono inverse, e c'è un test che lo prova

`seat-cycle.test.ts` fa il giro in un test solo: A prende l'ultimo posto → B e C rifiutate dal sistema
→ A annulla → B e C tornano `pending` → l'owner accetta B → C rifiutata di nuovo, e A, **annullata da
una persona**, non viene toccata. Gli `adjust` sono `[-1, +1, -1]`. È il test che dimostra che il
modello di T04b regge il giro completo, non solo le singole transizioni.

L'innesco è letto dal **valore ritornato dal decremento atomico**, non da una rilettura della tratta:
la cascata scatta se `adjustLegSeats` ritorna `seatsAvailable === 0`, il reintegro se il `+1` porta a
esattamente 1. Rileggere introdurrebbe una finestra fra decremento e decisione.

### Due decisioni del developer, tenute

- **Cascata a metà → `ok` con `cascadeFailure`, non `err`.** Il successo dell'utente non si ritira per
  un effetto collaterale incompleto: A resta `accepted`, il posto resta consumato, e le righe non
  chiuse sono elencate. La cascata prosegue dopo un fallimento, così `unclosed` contiene solo quelle
  che hanno davvero fallito e non quelle che non sono state tentate.
- **Il ritorno elenca le righe reintegrate**, per simmetria con `autoRejected`: è l'unico modo di
  sapere chi è tornato in coda senza rileggere la tratta, e chi offre l'auto dovrà essere avvisato.

### Il test di interleaving è cambiato, e il cambiamento è informativo

Le sue asserzioni finali ora contano **due** `save` invece di una: l'accettazione vincente consuma
l'ultimo posto, quindi la cascata rifiuta come `system` la candidata perdente. L'ordine delle scritture
e il fallimento del perdente restano identici. Non è un indebolimento del test: è la cascata che si
manifesta in uno scenario dove prima non c'era niente da rifiutare.

### S7 ha sistemato metà del problema, e la metà che resta va giudicata

Il criterio chiedeva che la lunghezza delle note fosse validata **solo in scrittura**, e in lettura
ora è così: una nota di 200 code point scritta con limite 280 si rilegge intatta anche dopo che il
limite è scceso a 10. **Ma le `save` degli usecase rivalidano la `requestNote` già esistente contro il
limite corrente.** Conseguenza: dopo un abbassamento del limite, una riga con nota vecchia e lunga non
si può più accettare, rifiutare, annullare né reintegrare — fallisce con `note-too-long`, e in un
reintegro finisce in `unclosed`.

Il criterio **alla lettera è soddisfatto** (quelle sono scritture). Il suo **scopo** no: la voce di
`IDEAS.md` da cui nasce dice *"un parametro di prodotto non deve poter rendere illeggibili dati già
scritti"*, e una riga che non si può più **modificare** è un grado peggio di una che non si può
leggere — si congela, e si congela proprio nel momento in cui qualcuno la sta chiudendo. Il rimedio
sarebbe validare solo i campi che la scrittura **sta impostando**, lasciando stare quelli che transita.
Segnalato al reviewer come punto da giudicare, non risolto: non voglio deciderlo io, perché è il
secondo giro sulla stessa famiglia di problema.

Residuo minore dichiarato dal developer: `note-blank` resta una regola di sola scrittura, quindi una
riga con nota di soli spazi seminata in modo grezzo si rileggerebbe come `ok`. Coerente con il brief,
che elencava come strutturali solo la risoluzione incompleta e `pending` con risoluzione.

### Una corsa che nessuno ha deciso, e la correzione di come è stata descritta

Fra la lettura di `listByLeg` nella cascata e una `requestSeat` concorrente non c'è alcun lock: una
candidatura che arriva subito dopo l'ultima accettazione resta `pending` su una tratta a zero posti.
Il developer l'ha riportata come *"la product decision è che sia lecito"*: **nessuno l'ha deciso.**
Segue da una scelta **mia** nel brief — `requestSeat` non rifiuta per posti a zero, perché `findMatches`
omette le tratte esaurite e il prodotto gestisce l'auto piena con la cascata — e va attribuita a quella,
non a una decisione dell'umano.

Non è uno stato bloccato: chi offre l'auto vede la richiesta, non può accettarla (`no-seats-available`)
e la chiude con un rifiuto motivato, che è esattamente ciò per cui la nota obbligatoria esiste. Ma è un
percorso in cui l'utente si candida e **poi** scopre che non c'era posto, e va dichiarato nei test di
T08 invece di restare implicito.

### Sonde: nove mutazioni, nove rossi verificati

La più istruttiva è *"stato d'arrivo del reintegro `accepted` invece di `pending`"* → **3 rossi**,
compreso il ciclo completo. E *"cascata che chiude tutto ciò che non è `accepted`"* → 2 rossi, cioè
proprio le `cancelled` e le `rejected/owner` che non devono essere toccate: è la prova che
`resolvedBy` è un campo portante e non diagnostico.

Due mutazioni **non** provate, dichiarate dal developer: la cascata con scope sull'intera trasferta
invece che sulla tratta, e un `accept` che ritira l'accettazione se la cascata fallisce.

### Round 1 di review — **APPROVATO**, nessun bloccante

Il primo giro del reviewer è morto per **limite di sessione** prima del verdetto, non per un problema
del lavoro. Ripreso il giorno dopo dal suo stesso contesto, con lo stato riverificato da me prima:
HEAD invariato, niente in staging, `verify` verde. `verify` rieseguito anche da lui: 261 test, exit 0.

**Contabilità chiusa all'unità**, file per file eseguiti uno a uno: 55+40+38+17+13+12+12+11+11+8+7+7+6+5+5+3+3+3+2+2+1 = **261 esatti**. È il controllo che esclude una suite
nascosta al runner o contata due volte, e che il totale da solo non può dare.

### Sul punto che gli avevo chiesto di giudicare: diagnosi giusta, gravità sbagliata

Gli avevo segnalato che le `save` degli usecase rivalidano la `requestNote` **in transito**, quindi
dopo un abbassamento del limite una riga con nota vecchia e lunga non si può più chiudere. Verdetto:
**la diagnosi è esatta in ogni dettaglio, la conclusione sulla gravità no**, e soprattutto **è il
criterio a essere scritto troppo stretto, non il codice a essere sbagliato.**

Le quattro ragioni per cui non ha bloccato, e le sottoscrivo:
1. il criterio è soddisfatto **e non per cavillo** — chiede che la riga si *rilegga* dopo
   l'abbassamento, e c'è il test che lo fa (200 code point scritti a 280, limite a 10, nota identica
   in rilettura) più il compagno che prova che la scrittura resta rifiutata;
2. **lo stato rotto oggi è irraggiungibile**: serve che un umano abbassi il limite sotto una nota già
   scritta, e finché il limite è 280 note più lunghe non possono esistere. Non scatta da sé;
3. **quando scatta non è silenzioso**: errore tipizzato con la violazione originale conservata, e
   nelle transizioni di sistema la riga compare in `unclosed` con la causa. Per la gerarchia di
   `CLAUDE.md` è questo il discrimine — non c'è perdita silenziosa;
4. il rimedio è una **decisione di design** che tocca `core/domain`, non autorizzato in T05 oltre S7,
   e imporne una sarebbe il reviewer che decide il design.

Dove mi ha dato ragione, ed è la parte che resta: **il criterio va riscritto** da *"si rilegge senza
`invalid-record`"* a *"si rilegge **e si può chiudere**"*, altrimenti la metà che manca scompare dal
tracciamento. La domanda sulla forma del rimedio va all'umano, e il reviewer l'ha già formulata come
quattro opzioni.

### Due commenti falsi corretti da me prima del commit

Entrambi non bloccanti, entrambi della classe di difetto su cui questo progetto **boccia** — un
documento che dichiara qualcosa che il codice contraddice — quindi li ho chiusi invece di rimandarli.

1. **Il doc di `abbassaLimiteNote` prevedeva male T09.** Diceva *"su Supabase il limite non vive
   nell'adapter e l'hook sarà un no-op"*. Falso: il doc del port impone che `save` validi con
   `makeMatchRequest` prima di scrivere, e quello richiede un `NoteConfig`, quindi l'adapter Supabase
   lo riceverà iniettato come quello memory e l'hook si implementa allo stesso modo. Scritto come
   no-op a T09, un test sarebbe diventato **vacuo** e un altro **rosso**, e si sarebbe finiti ad
   "adattare la suite" — che per `ARCHITECTURE.md` è il segnale che il port è sbagliato, mentre qui
   sarebbe stato sbagliato solo il commento.
2. **Un'invariante dichiarata "per costruzione" aveva un'eccezione.** `cancel-request.ts` diceva che
   un `+1` da 1 a 2 non può trovare righe `system`. Vero nel caso normale, **falso** se un reintegro
   precedente è rimasto incompleto: una riga `system` sopravvive su una tratta con un posto già
   libero, e il secondo annullamento non la reintegra. Non è un difetto di correttezza — la riga è in
   `unclosed` e il recupero è un nuovo passaggio sopra zero — ma è lo stesso motivo per cui il
   reviewer ha bocciato T04: *un commento che dichiara impossibile uno stato raggiungibile è
   un'informazione falsa nel posto dove la si cerca.* Corretto nel codice **e** nel commento del test
   che la ripeteva, che è anche il test che produce quello stato.

### Le due mutazioni "non provate" erano in realtà coperte

Il reviewer le ha valutate entrambe e nessuna lascia scoperto niente. La cascata con scope sulla
trasferta non è nemmeno **esprimibile** senza inventare un metodo che il port non ha più (`listByTrip`
è stato rimosso in T04b), e la sua forma equivalente farebbe cadere due test. L'`accept` che ritira
l'accettazione è pinnato da **tre** asserzioni dello stesso test. Giudizio da registrare: *la prudenza
del developer nel dichiararle non provate è il contrario del problema che questo progetto teme.*

### Il test di interleaving: il cambiamento non era un indebolimento, ed era impossibile che lo fosse

Le asserzioni portanti non sono il conteggio delle `save` ma "esattamente una vince", "una sola riga
`accepted`" e "posti a zero": se la perdente scrivesse il proprio stato il test cadrebbe **prima** di
arrivare al conteggio. Verificata anche la non-flakiness su entrambi gli ordini di intercalazione.
Una precisazione del reviewer che vale la pena tenere: il commento dice che il test *"prova che
l'usecase delega l'ammissione"*, ma in senso strict non può distinguere "delega" da "rilegge e poi
delega"; ciò che prova è che l'usecase **non tiene una decisione sui posti fuori dall'operazione
atomica**. La proprietà che mi interessava — innesco letto dal valore ritornato — l'ha verificata
**leggendo**: `findLeg` non compare né in `accept-request.ts` né in `cancel-request.ts`, esiste solo
in `request-seat.ts` per l'esistenza della tratta. Nessun percorso rilegge.

### `request-test-fakes.ts`: accettabile, e non è un'idea implementata senza approvazione

Verificato dal reviewer: `core/usecases/index.ts` **non** lo esporta, quindi non entra nel bundle, e i
suoi importatori sono esattamente i sette file di test di T05 — `create-trip.test.ts` è rimasto con i
propri fake e non è nemmeno modificato. La voce di `IDEAS.md` propone un modulo **trasversale**: qui
non è stato fatto. E la collocazione in una cartella di produzione è **forzata**, non una scorciatoia:
un `src/core/testing/` non sarebbe un elemento dichiarato in `boundaries/elements` e con
`default: 'disallow'` nessuno potrebbe importarlo; un `.test.ts` verrebbe eseguito da jest come suite
vuota. Annotato sulla voce perché il task futuro lo **assorba** invece di creare un secondo modulo.

### Una cosa che il reviewer ha trovato sui conteggi, e che vale come precedente

Confrontando i numeri ha notato che `find-matches.test.ts` ha **40** test e non i 39 che aveva
verificato lui durante la review di T04b. Non è una discrepanza: è il test che **io** ho aggiunto dopo
la sua approvazione, accogliendo il suo rilievo N3 sulla precedenza fra "posti esauriti omette" e "la
candidatura marca". Ha verificato che è un **rafforzamento** — una aggiunta, zero cancellazioni,
nessun altro test alterato — e ha registrato il metodo per la prossima volta che un file di un task
approvato viene toccato dopo la review: `git diff` sul solo file, contando gli `it(` aggiunti e
cancellati. È il controllo giusto, e vale la pena averlo scritto.

**T05 committato** come `792fdf6`, un commit unico, 27 file, working tree pulito.

---

## 2026-10-14 — Due decisioni dell'umano, e una che non chiude il problema per cui è nata

Nessun codice. Registrate perché cambiano i criteri di task futuri.

### 1. Tetto alla digitazione della nota, con contatore dei caratteri residui

Decisione: nel campo nota la digitazione **si ferma** al massimo (~255 caratteri) e un contatore mostra
i caratteri ancora disponibili. Da implementare **nel task che definirà la schermata delle note**.

**Due cose vanno dette, perché la decisione è buona ma risponde a una domanda diversa.**

La prima: **non chiude il problema che l'ha fatta nascere.** Il contatore impedisce di scrivere note
troppo lunghe *da qui in avanti*; il caso segnalato dal reviewer è una nota scritta quando il limite
era 280 che diventa **inchiudibile** se il limite scende a 140. Quelle righe esistono già e nessun
contatore le raggiunge. Il residuo resta aperto, e si chiude in uno dei due modi: validare solo i campi
che la scrittura imposta (la voce in `IDEAS.md`), oppure dichiarare il limite **non abbassabile** sotto
il tetto di digitazione — che con questa decisione diventa una scelta coerente invece di una rinuncia,
perché il tetto dell'interfaccia e la soglia del dominio diventerebbero lo stesso numero. **Girata
all'umano come domanda.**

La seconda: **il task in cui metterla non esiste.** Le note si scrivono in due punti — `requestNote`
quando si candida (T13) e `resolutionNote` quando si rifiuta o si annulla (T14) — e **né T13 né T14
menzionano le note**, perché i loro criteri precedono la loro esistenza. Non le menzionano nemmeno le
offerte grigie o rosse, le due tratte, la cascata e il reintegro. Aggiunto un riquadro sopra T13 che
dichiara che quei criteri **vanno riscritti prima di aprirli**, come è stato fatto per T05: aprirli
così produrrebbe codice verde contro un modello che non esiste più, che è esattamente come cinque
criteri su otto di T05 erano diventati sbagliati senza che nessun test lo dicesse.

Vincolo tecnico annotato: il tetto di digitazione deve venire dallo **stesso** `NOTE_CONFIG.maxLength`
del dominio, non da una costante nel componente. Due numeri che devono restare d'accordo sono il modo
in cui divergono.

### 2. I parametri di configurazione non si mostrano alla platea

Decisione: i valori di `config/` sono visibili solo lato admin; la platea vede i **KPI**, eventualmente
come gauge, mai i parametri.

**Oggi non c'è niente da nascondere, e questo cambia la natura del vincolo.** I parametri sono
**letterali compilati** in `config/`, non valori modificabili a runtime: un "tab configurativo" non
esiste. La decisione è quindi un vincolo su **cosa non costruire** — se servirà una UI di
configurazione è admin-only, e non è nello scope della demo.

**E un "lato admin" non esiste nel modello:** `Profile` ha `id`, `displayName`, `plantId` e nessun
ruolo. Un gate admin richiederebbe un campo ruolo, una policy RLS che lo rispetti e un ⛔ di contratto.
Per la demo non serve, perché non c'è nessuna schermata da proteggere.

Compatibile con il criterio di T16 già scritto (*"è visibile che saving e CO₂ sono stime da parametri
configurabili"*): dichiarare che un numero è una stima derivata da parametri **non** richiede di
mostrare i parametri, ed è anzi ciò che la rende credibile senza aprire il cofano in sede di pitch.
Riquadro aggiunto sopra T16.

### 3. I parametri di T06: default dichiarati

L'umano ha confermato la prima opzione: metto default difendibili in `config/` e li elenco qui con il
ragionamento, così li sostituisce senza toccare codice. Li scriverò nella voce di T06, non qui, perché
è lì che vanno cercati.

---

## 2026-10-14 — La base di calcolo dei KPI, e il residuo delle note chiuso come migrazione

Nessun codice. Due risposte dell'umano, nessuna delle quali era fra le opzioni che avevo offerto.

### Il residuo delle note: non è un problema di codice, è una migrazione

Risposta dell'umano: *"tutto quello che è oltre quel limite, attualmente, abbassalo sotto la soglia
facendo una sintesi in modo che non ci siano falsi negativi."*

**Applicata oggi è un no-op, e va detto:** non esiste **nessun dato** da migrare. L'app non è
deployata, `match_requests` non esiste nemmeno come tabella (arriva a T08), e le sole note in
circolazione sono fixture di test. Quindi il residuo oggi è chiuso dal fatto che non c'è niente da
chiudere.

**Quello che la risposta stabilisce, e che vale per il futuro, è una procedura:** abbassare
`NOTE_CONFIG.maxLength` **non è una modifica di configurazione, è una migrazione** — chi lo abbassa
accorcia contestualmente le note che sforano, così nessuna riga resta inchiudibile. Il codice non
cambia: resta la validazione sulla riga intera, e il limite resta liberamente abbassabile **a patto
che** l'abbassamento porti con sé il dato. Registrato come criterio di T08, che è dove le migrazioni
si scrivono.

**Una cosa la decido io e la dichiaro, invece di chiederla:** la sintesi **non è silenziosa**. Accorciare
la nota di una persona significa riscrivere ciò che ha scritto, e in questo progetto una modifica
silenziosa del dato di un utente è il difetto che inseguiamo da tre task. Quindi la riga accorciata va
**marcata come tale**, così chi la legge sa di non star leggendo l'originale. Il come — un flag, un
suffisso dichiarato — lo decide T08 insieme alla migrazione.

### La base di calcolo dei KPI: la sua risposta è migliore della mia raccomandazione

Avevo proposto: CO₂ per tratta, auto e giorni solo con **entrambe** le tratte coperte. Ragionamento:
un noleggio si paga a periodo, quindi condividere una sola tratta non evita giorni di noleggio.

Risposta dell'umano: *"io comunque devo fare una trasferta di 3 giorni, ma non ho preso una macchina
per me, indipendentemente da come vado e torno."*

**Ha ragione, e il mio errore era di modello.** Avevo assunto che chi condivide una sola tratta noleggi
per l'altra. Ma nel prodotto un **passeggero non noleggia affatto**: ha `hasCar: false` sulla propria
trasferta, e come copre la tratta che non ha condiviso (treno, un altro collega, un passaggio) è fuori
dal modello. Il fatto contabile — l'unico misurabile dai dati, e l'unico che l'azienda conta davvero —
è **che per quella persona non è stato pagato un noleggio**.

Come l'ho capita, e la scrivo qui perché se ho capito male va corretto adesso e non a review:
- **auto evitate** = colleghi con `hasCar: false` sulla **propria** trasferta e **almeno una**
  candidatura `accepted`. Non per tratta, e non serve che entrambe le tratte siano coperte;
- **giorni di noleggio evitati** = i giorni della **sua** trasferta, da `departureAt` a `returnAt`,
  conteggio **inclusivo** (3→5 novembre = 3 giorni, come diceva il criterio originale);
- **chi offre l'auto non conta** fra le auto evitate: ha noleggiato, ed è l'auto condivisa;
- **CO₂** resta **per tratta condivisa**: ogni tratta condivisa è un'auto in meno su quella strada.

Due test lo proteggono dal doppio conteggio in entrambe le direzioni: un collega con **una** tratta
accettata dà 1 auto e 3 giorni; lo **stesso** collega con **entrambe** le tratte accettate dà ancora
1 auto e 3 giorni, non 2 e non 6.

Semplificazione da dichiarare in schermata: il modello non sa come il collega ha coperto le tratte non
condivise e non conta le emissioni di quei mezzi.

### T06 pretende l'aritmetica di calendario che manca dal 13 ottobre

"Giorni fra `departureAt` e `returnAt`" non è calcolabile oggi: `parseUtcInstant` si ferma al giorno
per scelta dichiarata. Serve una conversione data civile → numero di giorno in `core/domain`, provata
su fine mese, anno bisestile e cambio d'anno. È il buco che avevo segnalato il 13 ottobre dicendo che
si sarebbe misurato a T06 e non prima: ci siamo, ed è additivo — nessuna firma cambia, nessun ⛔.

### I parametri di `config/` per T06, con la fonte

Promessi come "default difendibili e dichiarati". Difendibile significa che hanno una fonte, non che
suonano plausibili, quindi:

| Parametro | Default | Fonte e ragionamento |
|---|---|---|
| g CO₂/km | **110** | EEA: **96,7 g/km** sulle nuove immatricolazioni 2025 e **106,7 g/km** nel 2024. Quelle medie **includono le elettriche a 0 g/km**, quindi un'auto a combustione da noleggio sta sopra: 110 è una scelta **conservativa** per un'auto termica, e sottostima il beneficio invece di gonfiarlo. |
| Costo noleggio €/giorno | **55** | **Segnaposto, ed è il parametro che solo tu puoi sapere:** dipende dalla convenzione aziendale, non da un dato pubblico. Da sostituire con la tariffa reale. |
| Pomigliano–Foggia | **165 km** | **Stima, non confermata.** La ricerca non ha dato la coppia diretta; Lucera (provincia di Foggia) è a 153 km, e Foggia è più a est. Da verificare. |
| Foggia–Grottaglie | **232 km** | Confermato da un calcolatore di percorsi (232 km, ~2h24). |
| Pomigliano–Grottaglie | **320 km** | Derivato: Pomigliano–Taranto 308–329 km, e Grottaglie è a 23 km da Taranto. |

Due dei cinque sono dichiaratamente da sostituire — il costo del noleggio perché è aziendale, e
Pomigliano–Foggia perché non l'ho confermato. Stanno in `config/`, quindi si cambiano senza toccare
codice, ed è esattamente perché i criteri lo pretendono.

**Fonti:** [EEA via Sicurauto](https://www.sicurauto.it/news/novita-del-mercato/auto-nuove-emissioni-co2-medie-scendono-a-106-g-km-in-ue/) · [AGI, dati 2025](https://www.agi.it/scienza/news/2026-06-26/emissioni-nuove-auto-europa-37730281/) · [Foggia–Grottaglie](https://calcolopercorso.it/it/distanza/Foggia/Grottaglie) · [Taranto–Pomigliano](https://calcolopercorso.it/it/distanza/Taranto/Pomigliano-d-Arco)

---

## 2026-10-14 — T06 implementato, poi i parametri sono cambiati tre volte in un giro

`verify` verde, exit 0, **330 test** in 24 suite (erano 261). Scope pulito, verificato da me: `ports`,
`adapters`, `eslint.config.js` e `find-matches.ts` con diff **vuoto**. Non committato: il task va
rifatto in parte, perché l'umano ha cambiato i parametri **dopo** che era stato implementato.

### Il buco che ho trovato verificando, e che tocca la base di calcolo

**`MatchRequest` non sa qual è la trasferta di chi si candida.** Ha il `tripId` della trasferta che
*offre* il posto e il `requesterId`, e nessun collegamento alla trasferta del richiedente — verificato
leggendo i campi, non sulla parola del developer. Che l'ha quindi **ricostruita per euristica**: la
trasferta del richiedente senza auto, sugli stessi plant e nello stesso giorno della tratta condivisa.

L'euristica è stretta — i vincoli duri del matching impongono già stessi plant e stesso giorno — e
sbaglia solo se la stessa persona ha due trasferte sulla stessa tratta nello stesso giorno, caso che
l'app non impedisce e che il seed di T17 può costruire per sbaglio. Ma *"i giorni della **sua**
trasferta"* è il numero che va in cima alla slide, e poggiava su una **regola** invece che su un dato.

**Decisione dell'umano: `requesterTripId` si aggiunge ora.** Costa poco adesso perché lo schema di T08
non è ancora scritto: nessuna migrazione da rifare. È un ⛔ di contratto, approvato.

**Perché sta dentro T06 e non in un task a parte**, benché cambi `MatchRequest` e `requestSeat` che
sono artefatti di T04b/T05: è un **prerequisito della base di calcolo di T06**, e separarlo produrrebbe
un commit intermedio che non posso verificare in isolamento senza mettere da parte il lavoro di T06 già
scritto. Scritto come criterio dentro T06 con il ⛔ dichiarato. Se il reviewer ritiene che vada
separato, è un rilievo legittimo e lo accetto.

### Tre decisioni dell'umano, e la terza ha ribaltato una mia

1. **Carburante nel saving.** 2,2 €/litro, consumo **7,0 l/100 km** — media benzina, auto non
   performanti, parole sue — quindi **15,4 € ogni 100 km**. Costo auto da 55 a **120 €/giorno**, che è
   la sua cifra reale e sostituisce il mio segnaposto.
2. **Tutto configurabile da tabelle, niente valori compilati.** Aperto come **T07b**, prima di T08
   perché le tabelle vanno disegnate in una migrazione sola. Il confine deciso con lui: in tabella i
   **valori**, nel codice le **identità che il compilatore controlla** — i tre plant, gli stati, gli id
   dei badge — perché lì il tipo è ciò che rende un valore inesistente un errore di compilazione, ed è
   una scelta di T01 su cui il reviewer ha costruito in tre task. Da registrare come **inversione** di
   una decisione di T03 (i valori come letterali verificabili a compile time): il motivo per cui si
   rovescia è buono — un parametro che richiede una build EAS non è configurabile — ma è un'inversione
   e non un dettaglio. Nota che rende il lavoro minore di quanto sembri: **ogni usecase riceve già la
   config come parametro e la valida**, con un errore tipizzato se è incoerente. L'architettura aveva
   anticipato il passaggio senza che fosse il suo scopo.
3. **Il conducente va riconosciuto**, e la mia domanda sulla base di CO₂ è rimasta senza risposta
   perché lui ha risposto a una domanda migliore. I KPI **aziendali** restano invariati: contare il
   conducente fra le auto evitate conterebbe due volte la stessa auto, ed è il doppio conteggio da cui
   due test di T06 difendono. Il riconoscimento sta in **T07** (badge dedicati a chi guida) e in T15.
   Criteri aggiunti a T07, incluso il caso che li distingue: chi ha offerto posti e **non** ha avuto
   nessuna candidatura accettata **non** riceve i badge da conducente — il riconoscimento è per aver
   trasportato qualcuno, non per aver offerto.

### La coerenza che l'umano ha lasciato aperta: decisa da me

Avevo scritto CO₂ "per tratta condivisa" mentre noleggio e auto evitate erano "per trasferta". Con il
carburante la stessa incoerenza si ripresentava. **Deciso: tutto sulla trasferta del passeggero.** Chi
non ha noleggiato non ha guidato, quindi la sua auto mancata non ha percorso **nessuna** delle due
tratte: si contano andata e ritorno. Conseguenza messa sotto test: CO₂ e carburante **non** raddoppiano
se ha condiviso entrambe le tratte invece di una — la candidatura accettata è l'**innesco**, non
l'unità di misura. È lo stesso principio già vero per auto e giorni, e rende i quattro numeri della
slide calcolati sulla stessa base.

Il developer aveva implementato la CO₂ per tratta, con un test che pretendeva il raddoppio: quel test
va **invertito**, ed è il tipo di modifica che va dichiarata e non fatta in silenzio.

### Decisioni del developer da tenere

- **Aritmetica di calendario in `calendar.ts`, file nuovo e non dentro `instant.ts`.** Argomento suo e
  lo condivido: `instant.ts` dichiara per contratto di non validare il calendario (`2026-02-31` passa),
  quindi una funzione che valida nello stesso file darebbe **due nozioni di data valida a poche righe
  di distanza**. Espone `civilDayNumber` (giorni dal 1970-01-01, interi, nessun `Date`) e
  `inclusiveDaysBetween`. Ancore assolute sotto test: `1970-01-01 = 0`, `2000-01-01 = 10957`.
- **Data impossibile → `null`, mai un numero**, e nell'usecase diventa un errore tipizzato. Coperti
  `2026-02-31`, `2027-02-29`, **`2100-02-29`** (non bisestile) e `2000-02-29` (bisestile): è il caso
  che distingue una regola corretta da quella approssimata dei soli multipli di 4.
- **Coppia di plant assente → errore tipizzato, non zero.** Uno zero farebbe sparire una tratta reale
  dalla CO₂ mostrando in demo una cifra plausibile e al ribasso.
- **CO₂ in grammi interi**, conversione in kg lasciata alla UI: nessun float nel dominio.

Sonde eseguite con rosso verificato: "conta per tratta" → 2 rossi; giorni senza il `+1` → **16** rossi;
simmetria delle distanze rimossa → 3 rossi.

### Secondo giro: carburante, base unica, `requesterTripId`

`verify` verde, **340 test**. Tre sonde, tutte con rosso verificato:
- CO₂ moltiplicata per il numero di candidature → 2 rossi;
- costo auto sostituito col prezzo carburante nella componente noleggio → **4** rossi, fra cui il caso
  a mano e "ciascuna componente ai propri parametri". È la prova che esporre `rentalSavingsEuro` e
  `fuelSavingsEuro` separatamente serviva: un test sul solo totale non vedrebbe due parametri scambiati
  che per caso sommano giusto;
- `requesterTripId` sostituito con la vecchia euristica → **4** rossi, fra cui il test con **due
  trasferte gemelle** (stessi plant, stesso giorno, una di 3 giorni e una di 6). Il risultato cambia
  davvero, quindi nessuna ricostruzione per indizio è sopravvissuta altrove. È la sonda che conta,
  perché l'euristica eliminata male avrebbe lasciato un ripiego invisibile.

Due errori **eliminati** perché non più raggiungibili (`unknown-offer-trip`,
`return-leg-without-return-date`): con `requesterTripId` la trasferta che offre il posto non serve più
al calcolo. Rimuovere un errore diventato irraggiungibile è giusto — un ramo che nessun test può
coprire è codice morto, non difesa.

### Terzo giro: il difetto che ho trovato verificando, e come

Il developer aveva scritto nel report: *"se la trasferta indicata ha lo stato `cancelled`, ora conta
comunque. Prima la escludevo; con il riferimento esplicito decide il dato."*

**Il cambiamento andava nella direzione sbagliata e la motivazione non reggeva:** il riferimento
esplicito dice *quale* trasferta è, non *se* una annullata debba contare. Verificato nel codice:
filtrava su `request.status !== 'accepted'` e `own.status` non era guardato da nessuna parte. Quindi un
collega con trasferta `cancelled` contava come auto evitata, con giorni, km, CO₂ e saving pieni —
e una trasferta annullata non è avvenuta, quindi non c'era nessun noleggio da evitare. Gonfiava **tutti
e quattro** i numeri destinati alla slide.

**Il criterio mancava nei miei**, e la ragione per cui mi era sfuggito vale la pena scriverla: avevo
scritto *"le candidature `pending`, `rejected` e `cancelled` non contribuiscono"* senza accorgermi che
lo stesso stato esiste su **due entità diverse**. Aggiunto come criterio distinto, con la distinzione
dichiarata, e corretto anche il commento in testa al file che confondeva le due cose.

**Due cose sul processo, più importanti del difetto.** La prima: il developer l'ha **dichiarato** invece
di nasconderlo. Un cambiamento silenzioso nella stessa direzione sarebbe passato con `verify` verde e
sarebbe arrivato in demo. La seconda: ha aggiunto un test su `completed` e `published` che conta, non
solo quello su `cancelled` che non conta — così la regola non può degenerare nell'opposto ("solo
`published`"), e ha dichiarato di **non** aver provato quella mutazione. Dichiarare una sonda non fatta
è esattamente ciò che la rende recuperabile.

Ha anche segnalato di aver introdotto per errore un **BOM** con uno script di sonda, e di averlo
rimosso. Verificato da me su **tutti** i `.ts` toccati: nessun BOM. È il tipo di cosa che passa il lint
e rompe altrove, e vale come terzo episodio della stessa famiglia — dopo l'alias `R` e il mio
round-trip di encoding su `TASKS.md`, tre volte in due giorni che una manipolazione di testo via shell
ha corrotto un file. La regola in `IDEAS.md` va estesa oltre gli identificatori di una lettera.

`verify` verde finale: **343 test** in 24 suite (erano 261 a fine T05), rieseguito da me dopo ogni
giro. Scope verificato: `core/ports`, `eslint.config.js`, `find-matches.ts` e gli altri usecase di T05
con diff **vuoto**.

### Round 1 di review — **APPROVATO**, nessun bloccante

La verifica più accurata della sessione, e vale la pena registrare **come** l'ha fatta, perché i metodi
sono riutilizzabili.

**L'aritmetica di calendario provata contro un oracolo indipendente.** Ha confrontato `civilDayNumber`
con `Date.UTC` — lecito, perché l'ha eseguito in node e non dentro `core/` — su **109.938 date dal 1900
al 2200**: zero divergenze. Più le ancore assolute (`1970-01-01 = 0`, `2000-01-01 = 10957`,
`1969-12-31 = -1`) e la regola bisestile sui tre casi che la discriminano (2100 no, 2000 sì, 2028 sì).
È la differenza fra "i test passano" e "la funzione è corretta".

**La contabilità dei test chiusa in due modi indipendenti.** Per file, eseguendo i 24 uno a uno: 343.
Per delta: 261 + 29 + 43 + 3 + 3 + 3 + 1 = 343. E nessun conteggio **scceso** in nessun file, con i
diff dei file toccati fatti di sole aggiunte. Ha anche nominato l'unico punto dove un test potrebbe
essere scomparso senza traccia — **dentro i due file nuovi**, fra il primo e il terzo giro, perché non
esiste un baseline committato — e ha detto che lì la difesa non è il conteggio ma la copertura criterio
per criterio, che ha fatto.

**Le due rimozioni di errori verificate irraggiungibili, non accettate sulla parola.** `grep` per
`request.tripId`, `request.direction`, `offer`: zero riscontri, l'unico accoppiamento è
`requesterTripId`. Più una prova indipendente: un test passa a `computeCompanyKpi` **solo** la
trasferta del passeggero, senza l'offerta, e il calcolo riesce — se il codice la cercasse ancora, quel
test sarebbe rosso.

**Il test invertito giudicato non un indebolimento, con un argomento che non avevo.** `both.co2 ===
one.co2` da solo passerebbe anche se entrambi fossero zero: il test **pinna prima il valore assoluto**
(40.000 g verificato a mano) e poi confronta quattro campi. L'inversione è ancorata, non tautologica.

**Una precisazione che archivia un mio timore con la ragione giusta.** Temevo che due parametri
scambiati potessero sommare giusto per caso. Il reviewer ha mostrato che lo scambio fra **consumo** e
**prezzo al litro** è indistinguibile da *qualunque* test, perché `km × c / 100 × p` è commutativa in
`c` e `p`: non è un buco di copertura, è una **simmetria dell'aritmetica**. Ciò che si può pinnare è
che ciascuno muova il carburante e **non** il noleggio, ed è esattamente ciò che il test fa.

**La mutazione che il developer aveva dichiarato di non aver provato non serve:** il test che la uccide
l'aveva già scritto. L'`it.each` su `published` **e** `completed` asserisce tutti e quattro i numeri,
quindi il mutante "conta solo `published`" fa cadere il caso `completed`. Prudenza nella dichiarazione,
non un buco.

**`requesterTripId` dentro T06: accettabile**, e con un argomento migliore del mio. Il mio era la
non-separabilità; il suo è che un commit intermedio avrebbe aggiunto un campo obbligatorio **senza
consumatore**, e l'unico test possibile sarebbe stato il round-trip di contratto che c'è già — quindi
il commit separato non avrebbe aggiunto verifica, solo un punto di rollback su uno stato intermedio
inutile. Ha verificato anche che `TASKS.md` dicesse il vero sul fatto che lo schema di T08 non esiste:
nessun `.sql` nel repo.

**BOM e mojibake: zero**, scansionati su **tutti** i sorgenti e tutti i `.md`, non solo sui file
toccati. Il danno da `Set-Content` su `TASKS.md` è completamente rientrato.

### Quattro non bloccanti, tre diventati voci di `IDEAS.md`

Il più sostanzioso è **N1, e va saputo perché riguarda il numero in cima alla slide**:
`requesterTripId` è obbligatorio e non vuoto, e **lì si fermano i controlli**. Nessuno verifica che
quella trasferta esista, che sia del richiedente o che sia senza auto. `requestSeat` ha già
`deps.trips` in mano e non la interroga. Conseguenze con `verify` verde: un riferimento alla trasferta
di un collega o a una più lunga della propria gonfia tutti e quattro i KPI; un id inesistente spegne
l'intera dashboard. Oggi irraggiungibile solo perché nessuna UI esiste. **Girato all'umano come
domanda.**

**N2:** una trasferta degenere `from == to` nei dati fa ritornare `missing-distance` per **tutto** il
calcolo. Via d'ingresso: `seminaGrezzo`, una migrazione, e **il seed di T17** — lo scenario realistico.
Due criteri, su T17 e T16.
**N3:** `invalid-config / distanceKm` non dice **quale** coppia è rotta, mentre il gemello
`missing-distance` le nomina entrambe. Con tre sedi si trova a occhio, con la tabella da file di T07b
no.
**N4, non promosso a voce:** `invalid-trip-date` è provato solo sul **rientro**; i due rami gemelli
sulla **partenza** non hanno test. È la stessa riga di codice e lo stesso errore, quindi il reviewer ha
giudicato il rischio minimo e l'ha segnalato perché il prossimo lettore non creda che la copertura sia
simmetrica. Registrato qui e non implementato: non tocco codice approvato per una copertura che il
reviewer ha giudicato ridondante.

### Il giudizio di chiusura del reviewer, che vale come principio

*"T06 è il task dove i numeri finiscono su un proiettore, e la cosa che lo rende difendibile non sono
gli 82 test nuovi: è che tutti e sette i campi del risultato stanno su **una** base, quella dichiarata,
e che la base si legge da un dato e non da un indovinello. Le tre decisioni che hanno richiesto tre
giri — base di calcolo, carburante, `requesterTripId` — hanno tutte spostato il lavoro nella direzione
di meno inferenza e più dato esplicito, che è l'unica direzione in cui un numero sopravvive a una
domanda in sala."*

E una nota di processo da tenere: il developer ha dichiarato **tre** cose contro il proprio interesse —
un cambiamento di comportamento sugli stati (il difetto), una sonda non eseguita, e un BOM introdotto
per errore. Tutte e tre recuperabili **perché** dichiarate, e nessuna delle tre l'avrebbe trovata
`verify`. È il terzo task di fila in cui il difetto vero emerge da una dichiarazione volontaria e non
dalla macchina.

**T06 committato** come `a62f067`, un commit unico, 22 file, working tree pulito.

---

## 2026-10-14 — T07 · badge, con il riconoscimento del conducente

`verify` verde, exit 0: **393 test** in 27 suite (erano 343 a fine T06), 1 int, 1 smoke. Rieseguito da
me dopo entrambi i giri. Conteggio di partenza **misurato** dal developer prima di cominciare, come
avevo chiesto: era mancato nei due task precedenti.

### T07 consegna due funzioni, non una — decisione mia dichiarata nel brief

`computePersonalStats` (le statistiche per collega) e `awardBadges(stats, config)` (i badge dalle
statistiche). I criteri pretendono che le statistiche del conducente *si contino*, quindi qualcuno deve
contarle, e `awardBadges` deve restare una funzione sulle sole statistiche per essere testabile sui
confini delle soglie. Separarle tiene i test delle soglie piccoli e indipendenti dal conteggio.

### Tre cose del developer che sono scelte e non adempimenti

1. **Ha cancellato un proprio test perché tautologico.** Aveva scritto "il test sa riconoscere un testo
   vietato", che affermava cose su stringhe costanti e non poteva fallire. Il conteggio che scende da
   394 a 393 è il segno che la regola è stata applicata **contro il proprio lavoro**.
2. **Le etichette dei badge non contengono numeri.** Le soglie sono configurabili, quindi "Cinque
   viaggi" con soglia 3 mentirebbe. È lo stesso ragionamento per cui a T03 il bonus di plant non è
   configurabile: un testo che pubblicizza un numero che un parametro può cambiare è una trappola. Gli
   **id** contengono ancora i numeri (`cinque-viaggi`, `mille-km`) perché erano già nel dominio: sono
   interni e non si mostrano.
3. **Il test sui premi provato mettendo "Buono" in un'etichetta** → 2 rossi. Senza quella prova il
   criterio "nessun badge implica premi o buoni" sarebbe stato una dichiarazione d'intenti. La lista
   delle parole vietate è nel test con il motivo scritto: welfare e buoni sono fuori scope per
   decisione dell'umano, e un testo che li promette è una promessa che il prodotto non può mantenere.

### La duplicazione che ho causato io, e come è stata chiusa

T07 ha introdotto una **seconda copia** di `lookupDistance`, perché nel brief avevo vietato di toccare
i file di T06. Il divieto serviva a evitare scope creep nella logica di T06, **non** a costringere a
copiare una funzione — ed è la stessa classe di difetto per cui il reviewer ha bocciato T04: la stessa
regola definita in due punti. Due copie della ricerca simmetrica nella tabella delle distanze
divergerebbero in silenzio: una smetterebbe di provare il verso inverso e nessun test dell'altra se ne
accorgerebbe.

Estratta in `core/usecases/plant-distance.ts`, con il tipo della tabella. Due prove, entrambe
verificate da me:
- **i test di T06 sono intatti** (`compute-company-kpi.test.ts` con diff vuoto) e restano verdi: è la
  dimostrazione che il refactor non cambia comportamento, e il conteggio resta 393;
- **la sonda rompe entrambi i consumatori**: togliendo il tentativo `b→a` dal modulo condiviso cadono
  4 test in **3 suite**, fra cui quelle dei due usecase e il test di conformità della config. Con due
  copie ne sarebbero caduti solo quelli di uno — ed è esattamente la differenza fra una regola e due.

**Terza volta che un vincolo del mio brief produce una scelta peggiore di quella che il developer
avrebbe fatto da sé:** il port separato in T04b, la collisione di `legKey` che non esiste, e questa. Il
pattern è lo stesso — vieto un file per proteggere lo scope, e il divieto costringe a duplicare o a
inventare. La correzione non è vietare meno, è **nominare il motivo del divieto**, così chi lo riceve
sa quando non si applica.

### Una decisione di prodotto che resta all'umano

`awardBadges` **ricalcola da zero** dalle statistiche, quindi idempotenza e assenza di duplicati sono
vere **per costruzione** e non per controllo: non riceve i badge già assegnati, e per questo non esiste
un test "su un collega che ha già badge in input" — quell'input non esiste.

Il prezzo, dichiarato dal developer: **un badge può sparire** se le statistiche scendono, per esempio
se una trasferta viene annullata dopo che il badge era stato ottenuto. Oggi irraggiungibile, perché
nessun usecase annulla una trasferta — è la voce `IDEAS.md` sull'annullamento a cascata. Ma quando quel
flusso arriverà, un badge che svanisce è un premio simbolico **ritirato**, che è peggio di non averlo
dato. Da girare all'umano come scelta, non bloccante.

### Un controllo in più rispetto al brief, e perché lo tengo

Il developer ha aggiunto `requester-trip-not-owned` dentro `computePersonalStats`: se la trasferta
indicata da una candidatura accettata è **di un altro**, è un errore tipizzato. Non era nel brief, ed è
precisamente il rischio N1 che il reviewer aveva segnalato su T06. Lo tengo: è una difesa della propria
funzione, dentro un file nuovo, e non anticipa T07c — che chiude lo stesso buco **all'ingresso**, in
`requestSeat`, dove l'umano ha deciso di metterlo.

### T07c aperto, su decisione dell'umano

La validazione di `requesterTripId` in `requestSeat` (esiste, è del richiedente, è senza auto) diventa
un task a sé con i suoi criteri, invece di entrare in T07: è un rilievo del reviewer su T06 sciolto
dall'umano in **entrambi** i posti — usecase adesso, vincoli DB a T08 — e aggiunto anche il criterio
corrispondente a T08 (foreign key più policy di appartenenza).

Il developer ha notato che `TASKS.md` risultava modificato e ha **chiesto di controllarlo** invece di
assumere che fosse suo o mio. Era mio. È il comportamento giusto, e vale la pena registrarlo: in questa
sessione tre episodi diversi di corruzione di file sono stati scoperti guardando il diff.

### Round 1 di review — **APPROVATO**, nessun bloccante

`verify` rieseguito dal reviewer: 393 test, exit 0. Contabilità chiusa in due modi indipendenti —
per file (393 esatti su 27) e per delta (343 + 24 + 22 + 4 = 393) — quindi i 50 test nuovi stanno
**tutti e soli** nei tre file nuovi, e nessun file preesistente ha perso un test.

**Il refactor che tocca T06 è esattamente e soltanto quello dichiarato**, verificato leggendo il diff
riga per riga: un import, la cancellazione della funzione locale, il call site. Nessun errore nuovo o
rimosso, nessuna soglia spostata, l'ordine dei controlli identico, i payload degli errori identici.
E la sonda sulla simmetria l'ha **ricostruita da sé**, tracciando i quattro test che cadono in tre
suite — due delle quali appartengono a usecase **diversi**, che è il punto: con due copie ne cadrebbero
solo due, nello stesso file.

Sul merito: *"il divieto nel brief era l'errore"*, e il motivo che aggiunge è migliore del mio — con due
copie la divergenza non si manifesta come errore ma come **km mancanti su una slide**.

### Il rilievo che ho chiuso prima del commit, perché il buco era in un presidio

Il reviewer ha **eseguito** il predicato del test sulle parole vietate contro dodici etichette
avvelenate: ne intercettava **11 su 12**. Mancavano `ticket` e `welfare` — e sono i due termini
italiani più probabili per promettere proprio ciò che il PRD mette fuori scope, perché "ticket" è il
nome corrente del buono pasto e il welfare è escluso per decisione dell'umano. *"Ticket restaurant"* e
*"Welfare aziendale"* **passavano** il controllo.

Aggiunte le due parole, con il motivo nel commento, e **sonda eseguita**: ora entrambe le etichette
sono intercettate, e `verify` resta verde a 393 perché le etichette di produzione sono pulite. È due
stringhe, ma era l'unico presidio di una promessa verso l'utente, e un presidio con un buco nei due
casi più probabili è peggio di nessun presidio, perché dà fiducia.

### Due giudizi del reviewer che valgono come principio

**Sulla separazione in due funzioni:** *"è nel punto giusto, e la prova è nella forma dei test"*. I
confini delle soglie sono una matrice 6 × 3 che si scrive in un `it.each` di otto righe perché
`awardBadges` prende quattro numeri; con una funzione sola dai dati ai badge, ciascuna delle diciotto
celle avrebbe richiesto di costruire trasferte e candidature, e un fallimento su "soglia−1" non
avrebbe distinto un errore di **conteggio** da un errore di **confronto**.

**Sull'idempotenza per costruzione:** è la forma **forte**, non quella debole. Un duplicato non è
**rappresentabile**, quindi il criterio è soddisfatto più di quanto chiedesse — e non è "vero per
assenza di input", perché il test asserisce l'unicità in uno stato dove tutti e sei i badge sono
assegnati, intercettando così un id ripetuto nel catalogo, che è l'unico modo in cui un duplicato
potrebbe ancora nascere. *"È la differenza giusta fra un caso non testato e un caso non
rappresentabile."*

E su `requester-trip-not-owned`: **non** è scope strisciato. `computePersonalStats` dichiara di contare
*le trasferte proprie*, quindi contare quella di un altro la renderebbe **scorretta rispetto al proprio
contratto**, non solo meno severa. Difende l'enunciato della funzione, e non anticipa T07c, che chiude
lo stesso buco all'**ingresso**: le due difese stanno su lati opposti del confine, che è la struttura
che l'umano ha scelto rispondendo "in entrambi i posti".

### Non bloccanti registrati e non implementati

- **Le etichette dei badge e T07b**: oggi il presidio vale su costanti compilate, e T07b sposta "numeri
  **e testi**" in tabella senza elencare le etichette. **Girato all'umano come domanda**, perché cambia
  un criterio di T07b e va deciso prima della migrazione.
- **Un test diretto di "primo viaggio" con la config di produzione**: oggi coperto da tre test in
  composizione, catena completa, ma nessuno si legge come il criterio. Due righe, voce in `IDEAS.md`.
- **`PersonalStats.profileId` non è usato da `awardBadges`**, che dipende dalle sole quattro metriche.
  Non è un difetto — tiene insieme statistiche e persona per T15 — ma il tipo d'ingresso è più largo
  del dominio della funzione, e il reviewer lo segnala come *"porta aperta che conviene sapere che c'è"*:
  un domani un badge legato alla **persona** e non a una metrica sarebbe possibile **senza** cambiare la
  firma, cioè senza un checkpoint.

### Il giudizio di chiusura, che è il dato più utile del task

*"T07 è il primo task in cui il difetto strutturale non è stato **riscoperto**: lo stato `cancelled`
della trasferta, che a T06 è costato un terzo giro, qui è escluso in entrambe le famiglie dal primo
colpo e con due test che lo pinnano in positivo (`completed` conta) e in negativo. È il segnale che il
registro sta funzionando come registro."*

E: *"la duplicazione che avrei bocciato non è mai arrivata in review: è questo il modo in cui il ciclo
diventa più economico, non scrivendo meno test."*

**T07 committato** come `fa33c2e`, un commit unico, 16 file, working tree pulito.

---

## 2026-10-14 — Regola nuova: interruzioni e ripresa

L'umano ha chiesto perché il loop non ha ripreso da sé al reset del limite di sessione del 13 ottobre.

**La causa non è correggibile e va detta chiara:** l'agente non ha un avvio autonomo. Agisce su eventi
— un messaggio dell'umano, un subagent che finisce, o una sveglia programmata **prima**. Il reset di un
limite **non è un evento ascoltabile**, quindi nessuna configurazione fa reagire all'istante in cui si
sblocca: si può solo programmare in anticipo un risveglio che cada dopo.

**Un vincolo scoperto controllando, che esclude la soluzione più ovvia:** `verify` non è eseguibile
fuori da questa macchina, perché `test:int` richiede le credenziali di staging in `.env`, che è in
`.gitignore` per decisione di Fase 1. Quindi una ripresa **in cloud non può chiudere un task**:
scriverebbe codice e si fermerebbe davanti a `verify` rosso, dove committare è vietato. La ripresa
programmata ha senso **solo locale**.

**Tre regole scritte in `CLAUDE.md` § "Interruzioni e ripresa"** (commit `af82d4b`), perché il costo
dell'interruzione non è stato lo stop:
1. il lavoro approvato si committa **subito** — è l'unica cosa che un'interruzione può distruggere, e
   con questa regola si perde al massimo un giro di review in corso;
2. la ripresa parte dal **registro più il working tree** in ordine fisso, non dal report di un
   subagent: un report dice cosa un agente *credeva* di aver fatto;
3. `verify` è locale, scritto come fatto durevole invece di riscoperto da chi proverà il cloud.

La prima regola è stata applicata immediatamente: T07 era approvato dal reviewer e **ancora nel working
tree** — la stessa esposizione del 13 ottobre, riaperta. Committato prima di qualsiasi altra cosa.

**Scelta dell'umano sul meccanismo:** loop locale che si autosveglia fino al primo ⛔. Armato in
autopacing con sveglie di sicurezza da 30 minuti. Non è polling — quando un subagent finisce il
risveglio è immediato e automatico — la sveglia serve **solo** se il lavoro si pianta o se un limite
interrompe il turno, cioè è la rete che il 13 ottobre non c'era. Costo accettato e dichiarato: il
budget si consuma senza supervisione fino al limite successivo.

---

## 2026-10-14 — T07c · validazione di `requesterTripId`, due giri

`verify` verde, exit 0: **401 test** in 27 suite (erano 393 a fine T07). Rieseguito da me dopo
entrambi i giri. Scope verificato: solo **quattro** file toccati, e `core/domain`, `core/ports`, gli
adapter, `eslint.config.js` e gli altri usecase con diff **vuoto**.

### La quarta volta che un divieto del mio brief produce una soluzione peggiore

Il developer non poteva toccare lo spia condiviso dei test, che conosceva solo `trip-1`, quindi gli ha
costruito attorno un **wrapper locale** per far rispondere `findById` alle trasferte del richiedente.
**Me l'ha detto**, come gli avevo chiesto esplicitamente di fare nel brief — e l'elenco ora è: il port
separato in T04b, la collisione di `legKey` che non esiste, `lookupDistance` duplicata in T07, e
questo.

Il divieto serviva a non allargare lo scope, non a far aggirare un fake troppo debole. Autorizzata la
modifica allo spia con il vincolo che fosse **additiva**, e la prova pretesa in anticipo: i sei altri
file di test che lo usano devono restare verdi **senza essere modificati**. Verificato da me — diff
**vuoto** su tutti e sei, e il wrapper è sparito (zero occorrenze).

Lo spia ha guadagnato anche `findByIdCalls`, che conta gli id letti: serve ad asserire che con un id
vuoto la trasferta **non viene nemmeno letta**, cioè che l'ordine dei controlli è quello dichiarato.
È la stessa forma delle asserzioni "zero scritture" di T05: contare le chiamate invece di guardare i
valori finali.

### Un buco trovato dal developer, chiuso con una regola invece di due

Una candidatura sulla **propria** trasferta `completed` passava: una trasferta conclusa non si viaggia,
quindi non c'è nessun posto da chiedere. Invece di aggiungere un quinto motivo di rifiuto, la regola è
stata **invertita**: la trasferta del richiedente deve essere **`published`**, con un solo `reason` che
porta lo **stato trovato** così T13 può formulare la frase.

Il guadagno è che un nuovo valore di `TripStatus` nasce **rifiutato** invece che ammesso per
dimenticanza — la stessa forma per cui nel grafo del lint `default: 'disallow'` fa nascere un modulo
isolato e non libero. Sonda eseguita: disattivando il controllo cadono **esattamente** i due casi
(`cancelled` e `completed`) su 24 test del file.

**Non è in conflitto con T06**, che nei KPI conta le trasferte `completed`: lì si contano viaggi
**avvenuti**, qui si rifiuta di candidarsi a un viaggio **finito**. Due cose diverse sullo stesso
stato, ed è scritto nel commento del codice perché non venga "corretto" da qualcuno in buona fede.

### Le decisioni del developer, tenute

- **Un errore con `reason`, non quattro `kind`.** Per T13 i quattro casi sono lo stesso evento di
  schermata — "scegli un'altra trasferta" — e cambia solo la frase. Il `switch` esaustivo sul `reason`
  resta imposto dal compilatore, e il tipo è esportato perché T13 possa scrivere la tabella
  reason → testo.
- **L'ordine dei controlli protegge l'estraneo.** Il titolo si verifica **prima** di `already-requested`,
  perché quel rifiuto rivelerebbe lo stato di una candidatura che non è dell'attore. E fra i motivi,
  `not-owned` precede `has-car` e `not-published`, per non rivelare dettagli di una trasferta altrui.
  La sonda su `not-owned` fa cadere **due** test, e il developer sa dire perché: il secondo verifica
  l'**ordine**. Una sonda che fa cadere più di un test e spiega perché è una sonda; una che non lo sa
  dire è un test accoppiato.
- **Due difese su lati opposti del confine, non una ridondanza.** `computePersonalStats` ha già
  `requester-trip-not-owned` in **lettura** (si rifiuta di *contare* un dato incoerente già scritto);
  questa è in **scrittura** (rifiuta di *scriverlo*). È la struttura che l'umano ha scelto rispondendo
  "in entrambi i posti", e la terza metà è la foreign key a T08.

### Un effetto collaterale dichiarato, che non ho corretto io

Col nuovo ordine, una candidatura **già presente** e **con nota invalida** risponde `request-invalid`
invece di `already-requested`. Nessun test esistente lo copriva, il developer l'ha dichiarato invece di
lasciarlo scoprire, e il suo argomento è difendibile: la forma prima della semantica, e il titolo prima
di rivelare lo stato. **Girato al reviewer con il suo ragionamento**, perché non ho elementi per dire
che la mia intuizione sull'ordine valga più della sua.

### Round 1 di review — **APPROVATO**, e l'ordine va tenuto

`verify` rieseguito dal reviewer: 401 test, exit 0. Contabilità: **un solo file** cambia conteggio
(`request-seat.test.ts`, 13 → 20 blocchi), gli altri 26 identici a `HEAD`, totale 393 + 8 = 401.

**Sull'ordine dei controlli: tienilo**, con tre ragioni verificate. (1) *Forma prima di semantica è già
la regola di questo codice* — `createTrip` valida config, orologio e istanti prima di ogni regola di
business, `computeCompanyKpi` i quattro scalari prima di leggere una trasferta; e rispondere `not-found`
a una stringa vuota **direbbe una cosa falsa**, perché non abbiamo cercato niente. (2) La precedenza
"titolo prima di stato" **ha un test**, quindi è un contratto e non un accidente. (3) L'obiezione di
usabilità richiede **due** problemi simultanei e il primo non è raggiungibile dalla UI, mentre
l'alternativa renderebbe la rivelazione dello stato **incondizionata** — e quella sì è raggiungibile.

### Il rilievo che ho chiuso prima di committare: il commento prometteva più del codice

Il reviewer ha verificato leggendo che la riga esistente è letta con
`findByLegAndRequester(tripId, direction, **input.requesterId**)`: è la candidatura della persona
**nominata nell'input**, non di un terzo. Il mio commento diceva che `already-requested` *"rivelerebbe
a un estraneo lo stato di una candidatura che non è sua"*, e questo **sovrastima**: l'argomento vale
solo nel modello di minaccia in cui `requesterId` è falsificabile — che è quello reale di oggi — e **in
quel modello la protezione è parziale**. Chi si spaccia per un collega non legge più lo stato indicando
una trasferta qualsiasi, ma lo legge ancora indicando una trasferta **valida di quel collega**.

Quindi l'ordine **aggiunge un prerequisito di conoscenza, non chiude la rivelazione**. È la stessa
classe del rilievo di T04b sull'invariante dichiarata impossibile: il codice è giusto, il commento
promette di più. E il danno specifico qui era peggiore di un'imprecisione: *"a T08 qualcuno potrebbe
considerare la policy `requester_id = auth.uid()` meno urgente perché l'usecase già protegge"*.
Riscritto con la portata esatta, e con una riga che dice che **non** rende quella policy meno urgente.

### Il test che ho aggiunto, e la sonda che lo giustifica

Il reviewer ha segnalato un'asimmetria: di **due** decisioni di ordinamento prese nello stesso giro,
una era un contratto (titolo prima di stato, con il suo test) e l'altra una **dichiarazione in un
commento** (forma prima di stato). Un riordino futuro avrebbe riportato `already-requested` davanti
**senza nessun rosso**, e il commento sarebbe rimasto a descrivere un ordine che non c'è più.

Aggiunto l'`it`, e **sonda eseguita** spostando `already-requested` davanti alla forma: cadono **due**
test — il mio nuovo **e** quello preesistente sull'estraneo. Cioè quella mutazione rompe entrambe le
precedenze che doveva rispettare, ed è la prova che ora sono entrambe contratti. `verify` finale verde
a **402** test, sonda rimossa (zero occorrenze verificate).

### Tre cose che il reviewer ha verificato e che valeva la pena pretendere

- **`otherTrips` preserva davvero il default**, dimostrato leggendo i due rami e non "a parole": con
  l'opzione assente il secondo ramo è una ricerca su array vuoto, quindi la funzione calcola **lo
  stesso risultato per ogni input**. E le trasferte di `otherTrips` **non** entrano nella mappa delle
  tratte, quindi `findLeg` e `adjustLegSeats` non le vedono e non possono alterare i test degli altri
  usecase. *"Un fake modificato in modo non additivo non rompe la compilazione: rompe il significato
  dei test di qualcun altro, e solo i loro conteggi verdi lo escludono."*
- **Il fixture del caso `not-owned` è costruito perché solo il titolo possa far scattare l'errore**
  (trasferta altrui **senza auto e pubblicata**). Un fixture sciatto — altrui *e* con auto — avrebbe
  potuto passare per il motivo sbagliato.
- **`storage-unavailable` nella lettura della trasferta è tradotto in `storage-failed` e non in un
  rifiuto di merito:** è la distinzione che impedisce a un guasto di rete di apparire in schermata come
  "scegli un'altra trasferta".

### Un corollario sul pattern dei miei divieti, dal reviewer

Il suo dato in più: *"in tre casi su quattro il divieto riguardava file di **test** o di supporto, e la
soluzione imposta era peggiore del rischio evitato"*. Il corollario alla regola che avevo già scritto:
**un divieto su un file di test condiviso quasi mai protegge lo scope, perché i fake non sono scope,
sono strumenti.** La prova da pretendere quando si modifica un fake condiviso è quella usata qui: gli
altri file che lo usano restano verdi **senza essere modificati**.

### Tre non bloccanti registrati in `IDEAS.md`, più uno chiuso

Chiuso: il test sulla precedenza della forma (era N1). Registrati: `storage-failed` che non dice
**quale** delle tre letture è fallita, il fixture della trasferta propria da assorbire nei fake
condivisi, e la nota operativa sui divieti nei brief.

**Terza domanda per l'umano, da accorpare alle due in coda:** `requestSeat` ora verifica che la
trasferta dichiarata esista, sia tua, senza auto e `published`, ma **non** che abbia a che vedere con
la tratta su cui chiedi il posto. Si può dichiarare la propria Pomigliano→Grottaglie di 6 giorni e
prendere un posto su una Pomigliano→Foggia di un giorno: il controllo passa e i KPI accreditano 6
giorni e i km della tratta più lunga. La domanda nasce **ora** perché T07c ha chiuso l'altra metà dello
stesso buco.

**T07c committato** come `ac88514`, un commit unico, 7 file, working tree pulito.

---

## 2026-10-14 — Tre decisioni dell'umano, due task nuovi, e il loop si ferma a T07b

Nessun codice. Le tre domande in coda sono state sciolte, tutte e tre come raccomandato.

### 1. Le etichette dei badge passano in tabella, **con il controllo che le segue**

Criterio aggiunto a T07b: l'adapter che legge le etichette **rifiuta con errore tipizzato** un testo
che contiene una parola vietata. Il motivo per cui non bastava spostarle: oggi il criterio *"nessun
badge implica premi, denaro o buoni"* è imposto da un test su **costanti compilate**, e se i testi
diventano modificabili dalla dashboard senza che il controllo li segua, l'unica garanzia contro una
promessa che il prodotto non può mantenere svanisce **nel momento di massimo rischio** — la sera prima
del pitch, dalla sola persona che ha accesso a quella dashboard.

Secondo criterio, perché è il difetto che questo progetto ha già bocciato due volte: **la lista delle
parole vietate vive in un punto solo**, condivisa fra il test del catalogo e la validazione
dell'adapter. Due liste divergerebbero, e divergerebbero in silenzio.

### 2. **T07e** aperto: si memorizza il massimo storico delle metriche, non i badge

Delle tre vie, l'umano ha scelto quella trovata dal reviewer, e vale la pena scrivere **perché** è
migliore e non solo che è stata scelta: `awardBadges` resta una funzione pura sulle sole statistiche, i
duplicati restano **non rappresentabili** — la proprietà più forte che quel criterio ha oggi — e un
badge non si ritira perché un massimo non scende.

L'alternativa "memorizzo i badge assegnati" avrebbe riaperto il criterio dei duplicati, riportandolo da
*non rappresentabile* a *da verificare*: si sarebbe pagato in verifica ciò che si guadagnava in
permanenza. Nasce da un prezzo che il **developer di T07 ha dichiarato** invece di lasciarlo scoprire.

L'invariante su cui poggia tutto il task è una riga: **l'aggiornamento è monotono**, scrivere un valore
più basso non abbassa il massimo. E un criterio su T15: va **dichiarato in schermata** che le
statistiche mostrate e quelle che assegnano i badge possono essere due numeri diversi, con la stessa
onestà con cui si dichiara che saving e CO₂ sono stime.

### 3. **T07d** aperto: la trasferta dichiarata deve essere compatibile con la tratta

T07c ha chiuso metà del buco e **ha reso visibile l'altra**: dopo quel task l'unico modo di gonfiare i
KPI è dichiarare una trasferta propria **legittima ma irrilevante**. Chiedo un posto su una tratta
Pomigliano→Foggia di **un giorno** e dichiaro la mia Pomigliano→Grottaglie di **sei**: tutti i controlli
di T07c passano, e i KPI accreditano sei giorni e i km della tratta più lunga.

Il vincolo scelto non è arbitrario: sono gli **stessi vincoli duri** che `findMatches` applica già per
*proporre* quell'offerta, quindi non rifiuta nulla che l'app possa aver suggerito. Da cui il criterio
più importante del task, che è un test di **non-regressione sul vincolo stesso**: un percorso che
`findMatches` avrebbe proposto deve passare, e se quel test diventa rosso il difetto è nel vincolo e non
nel test.

Limite dichiarato: il vincolo esclude le **tappe intermedie**, che oggi il modello non esprime. Scritto
nel commento, dove lo troverà chi un giorno dovrà allentarlo.

### Stato del loop

Fermato come previsto. `T04 → T04b → T05 → T06 → T07 → T07c` chiusi, tutti con reviewer approvato e
commit singolo. Restano prima di T08: **T07d**, **T07e** e **T07b**, che è ⛔ e inverte una decisione di
T03 — e il loop non lo inizia senza un via libera esplicito dell'umano.

---

## 2026-10-14 — Fine sessione · stato, decisioni aperte, lezioni

Scritto per la sessione successiva. **Working tree pulito, `origin/auto/build` allineato, nessun
commit in attesa di push.** `main` fermo a `406d7e2`: lo mergia l'umano.

### Stato vero

Fase 0 e Fase 1 complete. **Fase 2: T01, T02, T03, T04, T04b, T05, T06, T07, T07c chiusi**, ognuno con
`verify` verde, reviewer approvato e **un commit solo**. `npm run verify` → **402 test unitari** in 27
suite, 1 di integrazione, 1 di smoke.

Il reviewer ha bocciato T02 due volte, T03 una e T04 una — **sempre con `verify` verde**. Da T04b in
avanti ha approvato al primo round, e la ragione registrata è che il registro ha iniziato a funzionare
come registro: il difetto dello stato `cancelled`, che a T06 è costato un giro, a T07 era già escluso.

### Prossimi passi, in ordine

1. **T07d** — compatibilità fra la trasferta dichiarata e la tratta. Criteri scritti, nessun ⛔.
   Da fare **prima di T12**.
2. **T07e** — massimo storico delle metriche, perché un badge non si ritiri. Criteri scritti, nessun
   ⛔ sul port nuovo perché è additivo. Da fare **prima di T15**.
3. **T07b ⛔** — parametri da tabella. **Inverte una decisione di T03** (i valori come letterali
   verificabili a compile time) e introduce un port nuovo: non si inizia senza un via libera esplicito.
4. **T08 ⛔** — schema, migrazioni e RLS. Ha accumulato **dieci criteri nuovi** da questa sessione.

**T13 e T14 non si aprono senza riscriverne i criteri:** precedono le note, le due tratte, le offerte
grigie e rosse, la cascata e il reintegro. C'è un riquadro che lo dichiara sopra T13.

### Decisioni di prodotto prese in questa sessione

Andata e ritorno come offerte **indipendenti**; le offerte già candidate **restano in lista** con il
loro stato (che ha emendato due criteri di T03); note facoltativa alla candidatura e obbligatoria al
rifiuto e all'annullamento di una accettata; `cancelled` ricliccabile; auto-rifiuto a cascata al
riempimento e **reintegro automatico** quando i posti risalgono; tetto di digitazione delle note con
contatore; parametri e testi da tabella con le **identità tipizzate** che restano nel codice; la base
dei KPI è **la trasferta del passeggero** ("non ho preso una macchina per me"); il conducente si
riconosce con **badge** e non sommandolo alle auto evitate; massimo storico invece di badge
memorizzati.

### Aperto, e da decidere quando servirà

- **Il task di modifica trasferta e quello di annullamento trasferta non esistono nel backlog**, e
  servono a tre cose già decise: l'annullamento a cascata delle candidature quando una tratta o una
  trasferta scompare, e il caso in cui il reintegro diventa raggiungibile.
- **Le 15+ voci `accettata` di `IDEAS.md` restano non schedulate.** Per `CLAUDE.md` non esistono finché
  non sono task, ed è giusto così — ma la più urgente morde a T09: *"Normalizzare l'istante al confine
  dell'adapter"*, senza cui ogni offerta da Supabase sparisce in silenzio.
- **La forma canonica degli istanti non è unica** (i millisecondi sono opzionali), quindi il confronto
  lessicografico non coincide sempre con quello cronologico. Nessun bug oggi; trappola per T13.
- Il costo noleggio è ora la cifra reale (120 €/giorno); resta provvisoria **Pomigliano–Foggia a
  165 km**, marcata `DA SOSTITUIRE` in `config/`.

### Le lezioni, che sono finite in `CLAUDE.md` e non solo qui

Quattro cose che questa sessione ha insegnato e che valgono per ogni progetto dell'officina, scritte
nelle sezioni **"Brief ai subagent"**, **"Interruzioni e ripresa"**, **Verifica** e **Scope**:

1. **Un divieto in un brief deve nominare il motivo.** Quattro volte un divieto ha prodotto una
   soluzione peggiore del rischio che evitava, e in tre casi su quattro riguardava file di **test**:
   i fake non sono scope, sono strumenti.
2. **I difetti veri emergono da dichiarazioni volontarie, non da `verify`**, che era verde in ogni
   caso. Va chiesto esplicitamente di dichiarare deviazioni, sonde non eseguite e cambi di
   comportamento.
3. **Un commento che promette più del codice è un difetto**, come un test che non può fallire. È
   accaduto tre volte, e in un caso avrebbe reso meno urgente una policy di sicurezza di T08.
4. **I criteri di un task si rileggono contro il modello attuale prima di aprirlo:** quelli obsoleti
   non diventano rossi, producono codice **verde e sbagliato**.

E una regola operativa che ha un costo dimostrato: **non manipolare file di testo con comandi di
shell.** Tre episodi in due giorni — un alias di una lettera che ha cancellato sei file, un round-trip
di encoding che ha riempito `TASKS.md` di mojibake, un BOM in un `.ts`. In tutti e tre il danno è stato
recuperabile **solo perché il lavoro precedente era committato**, e in due su tre è stato scoperto
guardando il **diff**, non da `verify`.

---

## 2026-10-23 — Ripresa · baseline, quattro decisioni, e i criteri di T07d riscritti prima di aprirlo

**Nessun codice applicativo.** Solo backlog e registro, che è il lavoro che la regola sui criteri
obsoleti pretende **prima** di aprire un task.

**Ripresa fatta nell'ordine di `CLAUDE.md`**, e lo stato trovato coincide con quello dichiarato a fine
sessione: `3c20968`, `auto/build` allineato a `origin/auto/build`, working tree pulito. **Baseline
`verify` verde** prima di toccare qualunque cosa: 402 test unitari in 27 suite, 1 di integrazione, 1 di
smoke. Serve a non attribuire a un task nuovo un rosso che c'era già.

### Il difetto trovato leggendo i criteri di T07d contro il modello, ed è esattamente la classe prevista

I due criteri originali di T07d dicevano *"i plant della trasferta dichiarata non coincidono con quelli
della tratta"* e *"la data di partenza non coincide con quella della tratta"*. Erano scritti pensando
all'andata. Ma `listOpenOffers` proietta la tratta di **rientro** con i plant **invertiti** e
`departureAt = returnAt` (`memory-trip-repository.ts`, ramo `direction === 'return'`): presi alla
lettera, quei criteri avrebbero rifiutato **ogni** candidatura legittima sul rientro, e il criterio di
non-regressione dello stesso task — *"un percorso che `findMatches` avrebbe proposto deve passare"* —
**sarebbe nato rosso**.

Vale la pena registrare *come* è emerso, perché è la lezione n.4 della sessione precedente che si paga
da sola al primo giro: non da `verify`, che era verde, e non dal reviewer, che non avrebbe visto il
task; dalla rilettura dei criteri contro il codice attuale, obbligatoria prima di aprire un task.

**Decisione dell'umano: simmetria per direzione.** Andata → plant nello stesso ordine e data di
`departureAt`; rientro → plant invertiti e data di `returnAt` della trasferta dichiarata. Da cui due
criteri nuovi: una trasferta **senza `returnAt`** non è compatibile con una tratta `return` (stesso
errore, stesso `reason`), e il test di non-regressione deve coprire **entrambe** le direzioni — se
coprisse solo l'andata, la simmetria resterebbe non verificata e il task tornerebbe verde e sbagliato.

### Le quattro decisioni dell'umano di oggi

1. **Autonomia accesa su T07d e T07e**, di fila, con ciclo completo e commit a ogni approvazione, e
   **stop a T07b**. Si interrompe prima solo per: reviewer che boccia due volte sullo stesso punto, un
   ⛔ non previsto, un criterio che si rivela obsoleto, una dipendenza nuova.
2. **Simmetria per direzione** su T07d, qui sopra.
3. **Quattro gruppi di `IDEAS.md` portati dentro**, tutti e quattro.
4. **Ordine:** `T07d → T07e → T07f → T07g → T07b ⛔ → T08 ⛔`.

### Cosa è entrato nel backlog, e perché in quel punto

- **T07f ⛔ — l'istante normalizzato al confine.** Unisce le due voci sull'istante e la nota sulla
  validità di calendario: sono lo stesso lavoro, un parser unico al confine. È la voce che il registro
  chiamava la più urgente e la ragione è meccanica: PostgREST serializza `timestamptz` con offset
  `+00:00` e precisione al microsecondo, `parseUtcInstant` rifiuta entrambe le forme, e `findMatches`
  risponde a un istante illeggibile con `continue` — quindi a T09 **ogni** offerta da Supabase
  sparirebbe in silenzio e il motore tornerebbe `ok([])`, indistinguibile da "nessun collega
  compatibile". Collocata **prima di T08** e non dentro T09 perché qui si decide la forma canonica, da
  cui dipendono le colonne, i tipi generati e il seed di T17 — e la voce stessa si dà *"S dentro, M
  scoperta dopo"*.
- **T07g — la suite di contratto prova il guasto.** Hook `guasta()`/`ripristina()`, liste che omettono
  le righe invalide, unicità dell'identità di tratta e della coppia (tratta, richiedente). Prima di T09
  perché il criterio di T09 *"passa la stessa suite senza modifiche"* vale quanto vale la suite, e oggi
  il ramo d'errore dei repository è l'unico comportamento del port che nessun test tocca. Il gemello su
  `supabase` resta a T09, dove l'adapter esisterà.
- **T07h — igiene di lint e identità.** Lint su `config/` e su `Date.parse`/`Date.UTC`,
  `src/__tests__/` dentro il grafo dei confini, `PlantId` e `BadgeId` derivati dagli array.
- **Criteri aggiunti a T08** (tre) e **a T16** (uno), nessun codice: il `CHECK`
  `has_car = false ⇒ seats_total = 0`, la corsa fra cascata e candidatura concorrente nei test di
  integrazione, il residuo della FK composta che blocca **anche le righe chiuse**, e su T16 il vincolo
  "i parametri non si mostrano alla platea".
- In `IDEAS.md`, **dodici voci annotate** come schedulate, con il task o il criterio di destinazione.
  Le righe `Stato` cambiate sono solo quelle che l'umano ha approvato oggi.

**Collocazione di T07h dichiarata da me, non chiesta:** dopo T07g e prima di T07b. L'ordine scelto
dall'umano non la nominava, e il motivo per cui T07h è stato portato dentro è che T07b lascia nel codice
le identità *"che il compilatore controlla"* — garanzia che oggi ha un buco in una direzione (aggiungere
un membro alla union senza aggiungerlo all'array non produce alcun errore). Chiuderlo dopo averci
costruito una tabella sopra sarebbe il contrario dell'ordine utile.

### Due decisioni prese da me e dichiarate, invece di chiederle

- **Planner solo su T07e.** T07d è un vincolo in un usecase solo con criteri già atomici: developer
  diretto. T07e attraversa port, adapter memory, suite di contratto e chiamante di `awardBadges`.
- **T07d non applica la finestra di tolleranza del matching**, solo plant e giorno. `requestSeat` non ha
  `MatchConfig` fra le dipendenze e prendersela sarebbe un cambio di firma fuori scope. Resta quindi
  **più lasco** dei vincoli duri di `findMatches` — non rifiuta nulla che l'app possa aver proposto — ed
  è sufficiente a chiudere il buco, che si misura in giorni e km. Scritto nei criteri, così chi
  rileggerà non lo prenderà per una dimenticanza.

### Cosa resta fuori, dichiarato per non farlo riscoprire

- **Port di osservabilità (`Logger`/`Telemetry`)**, con la voce XS *"`storage-failed` deve dire quale
  lettura è fallita"*: non schedulato. Serve **dopo** T09, quando i guasti diventano reali. T07g lascia
  nei commenti il nome del canale mancante, e **nessun commento dichiara osservabile un degrado che non
  lo è**.
- **Il blocco UI** (note validate solo sui campi scritti, errori accumulati, classificazione
  dell'errore auto+capienza, tetto di digitazione, `Trip.seatsAvailable` che mente dopo le tratte,
  candidature lette per owner, bonus "stessa persona su entrambe le tratte", cascata e reintegro in
  blocco): non schedulato. Va deciso insieme alla riscrittura dei criteri di T13 e T14, che non si
  aprono senza.
- **I due task che non esistono nel backlog** — modifica trasferta e annullamento trasferta — restano
  inesistenti, e con loro la voce *"Annullare una trasferta deve chiudere le candidature"*.
- **Deny rules sui `.claude/` annidati:** fuori da T07h. Toccherebbe `.claude/settings.json`, che
  `CLAUDE.md` vieta di modificare senza chiedere, e non è un freno di questo progetto ma dell'officina.
- **Preferenza per genere, distanze su mappa, notifiche push, repo separati:** restano `accettata` e non
  schedulate. Le notifiche sono separabili per il pitch e necessarie per un pilota.

**Il commit non contiene codice applicativo:** nessun file sotto `app/` è toccato, quindi la baseline
verde di stamattina è ancora lo stato di `verify`. Diff controllato prima di committare — 191 righe
aggiunte e 16 rimosse su `TASKS.md` e `IDEAS.md`, nessun mojibake e nessun BOM: è la dimensione prevista
per tre task nuovi, un blocco di criteri riscritti e dodici annotazioni.

**Prossimo passo:** T07d, developer diretto senza planner, poi `verify`, poi reviewer.

---

## 2026-10-23 — T07d · implementato, `verify` verde, in attesa del reviewer

**`verify` rifatto da me**, non preso dal report del developer: **418 test unitari in 27 suite** (+16
sulla baseline 402), 1 di integrazione, 1 di smoke. Diff +224/−5 su due file, la dimensione prevista.
Nessun file nuovo, nessuna suite nuova, nessun port toccato.

**Come è stato implementato.** `trasfertaCompatibile(dichiarata, offerente, direction)` confronta le due
**trasferte** e non la proiezione della tratta: plant nello stesso ordine, e stesso **giorno** del capo
corrispondente — `departureAt` per l'andata, `returnAt` per il rientro. Il predicato è equivalente alla
simmetria per direzione scritta nei criteri **perché** `listOpenOffers` proietta il rientro invertendo i
plant dell'offerente, e il developer ha verificato l'equivalenza sul codice invece di fidarsi del brief.
Il dato mancante — `TripLeg` non ha né plant né date — arriva da un `findById(input.tripId)` su un
metodo del port **che esiste già**: nessuna firma cambia.

Collocazione del controllo: dopo `not-published` e prima di `already-requested`, con **due test che la
pinnano**. Conseguenza voluta: chi dichiara una trasferta altrui *e* incompatibile riceve `not-owned`,
e chi ne dichiara una incompatibile avendo già una candidatura riceve `leg-incompatible` e non
`already-requested`. È la regola "titolo prima di stato" già decisa in T07c, estesa al caso nuovo.

### Le tre decisioni che il developer ha preso da sé e ha dichiarato

1. **Nome del quinto `reason`: `leg-incompatible`.** Il brief non lo dava.
2. **Un istante illeggibile non coincide con niente** → rifiuto. Vale anche per il `departureAt`
   dell'**offerente**, e questo è il punto da far guardare al reviewer: in quel caso l'errore dice
   `requester-trip-invalid`, cioè *"scegli un'altra trasferta"*, mentre il dato rotto è dell'offerta.
   Stessa famiglia del `continue` di `findMatches` su un'offerta illeggibile, e stessa perdita
   silenziosa.
3. **Il commento sul `kind` unico diceva "quattro casi"** e con il quinto era falso: riscritto senza il
   numero. È la regola sui commenti che promettono più del codice, applicata a un numero che invecchia.

### Due sonde non eseguite, dichiarate

- **Nessuna sonda di mutazione:** il predicato non è stato rotto per vedere i test diventare rossi. I
  test sono costruiti per poter fallire — rifiuti, confini, precedenze, e il test di non-regressione
  asserisce come **precondizione** che `findMatches` proponga davvero quell'offerta — ma la prova non è
  stata fatta.
- **Il rosso previsto non è stato osservato:** avevo previsto nel brief che il test su andata e ritorno
  diventasse rosso con `returnAt: null`; il developer ha completato la fixture **prima** del primo
  lancio, quindi quel rosso nessuno l'ha visto. L'aspettativa del test non è cambiata, solo il dato.

### Due voci nuove in `IDEAS.md`, entrambe da dichiarazioni volontarie e non da `verify`

- **Il vincolo non guarda il capo non richiesto.** Con **gli stessi plant e lo stesso giorno di
  partenza**, una trasferta dichiarata di sei giorni contro una tratta di uno passa, e T06 accredita sei
  giorni. Non è un difetto di T07d: il vincolo è per definizione quello dei vincoli duri di
  `findMatches`, che **proporrebbe** quell'offerta. Le due vie sono confrontare anche il capo non
  richiesto (rompe "ho chiesto solo l'andata") o limitare i giorni lato T06 (non toglie niente
  all'utente). Il comportamento attuale è pinnato da un test, quindi cambiarlo richiede una decisione
  scritta.
- **Il giorno del confronto è UTC**, non il giorno nel fuso di chi viaggia: una partenza fra mezzanotte
  e le due locali cade nel giorno UTC precedente, e due colleghi a due ore di distanza non si
  incontrerebbero mai. Irraggiungibile con dati realistici — si parte alle 6 o alle 7 — quindi
  registrato come asimmetria da decidere, non come allarme.

**Non committato:** il commit avviene dopo il reviewer, che è il prossimo passo.

---

## 2026-10-23 — T07d · **BOCCIATO** al primo giro, e il difetto era nella verifica

`verify` era verde, rifatto due volte — da me e dal reviewer. Il reviewer ha bocciato comunque: **quinta
bocciatura del progetto con `verify` verde**, e la prima in cui il codice di produzione è corretto e il
difetto è **tutto nei test**.

### N1, bloccante: il capo dell'offerente non era pinnato da nessun test

La causa radice è una fixture, non una riga di logica. Nel fake degli usecase
(`request-test-fakes.ts:76-77`) l'offerente ha `departureAt` alle 07:00 e `returnAt` alle 17:00 **dello
stesso giorno UTC**. Il predicato confronta il **giorno**, quindi in ogni test del file
`offerente.departureAt` e `offerente.returnAt` sono **lo stesso valore**: si possono invertire i due
rami del ternario `capoOfferente` in `trasfertaCompatibile` e tutti i 418 test restano verdi.

Il reviewer ha enumerato otto mutanti del predicato: sei muoiono — quelli sui plant, quelli sul capo
della **trasferta dichiarata**, e quello che stringe il confronto all'istante — e **due sopravvivono**,
entrambi sul capo dell'**offerente**, in entrambe le direzioni. Quindi la simmetria per direzione, che è
la ragione per cui i criteri sono stati riscritti stamattina, era verificata **su un lato solo**: quello
della trasferta dichiarata. Il difetto si era spostato di un passo, non era stato chiuso.

Conseguenza reale della mutazione sopravvissuta, se qualcuno un giorno "semplificasse" quella riga:
offerente che parte il 3 e rientra il 5, passeggero che dichiara una trasferta che rientra il **3**,
candidatura sul rientro → **accettata**. È il buco dei KPI che il task esiste per chiudere. E il caso
multi-giorno è quello **realistico**: le fixture di T06 usano 11-03 → 11-05, l'andata-e-ritorno in
giornata del fake è l'eccezione.

Nota che aggrava il punto e che vale come regola: il test che dovrebbe coprire la proprietà si chiama
*"il confronto è sul capo della direzione: il capo dell'altra direzione non conta"* — **un titolo che
annuncia la proprietà su entrambi i lati mentre la verifica su uno**. La regola sui commenti che
promettono più del codice vale anche per i nomi dei test.

**La sonda che il developer aveva dichiarato di non aver fatto era esattamente questa.** Una sonda non
fatta e **dichiarata** è recuperabile: è costata un giro di review. Non dichiarata, sarebbe stata un
commit verde con metà del vincolo non verificato.

### N2, minore: un limite mancante nel commento dei limiti

`trasfertaCompatibile` dichiara tre limiti e ne ha quattro. Il quarto: un istante **illeggibile su un
capo dell'offerente** produce `requester-trip-invalid`, cioè per T13 *"scegli un'altra trasferta"*,
mentre il dato rotto è dell'**offerta**. Oggi irraggiungibile — `createTrip` rifiuta già `+01:00` — ma a
**T09 largamente raggiungibile**, perché PostgREST serializza `+00:00` e `parseUtcInstant` lo rifiuta: in
quel caso *ogni* candidatura verrebbe respinta con un messaggio che incolpa il richiedente. Il commento
deve dichiararlo e nominare **T07f** come il task che ne rimuove la causa.

### Quello che il reviewer ha confermato, e che quindi non si rifà

Equivalenza del predicato **verificata sul codice dell'adapter** e non assunta dal brief: sostituendo la
proiezione, per entrambe le direzioni resta la stessa condizione, quindi confrontare le due trasferte
nello stesso ordine è lecito. T07c non è indebolito: `unaTrasfertaPropria` è **locale** al file, il
`returnAt` aggiunto è un dato in più che nessun test preesistente legge, e il test che asserisce
`findByIdCalls` a zero regge nonostante la seconda `findById`. La scelta `storage-failed` sul
`not-found` dell'offerente è corretta e il suo commento onesto. E il test di non-regressione **non prova
il vincolo contro sé stesso** sul lato offerta, perché la proiezione che ricostruisce a mano è pinnata
come stringhe letterali dalla suite di contratto.

### Un rilievo sul sistema, non sul task: il reviewer può scrivere

`OFFICINA.md` dichiara *"l'indipendenza del reviewer è strutturale, non dichiarata: non ha strumenti di
scrittura"*. **Non è vero come è scritto:** fra i suoi strumenti c'è la shell, e il rilievo N1 è nato
proprio **eseguendo i mutanti**, cioè modificando il sorgente e ripristinandolo. Il lavoro è stato
restituito pulito e l'ho verificato io sul working tree prima di proseguire — diff della dimensione
attesa, entrambi i rami della riga mutata intatti — ma la rete era una convenzione, non una proprietà
della macchina, e la regola *"non manipolare file di testo con comandi di shell"* è stata aggirata
dall'agente che dovrebbe farla rispettare.

Il punto delicato è che **la sonda era utile**: senza, N1 non sarebbe uscito. Quindi la domanda non è se
vietarla ma **chi la esegue e con quali reti**, e la scelta è dell'umano perché toccare gli strumenti di
un agente è un ⛔. Registrata in `IDEAS.md` con tre forme possibili.

### Tre voci nuove in `IDEAS.md`, dalla review

1. **L'indipendenza del reviewer non è strutturale** — qui sopra.
2. **Una proiezione sola da `Trip` a `TripRequest`/`SeatOffer` in `core/domain`.** La faccia "offerta" è
   pinnata dalla suite di contratto; la faccia "richiesta" **non esiste in produzione** e vive solo come
   assunzione dentro un test. Se T13 costruisse `TripRequest` senza invertire i plant sul rientro, la
   non-regressione di T07d svanirebbe **in silenzio**.
3. **Un fake le cui fixture non distinguono due campi rende invisibile una classe di mutanti** — la
   regola generale di N1, con il dato che la suite di contratto non ha il problema (date in giorni
   diversi, pinnate come letterali) e i fake degli usecase sì.

**Secondo giro in corso**, test-only più la riga di commento di N2, con la **sonda mirata obbligatoria**:
invertire i due rami, vedere i test nuovi diventare rossi, ripristinare, e dichiarare l'esito con
`git diff --numstat` a conferma del ripristino.

---

## 2026-10-23 — T07d · secondo giro: N1 e N2 chiusi, e **la sonda è stata eseguita**

`verify` rifatto da me: **420 test unitari in 27 suite** (+2 sui 418), 1 di integrazione, 1 di smoke.
Il predicato di produzione **non è cambiato**: ho controllato riga per riga che `request-seat.ts` differisca
dal giro precedente **solo** per il quarto limite nel commento.

### La sonda che mancava, eseguita e dichiarata

Invertiti i due rami del ternario `capoOfferente` con lo strumento di modifica, non con la shell. Il
punto si nomina, non si cita per numero di riga: il `request-seat.ts:119` scritto nella voce precedente
era **già vecchio quando l'ho scritto**, perché il quarto limite di N2 ha spostato la riga di quattro
posizioni. Rilievo del reviewer, e vale per ogni sonda futura. Risultato:
**tre test rossi** su 43 del file — la non-regressione sull'offerente multi-giorno (che copre entrambe le
direzioni), il rifiuto sul rientro dichiarato nel giorno di *partenza* dell'offerente, e il rifiuto
speculare sulla partenza dichiarata nel giorno di *rientro*. Poi ripristino, `git diff --numstat`
coincidente con quello di prima della sonda, e `verify` verde di nuovo.

Quindi i due mutanti che sopravvivevano **adesso muoiono**, e la differenza non è un'opinione: è la
stessa riga mutata che prima lasciava 418 test verdi e ora ne fa cadere tre.

### Come è stata chiusa la causa radice

`TripsOptions` guadagna `returnAt?: string`, **additiva**, con il default invariato
(`2026-11-03T17:00:00.000Z`): chi non la passa vede lo stesso fake di prima, e gli altri file che lo
importano non sono stati toccati — la suite completa resta a 27 suite verdi, che è la prova chiesta. Il
commento sull'opzione dichiara **perché** esiste: col default i due capi cadono nello stesso giorno UTC e
un confronto sul giorno non li separa. La lacuna di N1 è ora scritta dentro lo strumento, dove la
troverà chi scriverà il prossimo test.

Il developer ha aggiunto **un test non richiesto**, e l'ha dichiarato: il rifiuto speculare sull'andata.
Costo quasi nullo, uccide la stessa mutazione dall'altro lato, e resta dentro lo scope del rilievo.

Chiusi anche: il titolo del test che prometteva entrambi i lati (ora dice *"capo della direzione della
trasferta DICHIARATA"* e rimanda al `describe` dell'offerente per l'altro), il commento che descriveva
l'offerente mono-giorno, e il rifiuto `not-owned` che non asseriva le spie mentre l'intestazione del file
dichiara che **ogni** rifiuto lo fa.

**N2** chiuso: il quarto limite è nel commento di `trasfertaCompatibile`, dichiarato come **non gestito** e
con il rimando a T07f prima di T09.

### Una conseguenza del rilievo sul reviewer, applicata subito

Nel brief di questo secondo giro di review ho chiesto al reviewer di **non mutare il sorgente da sé**: se
gli serve una sonda, la chiede e la esegue il developer. Non è una modifica al sistema — è la regola di
`CLAUDE.md` sulla manipolazione di file via shell applicata a lui come a tutti — e lascia all'umano la
decisione durevole fra le tre forme registrate in `IDEAS.md`.

### **APPROVATO** al secondo giro, e cosa ha verificato il reviewer

Circuit breaker **non** scattato: una bocciatura, un punto, chiuso. Il reviewer ha rieseguito `verify`
(verde, 420/27), ha controllato che non ci fossero `.skip`/`.only`/`xit`/`todo` nel file di test, e ha
rispettato la regola nuova: **nessuna scrittura**, analisi dei mutanti per lettura.

Tre cose della sua verifica che vale la pena tenere, perché non sono "ok, approvo":

1. **Tre rossi su 43 è la firma precisa di quel mutante, non un rosso generico.** Nient'altro *poteva*
   cadere: ogni altro test del file usa l'offerente di default, dove i due capi sono lo stesso giorno
   UTC, e i casi con `returnAt: null` escono prima alla guardia. Il caso `in giornata` del `it.each`
   resta verde **e deve restarlo**: serve a provare che l'estensione del fake non ha cambiato il
   percorso di default.
2. **Il test speculare che il developer ha aggiunto senza che fosse richiesto era necessario**, non
   zelo: è il **solo** test che uccide il mutante *"il capo dell'offerente è sempre `returnAt`"*. Senza,
   N1 sarebbe stato chiuso a metà — e con esso la simmetria per direzione, che è l'intero motivo per cui
   i criteri sono stati riscritti.
3. **Nessun mutante del predicato resta non toccato**, enumerati uno per uno: plant cancellati,
   plant incrociati, ramo della trasferta dichiarata invertito, `.date` sostituito dall'istante intero,
   `===` rilassato in `>=` e `<=`, istante illeggibile. Le **due sole** righe senza test sono le guardie
   difensive sul capo dell'offerente, e non devono averne: cancellarle è un errore di **typecheck**, non
   un mutante eseguibile. Annotato in `IDEAS.md` perché nessuno, cercando copertura, allenti quei tipi
   per poterle testare.

Il reviewer ha anche confermato il punto che più rischiava di essere un "test modificato per passare":
il default di `unaTrasfertaPropria` che passa da `returnAt: null` a una data era **obbligato** da un test
preesistente — quello sulle due righe distinte su andata e ritorno, che chiede una candidatura `return`.
Il dato è diventato realistico, **l'asserzione è identica**, e il diff lo dimostra: 206 aggiunte e 2
rimozioni, dove le due rimozioni sono la riga di import sostituita e quel `returnAt: null`. Nessun
`expect` preesistente toccato. Il fake è importato da **sei** altri file e nessuno dei sei è nel diff.

**Due note non bloccanti, chiuse subito in questo commit:** la nota sul compilatore in `IDEAS.md`, e il
riferimento per nome invece che per riga qui sopra.

**Commit `45eb0cd`**, uno solo per il task, criteri spuntati con i limiti residui scritti sotto, pushato
su `auto/build`.

---

## 2026-10-23 — T07e · i criteri non avevano soggetto, e la decisione dell'umano sul trigger

Nessun codice. Rilettura dei criteri contro il modello **prima** di aprire il task, come per T07d — e
anche qui ha trovato qualcosa, con una differenza che vale la pena notare: i criteri di T07d erano
**sbagliati**, questi erano **incompleti**.

### Il buco

Il criterio *"`awardBadges` non cambia firma: chi la chiama le passa il massimo invece delle statistiche
correnti"* **non ha soggetto**. In produzione nessuno compone `computePersonalStats` con `awardBadges`:
l'unico posto dove le due funzioni si incontrano è nei test. Quindi "chi la chiama" non esiste, e i
criteri non dicevano da nessuna parte **quando** il massimo si aggiorna — che è la decisione da cui
dipendono il port, la forma del codice e una policy RLS di T08.

Secondo buco, conseguenza del primo: il criterio su T08 diceva *"RLS che permette a ciascuno di leggere
i propri"*, **solo lettura**. Se i massimi li aggiorna l'app, una tabella leggibile e non aggiornabile
rende il percorso inutilizzabile, e una policy scritta a metà è il genere di omissione che si scopre in
demo.

### La decisione dell'umano: un usecase nuovo, letto-poi-scritto

Legge trasferte e candidature, calcola le statistiche correnti, alza i massimi dove sono saliti, ritorna
i badge calcolati **sui massimi**. È il percorso che T15 userà davvero, quindi è quello su cui i criteri
si dimostrano.

Le altre due vie e il loro prezzo, registrati perché la scelta si capisca fra sei mesi: aggiornare i
massimi **dentro i quattro usecase di scrittura** già chiusi sarebbe più onesto sul piano causale — il
massimo sale quando il fatto accade — ma costerebbe più letture e più scritture per ogni accettazione e
un criterio di T05 da riaprire; **fermarsi al port** lasciando la composizione a T15 avrebbe dimostrato
il criterio del badge che non si ritira su una funzione **che nessuno chiama**, cioè la stessa forma del
difetto che il task nasce per evitare.

Conseguenza applicata subito: **criterio aggiunto a T08** per la metà in scrittura, con la domanda
aperta se la monotonia debba essere **anche** lato DB (`UPDATE … WHERE nuovo > corrente`, dove "zero
righe toccate" non è un errore ma il caso normale), come già si fa per il decremento atomico dei posti.

### Due decisioni mie, dichiarate

- **I massimi sono un tipo con un nome proprio**, non un `PersonalStats` riempito di massimi: stesse
  quattro metriche, significato diverso. Un campo che si chiama statistica e contiene un pelo d'acqua
  mentirebbe sul proprio nome, ed è la classe di difetto che questo progetto rifiuta. Così `awardBadges`
  non cambia firma e nessun nome diventa falso.
- **La monotonia vive nel dominio come funzione pura**, non nell'adapter: è l'invariante su cui poggia
  tutto il task, quindi deve valere su ogni adapter presente e futuro e non su quello che se lo ricorda.

Aggiunti due criteri che i criteri originali non avevano: l'usecase nuovo come percorso su cui si
dimostrano gli altri, e **nessun massimo scritto a metà** se `computePersonalStats` fallisce — si legge e
si calcola prima, si scrive dopo, come fa `requestSeat` con la sua unica `save`.

**Prossimo passo:** planner su T07e (il task attraversa dominio, port, adapter, suite di contratto e un
usecase nuovo: è il caso in cui serve davvero), poi developer, `verify`, reviewer.

---

## 2026-10-23 — T07e · **PIANIFICATO** in cinque step, e un criterio mio era sbagliato

Nessun codice. Il planner ha toccato **solo** `IDEAS.md` (quattro voci nuove): `TASKS.md` e
`PROGRESS.md` li ho tenuti io, come da brief, così resta tracciabile chi ha deciso cosa.

### Il criterio che ho scritto stamattina ed era sbagliato

L'avevo scritto così: *"la monotonia vive in `core/domain` come funzione pura… l'adapter la usa, non la
reimplementa, **e la suite di contratto lo verifica su entrambi**"*. Sbagliato due volte, e nessun test
avrebbe potuto dirlo:

1. Una suite **comportamentale** non può vedere se un adapter *importa* una funzione. Il criterio
   prometteva una verifica **che non esiste**: è un commento che promette più di quello che il codice
   ottiene, nella forma di un criterio di accettazione.
2. A T09 la forma giusta su Postgres è `GREATEST` per colonna in un unico `UPDATE` — cioè una
   **riespressione** della monotonia in un altro linguaggio. Preso alla lettera, il criterio avrebbe
   imposto l'unica alternativa possibile (leggi, calcola in TypeScript, riscrivi), che reintroduce la
   corsa per cui `adjustLegSeats` è stata definita **relativa** e che può **abbassare un massimo**.
   Avrebbe chiesto a T09 esattamente la cosa che il task vieta.

Riscritto: la **definizione** sta nel dominio con un test proprio, l'adapter memory la **invoca** e
quello lo verifica il **reviewer per lettura**, ogni altro adapter è provato **equivalente** dalla suite
— che su due tecnologie diverse è l'unica verifica disponibile. Rilievo del planner.

**La lezione è nuova e vale oltre questo task:** *"criteri obsoleti si riscrivono prima di aprire il
task"* finora ha riguardato criteri invecchiati con il modello. Questo era **sbagliato il giorno in cui
l'ho scritto**, e il modo in cui è stato trovato non è la rilettura contro il codice: è stato il planner
a chiedersi *come* si sarebbe verificato. Un criterio che nomina il proprio metodo di verifica va letto
anche su quel piano, non solo sul merito.

### Una decisione mia, con il motivo che la regge

**Una riga per profilo con le quattro metriche**, non una riga per (profilo, metrica). Non è una
preferenza: con quattro righe l'alzata sono quattro scritture indipendenti, e la terza che fallisce
lascia applicate le prime due — è la voce di `IDEAS.md` sulla cascata che scrive N righe, già registrata
come difetto. Con l'aggregato il *"massimo scritto a metà"* diventa **non rappresentabile** invece di
evitato, che è la gerarchia di questo progetto. La forma per metrica avrebbe richiesto anche un **enum
delle metriche nel DB**, cioè un secondo posto dove vive l'elenco. Prezzo dichiarato nel criterio: una
quinta metrica diventa una migrazione di colonna.

### Un terzo criterio falso, trovato scrivendo questo, e **non** riscritto in silenzio

**T15 dice *"i numeri coincidono con quelli calcolati da T06 e T07 sugli stessi dati"***. Era vero
quando i badge si calcolavano sulle statistiche correnti; con T07e i badge vengono dai **massimi
storici** e i due numeri **possono differire per costruzione** — è il punto del task. Preso alla lettera
quel criterio chiede a T15 di dimostrare un'uguaglianza che T07e ha reso falsa. Marcato con un riquadro
⚠️ sopra T15, come già si fa per T13 e T14, e **non** riscritto da me: è un criterio di prodotto, e la
riscrittura è dell'umano quando aprirà il task. Aggiunto invece il criterio corrispondente che T07e
pretendeva: la schermata dichiara che le statistiche sono correnti e i badge sui massimi.

### Il piano, in breve

Cinque step, ognuno chiudibile con `verify` verde: (1) la monotonia come funzione pura del dominio, con
un **ponte di tipo** che fa fallire `typecheck` se una metrica nuova entra in `PersonalStats` e non nei
massimi; (2) port additivo, adapter memory, suite di contratto; (3) l'usecase che compone il percorso con
**una sola** scrittura; (4) i due invarianti per cui il task esiste e i percorsi d'errore; (5) i limiti
scritti nel codice dove si trovano. Stima ~21 test in più, dichiarata come stima.

**Tre cose del piano che vale la pena tenere qui**, perché sono decisioni e non dettagli:

- **Il port ha anche la lettura, che l'usecase non usa**, ed è la lettura che rende la scrittura
  *dimostrabile*: senza, un adapter che calcola il massimo e non lo persiste passerebbe la suite.
- **`raise` prende l'aggregato e ritorna lo stato dopo l'alzata**, invece di leggi-modifica-scrivi: un
  merge fatto nel client fra una lettura e una scrittura perderebbe un'alzata concorrente, cioè
  **abbasserebbe un massimo**. È lo stesso argomento per cui `adjustLegSeats` è relativa.
- **Una duplicazione accettata e dichiarata:** l'usecase deve enumerare le tratte proprie (*andata
  sempre, ritorno se `returnAt`*), regola che vive già in `save` e in `listOpenOffers`. Le alternative
  erano un metodo nuovo sul port (⛔, e per sole prestazioni) o fidarsi di un comportamento di
  `listByLeg` su tratta inesistente **che nessun test di contratto pinna** — e fidarsi di un
  comportamento non pinnato è peggio della duplicazione. Va nel commento dell'usecase.

### Quattro voci nuove in `IDEAS.md`, dal planner

`listByLeg` su tratta inesistente non pinnato dalla suite; `PersonalBests` strutturalmente identico a
`PersonalStats` (il nome protegge chi legge, **non** il compilatore, e brandizzarlo è un ⛔); **i massimi
non hanno una via di correzione** — la monotonia rende permanente anche un massimo sbagliato, da seed o
da un'accettazione per errore; e il degrado di T15 se la scrittura dei massimi fallisce, dove una delle
tre vie possibili **riapre il badge che si ritira**.

**Prossimo passo:** developer sullo Step 1–2, con le sonde di mutazione **chieste nel brief** e non
lasciate alla sua iniziativa.

---

## 2026-10-23 — T07e · cinque step implementati, `verify` verde, in attesa del reviewer

`verify` rifatto da me: **448 test unitari in 30 suite** (da 420/27), 1 di integrazione, 1 di smoke.
Sette file nuovi, otto modificati in modo additivo. Mutazioni **ripristinate** e verificate da me:
`Math.max` quattro volte nel dominio, e l'adapter che **importa e invoca** `raisePersonalBests` senza
nessun `Math.` proprio.

### Le tre sonde, tutte eseguite — ed è la differenza con T07d

Questa volta le sonde erano **nel brief**, non lasciate all'iniziativa del developer. Esito:

- **Ponte di tipo:** aggiunta una metrica finta a `PersonalStats` → `typecheck` rosso, con l'errore sul
  ponte (`TS2322 Type 'true' is not assignable to type 'false'`). Nello stesso run cadono anche altri
  file che costruiscono `PersonalStats` a mano, ma il ponte è l'unico errore causato dalla **divergenza**
  fra le due liste di metriche — cioè l'unico che resterebbe se qualcuno aggiornasse tutte le fixture e
  si dimenticasse i massimi.
- **`Math.max` → `Math.min` nel dominio:** cadono **14 test** in 3 suite (3 di dominio, 7 di contratto,
  4 di usecase).
- **`raise` dell'adapter sostituita da un upsert che sovrascrive:** cadono **4 test, tutti di
  contratto** — il caso misto per colonna, l'alzata più bassa, i quattro zeri, e l'eco dell'input. **I
  test di dominio non se ne accorgono, e non possono:** è esattamente il limite che il criterio corretto
  oggi dichiara, cioè che "l'adapter la invoca e non la reimplementa" lo verifica il **reviewer per
  lettura** e non la suite.

Per entrambe le mutazioni: `git diff --numstat` identico a prima, e `verify` verde dopo il ripristino.

### Una deviazione di conteggio, dichiarata, e vale la pena tenerla

Il piano (e il mio brief) dicevano **sei** file che importano il fake condiviso. Sono **sette**: il
settimo è `request-seat.test.ts`, cioè il file di T07d chiuso un'ora prima. Nessuno dei sette è stato
modificato e tutti e sette sono verdi. Il numero sbagliato veniva dal mio brief, non dal developer: è un
dato che avevo riportato dal piano senza ricontarlo.

### Due decisioni del developer, dichiarate

- **Il ponte di tipo sta in `core/usecases/`, non in `core/domain`.** `PersonalStats` vive negli usecase
  e il dominio non può importarlo: metterlo nel dominio avrebbe richiesto di invertire quella
  dipendenza. Il file dichiara che la prova vera è `typecheck` e che il suo `expect` a runtime è solo di
  forma.
- **Filtro `hasCar` nell'enumerazione delle tratte**, perché le tratte esistono solo con l'auto: le
  letture sono quindi **al più** `1 + 2N`, e il commento dice "al più" invece di `1 + 2N` secco.

E una correzione a un commento che **diceva il falso**: il doc di `storage-failed` ora dichiara che
l'errore può venire **anche dalla `raise`** e non solo dalle letture.

### Quello che il task non copre, dichiarato dal developer e non scoperto dopo

L'adapter che *invoca* la funzione di dominio non è provato da nessun test (lo vede il reviewer, e la
mutazione 2 mostra il perché); la **concorrenza reale** non è coperta, perché la memory è single-thread e
l'atomicità della `raise` si dimostra solo a T09; **nessun chiamante dell'usecase esiste ancora**, lo
creerà T15; il costo `1 + 2N` è dichiarato e non misurato; e non c'è un test che fissi il comportamento
di `listByLeg` su una tratta inesistente — che è il motivo della duplicazione accettata.

**Non committato:** il commit arriva dopo il reviewer.

---

## 2026-10-23 — T07e · **BOCCIATO** al primo giro: un test che a T09 sarebbe rosso

`verify` verde, rifatto tre volte — dal developer, da me e dal reviewer. Bocciato comunque: **sesta
bocciatura del progetto con `verify` verde**, e la seconda di fila in cui il codice di produzione è
corretto e il difetto è nella **verifica**.

Il reviewer ha chiuso la contabilità in due modi — per delta (420 + 28 = 448, 27 + 3 = 30) e per file
nuovo (dominio 7 + usecase 12 + ponte 1 + contratto 8 = 28 esatti) — quindi nessun test preesistente è
stato perso o riscritto per passare. Grep esaustivo su `src/`: zero `skip`, `only`, `xit`, `todo`,
`@ts-`, `eslint-disable`, `as any`.

### N1, bloccante: il test dei massimi scrive e legge la riga di un altro utente

Il `beforeEach` della suite di contratto autentica `owner`. Il test *"due profili hanno massimi
indipendenti"* crea `altro` e poi fa `raise` e `findByProfile` sulla **sua** riga **restando `owner`** —
mai una `comeUtente`. Verificato da me riga per riga.

**Perché costa caro, e perché solo a T09:** con la policy RLS scritta stamattina su T08 — ciascuno legge
e aggiorna **i propri** massimi, **nessuno** quelli di un altro — su Supabase la `raise` viene respinta,
e anche superandola la lettura non vede la riga e l'adapter sintetizza gli **zeri**, che è il contratto
dichiarato. Rosso in **due punti indipendenti**. Ma T09 pretende *"la stessa suite di contratto, senza
modifiche alla suite"*, e per `ARCHITECTURE.md` una suite che va adattata è il segnale che **il port è
sbagliato**: qui il port è sano, è il test a essere scritto come se le RLS non esistessero. La
discussione a T09 sarebbe su un port giusto — o peggio, qualcuno allenterebbe la policy dei massimi per
far passare un test, e `CLAUDE.md` di progetto chiude quella via (*"RLS attiva su ogni tabella, anche
nella demo"*).

Due cose rendono il rilievo più forte di un'opinione. La **convenzione esiste già**: nello stesso file
ogni operazione fatta per conto di un altro commuta identità prima, in una dozzina di punti. E
`memory.contract.test.ts` lo dichiara a parole — in RAM non esistono RLS, su Supabase quell'hook farà un
vero sign-in, ed **esiste già adesso perché aggiungerlo dopo imporrebbe di riscrivere la suite**. È
letteralmente il danno che quel commento prevedeva, tre settimane prima.

### N2: un commento che descrive come aperta una decisione già presa

`award-badges.ts` dice ancora *"memorizzare i badge «per sempre» è una scelta di persistenza, fuori da
questo task"*. Dopo T07e è una **previsione su un task futuro diventata falsa**: la scelta è stata fatta
— si memorizzano i **massimi** — e sul percorso di prodotto il badge non sparisce più. Il danno non è
l'imprecisione: la correzione "ovvia" che quel commento suggerisce — memorizzare i badge — è precisamente
l'alternativa che l'umano ha **scartato** il 14 ottobre, perché riaprirebbe il criterio dei duplicati da
*non rappresentabile* a *da verificare*. È la regola di `CLAUDE.md` sulle previsioni nei commenti, con il
costo visibile.

### Le sonde: il reviewer ha rifatto i conti per lettura, e tornano

`Math.max → Math.min` = **14** (3 + 7 + 4), e per ciascuno dei tre blocchi ha spiegato **quali test non
cadono e perché è giusto che non cadano** — chi non asserisce il verso del confronto, chi asserisce il
candidato, chi confronta due esecuzioni fra loro. L'adapter con upsert = **4**, tutti di contratto.
Mutanti cercati in più e **tutti morti**: campi incrociati nei due versi, `profileId` dal memorizzato,
`findByProfile` che ritorna sempre zeri, `raise` che non persiste, riga unica globale, badge calcolati
sulle statistiche correnti (ucciso **due volte**), `raise` saltata. E uno che **non è un mutante**: lo
scambio degli argomenti di `raisePersonalBests`, perché `Math.max` è simmetrico e i due `profileId`
coincidono per costruzione.

### Il punto che costa più caro, verificato: la forma SQL di T09 regge

Il contratto **è** esprimibile con un solo `INSERT … ON CONFLICT DO UPDATE … RETURNING *`: il caso misto
vincola `GREATEST` **per colonna** (una monotonia di riga darebbe `(7,1,9,100)` o `(5,4,9,300)`, entrambi
rossi), `RETURNING *` soddisfa *"ritorna lo stato dopo l'alzata"*, e la firma `raise(aggregato)` non
espone nessuna lettura obbligatoria — quindi nessun adapter è spinto al leggi-modifica-scrivi che
reintrodurrebbe la corsa. L'unica dipendenza implicita è sana: gli zeri per riga assente li sintetizza la
**stessa** funzione di dominio su entrambi gli adapter.

### Il giudizio di forma, messo a verbale perché non torni

Avevo chiesto se `stored`/`candidate` in inglese fossero un rilievo, dato che il resto del core usa
locali italiani. Risposta: **niente, nemmeno un nit**. Il dominio ha già questa divisione —
**parametri in inglese** (`civilDayNumber(date)`, `inclusiveDaysBetween(startDate, endDate)`,
`parseUtcInstant(value)`) e **locali in italiano** (`inizio`, `fine`, `campi`) — e i file nuovi la
rispettano esattamente. Uniformare all'italiano **romperebbe** la coerenza con `core/domain`, non la
creerebbe.

### Due riserve diventate voci di `IDEAS.md`

**Una lettura negata dalle RLS sarà indistinguibile da "nessun massimo"**: a T09 un errore di
autorizzazione si presenterebbe come un dato legittimo, perché il contratto dice *"riga assente → zeri in
`ok`"*. E **il test dei duplicati copre tre badge su sei**: la catena è completa e la proprietà è
conservata per costruzione, ma nessun test **si legge come il criterio** — stessa famiglia della voce su
*"primo viaggio"*.

**Secondo giro in corso:** N1, N2, più due riserve che si chiudono perché i file si riaprono comunque —
una coincidenza di fixture nel caso misto (`transportedColleagues` a 9 su entrambi i lati, nel test il
cui scopo è distinguere colonna per colonna) e un'intestazione che si contraddice col codice. Vincolo
dato al developer: **il conteggio deve restare 448/30**, perché è una modifica di identità e non di
copertura. E una sonda in più: dimostrare che `comeUtente` sull'adapter memory è davvero un **no-op**,
altrimenti il test corretto proverebbe una cosa diversa da quella che credo.

---

## 2026-10-23 — T07e · **APPROVATO** al secondo giro, e chiuso

`verify` verde, 448 test in 30 suite — **conteggio invariato**, perché la correzione era di identità e
non di copertura. Toccati tre soli file nel secondo giro; il reviewer l'ha verificato **sui timestamp**,
non sulla parola del developer, e ha constatato che gli altri tredici sono bit per bit quelli che aveva
già approvato nel merito.

### La risposta alle due domande che avevo posto

**La forma della correzione di N1 è quella giusta, e preferita anche a parità.** Leggere la riga di
`altro` **dentro** la finestra di identità e asserire fuori è equivalente, perché sotto le RLS conta
**chi esegue la query** e non chi valuta l'`expect`. In più la diagnosi resta buona in entrambi i modi di
fallire a T09: se la scrittura viene respinta, l'helper solleva *"raise fallita nel setup"* dentro la
finestra; se fosse la lettura a essere negata, il contratto *"riga assente → zeri"* la farebbe tornare
`ok(zeri)` e l'asserzione finale cadrebbe. **Nessuno dei due casi passa in silenzio.** E la forma
coincide con il pattern già stabilito nello stesso file: un file in cui due test fanno la stessa cosa in
due modi diversi è peggio.

**Sulla sonda, la risposta è più interessante della domanda.** La lettura basta, e pretendere la
mutazione sarebbe stato **chiedere una verifica che non può fallire**: `comeUtente` in RAM è un no-op con
il corpo vuoto, l'ambiente memory non ha alcun concetto di identità, quindi nessuna mutazione di quella
funzione può cambiare un risultato su `memory` — l'esito della sonda era noto a priori, zero test
caduti. L'unica cosa misurabile su memory era che la correzione non cambiasse la copertura, e il
conteggio invariato la misura. Il valore sta a T09, dove `comeUtente` farà un sign-in vero, e lì lo
misura la suite stessa. **Avevo chiesto una sonda nel posto in cui una sonda non può dire niente**, ed è
il complemento della lezione di T07d: lì mancava la sonda che serviva, qui ne chiedevo una innocua.

### Un carattere che ha comprato un mutante

La riserva 3 — `transportedColleagues` a 9 su entrambi i lati nel caso misto — era un carattere, e dopo
la correzione (candidato a 2) **le quattro colonne sono tutte distinte e vanno in direzioni diverse**:
una sale, tre scendono. Il reviewer ha rifatto l'analisi e ora quel test uccide anche il mutante
*"prendi sempre il memorizzato"*, che prima su quella colonna non avrebbe distinto. Le due firme
dichiarate restano esatte: **14** per `Math.max → Math.min` e **4** per l'upsert nell'adapter.

### Una proposta che nasce dal difetto di oggi, ed è strutturale

**Su `memory` niente impedisce a un test di contratto di agire con l'identità sbagliata.** N1 era verde
a 448 test e l'ha trovato una lettura. La via è far sì che l'ambiente in RAM **registri** l'identità e
che gli adapter memory rifiutino le operazioni altrui dove le RLS di T08 le rifiuteranno: così quella
classe di difetto cade **su `memory`**, prima di arrivare a Supabase. Tocca solo file di test e l'adapter
memory, si lega a **T07g**, ed è il presidio strutturale di una regola che oggi è convenzione più
reviewer. Scritta in `IDEAS.md`; la decisione è dell'umano.

### T07e chiuso

Commit unico, criteri spuntati. Due criteri sono spuntati con una **dichiarazione invece che con una
pretesa**: quello su T15 vale come *criterio aggiunto a T15*, perché nessuna schermata esiste ancora; e
quello sui duplicati è soddisfatto **in composizione**, con il limite dichiarato — il test sul percorso
nuovo esercita tre badge su sei. Entrambi i limiti sono scritti accanto alla spunta, così chi li rilegge
non li prende per garanzie piene.

---

## 2026-10-23 — Fine sessione · stato, decisioni, e quattro lezioni sui criteri

Scritto per la sessione successiva. **Working tree pulito, `origin/auto/build` allineato, nessun commit
in attesa di push.** `main` fermo dove l'ha lasciato l'umano: lo mergia lui.

### Stato vero

Fase 0 e Fase 1 complete. **Fase 2: chiusi T01, T02, T03, T04, T04b, T05, T06, T07, T07c, T07d, T07e** —
ognuno con `verify` verde, reviewer approvato e **un commit solo**. `npm run verify` → **448 test unitari
in 30 suite**, 1 di integrazione, 1 di smoke (erano 402/27 a inizio sessione).

Quattro commit, in ordine: `20f7e07` (backlog), `45eb0cd` (T07d), `19a16d5` (pianificazione T07e),
`ecec9c5` (T07e).

Il reviewer ha bocciato **due volte su due task**, sempre con `verify` verde, e in **entrambi i casi il
codice di produzione era corretto**: il difetto era nella verifica. È un cambio di natura rispetto alle
bocciature precedenti, che riguardavano il codice.

### Prossimi passi, in ordine — il prossimo è un ⛔

1. **T07f ⛔** — l'istante normalizzato al confine. Rompe le firme di `Trip`, `SeatOffer`, `TripRequest`
   e di ogni adapter che le materializza. **Serve il via libera dell'umano**, che oggi ha scelto di
   fermarsi prima: la domanda è già posta e aspetta solo la risposta. È la voce più urgente del registro
   — senza, a T09 **ogni** offerta da Supabase sparisce in silenzio e il motore torna `ok([])`.
2. **T07g** — la suite di contratto prova il guasto, **più il criterio aggiunto oggi** sull'identità in
   RAM. Nessun ⛔. Il costo è passato da S/M a M.
3. **T07h** — igiene di lint e identità. Nessun ⛔.
4. **T07b ⛔** — parametri da tabella. Inverte una decisione di T03 e introduce un port nuovo.
5. **T08 ⛔** — schema, migrazioni e RLS. Ha accumulato **quattro criteri nuovi** in questa sessione.

**Non si aprono senza riscriverne prima i criteri: T13, T14** (precedono le note, le due tratte, le
offerte grigie e rosse, la cascata e il reintegro) **e adesso anche T15**, con il riquadro ⚠️ sopra il
task.

### Decisioni dell'umano in questa sessione

Simmetria per direzione su T07d; quattro gruppi di `IDEAS.md` portati dentro come T07f, T07g, T07h più
criteri su T08 e T16; l'ordine `T07d → T07e → T07f → T07g → T07b → T08`; il trigger di T07e come
**usecase nuovo letto-poi-scritto**, con la metà in scrittura delle RLS che ne segue; l'identità in RAM
come **criterio di T07g**; e sugli strumenti del reviewer la forma **(a)** — se gli serve una sonda, la
chiede e la esegue il developer.

### Aperto, e da decidere quando servirà

- **T07d ha ristretto il buco dei KPI, non l'ha chiuso.** Con gli **stessi plant e lo stesso giorno di
  partenza**, una trasferta dichiarata di sei giorni contro una tratta di uno passa, e T06 accredita sei
  giorni. Due vie in `IDEAS.md`, con prezzi diversi: confrontare anche il capo non richiesto (rompe "ho
  chiesto solo l'andata") o limitare i giorni lato T06 (non toglie niente all'utente).
- **La sonda di mutazione come step di `verify`** resta la forma (c) non scelta: sarebbe la rete più
  forte e non dipenderebbe da chi si ricorda di chiedere.
- **Il giorno dei confronti è UTC**, non quello del fuso di chi viaggia. Irraggiungibile con dati
  realistici, da decidere prima che lo incontri un seed notturno.
- **I massimi non hanno una via di correzione:** la monotonia rende permanente anche un massimo
  sbagliato, da seed o da un'accettazione per errore.
- **A T09 una lettura negata dalle RLS sarà indistinguibile da "nessun massimo"**: un errore di
  autorizzazione che si presenta come un dato legittimo.
- **I due task che non esistono nel backlog** — modifica trasferta e annullamento trasferta — restano
  inesistenti, e con loro la cascata sulle candidature quando una trasferta scompare.
- **Il blocco UI** (note validate solo sui campi scritti, errori accumulati, tetto di digitazione,
  `Trip.seatsAvailable` che mente dopo le tratte, candidature lette per owner, bonus "stessa persona su
  entrambe le tratte") resta non schedulato, da decidere con la riscrittura dei criteri di T13–T15.

### Le quattro lezioni, che riguardano tutte i **criteri** e non il codice

1. **Un criterio può essere sbagliato il giorno in cui lo scrivi.** La regola nota diceva che i criteri
   **invecchiano** col modello; oggi due erano sbagliati **appena scritti**: quello di T07d letto alla
   lettera rifiutava ogni rientro legittimo, e quello mio sulla monotonia prometteva una verifica che
   non esiste e a T09 avrebbe imposto la cosa che il task vieta.
2. **Un criterio che nomina il proprio metodo di verifica va letto anche su quel piano.** Non l'ha
   trovato una rilettura contro il codice: l'ha trovato il planner chiedendosi **come** si sarebbe
   verificato. *"La suite di contratto lo verifica"* era falso perché una suite comportamentale non vede
   gli import.
3. **Una verifica può mancare, ma può anche essere innocua per costruzione.** T07d è stato bocciato per
   una sonda **mancante**; su T07e ne ho chiesta una il cui esito era **noto a priori** — mutare un
   no-op in un ambiente senza identità non può far cadere niente. Prima di chiedere una sonda, chiedersi
   se **può** fallire.
4. **La causa di un test che non distingue sta quasi sempre in una fixture, non nel predicato.** Due
   volte oggi: andata e rientro dell'offerente nello stesso giorno UTC, e una colonna con lo stesso
   valore sui due lati nel test il cui scopo era distinguere colonna per colonna. In entrambi i casi il
   codice di produzione era giusto.

Le tre regole operative nuove sono in `CLAUDE.md` e in `OFFICINA.md`, non solo qui: il testo multilinea
ai comandi nativi passa per un file, al reviewer non si chiede di mutare il sorgente, e la frase
sull'indipendenza del reviewer non dichiara più una proprietà che il sistema non ha.


---

## 2026-10-25 — Ripresa su una macchina nuova · due prerequisiti, una rete giù, e la delega dell'umano

**Macchina diversa dalla precedente.** Il repo è un clone fresco: niente `node_modules`, niente Node,
niente `app/.env`. Il branch locale `auto/build` è stato creato a tracciare `origin/auto/build`
(`0608d1f`), che è lo stato lasciato dalla sessione del 23 ottobre.

**Delega dell'umano, valida per questa sessione:** procedere in automatico e, davanti a una decisione,
scegliere l'opzione raccomandata dall'agente invece di fermarsi a chiedere. Ogni decisione presa così
è registrata qui con la sua alternativa, perché l'umano possa rovesciarla.

**Le due domande poste comunque**, perché nessuna raccomandazione le scioglie:
- **Node** — installazione di software, ⛔ per F1.1. Risposta: lo installa l'agente, come in F1.1.
  Node LTS **v24.22.1** da nodejs.org, **SHA256 verificato** contro `SHASUMS256.txt` di `latest-v24.x`
  (`d2046d28…95fa5`, corrisponde), estratto in `%LOCALAPPDATA%\Programs\nodejs`, aggiunto al PATH
  utente. Niente admin. Poi `npm ci` dal lockfile: **nessuna dipendenza nuova**, e i due install script
  già valutati in Fase 1 (`@parcel/watcher`, `unrs-resolver`) restano non eseguiti.
- **Credenziali di staging** — solo l'umano le ha. Risposta: crea lui `app/.env`.

**`verify` alla ripresa, prima di toccare niente:** lint, typecheck, **448 unit in 30 suite** e smoke
verdi; `test:int` rosso **per la ragione giusta** — *"mancano le variabili EXPO_PUBLIC_SUPABASE_URL,
EXPO_PUBLIC_SUPABASE_ANON_KEY"*. Lo stato ereditato è quello dichiarato.

### ⚠️ La seconda rete su git è giù su questa macchina

L'hook `PreToolUse` in `.claude/settings.json` è `python -I "C:/D/Python Projects/officina-software/
.claude/hooks/guard-git.py"`: **un percorso assoluto della macchina precedente**, e qui `python` è
l'alias del Microsoft Store, non un interprete (quello vero è il launcher `py`, 3.12.10). L'hook quindi
**fallisce senza bloccare**, e ogni comando passa: lo dimostra il fatto che questa sessione sta girando.
Restano attive le **deny rules** (verificato: hanno fermato una lettura di `.env`) e la **branch
protection** su `main`. **Non corretto**, perché `CLAUDE.md` vieta di toccare `.claude/settings.json`:
la decisione è dell'umano. La via ovvia è un percorso relativo alla radice del repo e un interprete che
esista su entrambe le macchine. Nel frattempo l'agente non usa nessuno dei comandi vietati, che è ciò
che l'hook impone — ma è convenzione, non freno, e va detto.

**Il reviewer non compare fra i tipi di agente caricati** in questa sessione, benché
`.claude/agents/reviewer.md` esista. Non si tocca `.claude/`: la review la fa un agente generico con le
istruzioni di `reviewer.md` lette parola per parola, su modello forte, e **senza** modificare file.

**T07f ⛔ si apre per delega.** Il checkpoint chiedeva il via libera a rompere le firme di `Trip`,
`SeatOffer` e `TripRequest`; è la raccomandazione dell'ultima sessione ed è reversibile con un
`git revert`. Alternativa non scelta: fermarsi qui fino al via libera esplicito.

---

## 2026-10-25 — T07f · pianificazione

Nessun codice. Il planner ha toccato **solo** `TASKS.md` (criteri di T07f), `IDEAS.md` (due voci) e
questa voce. Letti prima: `instant.ts`, `calendar.ts`, le tre entità, `trip-leg.ts`, i quattro usecase
che leggono istanti (`find-matches`, `create-trip`, `request-seat`, `compute-company-kpi`; gli altri —
`leg-system-transitions`, `accept`/`reject`/`cancel`, `compute-personal-stats`, `refresh-personal-bests`
— toccano solo `returnAt === null`), l'adapter memory, la suite di contratto, `request-test-fakes.ts`
e i test che pinnano le forme.

### I criteri, riletti contro il codice: sei correzioni e tre aggiunte

**La causa comune è una sola, e va detta prima del dettaglio.** I criteri sono stati scritti sul modello
in cui il parser **rifiuta** tutto ciò che non è canonico. T07f introduce un parser che **accetta e
riporta** (`+00:00`, microsecondi, `Z` senza millisecondi). Su quel modello nuovo due cose cambiano di
significato, e nessun test se ne accorgerebbe:

1. **"Accettato dal parser" non vuol più dire "canonico".** Il criterio della suite di contratto,
   preso alla lettera, sarebbe soddisfatto da un adapter Supabase che lascia uscire la stringa grezza
   di PostgREST: `+00:00` è accettato. E quella stringa, confrontata come stringa con una `...Z`,
   ordina male — cioè il criterio avrebbe promesso la proprietà che il task esiste per garantire, senza
   verificarla. Riscritto come **punto fisso**: il parser riporta l'istante uscito **identico**.
2. **Tre test chiusi di T04 pinnano il comportamento che T07f rovescia apposta.** `create-trip.test.ts` ha
   *"una partenza con microsecondi è rifiutata"*, *"un rientro con microsecondi è rifiutato"* e
   *"senza millisecondi ma con la Z è canonico: accettato e non riscritto"*, sotto un `describe`
   intitolato *"rifiutati e mai convertiti"*. Il terzo criterio di T07f chiede l'opposto. Senza un
   criterio che li elenchi, il developer avrebbe due scelte entrambe sbagliate: cambiarli in silenzio
   (vietato da `CLAUDE.md`) o fermarsi davanti a un rosso che è il task stesso. Aggiunto il criterio
   che li nomina uno per uno, più i tre test che diventano **irrappresentabili** (un'offerta con
   `+01:00` in `findMatches`, la richiesta malformata, l'istante illeggibile della trasferta
   dichiarata) e quello sulla data impossibile in `computeCompanyKpi`. L'intenzione di ciascuno passa
   ai test del parser, che è dove ora vive la garanzia.

Le altre correzioni, una riga ciascuna — il dettaglio è accanto a ogni criterio in `TASKS.md`:

- **Criterio 1** non diceva chi può chiamare il parser: `createTrip` è un **confine** (entra la
  stringa del form e quella dell'orologio), non un consumatore. Reso verificabile con due `rg`.
- **Criterio 2** non diceva come si verifica un tipo: un test a runtime non vede i tipi. Ora è
  un'asserzione che il compilatore valuta, e che **può** fallire.
- **Criterio 3**: Postgres scrive i decimali **senza zeri finali** (`.12+00:00`, non `.120000`). Un
  parser a tre o sei cifre fisse avrebbe rifiutato una riga su dieci a T09. Pinnato anche il
  **troncamento**.
- **Criterio 4**: *"senza eccezioni"* non è verificabile come enunciato universale; lo è come proprietà
  della forma a **larghezza fissa**, provata su ogni uscita del parser.
- **Criterio 8** nominava un **seed che non esiste**: diventa un criterio di T17.
- **Aggiunti**: l'elenco dei test che cambiano (sopra); `MatchError` perde
  `invalid-request-departure-at`, che diventa irrappresentabile, e `ARCHITECTURE.md` segue nello stesso
  commit; i criteri corrispondenti su T08 (`timestamptz(3)`) e T17 (seed dal parser), nella forma che
  T07c e T07e hanno già usato.

### La forma canonica e il nome, pinnati

**`YYYY-MM-DDTHH:mm:ss.sssZ`, sempre i millisecondi, 24 caratteri.** Tre ragioni, in ordine di peso:
è la forma che `Clock.now()` promette già e che `toISOString()` produce, quindi l'orologio di sistema
la emette senza conversione; è a **larghezza fissa**, che è l'unica proprietà da cui segue *"ordine
lessicografico = ordine cronologico"* senza eccezioni (per anni a quattro cifre); ed è la forma in cui
la suite di contratto scrive **già** tutte le sue fixture. Il millisecondo e non il microsecondo perché
nessun conto del dominio scende sotto, e JS non rappresenta il microsecondo in un `number` d'epoca
senza perdita.

**Il tipo si chiama `UtcInstant`; il parser `normalizeUtcInstant`.** `Instant` esiste **già** — è
l'interfaccia `{ date, millisOfDay }` che `parseUtcInstant` ritorna — e dare lo stesso nome al brand
avrebbe messo due significati sotto un nome per tutta la durata del task. `UTC` nel nome dice da cosa
dipende la garanzia. Il parser cambia nome perché cambia contratto (da `Instant | null` a
`Result<UtcInstant, UtcInstantError>`), e un nome nuovo permette uno step 1 **additivo e verde**; il
vecchio sparisce allo step 4, e `rg` lo dimostra.

### Il piano, in cinque step

**Step 1 — Il tipo e il parser, additivi.** Solo dominio; il vecchio parser resta intatto.
- Deve esistere in `instant.ts`: `UtcInstant` (stringa marchiata con un `unique symbol`, così nessun
  letterale d'oggetto può fingere il marchio); `UtcInstantError` (`malformed-instant` /
  `non-utc-offset` / `impossible-date`, ciascuno con `value`); `normalizeUtcInstant`; due funzioni
  **totali** sul tipo — `utcInstantParts` (data e millisecondi nel giorno, l'attuale `Instant`
  rinominato `InstantParts`) e `compareUtcInstants`. La validità di calendario passa da
  `civilDayNumber` di `calendar.ts` (dominio → dominio, nessun ciclo). Il marchio si ottiene con un
  **type predicate** interno, non con `as`.
- Deve esistere `core/domain/instant-fixture.ts`: `utc(raw)` per le fixture, che **solleva** su input
  invalido. **Non** esportato da `domain/index.ts`; intestazione che lo dichiara solo-test.
- Test, in `instant.test.ts`, con **stringhe letterali**: `…06:30:00Z` → `…06:30:00.000Z`;
  `…06:30:00+00:00` → `.000Z`; `…06:30:00.12+00:00` → `.120Z`; `…06:30:00.5Z` → `.500Z`;
  `…06:30:00.123999+00:00` → `.123Z`; `…23:59:59.999999+00:00` → `…23:59:59.999Z` **stesso giorno**.
  Rifiutati: `+01:00`, `-01:00`, `-00:00` → `non-utc-offset`; sette decimali, senza fuso, spazio al
  posto di `T`, `z` minuscola, `+0000`, `+00`, ore 24, minuti o secondi 60 → `malformed-instant`;
  `2026-02-31`, `2026-02-29`, `2027-02-29`, `2100-02-29`, `2026-04-31` → `impossible-date`.
  Accettati `2028-02-29` e `2000-02-29` (rete contro un parser troppo stretto). La coppia `Z` / `.000Z`
  produce **la stessa stringa**. Ogni uscita della tabella ha 24 caratteri e la forma a larghezza
  fissa. Una tabella di grezzi in ordine cronologico noto, normalizzati e ordinati con `sort()`
  lessicografico, resta in quell'ordine, e `compareUtcInstants` concorda. I casi di
  `utcInstantParts` (mezzanotte = 0, ultimo millisecondo = 86 399 999) portati dai test attuali.
  Un'asserzione di tipo: `string` non è assegnabile a `UtcInstant`.
- **Sonde, da chiedere nel brief del developer — tutte possono fallire:** arrotondare invece di
  troncare (cadono `.123999` e `23:59:59.999999`); togliere il controllo di calendario (cadono le date
  impossibili); non riempire a tre cifre (cade la larghezza fissa); `type UtcInstant = string`
  (`typecheck` rosso).
- File: `instant.ts`, `instant.test.ts`, `instant-fixture.ts` (nuovo), `domain/index.ts`.
- Chiude con `verify` verde.

**Step 2 — Le firme si rompono.** È l'unico step non spezzabile: entità, consumatori e fixture sono
legati dalla compilazione, e un taglio a metà non compila.
- `Trip`, `SeatOffer`, `TripRequest`: `departureAt: UtcInstant`, `returnAt: UtcInstant | null`.
- `createTrip`: normalizza `input.departureAt`, `input.returnAt` e `clock.now()`; stessi `kind` di
  errore di oggi, con `value` **grezzo** (è ciò che il chiamante ha mandato); il `Trip` salvato porta
  la forma canonica; il `confronta` locale lascia il posto a `compareUtcInstants`.
- `findMatches`: nessun parser, `utcInstantParts` su richiesta e offerta; **via** la riga
  `if (!istanteOfferto) continue;` — che è il difetto per cui il task esiste — e via
  `invalid-request-departure-at` da `MatchError`.
- `requestSeat`: `trasfertaCompatibile` legge la data da `utcInstantParts`; via la guardia
  sull'istante illeggibile e la voce del LIMITE corrispondente, perché la causa non esiste più. La
  guardia `=== null` resta: è il rientro mancante, non un istante rotto.
- `computeCompanyKpi`: `utcInstantParts`; via il controllo `civilDayNumber(start) === null`, che
  diventa **irraggiungibile**; `invalid-trip-date` **resta**, perché il rientro precedente alla partenza
  è ancora rappresentabile (`makeTrip` non lo vieta, `seminaGrezzo` lo scrive) e ha già il suo test.
- Adapter memory: **nessuna logica cambia**. Se il developer si trova a cambiarne una, è un segnale e
  si ferma.
- Fixture: `request-test-fakes.ts` (`TripsOptions.returnAt` diventa `UtcInstant`), `unaTrasferta` di
  `repository-contract.ts`, e ogni letterale d'istante in un `Trip`, `SeatOffer` o `TripRequest` dei
  test, via `utc(…)`. `richiestaDel` in `request-seat.test.ts` perde il ripiego `?? ''`.
- Test che cambiano aspettativa: **esattamente** l'elenco del criterio di `TASKS.md`. In
  `create-trip.test.ts` i microsecondi diventano *"accettati e troncati"* con l'istante salvato
  pinnato, il `Z` senza millisecondi diventa *"accettato e riportato a `.000Z`"*, il `describe` cambia
  titolo; si aggiungono `+00:00` accettato e riportato, e `2026-02-31T…` → `invalid-departure-at` con
  zero scritture. Il test su `departure-in-the-past` con `…07:00:00Z` **non** cambia: l'errore riporta
  il valore grezzo.
- Asserzioni di tipo sui campi d'istante delle tre entità (`string` non assegnabile).
- Criteri: `verify` verde; `rg "as UtcInstant" app/src` vuoto; nel diff dei test nessuna aspettativa
  cambiata oltre l'elenco (reviewer).
- **Sonde:** riportare `SeatOffer.departureAt` a `string` (`typecheck` rosso: l'asserzione di tipo
  diventa falsa); invertire il segno di `compareUtcInstants` in `createTrip` (cadono i confini di T04,
  *"uguale ad adesso"* e *"un millisecondo prima"*). **Non** chiedere una sonda su *"`createTrip`
  salva la stringa grezza"*: non compila, quindi la rete è il compilatore e una sonda a runtime non ha
  niente da misurare.
- File: `trip.ts`, `seat-offer.ts`, `trip-request.ts`, `create-trip.ts`, `find-matches.ts`,
  `request-seat.ts`, `compute-company-kpi.ts`, `request-test-fakes.ts`, `repository-contract.ts`
  (solo la fixture), e i test: `create-trip`, `find-matches`, `request-seat`, `compute-company-kpi`,
  `compute-personal-stats`, `refresh-personal-bests`, `award-badges`, `kpi-config`, `trip`,
  `memory-trip-repository`. Se il compilatore ne indica altri, si aggiungono e si dichiarano.

**Step 3 — La suite di contratto pretende il punto fisso.** Additivo.
- Test nuovi in `repository-contract.ts`: dopo `save`, ogni istante uscito da `findById`,
  `listByOwner` e `listOpenOffers` (andata **e** ritorno) è identico al letterale scritto **e** è
  punto fisso di `normalizeUtcInstant`. Fixture con millisecondi che finiscono in zero (`.120Z`), e i
  due capi in **giorni diversi** — la lezione di T07d: capi indistinguibili nascondono i mutanti.
- `memory.contract.test.ts` **non cambia**: è la prova che la modifica è additiva.
- **Nessuna sonda, e va scritto perché.** Su `memory` il test non può fallire per costruzione: per
  far uscire una stringa non canonica l'adapter dovrebbe produrre una `string`, e non compilerebbe.
  Una sonda qui avrebbe esito noto a priori. Il test paga a T09, dove il marchio lo dà il parser e
  non il compilatore.
- File: `repository-contract.ts`.

**Step 4 — Il vecchio parser sparisce.**
- Eliminati `parseUtcInstant`, `Instant` e la regex `ISTANTE_UTC`; esportazioni di
  `domain/index.ts` aggiornate. Commenti che li nominano o che descrivono il vecchio contratto:
  intestazione di `calendar.ts` (*"il parser non verifica il calendario"*, ora falso), `clock.ts`,
  `trip.ts`, `fixed-clock.test.ts`.
- Criteri: i due `rg` del criterio 1 di `TASKS.md`; `verify` verde.
- File: `instant.ts`, `domain/index.ts`, `calendar.ts`, `clock.ts`, `trip.ts`, `fixed-clock.test.ts`.

**Step 5 — Documenti e criteri a valle.**
- `ARCHITECTURE.md`, § Il motore di matching: `MatchError` senza `invalid-request-departure-at`, e il
  paragrafo sul `Result` dice che la garanzia sull'istante è passata al tipo.
- `TASKS.md`: criterio su T08 (`timestamptz(3)`) e su T17 (seed da `normalizeUtcInstant`). Li scrive
  l'orchestratore, non il developer: sono criteri, non codice.
- Criterio: `rg "invalid-request-departure-at" app ARCHITECTURE.md` vuoto.

Stima: una ventina di test in più e sette in meno, **dichiarata come stima**.

**DoD, da sapere prima di aprire:** `verify` comprende `test:int`, che su questa macchina è rosso
finché l'umano non crea `app/.env`. Il commit di T07f aspetta quel file; il lavoro degli step no.

### Le decisioni prese qui, con l'alternativa scartata

- **Forma a millisecondi fissi.** Scartata: forma corta quando i millisecondi sono zero — è proprio la
  doppia forma che ordina al contrario.
- **Troncamento oltre il millisecondo.** Scartato l'arrotondamento: `23:59:59.9999` porterebbe il
  riporto sul giorno, sul mese e sull'anno, cioè aritmetica di calendario per un millisecondo.
- **Solo `Z` e `+00:00`; `+01:00` e ogni altro offset rifiutati con `non-utc-offset`, `-00:00` compreso**
  (RFC 3339: offset locale ignoto). Scartata la conversione di qualunque offset: richiede l'inversa di
  `civilDayNumber`, nessun produttore del sistema la usa (la sessione Supabase è UTC), e il test di T04
  sul `+01:00` rifiutato resta valido. Un offset non nullo da PostgREST è una configurazione sbagliata,
  da far vedere e non da assorbire.
- **Da uno a sei decimali.** Scartati tre o sei fissi: Postgres toglie gli zeri finali.
- **`Result` con errore tipizzato al posto di `null`.** Scartato `null`: il criterio sulle date
  impossibili chiede un errore tipizzato al confine.
- **Parser con nome nuovo e vecchio eliminato allo step 4.** Scartata la firma cambiata sul posto:
  rompe tutti i consumatori in un colpo e lo step 1 non chiuderebbe verde.
- **Marchio con `unique symbol` e type predicate, zero `as`.** Scartato `value as UtcInstant` nel
  costruttore: le convenzioni vietano `as` per zittire il compilatore, e qui non serve.
- **`Clock.now()` resta `string`; la normalizza `createTrip`.** Scartato brandizzare il port: allarga il
  ⛔ a una firma che il checkpoint non nomina. Voce in `IDEAS.md`.
- **`CreateTripInput` resta `string` e gli errori conservano i `kind` di oggi, senza un campo `reason`.**
  Scartato portare il parser nella UI: T12 mapperà gli errori di T04 così come sono, e il form userà un
  selettore di data che una data impossibile non la produce.
- **`invalid-trip-date` resta.** Scartata la rimozione: il rientro rovesciato è ancora rappresentabile.
- **Le fixture passano da un modulo in `core/domain` che solleva.** Scartato un aiuto per file: una
  dozzina di copie in tre livelli, e `core/domain` è l'unico posto raggiungibile da tutti. Il rischio
  — una funzione che lancia importabile dalla produzione — è dichiarato e ha una voce in `IDEAS.md`.
- **Asserzioni di tipo con un tipo condizionale, non con `@ts-expect-error`.** Stessa forza (diventano
  rosse se la stringa torna assegnabile), e non dipendono da come il lint tratta le direttive.

### Le decisioni che spetterebbero all'umano, con la mia raccomandazione (applicata per delega)

- **`MatchError` perde un `kind`, e `ARCHITECTURE.md` cambia.** È un contratto pubblico documentato.
  Raccomando la rimozione: lasciarlo produrrebbe un ramo irraggiungibile e un documento che promette
  un errore che nessun input può causare.
- **Sette test di task chiusi (T03, T04, T06, T07d) cambiano o spariscono.** Raccomando di cambiarli,
  con l'elenco scritto nei criteri: pinnano esattamente il comportamento che l'umano ha scelto di
  rovesciare portando dentro le due voci.
- **`timestamptz(3)` come criterio di T08.** Raccomandato: con la precisione di default Postgres
  conserva i microsecondi che il dominio tronca, e due istanti distinti nel DB diventerebbero uguali
  in JS — un `ORDER BY` e un ordinamento lato client darebbero risposte diverse sugli stessi dati.

### Fuori da T07f, per non farlo cercare

- **A T09** l'adapter Supabase passa ogni istante letto da `normalizeUtcInstant`; un istante che il
  parser rifiuta è `invalid-record` in `findById` e un'omissione nelle liste — quest'ultima è già un
  criterio di T07g. Su `memory` quel ramo diventa irraggiungibile, perché `seminaGrezzo` riceve un
  `Trip` già marchiato.
- La voce *"Il giorno del confronto è quello UTC"* resta aperta e non si muove: T07f cambia la forma
  dell'istante, non il fuso del giorno.

### Due voci nuove in `IDEAS.md`, dal planner

`Clock.now()` che ritorna `UtcInstant` (l'unico punto d'ingresso dell'istante che resta `string`, e
T13 lo leggerà); e una regola di lint che vieti alla produzione di importare i moduli di sola fixture
— `request-test-fakes.ts` oggi, il modulo degli istanti domani, che **solleva**.

**Prossimo passo:** review del piano, poi developer sullo Step 1, con le quattro sonde **scritte nel
brief** e non lasciate alla sua iniziativa.


---

## 2026-10-25 — T07f · **APPROVATO** al secondo giro, e chiuso

`verify` completo **verde**: **488 test unitari in 30 suite** (erano 448, +40), 1 di integrazione, 1 di
smoke. Il ⛔ era sciolto per delega dell'umano (voce di ripresa sopra).

### Cosa c'è adesso

`UtcInstant` è un tipo marchiato (`unique symbol`, marchio ottenuto con un type predicate, nessun `as`),
e `normalizeUtcInstant` è l'unico punto che lo produce, con `Result<UtcInstant, UtcInstantError>`.
Forma canonica **`YYYY-MM-DDTHH:mm:ss.sssZ`, sempre 24 caratteri**; accetta `Z` e `+00:00`, da uno a
sei decimali, **tronca** oltre il millisecondo; rifiuta le date impossibili con `impossible-date`.
`Trip`, `SeatOffer` e `TripRequest` portano il tipo, e `createTrip` è il confine che normalizza.
Spariscono l'omissione silenziosa di `findMatches`, la guardia sull'istante illeggibile di
`requestSeat`, un controllo irraggiungibile di `computeCompanyKpi`, il `kind`
`invalid-request-departure-at` di `MatchError` (`ARCHITECTURE.md` aggiornato), e il vecchio parser.
La suite di contratto ha il test del **punto fisso** su `findById`, `listByOwner`, `listOpenOffers`.
Criteri conseguenti scritti su T08 (`timestamptz(3)`) e T17 (seed dal parser).

**Sette test di task chiusi cambiano aspettativa**, tutti nell'elenco del criterio scritto **prima**
dell'implementazione. In più sono stati rimossi gli 8 test del vecchio parser, che non erano
nell'elenco: la funzione non esiste più, e il reviewer ha verificato **caso per caso** che ognuno è
coperto dal parser nuovo — uno con un confine più stretto (ora 24 invece di 25).

### Sonde di mutazione, tutte eseguite dal developer

Arrotondare invece di troncare → 6 test caduti; togliere il controllo di calendario → 5; non riempire
a tre cifre → 12; `type UtcInstant = string` → `typecheck` rosso; `SeatOffer.departureAt: string` →
`typecheck` rosso in due punti; segno invertito in `createTrip` → 28; segno invertito in
`compareUtcInstants` → 29. **La previsione del piano era sbagliata su un nome:** il test *"uguale ad
adesso"* non cade con il segno invertito, perché a parità il confronto vale 0 qualunque sia il segno.
Il reviewer ha confermato che non è un confine scoperto: quel test copre un'altra mutazione (`< 0` →
`<= 0`). Non eseguita, come da piano, la sonda *"createTrip salva la stringa grezza"*: non compila.

### La bocciatura del primo giro: commenti, non codice

Codice, test e tipi approvati al primo giro. Bocciato per due difetti di **commento**: **N1**, un
commento in un test nominava ancora il parser eliminato, quindi la seconda ricerca del criterio 1 non
tornava vuota; **N2**, due commenti (`create-trip.test.ts`, `clock.ts`) descrivevano il vecchio
contratto — *"con tutto in UTC l'ordine lessicografico coincide con quello cronologico"* è
esattamente la frase che T07f dimostra falsa. Chiusi al secondo giro con quattro riserve minori
(un'asserzione contro `undefined` dopo un `sort`, `eCanonico` → `haLarghezzaCanonica`, un commento in
`fixed-clock.test.ts`, il newline finale). Conteggio invariato a 488/30; il reviewer ha verificato
**sui file** che il resto del diff è identico a quello approvato nel merito.

La lezione è nella voce nuova di `IDEAS.md`: un criterio di verifica **per assenza** deve dire se i test
sono inclusi. Il primo `rg` lo diceva, il secondo no.

### Due incidenti del developer, dichiarati da lui

1. **Ha cancellato metà di `node_modules`.** Per contare i test di base ha creato un worktree di HEAD
   con una junction a `app/node_modules`, poi `git worktree remove --force` ha cancellato **attraverso
   la junction**. Sorgente intatto (verificato dall'orchestratore: i 26 file attesi, nessun worktree
   residuo, `.env` presente); ripristinato con `npm ci` dal lockfile, nessuna dipendenza nuova, poi
   `verify` verde. **Regola per i brief futuri:** niente worktree, junction o copie del repo per
   misurare; il conteggio di base è quello registrato qui.
2. **Ha scritto un file di test con la shell** (`[IO.File]::WriteAllText`), contro la regola di
   `CLAUDE.md`. Nessun danno: niente BOM, niente CR, UTF-8 valido, verificato da orchestratore e
   reviewer sui byte. Mancava solo il newline finale (R4).

Il reviewer è stato un agente generico con le istruzioni di `reviewer.md`, su modello forte, senza
modificare file: il tipo `reviewer` non è caricato in questa sessione.


---

## 2026-10-25 — T07g · pianificazione

Nessun codice. Il planner ha toccato **solo** `TASKS.md` (criteri di T07g), `IDEAS.md` (tre voci) e
questa voce. Letti prima: i sei port, i cinque adapter memory, `repository-contract.ts`,
`memory.contract.test.ts`, `memory-trip-repository.test.ts`, `request-test-fakes.ts`, i validatori di
dominio e gli usecase che leggono liste (`leg-system-transitions`, `refresh-personal-bests`) o agiscono
per conto di un attore (`request-seat`, `accept-request`, `reject-request`, `cancel-request`).

**Un fatto che semplifica tutto:** nessun usecase usa gli adapter memory, perché i test di `core/` passano
dai fake di `request-test-fakes.ts`. Quindi le policy in RAM non possono rompere un solo test di usecase:
il raggio del task è la suite di contratto, i test specifici di memory e i quattro adapter.

### I criteri, riletti: sette correzioni e un'aggiunta

**La causa comune:** tre criteri sono stati scritti **prima** del modello a tratte e di T07f, e quello
sull'identità non diceva **quali** operazioni rifiutare. Su metà delle tabelle T08 non ha ancora deciso.

- **Il primo era insoddisfacibile.** *"I file che già lo usano restano verdi senza essere modificati"*:
  l'unico file che usa `AmbienteDiContratto` è `memory.contract.test.ts`, che lo **implementa**, e un
  membro obbligatorio lo costringe a cambiare. L'unico modo di soddisfarlo alla lettera era renderli
  opzionali, e a T09 un ambiente senza guasto avrebbe saltato il test **in verde**. L'additività ora si
  prova sulle asserzioni, con un comando: `git diff -U0 b118678 -- …/repository-contract.ts | rg
  "^-.*expect"` restituisce una riga sola, quella elencata.
- **Il caso concreto delle liste era scritto sul modello di prima di T04b.** *"Una riga con
  `seatsTotal: 2` e `seatsAvailable: 5` diventa un'offerta con cinque posti"* era vero quando i posti
  venivano da `Trip`. Oggi `listOpenOffers` li legge dalla **tratta**, e una trasferta grezza 2/5 senza
  tratte non produce nessuna offerta: il test scritto alla lettera sarebbe stato **verde senza toccare
  l'adapter**. Il caso vero è la tratta 2/5 sotto una trasferta valida, che oggi diventa davvero
  un'offerta con cinque posti.
- **"Ogni lettura"** comprendeva letture di tipi senza validatore (`Profile`, `PersonalBests`), dove non
  c'è niente da omettere, e taceva su `findByLegAndRequester`, lettura singola che oggi non valida.
- **L'unicità delle candidature non era vera nemmeno come dichiarazione.** La voce di `IDEAS.md` la
  attribuiva all'upsert per id, che non impedisce **due id** sulla stessa (tratta, richiedente): l'adapter
  memory oggi li accetta entrambi. Per verificarla serve che `save` la rifiuti, e il doc lo dichiari.
- **Il guasto:** quindici metodi contati e nominati, più lo **storage intatto** sulle quattro scritture,
  senza cui passerebbe un adapter che scrive e poi riporta l'errore.
- **I commenti sull'omissione:** resi verificabili con due `rg`, con il perimetro dichiarato.
- **L'identità:** la tabella di cosa si rifiuta, cosa si filtra e cosa no, il modo del rifiuto, i due test
  esistenti che cambiano e la sonda che dimostra i denti. Dettaglio sotto.
- **Aggiunto:** criteri corrispondenti su T08 e T09.

### L'identità: quali operazioni, e in che modo

**Oggi nessun test di contratto agisce con l'identità sbagliata.** L'ho verificato test per test: N1 di
T07e era l'unico, ed è chiuso. Il valore del criterio è quindi **prospettico**: i ~40 test nuovi di questo
task, e quelli di dopo. Due fixture però sarebbero rosse a T09 per la stessa **classe** di difetto:
`unaCandidatura` usa `requesterTripId: trip-di-${id}`, una trasferta che non esiste (foreign key), e
*"requesterTripId sopravvive"* usa il letterale `'trasferta-del-richiedente'` (non è un uuid, e non è
una trasferta del richiedente). Con la policy su `requester_trip_id` imposta in RAM diventano rosse
**su memory**: è il criterio che funziona, e le si corregge nominandole.

**Il modo del rifiuto non è uno solo, perché Postgres non ne ha uno solo.** Una scrittura negata da una
policy è un **errore** (`WITH CHECK`, e anche il ramo `DO UPDATE` di un upsert su una riga che la policy
non lascia aggiornare). Una lettura negata **non lo è**: la riga semplicemente non c'è. Un adapter in RAM
che rispondesse con un errore anche in lettura pretenderebbe da Supabase ciò che non può dare, e a T09 la
suite andrebbe adattata. Quindi: scritture → `storage-unavailable`, che `RepositoryError` prescrive già
per *"permessi negati, RLS che blocca"*; letture → `not-found`, omissione, `null`, zeri.

**Un difetto trovato sulla strada, ed è il più serio della pianificazione.** `cancelRequest` gira con
l'identità del **richiedente**, e quando restituisce un posto chiama `restoreSystemRejected`: `listByLeg`
sulla tratta dell'owner, poi una `save` per ogni riga rifiutata dal sistema, cioè su righe di **altri**
richiedenti. E chiama `adjustLegSeats(+1)` sulla tratta dell'owner. Con la policy dei due attori scritta
su T08 la `save` sarebbe vietata; con la lettura delle candidature ristretta a richiedente e owner,
`listByLeg` vedrebbe solo la riga del richiedente, e il reintegro tornerebbe **`ok([])` in silenzio**:
l'annullamento riesce e gli altri restano rifiutati per sempre. I test di usecase non possono vederlo,
perché i fake non hanno identità. Non lo risolve T07g, che **non impone** `adjustLegSeats` e non esegue
usecase in RAM: diventa un criterio di T08 (*"deciso chi esegue il reintegro e l'incremento"*), le cui
vie naturali sono una funzione lato DB o una policy dedicata alle transizioni `system`.

### Il piano, in cinque step

Ordine **diverso** da quello dei criteri: l'identità per prima, così i test nuovi degli step 2–4 nascono
**sotto** la rete che li controlla. Scriverli prima vorrebbe dire produrre quaranta test fuori dalla rete
che il task esiste per mettere.

Ordine dei controlli in ogni scrittura in RAM: **validazione → guasto → identità → unicità**. A T09 la
validazione è locale e precede la rete; il resto lo fa il DB. Nelle letture: guasto → filtro d'identità →
validazione.

**Step 1 — Condizioni in RAM e identità.**
- Deve esistere in `adapters/memory` un modulo con lo **stato mutabile condiviso** dell'ambiente
  (`identità: ProfileId | null`, più il guasto che lo step 2 accende), iniettato come parametro
  **opzionale** nei costruttori di `MemoryTripRepository`, `MemoryMatchRequestRepository` (che riceve
  anche il `TripRepository`, per sapere di chi è una trasferta: stesso precedente della join sui profili)
  e `MemoryPersonalBestsRepository`. Assente = nessuna policy, il comportamento di oggi.
  `memory.contract.test.ts` lo crea, lo passa, e `comeUtente` lo scrive.
- Le policy della tabella del criterio di `TASKS.md`, e nient'altro.
- Test nuovi in `repository-contract.ts`, uno per regola, ciascuno con l'esito e lo storage dopo:
  trasferta con `ownerId` altrui; dirottamento di un id esistente di un altro; candidatura creata da chi
  non è il richiedente; `accepted` scritto dal richiedente; chiusura da un terzo; `requesterTripId` di
  un'altra persona e inesistente; `raise` per un altro profilo (la sua riga resta intatta);
  `findByProfile` di un altro che ha una riga → zeri; le quattro letture delle candidature da un
  estraneo. A T09 questi test girano contro le RLS vere: sono **i test di integrazione delle policy di
  T08, gratis**.
- Fixture: `unaCandidatura` punta a una trasferta vera del richiedente, salvata da lui nel `beforeEach`
  del blocco, che poi **restituisce l'identità a `owner`** (i test esistenti ereditano quella);
  `candidaturaDi` crea quella di un altro richiedente quando serve. *"requesterTripId sopravvive"* usa
  una seconda trasferta vera, **distinta** dalla default (lezione 4: fixture che non distinguono).
- Commenti: l'intestazione di `repository-contract.ts` e il doc di `comeUtente` (*"In RAM è un no-op"*),
  e il commento in `memory.contract.test.ts`, oggi falsi.
- **Sonde, tutte possono fallire:** togliere `comeUtente(altro)` da *"due profili hanno massimi
  indipendenti"* (è N1 di T07e: prima verde, ora deve essere rosso — **la sonda del criterio**); togliere
  `comeUtente(owner)` prima del rifiuto in *"note e resolvedBy"*; togliere `comeUtente(altro)` in
  *"listByOwner ritorna solo…"*; nell'adapter, togliere il controllo sull'owner **esistente** in
  `trips.save` (cade il dirottamento) e quello su `requesterTripId`. **Da non chiedere:** sonde su
  `adjustLegSeats`, che non è imposto: esito noto, non cade niente.
- File: modulo nuovo in `adapters/memory`, `memory-trip-repository.ts`,
  `memory-match-request-repository.ts`, `memory-personal-bests-repository.ts`, `memory.contract.test.ts`,
  `repository-contract.ts`.
- Chiude con `verify` verde, con le sole due modifiche di fixture elencate.

**Step 2 — Il guasto.**
- `guasta()` / `ripristina()` obbligatori in `AmbienteDiContratto`; `pulisci()` ripristina. In RAM il
  flag nello stato condiviso, controllato in testa a **ognuno** dei quindici metodi.
  `MemoryProfileRepository` riceve lo stato anche lui.
- Test di contratto a tabella, una riga per metodo, `kind` asserito; per le quattro scritture, dopo
  `ripristina()`, la rilettura mostra lo stato di prima.
- **Sonde che possono fallire:** togliere il controllo da `trips.findById`, `listByOwner`, `findLeg`,
  `adjustLegSeats`, `profiles.listByIds`, `personalBests.findByProfile` (cade la riga sua); spostarlo
  **dopo** la scrittura in `trips.save` (cade lo storage intatto); `ripristina` vuota (cade la rilettura).
  **Innocue per costruzione, da non chiedere:** togliere il controllo da `listOpenOffers`, perché chiama
  `profiles.listByIds`, che restituisce lo stesso errore; e dai cinque metodi di
  `MatchRequestRepository`, il cui filtro d'identità legge le trasferte sotto lo stesso guasto. Il
  contratto osservabile è soddisfatto in entrambi i modi; la sonda non misurerebbe niente.
- File: `repository-contract.ts`, `memory.contract.test.ts`, i cinque adapter memory toccati.
- Chiude verde. Nessuna asserzione esistente cambia.

**Step 3 — Le letture validano.**
- `listByOwner` e `listOpenOffers` omettono la trasferta che `makeTrip` rifiuta e la tratta che
  `makeTripLeg` rifiuta; `listByLeg` e `listByRequester` la candidatura che
  `validateMatchRequestStructure` rifiuta (solo struttura: il limite delle note vale in scrittura, come
  in `findById`); `findByLegAndRequester` torna `invalid-record`.
- Test: in `memory-trip-repository.test.ts` la tratta 2/5 sotto una trasferta valida, la trasferta
  riscritta invalida sopra tratte valide, `listByOwner` con una riga invalida, ciascuno con una riga
  sana seminata allo stesso modo che resta. In `repository-contract.ts`, con `seminaCandidaturaGrezza`,
  le due liste e `findByLegAndRequester`, letti con un'identità che **vede** la riga, con la sana
  accanto.
- Doc: `repository-error.ts` (`invalid-record` vale anche per le liste, in forma di omissione),
  `trip-repository.ts`, `match-request-repository.ts`. Ogni omissione col suo commento sul canale.
- **Sonde, tutte possono fallire:** togliere la validazione da ciascuna delle cinque letture (cade il
  suo test); omettere **tutto** (cade il controllo positivo).
- File: `memory-trip-repository.ts`, `memory-match-request-repository.ts`, i tre doc di port,
  `memory-trip-repository.test.ts`, `repository-contract.ts`.
- Chiude verde. I due `rg` del criterio.

**Step 4 — Unicità.**
- Doc di `MatchRequestRepository.save`: un secondo id sulla stessa (tratta, richiedente) è
  `invalid-record`, storage intatto; lo stesso id resta upsert. Il controllo in RAM guarda **tutte** le
  righe, non solo quelle visibili all'identità, come un indice unico.
- Test di contratto del criterio, con l'identità giusta, così il `kind` dice che il rifiuto è per
  unicità e non per identità.
- **Sonde che possono fallire:** togliere il controllo (cade il rifiuto); restringere la coppia a
  `(tripId, requesterId)`, senza la direzione (cade *"due candidature dello stesso collega sulle due
  tratte"*, test esistente); confrontare anche l'id (cade il rifiuto); ripetere una direzione nel ciclo
  di `listOpenOffers` (cade l'unicità delle offerte).
- File: `match-request-repository.ts`, `memory-match-request-repository.ts`, `repository-error.ts`,
  `repository-contract.ts`.
- Chiude verde.

**Step 5 — Criteri a valle e documenti.** Li scrive l'orchestratore, non il developer: sono criteri.
- `TASKS.md`: i criteri corrispondenti su T08 e T09 elencati nell'ultimo criterio di T07g.
- `ARCHITECTURE.md`, § Modello dati (bozza): `match_requests` con l'unicità (tratta, richiedente).

Stima: una quarantina di test nuovi su 488, **dichiarata come stima**. Il costo sale da M a **M pieno**:
più file del previsto, nessun file grande.

### Le decisioni prese qui, con l'alternativa scartata

- **Identità prima di tutto il resto.** Scartato l'ordine dei criteri: test scritti fuori dalla rete.
- **Stato condiviso mutabile iniettato**, come `limiteNote`. Scartati un setter per adapter (quattro punti
  da tenere allineati) e l'identità letta da `MemorySessionGateway` (accoppia due port che su Supabase
  condividono il client, non il contratto).
- **Parametro opzionale; assente = nessuna policy.** Scartato obbligatorio: costringerebbe
  `memory-trip-repository.test.ts` a gestire un'identità estranea a ciò che prova. I denti stanno nei test
  negativi di contratto, rossi se l'ambiente non cabla lo stato.
- **In RAM solo le policy scritte su T08, più la lettura delle candidature.** Scartato imporre anche la
  lettura delle trasferte: deciderebbe in un adapter di test una policy che T08 non ha scritto.
- **Letture negate come filtro, non come errore.** Scartato l'errore: Postgres non lo produce.
- **Le liste di trasferte e tratte testate in `memory-trip-repository.test.ts`.** Scartati due hook nuovi
  di semina grezza nell'ambiente: a T09 non sarebbero realizzabili sotto i CHECK, e un test che non può
  girare fallisce, cioè la suite andrebbe adattata.
- **Validazione → guasto → identità → unicità.** Scartato il guasto per primo: a T09 la validazione è
  locale.
- **`pulisci` ripristina il guasto.** Scartato un `try/finally` in ogni test: affiderebbe a ciascun test
  la pulizia di staging.

### Le decisioni che spetterebbero all'umano, con la mia raccomandazione (applicata per delega)

- **Nessun `RepositoryError` nuovo per il rifiuto d'identità: è `storage-unavailable`.** Nessuna firma di
  port cambia; cambiano solo i costruttori degli adapter memory, che non sono port. Raccomando così perché
  il doc lo prescrive già, e perché i denti del criterio vengono dai test rossi, non dal `kind`. Scartato
  un `forbidden`: è un ⛔ sul contratto, tocca ogni consumatore, e oggi non aggiunge niente. Il prezzo,
  che *"non autorizzato"* e *"rete giù"* coincidano, è una voce di `IDEAS.md`.
- **Il secondo id sulla stessa coppia è `invalid-record`, con il doc esteso.** Scartato un `conflict`:
  ⛔ per lo stesso motivo; e `storage-unavailable` sarebbe falso, perché ritentare non serve.
- **`findByLegAndRequester` valida e torna `invalid-record`.** Stringe il contratto di una lettura.
  Scartato `null`: `requestSeat` crederebbe che il collega non si sia candidato e ne creerebbe un'altra.
- **La tabella delle policy in RAM diventa vincolante per T08**, compresa la lettura delle candidature
  che T08 non ha scritto per esteso. Raccomandata, perché la suite la segue già per convenzione in ogni
  test, e perché le note sono dati personali.

### Fuori da T07g, per non farlo cercare

- La sessione di `MemorySessionGateway` e l'identità dell'ambiente restano **separate** in RAM, mentre su
  Supabase `comeUtente` farà un sign-in vero, visibile anche a `currentSession`. Nessun test di contratto
  dipende da questa differenza.
- La voce *"La suite di contratto non pinna `listByLeg` su una tratta inesistente"* resta una proposta,
  benché tocchi lo stesso file: non è fra le tre portate dentro.
- I fake di `request-test-fakes.ts` non acquisiscono né identità né validazione: non sono adapter.

### Tre voci nuove in `IDEAS.md`, dal planner

Il rifiuto RLS e il guasto di rete che arrivano come lo stesso `storage-unavailable`; `Profile` e
`PersonalBests` senza un validatore di dominio; `gateway-unavailable` mai prodotto né asserito. Il
conflitto di `cancelRequest` e la compatibilità fra i CHECK e `seminaCandidaturaGrezza` **non** sono voci:
sono criteri di T08 dello step 5, perché la policy che li rende visibili la scrive questo task.

**Prossimo passo:** review del piano, poi developer sullo Step 1, con le sonde **scritte nel brief**,
comprese quelle da non chiedere e il perché.


---

## 2026-10-25 — T07g · **APPROVATO** al secondo giro, e chiuso

`verify` completo **verde**: **548 test unitari in 31 suite** (erano 488 in 30, +60), 1 di integrazione,
1 di smoke. I tre ⛔ emersi in pianificazione erano sciolti per delega dell'umano.

### Cosa c'è adesso

**L'ambiente in RAM ha un'identità e un guasto.** `adapters/memory/memory-conditions.ts` tiene lo stato
condiviso `{identita, guasto}`, iniettato come parametro opzionale nei quattro adapter memory (assente =
il comportamento di prima, usato solo dai test di memory che non sono contratto). `comeUtente`, che fino
a T07e era un no-op, ora scrive l'identità; `guasta()` / `ripristina()` sono **obbligatori**
nell'interfaccia dell'ambiente, e `pulisci()` ripristina anche il guasto.

- **Guasto:** in testa a tutti i quindici metodi dei repository; le quattro scritture sotto guasto non
  scrivono, verificato su una fotografia dello storage.
- **Policy in scrittura**, la tabella del criterio: `trips.save` solo dall'owner, upsert compreso;
  `matchRequests.save` con i due attori **sulla riga vecchia e sulla nuova** (USING e WITH CHECK) e
  `requesterTripId` sempre del richiedente; `raise` solo sui propri massimi. Rifiuto =
  `storage-unavailable`, nessun `kind` nuovo. `adjustLegSeats` non imposto, dichiarato.
- **Filtri in lettura:** candidature visibili a richiedente e owner, massimi solo propri; una lettura
  negata è una riga assente, come su Postgres.
- **Letture validate:** le liste omettono le righe che il dominio rifiuta, con un commento che nomina il
  port di osservabilità mancante; `findByLegAndRequester` torna `invalid-record`.
- **Unicità** (tratta, richiedente): un secondo id è `invalid-record` (`duplicate-requester-on-leg`).

**La sonda che dà i denti al criterio:** rimettere il difetto N1 di T07e (togliere `comeUtente(altro)` da
*"due profili hanno massimi indipendenti"*) rende **rosso** `test:unit`. Prima di questo task restava
verde. Tutte le altre sonde del piano sono cadute dove dovevano; non eseguite, come da piano, le tre a
esito noto.

**Test esistenti cambiati: solo i due elencati nel criterio** — la fixture `unaCandidatura`, che
puntava a una trasferta inesistente, e *"requesterTripId sopravvive"*, che usava un letterale. L'additività
contro `b118678` è provata: una sola riga `expect` tolta, quella attesa.

### La bocciatura del primo giro: una RAM più permissiva delle RLS

**N1**, ed era il punto delicato del task. Per un id già esistente la policy delle candidature guardava
**una sola** delle due righe, e in modo asimmetrico: il richiedente poteva riassegnare la propria riga a
un altro richiedente, e l'owner di una seconda trasferta poteva spostare su di sé una candidatura altrui
e accettarla. Su Postgres un UPDATE passa `USING` sulla riga vecchia **e** `WITH CHECK` sulla nuova, e per
le trasferte il developer l'aveva già fatto. È la direzione pericolosa: un test verde su memory e rosso a
T09, con la scelta fra adattare la suite e allentare la policy. Chiuso con i due controlli e due test, ognuno
isolato da una sonda.

**N2**, un commento che prometteva *"ogni scrittura rifiutata e ogni lettura filtrata"* con identità
nulla, quando `adjustLegSeats` e le letture di trasferte e profili restano fuori; e la regola
dell'identità nulla non la eseguiva nessun test. Chiuso con il commento riscritto e
`memory-conditions.test.ts`, che la prova su `memory` perché l'ambiente di contratto non sa ancora
tornare a identità nulla (voce in `IDEAS.md`, *"Un hook esci"*).

### Lo step 5, dell'orchestratore

Criteri su **T08**: `UNIQUE (trip_id, direction, requester_id)`; le policy della tabella di T07g, rese
vincolanti; **deciso chi esegue il reintegro e l'incremento di `cancelRequest`**, che oggi gira come
richiedente e riscrive righe di altri — sotto le policy tornerebbe `ok([])` in silenzio; CHECK compatibili
con le righe seminate dalla suite. Su **T09**: `guasta` / `ripristina` nell'ambiente Supabase, la stessa
mappatura degli errori, le omissioni sulle liste. In `ARCHITECTURE.md` l'unicità e la visibilità di
`match_requests`.

Tre voci nuove in `IDEAS.md` dalla review: dividere la suite di contratto per port (da ~1235 a 1867
righe), l'hook *"esci"*, e il `kind` di un duplicato scritto senza permessi.

**Riserva lasciata aperta, dichiarata:** nel nome di un test nuovo manca uno spazio dopo i due punti
(*"un estraneo non vede la candidatura:findById…"*). Cosmetica, non toccata dopo l'approvazione per non
committare codice fuori dal perimetro rivisto.

**Il primo giro del developer è stato pulito:** nessuna scrittura da shell, nessun worktree. Le due regole
aggiunte al brief dopo T07f hanno tenuto.


---

## 2026-10-25 — T07h · pianificazione

Nessun codice. Il planner ha toccato **solo** `TASKS.md` (criteri di T07h), `IDEAS.md` (tre voci) e
questa voce. Letti: `eslint.config.js`, `src/config/*`, `plant.ts`, `badge.ts`, i consumatori di
`PLANT_IDS` / `BADGE_IDS`, ogni import di `config/` in `src/`, ogni occorrenza di `Date` in `src/`,
`harness.test.ts`, le tre config di jest, `ARCHITECTURE.md` § Modularità. Nessun ⛔.

### I criteri, riletti contro il codice dopo T07f e T07g

- **`config/`:** nessun file di produzione di `core/` lo importa. Lo importano sei test di conformità,
  tutti in `core/usecases/`; fuori dal core, `memory-conditions.test.ts` e `memory.contract.test.ts`
  (adapter: `config` resta nel loro grafo, non cambia niente). Il testo *"rientra per
  `src/core/**/*.test.ts`"* avrebbe dato `config/` anche ai test di `domain/`, che oggi non l'hanno:
  ristretto a `src/core/usecases/**/*.test.ts`. `request-test-fakes.ts` e `instant-fixture.ts` non
  sono `.test.ts`, restano elementi di produzione e non importano `config/`.
- **`Date`:** in `src/` nessun codice, test compresi, usa `Date.parse` o `Date.UTC`; `Date` compare
  solo in commenti. Perimetro dichiarato: `src/core/**/*.ts`, test inclusi, come la regola di oggi.
- **`src/__tests__/`:** è ancora l'unico buco **di `src/`** — ma non dell'albero, come diceva il testo:
  `App.tsx`, `index.ts` e `tests/**` sono fuori dal blocco di `boundaries`. Corretto, e la radice
  fuori dal grafo va in `IDEAS.md`. `no-unknown-files` oggi segnalerebbe solo `harness.test.ts`.
- **Identità:** nessun consumatore esaustivo di `PlantId` (le distanze sono `Partial<Record<…>>`),
  mentre `BADGE_CATALOG` e `BadgeConfig.thresholds` sono `Record<BadgeId, …>` completi: è lì che la
  sonda può mordere. Il criterio diceva cosa, non come verificarlo: aggiunta la verifica.
- **Runtime:** reso verificabile con il conteggio (548 / 31) e *"nessun file di test cambia"*.

### Decisioni

- **Elemento `usecases-test`** (pattern `src/core/usecases/**/*.test.ts`, per file, dichiarato **prima**
  di `usecases`) con `[...GRAFO.usecases senza config, 'config']`. Alternativa: un elemento unico
  `core-test` per tutto `core/`, scartata perché allarga i test di `domain/`.
- **Nessuna seconda rete** `no-restricted-imports` su `config` nel blocco del core: per i test servirebbe
  un blocco che ripete i pattern anti-adapter. Alternativa: farla adesso; annotata in `IDEAS.md`.
- **Un selettore `MemberExpression[object.name='Date']` al posto di quello su `Date.now`**, che ne è un
  caso. Alternativa: aggiungerlo accanto, scartata per non avere due errori sulla stessa riga. Resta
  `NewExpression[callee.name='Date']`. L'alias (`const D = Date`) resta scoperto: voce in `IDEAS.md`.
- **Entrambe le reti su `src/__tests__/`** (il criterio dice *oppure*): elemento `harness` con **nessun
  import permesso** dentro `src/`, e `no-unknown-files` attiva. Alternativa: solo una delle due; scelta
  entrambe perché l'elemento chiude il buco di oggi, `no-unknown-files` quello della prossima cartella.
  Un test end-to-end in RAM lì richiederà di allargare `harness` con una decisione scritta.
- **`PLANT_IDS` / `BADGE_IDS` esportati come tupla** (`as const`), non riannotati `readonly X[]`. Il
  tipo pubblico si **restringe**: ogni uso di oggi resta valido, lo prova `typecheck`. Non lo leggo come
  ⛔ su un'interfaccia: nessuna firma cambia, e nessun chiamante cambia. Alternativa: una seconda
  costante annotata, scartata perché duplica il nome.

### Il piano, in cinque step (un commit solo)

**Step 1 — `config/` fuori dal core di produzione.** File: `app/eslint.config.js`,
`ARCHITECTURE.md` (§ Modularità, paragrafo 127–136: lint e documento ora coincidono).
- *Sonda 1a:* `import { MATCH_CONFIG } from '../../config';` in `core/usecases/find-matches.ts` →
  `lint` rosso (`boundaries/dependencies`).
- *Sonda 1b:* la stessa riga in `core/usecases/request-test-fakes.ts` (non è `.test.ts`) → rosso.
- *Sonda 1c:* `import { NOTE_CONFIG } from '../../config';` in `core/domain/trip.test.ts` → rosso,
  come oggi.
- *Controllo positivo:* i sei test di conformità restano verdi a `lint`. Se fossero classificati
  `usecases` invece di `usecases-test`, sarebbero rossi: è la prova che l'ordine degli elementi regge.

**Step 2 — membri di `Date`.** File: `app/eslint.config.js`, `ARCHITECTURE.md` riga 121.
- *Sonde 2a/2b/2c:* `Date.parse('2026-11-03')`, `Date.UTC(2026, 10, 3)` e `Date.now()` in
  `core/domain/instant.ts` → `lint` rosso, ciascuna da sola.
- *Sonda 2d:* `Date.parse('2026-11-03')` in `core/domain/instant.test.ts` → rosso (test inclusi).

**Step 3 — `src/__tests__/` nel grafo, e niente file sconosciuti.** File: `app/eslint.config.js`.
- *Sonda 3a:* in `src/__tests__/harness.test.ts`, `import '../adapters/memory';` → rosso.
- *Sonda 3b:* nello stesso file `import '../ui';` → rosso.
- *Sonda 3c:* un file nuovo `src/sonda/x.ts` con `export const x = 1;` → rosso
  (`boundaries/no-unknown-files`), poi cancellato.

**Step 4 — identità derivate.** File: `src/core/domain/plant.ts`, `src/core/domain/badge.ts`.
`export const PLANT_IDS = [...] as const; export type PlantId = (typeof PLANT_IDS)[number];`, idem per
i badge. I commenti in testa restano veri; si aggiorna solo quello che descrive l'annotazione.
- *Verifica:* `rg -c "'pomigliano'" src/core/domain/plant.ts` e `rg -c "'primo-viaggio'"
  src/core/domain/badge.ts` danno 1.
- *Sonda 4:* aggiungere `'sonda'` a `BADGE_IDS` → `typecheck` rosso su `BADGE_CATALOG` (manca la
  chiave). Prima di questo step la stessa aggiunta alla **union** compilava. Per `PlantId` nessuna sonda
  morde, perché nessun consumatore è esaustivo: la verifica è il conteggio.

**Step 5 — chiusura.** `npm run verify` verde; `test:unit` a 548 in 31; `git status` senza `src/sonda/`;
`git diff --name-only` = `app/eslint.config.js`, `plant.ts`, `badge.ts`, `ARCHITECTURE.md`, più i diari.
Per l'orchestratore, non per il developer: la riga *"`core/` non usa `Date.now()` né `new Date()`"* del
`CLAUDE.md` di progetto va estesa ai membri di `Date`, come `ARCHITECTURE.md`.

Ogni sonda si esegue **da sola**, si registra l'esito (regola che scatta, file, riga) e si ripristina
prima della successiva. Niente worktree, niente scritture da shell: le regole del brief di T07f restano.


---

## 2026-10-25 — T07h · implementazione, sonde e primo giro di review

`verify` completo **verde**, **548 test unitari in 31 suite**, invariato: nessun file di test toccato,
nessun comportamento a runtime cambiato. Diff: `eslint.config.js`, `plant.ts`, `badge.ts`,
`ARCHITECTURE.md`, e una riga del `CLAUDE.md` di progetto (orchestratore).

### Una deviazione dal piano, e regge

Il piano voleva un elemento `usecases-test` dichiarato per file. In `eslint-plugin-boundaries` 7.2.0
non si può: `mode: 'file'` funziona ma è deprecato e stampa un warning a ogni lint, e senza `mode` gli
elementi combaciano per cartella e il pattern `*.test.ts` è ignorato (i sei test di conformità
risultavano `usecases` e davano sei errori). Il developer ha usato un **descrittore di file**,
`settings['boundaries/files']` con la categoria `conformance-test` su `src/core/usecases/**/*.test.ts`,
e una policy dedicata che aggiunge `config` solo a quei file. `GRAFO.usecases` non contiene più `config`.
Il reviewer l'ha trovato documentato nel README del pacchetto installato e nei suoi tipi, e ha
verificato che un file di produzione non può finire nella categoria senza chiamarsi `*.test.ts` — e
allora jest lo eseguirebbe come test.

### Le sonde: ogni regola nuova vista scattare

Eseguite dal developer una per volta, ripristinate con Edit; **rifatte dal reviewer** con
`eslint --stdin --stdin-filename`, cioè su contenuto virtuale, senza scrivere su disco — tutte tranne la
4, che richiede di scrivere un file: quell'esito è solo del developer. Il reviewer ha rilanciato lint,
typecheck e `test:unit`; `verify` completo (con `test:int` e smoke) l'hanno eseguito developer e
orchestratore.

| # | Violazione | File | Esito |
|---|---|---|---|
| 1a | `import { MATCH_CONFIG } from '../../config'` | `core/usecases/find-matches.ts` | `boundaries/dependencies`: *no policy allowing dependencies from "usecases" to "config"* |
| 1b | la stessa riga | `core/usecases/request-test-fakes.ts` | stesso errore: il modulo di fake resta `usecases` puro |
| 1c | `import { NOTE_CONFIG } from '../../config'` | `core/domain/trip.test.ts` | `boundaries/dependencies`, da "domain" |
| + | controllo positivo: i sei test di conformità | `core/usecases/*-config.test.ts` | verdi |
| 2a | `Date.parse('2026-11-03')` | `core/domain/instant.ts` | `no-restricted-syntax` (*core/ non puo' leggere l'orologio di sistema*) |
| 2b | `Date.UTC(2026, 10, 3)` | `core/domain/instant.ts` | stesso errore |
| 2c | `Date.now()` | `core/domain/instant.ts` | stesso errore |
| 2d | `Date.parse('2026-11-03')` | `core/domain/instant.test.ts` | stesso errore: il perimetro include i test |
| 3a | `import '../adapters/memory'` | `src/__tests__/harness.test.ts` | `boundaries/dependencies`, da "harness" a "adapters" |
| 3b | `import '../ui'` | `src/__tests__/harness.test.ts` | `boundaries/dependencies`, da "harness" a "ui" |
| 3c | file nuovo `src/sonda/x.ts` | — | `boundaries/no-unknown-files`; file e cartella cancellati |
| 4 | `'sonda'` aggiunto a `BADGE_IDS` | `core/domain/badge.ts` | `typecheck` rosso, TS2741 in `award-badges.ts(39)` e in tre test |

Il reviewer ha aggiunto sonde sue, tutte coerenti: un `.test.tsx` di usecase che importa `config` è
rosso; un test di conformità che importa `adapters` è rosso (la policy dedicata non allarga oltre
`config`); `new Date(0)` e `Date?.now()` sono rossi; `export type X = Date` resta verde, giustamente.
**`globalThis.Date.now()` passa**: è già in `IDEAS.md` (*"Un alias di `Date` aggira il selettore"*).

Su `PlantId` nessuna sonda può fallire, perché nessun consumatore ha bisogno di tutte le sedi: la
verifica è il conteggio — `'pomigliano'` e `'primo-viaggio'` compaiono una volta sola nei rispettivi file.

### Primo giro: bocciato per il documento, non per il codice

1. In `ARCHITECTURE.md` le frasi su `harness` e `no-unknown-files` erano state inserite **prima** di
   *"Serve a una cosa sola: far diventare rosso `tsc`…"*, che così si riferiva alla cosa sbagliata.
2. Gli esiti delle sonde stavano nel report del developer e non qui, dove il criterio li chiede.

Chiusi dall'orchestratore, perché sono documenti suoi: il paragrafo su `config/` è ricomposto, e quello
sul grafo di `src/` è a sé; questa tabella è la voce che mancava. Chiuse insieme due riserve: la frase
*"i test di conformità"* era più stretta del lint (**qualunque** test di usecase può importare
`config/`, oggi lo fanno solo i sei di conformità), e *"un istante si legge solo in `instant.ts`"* stava
sotto *"queste regole le impone il lint"* mentre è una **convenzione** — il lint vieta `Date`, non un
secondo parser scritto a mano. Ora è scritta come tale, in `ARCHITECTURE.md` e nel `CLAUDE.md` di
progetto.


**Secondo giro: APPROVATO.** Il reviewer ha verificato che il codice è identico al primo giro e che i
due paragrafi e questa voce non promettono più di quanto la config imponga. Riserva lasciata, dichiarata:
il commento a `eslint.config.js:173` sugli alias di `Date` non nomina `globalThis.Date` — cosmetica, già
coperta dalla voce di `IDEAS.md`, non toccata per non riaprire il codice dopo la review.

**T07h chiuso**, commit unico. Con T07f, T07g e T07h il blocco di igiene prima dello schema è finito:
il prossimo è **T07b ⛔** (parametri da tabella, un port nuovo), poi **T08 ⛔** (schema e migrazioni).


---

## 2026-10-25 — T07b · pianificazione

Nessun codice. Il planner ha toccato **solo** `TASKS.md` (criteri di T07b), `IDEAS.md` (tre voci) e
questa voce. Letti: i due `CLAUDE.md`, `OFFICINA.md`, `ARCHITECTURE.md`, le voci del 12/10 (decisione 3
di T03), del 14/10 (*"tutto configurabile da tabelle"*, le etichette in tabella) e del 25/10;
`src/config/*`, i sei `*-config.ts` e i sei `*-config.test.ts`, `plant-distance.ts`, `note-config.ts`,
`badge.ts`, `award-badges.ts` e il suo test (le parole vietate), `leg-system-transitions.ts`, i port,
`repository-error.ts`, gli adapter memory, `memory-conditions.ts`, la suite di contratto (ambiente,
guasto, identità), `eslint.config.js`. Ogni import di `config/` in `src/`: **solo test** (sei di
conformità, `memory.contract.test.ts`, `memory-conditions.test.ts`).

**Il ⛔ di T07b è sciolto per delega dell'umano** (sessione del 25/10, *"scegli l'opzione
raccomandata"*): port nuovo e inversione della decisione di T03 autorizzati, da registrare come
inversione. È fatto qui sotto e nel criterio apposito.

### L'inversione, scritta come tale

La decisione 3 di T03 (12/10) diceva: *"i valori di config sono letterali, non variabili d'ambiente:
una soglia letta da `.env` sarebbe `string | undefined` a runtime, non verificabile a compile time"*.
T07b la rovescia: i valori arrivano da una tabella, a runtime. **Cosa si perde:** un valore sbagliato
non è più un errore di `tsc`, è un `invalid-record` al primo `load`. **Cosa lo compensa:** il motivo di
T03 era *"un campo mancante diventerebbe `NaN` e farebbe sparire tutti i match senza errori"*, e
`parseParameters` è esattamente la rete contro quel caso — mancante, non numerico o fuori intervallo è
un errore tipizzato con il nome della chiave, mai un default. Le **identità** restano compilate, come
deciso con l'umano il 14/10.

### I criteri, riletti contro il modello

Tre cause, dettagliate in `TASKS.md` accanto a ogni criterio:

1. **Vincolo di realtà.** Schema (T08) e dipendenza (T09) non esistono e sono ⛔ fuori dalla portata
   dell'agente. Tre criteri li nominavano (adapter Supabase, RLS, *"senza ricompilare"*): divisi in una
   metà verificabile oggi su `memory` e una metà scritta su T08/T09.
2. **Il grafo.** `MatchConfig`, `KpiConfig`, `BadgeConfig` & co. stanno in `core/usecases`, e
   `GRAFO.ports = ['domain', 'ports']`: un port che li restituisce non compila senza spostarli. Si
   spostano in `core/domain`, come `NoteConfig` già è, con riesportazione invariata da `usecases/`.
3. **I test di conformità proteggono valori compilati.** *"Ogni soglia ≥ 1"*, *"ogni coppia di plant
   risolvibile nei due versi"*, *"la nota automatica sta entro il limite"* sono asserzioni su
   `config/`: con la tabella non proteggono più la produzione, e diventano controlli di
   `parseParameters`.

Tre difetti trovati leggendo, non da `verify`:
- **La lista del criterio ometteva g CO₂/km**, che è in `KPI_CONFIG` ed è il numero della CO₂ in slide.
- **`'ricompensa'` non intercetta "ricompense"**: il test di oggi accetta *"Ricompense per te"*. Il
  criterio elenca i plurali, il codice no. Il criterio ora pretende un test di tabella sulle sedici
  parole del criterio.
- **Nessun usecase valida `NoteConfig.maxLength`.** `makeMatchRequest` confronta `length >
  config.maxLength`, e con `NaN` è sempre falso: le note non avrebbero limite. Con valori compilati era
  irraggiungibile; da una tabella no.

### Il port

```ts
// core/ports/parameter-repository.ts
export interface ParameterRepository {
  load(): Promise<Result<AppParameters, RepositoryError>>;
}
```

- **Nome:** `ParameterRepository`, per coerenza con gli altri port di storage. `AppParameters` e non
  `Parameters`, che è un tipo di utilità di TypeScript.
- **Un metodo, nessuna scrittura**, come `ProfileRepository`: l'app non scrive parametri. Il percorso
  di scrittura è amministrazione (dashboard), e nella suite è un hook dell'ambiente.
- **Errori: `RepositoryError` così com'è, nessun `kind` nuovo.** Guasto e permessi →
  `storage-unavailable`; parametro mancante, malformato, sconosciuto o etichetta vietata →
  `invalid-record` con `id` = chiave (`'match.toleranceMinutes'`, `'distance:pomigliano-foggia'`,
  `'badge:mille-km.label'`) e `detail` = motivo. Il contratto lo consente: il doc di `invalid-record`
  copre già *"le letture di una singola entità, quando lo storage restituisce un record che il dominio
  rifiuta"*, e l'insieme dei parametri si legge come **un aggregato**. Il doc guadagna una riga che
  nomina `load`; il tipo no. Il **primo** errore in ordine fisso, non l'elenco (c'è già *"Accumulare
  gli errori di validazione"* in `IDEAS.md`).
- **Lettura negata = righe assenti**, come stabilito da T07g: con identità nulla `load` vede zero righe
  e risponde `invalid-record` sulla prima chiave mancante. Il messaggio non dice *"non autenticato"*;
  è il prezzo di specchiare le RLS invece di aggiungere logica all'adapter, ed è il motivo per cui i
  task di UI devono chiamare `load` **dopo** l'accesso.

**Validazione al confine:** `parseParameters(raw: RawParameters): Result<AppParameters,
ParameterError>` in `core/domain`. `RawParameters` = `{ values: Record<string, unknown>; plantDistances:
{fromPlantId, toPlantId, km}[]; badges: {badgeId, threshold, label}[] }`, tutto `unknown` dentro: è la
forma neutra che una tabella chiave/valore e una riga a colonne tipizzate producono entrambe, quindi
**non decide lo schema di T08**. `ParameterError` è un tipo di dominio (`domain/` non vede `ports/`);
l'adapter lo traduce in `invalid-record`, come fa con gli errori di `makeTrip`.

**Composizione con gli usecase: nessun usecase nuovo.** `AppParameters` ha per campi i tipi che gli
usecase ricevono già — `matching`, `createTrip`, `kpi`, `notes`, `cascade`, `badges` — quindi il
chiamante passa `p.matching` a `findMatches`, `{ ...p.notes, ...p.cascade }` ad `acceptRequest`,
`{ distances: p.kpi, badges: p.badges }` a `refreshPersonalBests`. Un `loadParameters` che chiamasse il
port e basta sarebbe un wrapper. **Il chiamante di produzione non esiste**, come per T07e: nessuna
schermata, nessuna radice di composizione. Forma proposta, nell'ordine: oggi il lint toglie a `ui/`
l'arco verso `config/` (l'unica altra strada per i valori); un test in `src/__tests__/` dimostra il
percorso port → usecase; il chiamante vero è un criterio dei task di UI (testo sotto).

**La lista unica delle parole vietate:** `core/domain/badge-label.ts` — `FORBIDDEN_BADGE_WORDS` e il
predicato. La importano `parseParameters`, `awardBadges` e i test. In `domain/` perché il parser vive lì
e `domain/` importa solo `domain/`.

**Cosa resta in `config/`:** solo `SEED_PARAMETERS`, in forma **grezza**. `config/` non può importare il
core, e la forma grezza è dati puri: nessun tipo da annotare. Usi: ambiente memory, test di
composizione, test di conformità, e a T08 la sorgente della migrazione di seed. **Nessun valore di
default a runtime:** un fallback sul seed renderebbe un parametro mancante un parametro silenzioso, cioè
il difetto che il criterio vieta. **Due fonti non divergono** perché la seconda è derivata: il SQL di
seed lo genera uno script da `SEED_PARAMETERS` e un test senza rete confronta il file committato con
l'output (criterio di T08). Dopo la prima migrazione la tabella di staging **può** divergere dal seed,
ed è voluto: è il punto della decisione. Per questo i test dicono *seed*, non *produzione*.

**La suite di contratto**, additiva. L'ambiente guadagna `parameters: ParameterRepository` e
`scriviParametriGrezzi(raw: RawParameters)`, che sostituisce l'insieme intero (su Supabase, credenziali
di servizio). Un `describe('ParameterRepository')` nuovo:
- **P1** — scritto il seed, `load` è `ok` e alcuni valori sono pinnati come **letterali** (30, 120,
  `'Primo viaggio condiviso'`). *Esito noto su `memory`*: l'adapter chiama lo stesso parser. Paga a T09,
  dove prova che la traduzione delle righe non perde niente.
- **P2** — cambiata una riga (tolleranza 30 → 10), `load` restituisce 10.
- **P3** — tolta la riga della coppia Pomigliano–Foggia: `invalid-record`, `id` = la coppia.
- **P4** — un'etichetta con *"Ticket"*: `invalid-record`, `id` = l'etichetta.
- **P5** — sotto guasto `storage-unavailable`; dopo `ripristina()` `load` è `ok` con gli stessi valori.

Solo casi **rappresentabili** su Postgres con qualunque schema ragionevole (una riga che manca, un testo):
i casi di tipo e intervallo, che un CHECK o una colonna `integer` rendono irrappresentabili, stanno nei
test di `parseParameters`, come i test sulle trasferte invalide stanno in `memory-trip-repository.test.ts`
(precedente di T07g). La tabella dei **quindici** metodi del guasto **non si tocca**: dice *"dei quattro
repository"*, e allungarla a sedici cambierebbe un'`expect` esistente. Il guasto del port nuovo ha il
suo test (P5). Il doc di `guasta()` (*"ogni metodo di ogni repository"*) resta vero.

### Il piano, in sette step (un commit solo)

**Step 1 — Tipi e predicati in `core/domain`, nessun comportamento cambia.** File:
`core/domain/parameters.ts` (nuovo: `MatchConfig`, `CreateTripConfig`, `KpiConfig`,
`PlantDistanceTable`, `CascadeConfig`, `BadgeConfig`, e i predicati: tolleranza intero ≥ 0, posti intero
≥ 1, KPI finiti ≥ 0, soglia intero ≥ 1, `maxLength` intero ≥ 1), `domain/index.ts`; i cinque
`usecases/*-config.ts` e `plant-distance.ts` diventano riesportazioni; `find-matches.ts`,
`create-trip.ts`, `compute-company-kpi.ts`, `award-badges.ts` chiamano i predicati al posto del
controllo in linea, **con gli stessi `kind` d'errore**. Verde da solo: sì. Prova: **nessun file di test
cambia** e `test:unit` resta a 548 in 31.
- *Sonda 1a:* nel predicato della tolleranza, `>= 0` → `>= 1`: rosso in `find-matches.test.ts` (il
  confine a tolleranza zero). Rifatta allo step 3, deve rendere rossi **anche** i test del parser: è la
  prova che il predicato è uno.
- *Sonda 1b:* nel predicato dei posti, `>= 1` → `>= 2`: **resta verde** in `create-trip.test.ts`,
  verificato leggendo: i test della config invalida usano `0, -1, 2.5, NaN` e nessuno usa
  `maxSeatsOffered: 1`, cioè il confine valido più basso non è coperto. Non si corregge allo step 1
  (nessun file di test cambia); lo copre allo step 3 il test del parser con `1` accettato, e la sonda
  rifatta lì deve essere rossa.

**Step 2 — Le etichette escono dal catalogo, e la lista delle parole è una.** File:
`core/domain/badge-label.ts` (nuovo: `FORBIDDEN_BADGE_WORDS`, con `'ricompens'` al posto di
`'ricompensa'`, e il predicato: non vuota e senza parole vietate), `domain/parameters.ts`
(`BadgeConfig.labels: Readonly<Record<BadgeId, string>>`), `award-badges.ts` (`BADGE_CATALOG` perde
`label`; l'etichetta viene da `config.labels[id]`; un'etichetta che il predicato rifiuta → il suo
`invalid-config` con `badgeId`, stessa forma di oggi), `config/badges.ts` (le sei etichette di oggi,
**identiche**, finché lo step 4 non lo sostituisce), `award-badges.test.ts`,
`refresh-personal-bests.test.ts`, `badge-config.test.ts`. Verde da solo: sì.
- Test nuovi: tabella sulle **sedici** parole del criterio, ognuna dentro un'etichetta, rifiutata dal
  predicato e da `awardBadges`; *"Ricompense per te"* fra i casi.
- *Sonda 2a:* togliere `'ticket'` dalla lista → rosso (*"Ticket restaurant"*).
- *Sonda 2b:* `'ricompens'` → `'ricompensa'` → rosso: è il difetto di oggi rimesso.
- *Sonda 2c:* `awardBadges` che salta il predicato → rosso nel suo test.
- *Verifica:* `rg -n "'voucher'" app/src` (test **inclusi**) → una riga, in `badge-label.ts`.

**Step 3 — `parseParameters`.** File: `core/domain/parse-parameters.ts` (nuovo: `PARAMETER_KEYS`,
`RawParameters`, `AppParameters`, `ParameterError`, il parser), il suo test, `domain/index.ts`.
Additivo, verde da solo. Un test per ogni caso del criterio, più: le otto chiavi pinnate; il caso valido
che produce un `AppParameters` atteso scritto come letterale.
- *Sonda 3a:* ripetere la 1a → rossi **sia** `find-matches.test.ts` **sia** il test del parser.
- *Sonda 3b:* accettare `typeof value === 'string'` convertito con `Number` → rosso (il caso `'30'`).
- *Sonda 3c:* togliere il controllo della coppia invertita → rosso.
- *Sonda 3d:* togliere il controllo della nota automatica sotto il limite caricato → rosso.
- *Sonda 3e:* togliere il controllo di `maxLength` → rosso (il caso `NaN` non arriva da JSON: si prova
  con `0` e `1.5`).
- *Sonda 3f:* ignorare una chiave sconosciuta invece di rifiutarla → rosso.

**Step 4 — `config/` diventa il seed.** File: `config/parameters.ts` (nuovo, `SEED_PARAMETERS` grezzo,
con il commento *"DA SOSTITUIRE"* sulla Pomigliano–Foggia che si porta dietro), `config/index.ts`; via
`matching.ts`, `trips.ts`, `kpi.ts`, `badges.ts`, `notes.ts`; i sei `*-config.test.ts` sostituiti da
`core/usecases/parameters-seed.test.ts`; `memory.contract.test.ts` e `memory-conditions.test.ts` (il
limite delle note da `parseParameters(SEED_PARAMETERS)`); `eslint.config.js` (`GRAFO.ui` senza
`config`). Verde da solo: sì.
- *Mapping dei vecchi `it`* (da registrare qui dal developer, uno per uno): soglie intere ≥ 1, tolleranza
  ≥ 0, posti ≥ 1, `maxLength` ≥ 1, nota automatica entro il limite → **il seed passa
  `parseParameters`** (lo stesso controllo, al confine); valori pinnati (110, 120, 7,0, 2,2, 165, 320,
  232, 8, soglie) → pinnati sul seed parsato; *"accettata da `awardBadges` / `computeCompanyKpi` /
  `makeMatchRequest`"* e *"ogni coppia risolvibile nei due versi"* → invariati sul seed parsato;
  *"X soddisfa XConfig"* (l'annotazione è l'asserzione) → **cadono**, perché il parser è tipizzato e la
  riga non può più fallire. La voce di `IDEAS.md` *"Un test diretto del criterio «primo viaggio» con la
  config di produzione"* resta fuori: è una proposta, non entra da sola.
- *Sonda 4a:* `import { SEED_PARAMETERS } from '../config';` in `src/ui/index.ts` → `lint` rosso.
- *Sonda 4b:* nel seed, la soglia di `primo-viaggio` a 0 → rosso in `parameters-seed.test.ts`.
- *Verifica:* il comando `rg` del secondo criterio non trova niente.

**Step 5 — Il port, l'adapter memory, la suite.** File: `core/ports/parameter-repository.ts`,
`ports/index.ts`, `repository-error.ts` (una riga di doc), `adapters/memory/memory-parameter-repository.ts`
(costruttore `(raw: RawParameters, condizioni?: CondizioniDiAmbiente)`, `sostituisci(raw)`, guasto in
testa, identità nulla → zero righe, poi `parseParameters` e la traduzione in `invalid-record`),
`memory/index.ts`, `memory-conditions.ts` (doc: i parametri fra le letture filtrate),
`memory-conditions.test.ts` (identità nulla → `invalid-record`), `repository-contract.ts` (ambiente e
P1–P5, `import { SEED_PARAMETERS }` dalla suite: `adapters → config` è nel grafo),
`memory.contract.test.ts`. Verde da solo: sì.
- *Sonda 5a:* l'adapter che ignora le righe e parsa sempre il seed del costruttore iniziale → rosso P2.
- *Sonda 5b:* l'adapter che non chiama `parseParameters` (cast delle righe) → rossi P3 e P4.
- *Sonda 5c:* l'adapter che ignora il guasto → rosso P5.
- *Sonda 5d:* l'adapter che ignora l'identità → rosso in `memory-conditions.test.ts`.
- *Verifica:* `git diff -U0 4a4bc11 -- app/src/adapters/contract/repository-contract.ts | rg
  "^-.*expect"` vuoto.

**Step 6 — Il percorso port → usecase.** File: `eslint.config.js` (`GRAFO.harness` = `['harness',
'domain', 'ports', 'usecases', 'adapters', 'config']`, **senza `ui`**), `src/__tests__/parameters-path.test.ts`
(nuovo). Verde da solo: sì. Due casi: tolleranza 30 → 10 e un'offerta a 20 minuti che esce da
`findMatches`; un'etichetta cambiata che `awardBadges` restituisce. Ciascuno controlla anche il
**prima**: senza, il test passerebbe con una tolleranza già a 10.
- *Sonda 6a:* `awardBadges` che legge di nuovo un'etichetta compilata → rosso.
- *Sonda 6b:* `import '../ui';` in `harness.test.ts` → rosso, come a T07h (3b): la decisione allarga
  `harness` e lascia chiuso il buco che T07h voleva chiudere, `ui/` ↔ `adapters/`.
- *Dichiarato:* la sonda 3a di T07h (`harness → adapters` rosso) **smette di esserlo, per decisione**.

**Step 7 — Documenti.** `ARCHITECTURE.md`: albero dei moduli (port nuovo, `config/` come seed), §
Modularità (il paragrafo su `config/` e sui sei test di conformità si riscrive; `harness` allargato; `ui/`
senza `config/`), § Modello dati (*"il limite delle note è in `config/`"* → nei parametri). **Per
l'orchestratore, non per il developer:** il `CLAUDE.md` di progetto dice *"soglie, costi, tolleranze e
distanze stanno in `config/`. Un KPI che cambia modificando `config` è la prova…"* e *"parametri di
`config` arrivano da `.env`"*: la prima diventa falsa con T07b, la seconda era già falsa dalla decisione
3 di T03 (i valori erano letterali). Più i criteri qui sotto su T08, T09 e UI.

**Chiusura:** `npm run verify` verde; ogni sonda eseguita **da sola** dal developer, con esito
registrato qui, e ripristinata con Edit; niente worktree, niente scritture da shell. Il conteggio dei
test cambia (sei suite di conformità ne diventano una, più parser, etichette, contratto, percorso): lo
riporta il developer, non lo prevedo.

### Decisioni, una riga ciascuna con l'alternativa

- **Tipi in `core/domain/parameters.ts`, riesportati da `usecases/`.** Alt.: aggiornare tutti gli import e
  togliere i `*-config.ts` (più pulito, più file toccati); o allargare `GRAFO.ports` a `usecases`
  (inverte la freccia: scartata).
- **Predicati estratti e condivisi da usecase e parser.** Alt.: parser solo strutturale (presenza, tipo)
  e intervalli lasciati agli usecase: meno lavoro, ma un `maxLength` invalido non lo vedrebbe nessuno e
  una soglia a 0 si scoprirebbe sulla dashboard, non al caricamento.
- **`RawParameters` neutro rispetto allo schema.** Alt.: fissare ora tabella chiave/valore o colonne
  tipizzate, che è una decisione di T08 (⛔ schema).
- **Chiave sconosciuta rifiutata, non ignorata.** Alt.: ignorarla: in una tabella chiave/valore un refuso
  accanto alla chiave giusta diventerebbe una riga che si modifica senza effetto.
- **Primo errore, non elenco.** Alt.: elenco (voce già in `IDEAS.md`).
- **Etichette in `BadgeConfig.labels`.** Alt.: `awardBadges` che ritorna solo id e testi uniti in UI:
  cambia il tipo di ritorno e sposta in UI la garanzia sul testo.
- **`awardBadges` valida anche le etichette.** Alt.: solo al confine: un `Badge` vietato resterebbe
  costruibile da un chiamante con una config scritta a mano.
- **`ricompens` nella lista.** Alt.: aggiungere `'ricompense'` accanto: due voci per una radice.
- **Sei test di conformità consolidati in uno.** Alt.: lasciarli e cambiarne la sorgente: sei copie dello
  stesso unwrap e sei asserzioni che non possono fallire.
- **Guasto del port nuovo in un test suo, tabella dei quindici intatta.** Alt.: portarla a sedici,
  cambiando un'`expect` di T07g.
- **`harness` allargato, non un elemento nuovo.** Alt.: un elemento `composition`; T07h aveva scritto che
  un test end-to-end in RAM sarebbe passato da qui con una decisione scritta, ed è questa.
- **Identità nulla → righe invisibili in RAM.** Alt.: lasciarlo fuori, come le letture di trasferte in
  T07g; scartata perché la policy di questa tabella la scrive T07b stesso.

### ⛔ e raccomandazioni, applicate per delega

1. **Port nuovo `ParameterRepository`** — raccomandato e applicato. Alt.: un parametro di costruzione
   letto da `.env`, che è la strada che T03 aveva già scartato.
2. **Inversione della decisione 3 di T03** — applicata, registrata sopra e in `ARCHITECTURE.md`.
3. **I tipi di config cambiano modulo** (`usecases/` → `domain/`). La superficie pubblica di
   `core/usecases` resta identica grazie alle riesportazioni. Raccomandato.
4. **`BadgeConfig` guadagna `labels`, `BADGE_CATALOG` perde `label`.** È un'interfaccia pubblica
   esportata da `usecases/index.ts`. Raccomandato: è l'unico modo di portare il testo nella tabella
   senza cambiare il tipo di ritorno di `awardBadges`. Il criterio di T07e *"`awardBadges` non cambia
   firma"* resta vero per i parametri; la forma di `BadgeConfig` cambia, dichiarato.
5. **Grafo del lint**: `ui/` perde `config/`, `harness` guadagna cinque archi. Non è un'API, ma cambia un
   freno provato a T07h: lo dichiaro come ⛔ di processo. Raccomandato.

Nessun cambio di schema, nessuna dipendenza, nessuna installazione: restano su T08 e T09.

### Criteri per l'orchestratore (step finale)

**Su T08** — *Criteri aggiunti il 25 ottobre 2026, da T07b*
- [ ] **Le tabelle dei parametri** (scalari, distanze fra plant, badge), nella forma decisa qui, con RLS
      attiva: **`SELECT` per `authenticated`**, nessuna policy di `INSERT`/`UPDATE`/`DELETE` per i ruoli
      dell'app, niente per `anon`. Il gate è la dashboard, che ha solo l'umano: nessun ruolo admin nel
      modello. Un test di integrazione dimostra che un autenticato legge, che `anon` non legge, e che una
      `UPDATE` dall'app **non cambia la riga** — sotto RLS una `UPDATE` senza policy tocca zero righe
      senza errore, quindi il test rilegge il valore invece di aspettarsi un errore
- [ ] **Il seed dei parametri è derivato da `SEED_PARAMETERS`**, non riscritto a mano: uno script genera
      la migrazione di seed, e un test unitario senza rete confronta il file SQL committato con l'output
      dello script. Così `config/` e la migrazione non divergono. Dopo l'applicazione, la tabella è la
      fonte a runtime e può divergere dal seed per decisione dell'umano
- [ ] I `CHECK` delle tabelle dei parametri sono compatibili con i casi della suite di contratto di T07b
      (una coppia di distanze mancante, un'etichetta con una parola vietata), e **nessun CHECK replica
      la lista delle parole vietate**: sarebbe la seconda lista, in un secondo linguaggio. Se un caso
      diventa irrappresentabile, il test è dichiarato *solo memory* con il motivo
- [ ] **Abbassare `note.maxLength` resta una migrazione** (decisione del 14 ottobre), ma con T07b è anche
      una riga modificabile dalla dashboard: un trigger o un vincolo impedisce di portarlo sotto la
      lunghezza della nota più lunga esistente, così l'unica via resta la procedura che accorcia e marca
      le note. Un test di integrazione prova il rifiuto

**Su T09** — *Criteri aggiunti il 25 ottobre 2026, da T07b*
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

**Sui task di UI** (proposta per l'orchestratore, non richiesta dal brief: è il soggetto che il secondo
criterio di T07b non ha) — il primo task che chiama un usecase con config (oggi T12, `createTrip`):
- [ ] La config arriva da `ParameterRepository.load()` **dopo l'accesso**, mai da `config/` (il lint lo
      impone già); se `load` fallisce la schermata mostra un errore esplicito, **nessun valore di
      default**

### Deviazioni e note

- **Il brief chiedeva che cosa resta in `config/`, "fixture o default":** fixture e sorgente del seed sì,
  **default no**. Un default è la forma esatta del difetto che il criterio vieta.
- **Un criterio per la UI** oltre a T08 e T09: senza, il secondo criterio di T07b resterebbe senza
  soggetto anche dopo T09.
- **Due righe del `CLAUDE.md` di progetto** vanno corrette dall'orchestratore (step 7). La seconda era
  già falsa prima di T07b.
- **Rischio dichiarato per T09:** se staging è anche il progetto della demo, la suite di contratto
  scrive sui parametri veri. Il criterio di ripristino lo contiene; separare i due progetti è una
  scelta dell'umano.
- Tre voci nuove in `IDEAS.md`: normalizzazione del testo prima del controllo delle parole vietate;
  storico delle modifiche ai parametri; quando l'app rilegge i parametri. Non duplicate: verificato
  sui titoli e sul contenuto di *"Il presidio sui testi dei badge"* e *"Accumulare gli errori"*.


---

## 2026-10-25, 15:17 — Il loop si è fermato sul limite di sessione, e il risveglio che mancava

Il developer di T07b è terminato con *"You've hit your session limit · resets 3:10pm"* a metà dello
step 2 (ultimo passo: `plant-distance.ts`). Il limite si è resettato alle 15:10 e **nessuno è
ripartito**: l'orchestratore non aveva un turno attivo, e la fine di un limite non è un evento che
qualcuno ascolta. È il caso già descritto in `CLAUDE.md` (*"il loop non si risveglia da sé"*), che
diceva come renderlo economico ma non come **ripartire**. L'ha fatto notare l'umano.

**Ripreso alle 15:17** con `SendMessage` allo stesso developer, che ha il suo contesto salvato, con
l'istruzione di rileggere `git status` prima di continuare: il working tree è la verità.

**Correzione strutturale:** un **heartbeat** ricorrente (`CronCreate`, minuti 7/22/37/52 di ogni ora),
che scatta solo a sessione inattiva — riavvia un subagent fermato da un limite, esegue il passo
successivo del ciclo se il loop è fermo senza una domanda all'umano in sospeso, altrimenti tace. La
regola è in `CLAUDE.md` § Interruzioni e ripresa: si arma all'inizio di ogni sessione di loop.
**Limiti dichiarati:** l'heartbeat vive quanto il processo di Claude Code (chiusa la finestra, la
ripresa torna manuale) e scade da solo dopo 7 giorni; e non scavalca i checkpoint — su T08 si ferma ad
aspettare l'umano.


---

## 2026-10-25 — T07b · esecuzione, sonde e primo giro di review

`verify` completo **verde**: **651 test unitari in 29 suite** (base 548 in 31: sei `*-config.test.ts`
fusi in `parameters-seed.test.ts`, suite nuove per il parser, la lista delle parole e il percorso), 1 di
integrazione, 1 di smoke. Il ⛔ era sciolto per delega dell'umano. **Nessuna dipendenza nuova.**

**Interruzione a metà:** il developer è stato fermato dal limite di sessione alla fine dello step 2, con
la sonda 2c ancora applicata; ripreso alle 15:17, l'ha ripristinata prima di continuare. Il reviewer ha
verificato **per lettura**, punto per punto, che nel diff non resta nessuna mutazione di sonda.

### Cosa c'è adesso

- **Port `ParameterRepository`**, un solo metodo `load(): Promise<Result<AppParameters, RepositoryError>>`,
  nessuna scrittura. Errori dentro `RepositoryError`: guasto o permessi → `storage-unavailable`;
  parametro mancante, malformato, sconosciuto o etichetta vietata → `invalid-record` con `id` = chiave e
  `detail` = motivo. Nessun `kind` nuovo.
- **`parseParameters`** in `core/domain`, invocato dall'adapter: chiavi sconosciute rifiutate, ordine
  fisso del primo errore, **nessun default**, gli stessi predicati di intervallo che usano gli usecase.
- **`MemoryParameterRepository`**: guasto → identità nulla (zero righe, come sotto una `SELECT`
  riservata ad `authenticated`) → parser. La suite di contratto ha P1–P5 (seed letto, riga cambiata,
  coppia di distanze mancante, etichetta con *"Ticket"*, guasto e ripristino), **solo additiva**.
- **Lista unica delle parole vietate** in `core/domain/badge-label.ts`, con `'ricompens'`: *"Ricompense
  per te"* oggi è rifiutata, ieri passava. Le etichette sono uscite da `BADGE_CATALOG` e stanno in
  `BadgeConfig.labels`; `awardBadges` le valida.
- **`config/` contiene solo `SEED_PARAMETERS`**, grezzo. Il core di produzione e `ui/` non lo importano
  (imposto dal lint).
- **Inversione della decisione 3 di T03**, registrata in `ARCHITECTURE.md`: i valori non sono più
  letterali compilati, perché un parametro che richiede una build non è configurabile.

### La fusione dei sei test di conformità, vecchio → nuovo

Verificata dal reviewer contro HEAD. Righe di `parameters-seed.test.ts`.

| Vecchio file | Vecchia asserzione | Dove sta ora |
|---|---|---|
| tutti e sei | *"X soddisfa XConfig"* | cade: il tipo non è più compilato contro un valore, lo controlla il parser |
| badge | soglia intera ≥ 1 | r. 33, *"il seed passa `parseParameters`"* |
| badge | valori dichiarati | r. 51 |
| badge | config accettata da `awardBadges` | r. 75 |
| cascade | nota non vuota ed entro `maxLength` in code point | r. 33 (via `validaNota`) |
| cascade | nota accettata da `makeMatchRequest` | r. 83, invariata |
| create-trip | posti intero ≥ 1 | r. 33 |
| create-trip | massimo 8 | r. 41 |
| kpi | 110 / 120 / 7,0 / 2,2 / 165 / 320 / 232 | rr. 43–50 |
| kpi | coppie risolvibili nei due versi | r. 105, identica |
| match | tolleranza intera ≥ 0 | r. 33; il pin di 30 è **nuovo** |
| note | `maxLength` ≥ 1 | r. 33; il pin di 280 è **nuovo** |
| — | etichette e nota automatica | r. 61, **nuovo** |

### Le sonde

| # | Mutazione | Esito |
|---|---|---|
| 1a | tolleranza `>= 0` → `>= 1` | 1 rosso in `find-matches.test.ts` (*tolleranza zero*) |
| 1b | posti `>= 2` nel predicato (allo step 3) | 2 rossi, solo nel parser; `create-trip.test.ts` resta verde, come previsto |
| 2a | tolto `'ticket'` dalla lista | 2 rossi (*Ticket restaurant*, predicato e `awardBadges`) |
| 2b | `'ricompens'` → `'ricompensa'` | 3 rossi |
| 2c | `awardBadges` senza controllo dell'etichetta | 18 rossi (16 vietate + 2 vuote) |
| 3a | 1a rifatta col predicato condiviso | rossi **sia** `find-matches` sia il parser: il predicato è uno solo |
| 3b | stringa convertita con `Number` | 7 rossi |
| 3c | senza normalizzazione della coppia invertita | 2 rossi |
| 3d | senza controllo nota / limite | 3 rossi |
| 3e | senza controllo di `maxLength` | 4 rossi |
| 3f | chiave sconosciuta ignorata | 2 rossi |
| 4a | `import { SEED_PARAMETERS } from '../config'` in `ui/index.ts` | lint: *no policy … from "ui" to "config"* |
| 4b | soglia di `primo-viaggio` a 0 nel seed | 6 rossi in `parameters-seed.test.ts`, più le suite memory che falliscono ad alta voce |
| 5a | adapter che ignora le righe nuove | rosso solo P2 |
| 5b | adapter che non segnala gli errori del parser | rossi P3, P4 e il test dell'identità nulla |
| 5c | guasto ignorato | rosso P5 |
| 5d | identità ignorata | rosso in `memory-conditions.test.ts` |
| 6a | `awardBadges` con etichetta compilata | 2 rossi |
| 6b | `import '../ui'` in `harness.test.ts` | lint: *no policy … from "harness" to "ui"* |

Il reviewer ha rifatto le sonde di lint su contenuto virtuale (`--stdin`), tutte rosse, più due sue:
usecase di produzione → `config` e test di `domain` → `config`. **Per decisione del piano la sonda 3a di
T07h (`harness → adapters`) ora è verde:** `harness` vede anche `adapters` e `config`, per il test del
percorso port → usecase.

### Deviazioni dichiarate dal developer

`validaNota` esportata da `match-request.ts` perché il parser riusa il controllo invece di duplicarlo;
`MIN_SEATS_WITH_CAR` spostata in `domain/parameters.ts`; due costanti segnaposto in `parseParameters`
per costruire il `Record<BadgeId, …>` senza `as` — il reviewer ha verificato che nessun segnaposto può
uscire dalla funzione; commenti ritoccati in cinque file per renderli veri.

### Primo giro: bocciato per testi e registro, non per il codice

**N1**, questa voce mancava: la corrispondenza dei test e gli esiti delle sonde stavano solo nel report.
**N2**, tre testi falsi sull'ambiente: *"l'ambiente di contratto parte dal seed"* in `ARCHITECTURE.md`
(parte vuoto), *"il seed serve all'adapter memory"* nel `CLAUDE.md` di progetto (che suggeriva proprio il
default vietato una riga dopo), e due doc dell'interfaccia di contratto falsi su staging. **N3**,
`validaNota` esportata anche dall'indice di `domain` senza consumatori: un allargamento d'interfaccia
senza motivo. **N4**, la regola dell'heartbeat taceva la scadenza dei 7 giorni.

N1, N2 (documenti) e N4 li ha chiusi l'orchestratore; N2 sui doc dell'interfaccia e N3 il developer.
È la terza bocciatura di oggi nata da **testi che promettono più del codice**: la regola c'è, il difetto
si ripresenta, e lo trova solo una lettura.


**Secondo giro: APPROVATO.** Il reviewer ha verificato sui file i sei punti e ha rilanciato lint,
typecheck e `test:unit` (651/29). Una riserva sulla frase *"gli adapters importano `config/` solo nei
test"* (la suite di contratto non è un `*.test.ts`) chiusa subito dall'orchestratore; le altre in
`IDEAS.md`.

**T07b chiuso**, commit unico. **Il blocco prima dello schema è finito.** Il prossimo è **T08 ⛔**:
schema, migrazioni e RLS. Le migrazioni si possono scrivere e provare in locale, ma **applicarle a
staging** richiede credenziali di amministrazione del database che l'agente non ha (la chiave nel
`.env` è pubblica e non crea tabelle) ed è un cambio di schema: lì il loop si ferma e chiede all'umano.


---

## 2026-10-25 — T08 ⛔ · la decisione dell'umano, e la Supabase CLI

**Domanda posta all'umano** (un checkpoint vero, che la delega non copre: cambio di schema su un
database remoto, con credenziali che l'agente non ha). Risposta: **applica l'agente, con la CLI**.
Alternative non scelte: l'agente scrive e l'umano applica dal SQL Editor; fermarsi.

**Conseguenze:**
- **Una credenziale potente sulla macchina:** la stringa di connessione del database di staging, in
  `app/.env` come **`SUPABASE_DB_URL`**, **senza** prefisso `EXPO_PUBLIC_` — le variabili con quel
  prefisso finiscono nel bundle dell'app. La crea l'umano; l'agente non la legge (deny rules), la passa
  solo alla CLI.
- **Supabase CLI v2.120.0**, binario ufficiale per Windows da GitHub, **SHA256 verificato** contro
  `checksums.txt` della release (`0db5224f…74c92e`, corrisponde), estratto in
  `%LOCALAPPDATA%\Programs\supabase`, PATH utente, niente admin. **Scelta la release più recente con
  almeno due settimane di vita** (6 ottobre), non l'ultima (v2.122.0, di due giorni fa): la stessa
  prudenza sulla catena di fornitura usata per le dipendenze. Scartato il pacchetto npm `supabase`:
  installa il binario con uno script di postinstall, che le regole di Fase 1 tengono bloccato.
- **Sull'altra macchina** la CLI va installata allo stesso modo, e il `.env` va completato con la stessa
  variabile.


---

## 2026-10-25 — F1.1 · i prerequisiti dentro il repo, perché si lavora su due macchine

**Richiesta dell'umano:** tutto ciò che si scarica deve essere riproducibile sull'altra macchina, quindi
dentro la cartella del repo. **I binari non possono stare in git:** `supabase.exe` pesa 112 MB, oltre il
limite di 100 MB per file di GitHub, e un binario in git non si rivede.

**Soluzione:** `tools/setup.py`, committato, solo stdlib di Python (l'interprete presente su entrambe le
macchine, non soggetto all'ExecutionPolicy — la stessa ragione dell'hook guard). Contiene le **versioni
e gli SHA256 fissati** — Node 24.22.1 e Supabase CLI 2.120.0, gli stessi verificati stamattina — e
scarica in `tools/node` e `tools/supabase`, ignorati da git (`tools/*` tranne lo script). Un download
che non corrisponde fa fallire lo script **prima** di estrarre. Idempotente: provato due volte, il
secondo giro non scarica niente. `verify` verde (651/29) con il Node di `tools/`.

**Sull'altra macchina:** `git pull`, `py tools/setup.py`, `npm ci` in `app/`, `tools/node` e
`tools/supabase` in testa al PATH, e `SUPABASE_DB_URL` nel `.env`. La regola è in `CLAUDE.md` § Interruzioni
e ripresa. Le copie installate stamattina in `%LOCALAPPDATA%\Programs` si rimuovono, con le loro voci nel
PATH utente, appena nessun agente le usa.


---

## 2026-10-25 — T08 · pianificazione

Nessun codice, nessun SQL. Il planner ha toccato **solo** `TASKS.md` (T08, più criteri corrispondenti su
T09, T10, T16, T17), `IDEAS.md` (tre voci, due note) e questa voce. Letti: i due `CLAUDE.md`,
`OFFICINA.md`, `ARCHITECTURE.md`, le voci del 25/10 (T07f, T07g, T07b, la decisione dell'umano sulla CLI,
`tools/setup.py`), T08–T17; il codice di `core/domain` (trip, trip-leg, match-request, personal-bests,
plant, profile, parse-parameters), i port, gli adapter memory (`memory-conditions.ts` e le policy in
RAM), la suite di contratto (ambiente e `seminaCandidaturaGrezza`), `accept-`/`cancel-request.ts`,
`leg-system-transitions.ts`, `config/parameters.ts`, la configurazione di jest, `package.json`,
`eslint.config.js`, i due `.gitignore`.

**Deviazione dichiarata:** il brief permetteva `supabase --help` in sola lettura, ma in questo ruolo non
ho uno strumento shell. Le affermazioni sulla CLI qui sotto sono **da confermare allo step 0**, e il
piano dice cosa cambia se non reggono.

### Due cose da sapere prima di tutto il resto

1. **`supabase gen types typescript --db-url` gira in Docker** (esegue `postgres-meta` in un container,
   per quanto ne so della CLI v2), e su questa macchina Docker non c'è e non si installa senza admin.
   Le alternative chiedono una **credenziale nuova** — un token personale per `--project-id`, valido su
   **tutti** i progetti dell'account, prod compresa — o un **passo umano** (download dei tipi dalla
   dashboard). È un ⛔ che la delega non copre: una credenziale con quel raggio la decide l'umano, come
   ha deciso `SUPABASE_DB_URL`. **Raccomandazione:** il passo umano, perché il raggio del token è
   sproporzionato a un file di tipi; la deriva fra file e schema la tiene un test sugli enum (sotto).
   Alternativa: il token, se l'umano preferisce l'automazione piena.
2. **Il reintegro sotto RLS ha bisogno di un cambio di port.** T08 scrive la funzione del DB, ma
   l'usecase reintegra con `listByLeg` + `save` e continuerebbe a tornare `ok([])` in silenzio. Il
   metodo del port è un task a sé, da fare prima di T09 (nota del 25/10 su *"La cascata e il reintegro
   scrivono N righe una alla volta"* in `IDEAS.md`). **Dipendenza mancante, segnalata e non risolta.**

### I criteri, riletti: cosa ho cambiato e perché

Dettaglio accanto a ogni criterio, marcato *(25/10)*.

- **Duplicati fusi.** La concorrenza c'era due volte (blocco base e 13/10); le RLS di scrittura su
  `trips` e `match_requests` due volte (13/10 e T07g); `maxLength` due volte (13/10 e T07b). Restano
  scritti, con il rimando a quello che li contiene.
- **Due forme SQL che PostgREST non esprime.** `SET seats_available = seats_available + :delta` e
  `GREATEST` dentro un upsert: con `supabase-js` non si scrivono. Diventano funzioni del DB
  (`adjust_leg_seats`, `raise_personal_bests`), e quindi **cambiano il contratto di T09**, che le chiama
  invece di fare `PATCH`/`upsert`. Scritto su T09.
- **Un'affermazione falsa.** *"Foreign key + policy… impossibile anche per il seed e per le migrazioni"*:
  migrazioni, seed e dashboard girano come `postgres`, che scavalca le RLS. Diventa una foreign key
  **composta** `(requester_trip_id, requester_id) → trips(id, owner_id)`, più la policy, che scatta
  prima e dà all'app l'esito di `memory`.
- **Un tipo che arrotonda.** `timestamptz(3)` arrotonda al millisecondo, non tronca: `23:59:59.9996`
  diventa il giorno dopo, e il confronto per giorno di T07d darebbe due risposte. Sostituito da
  `timestamptz` + `CHECK (col = date_trunc('milliseconds', col))`: rifiuto invece di arrotondamento. Il
  test di T07f diceva *"lo rilegge troncato"*: con questa forma lo vede **rifiutato**, ed è il motivo
  della correzione.
- **Un metodo non disponibile:** i tipi generati (sopra).
- **Verifiche senza perimetro rese verificabili:** "applicabili su un progetto vuoto" (senza un secondo
  progetto: test di revert + migrazioni in una transazione annullata), "RLS su ogni tabella" (dal
  catalogo, schemi `public` e `private`, nessun elenco scritto a mano), "oltre a quanto previsto" (la
  tabella delle letture è scritta), "nessun *T08 non ha deciso*" (un `rg`, test inclusi).
- **Una contraddizione fra blocchi.** I `CHECK` sulle candidature (invarianti di
  `validateMatchRequestStructure`) rendono irrappresentabile la riga che la suite semina con
  `seminaCandidaturaGrezza`: il blocco di T07g lo prevedeva, ora è deciso (i quattro test vanno *solo
  memory*, l'hook esce).
- **Criteri che i port chiedevano già e T08 non aveva:** `trips.owner_id → profiles` e la lettura delle
  offerte per tutti (doc di `listOpenOffers`), la materializzazione delle tratte (doc di `save`).
- **Ambito delle tabelle.** *"Tabelle da `ARCHITECTURE.md`"* comprendeva `invite_codes` e `plants`: il
  primo passa a T10 (il flusso d'accesso non è disegnato), il secondo diventa un tipo enumerato.

### Lo schema, nella forma decisa

Tipi enumerati per **ogni** union di letterali del dominio: `plant_id`, `badge_id`, `parameter_key`,
`leg_direction`, `trip_status`, `match_request_status`, `resolved_by`. Sono un secondo elenco, ed è il
prezzo che T07e rifiutava per le metriche; qui lo si paga perché i tipi generati li espongono come union,
e un'asserzione di tipo li tiene **uguali nei due versi** alle union del dominio. Un `CHECK … IN (…)`
sarebbe lo stesso elenco, invisibile ai tipi generati.

| Tabella | Colonne e vincoli | Lettura | Scrittura dall'app |
|---|---|---|---|
| `profiles` | `id` → `auth.users` (cascade), `display_name`, `plant_id` | `authenticated` | nessuna (T10) |
| `trips` | `id` uuid, `owner_id` → `profiles` (restrict), plant, `departure_at`/`return_at` timestamptz al ms (CHECK), `has_car`, `seats_total`, `seats_available`, `status`; CHECK di `makeTrip`; `UNIQUE (id, owner_id)` | `authenticated` | owner, upsert compreso |
| `trip_legs` | PK `(trip_id, direction)`, `trip_id` → `trips` (cascade: la tratta è una proiezione), CHECK `BETWEEN` | `authenticated` | nessuna: trigger e `adjust_leg_seats` |
| `match_requests` | `id`, `(trip_id, direction)` → `trip_legs` (**restrict**), `requester_id` → `profiles`, `(requester_trip_id, requester_id)` → `trips(id, owner_id)` (restrict), stato, note, `resolved_by`, `notes_shortened`; `UNIQUE (trip_id, direction, requester_id)`; CHECK della struttura | richiedente e owner | due attori, più il trigger sulla riga vecchia |
| `personal_bests` | `profile_id` → `profiles` (cascade), quattro metriche ≥ 0 (interi; km `double precision`) | solo la propria | solo la propria, via `raise_personal_bests` |
| `parameters` | `key parameter_key` PK, `value jsonb` (numero o testo) | `authenticated` | nessuna |
| `plant_distances` | due `plant_id` diversi, coppia non ordinata unica, `km` finito ≥ 0 | `authenticated` | nessuna |
| `badge_parameters` | `badge_id` PK, `threshold` intero ≥ 1, `label` | `authenticated` | nessuna |

`anon`: zero righe ovunque (nessuna policy, nessuna `REVOKE` di `SELECT`: deve essere *"riga assente"*,
non un errore, come chiede T09).

**Funzioni.** In `public`, perché l'app le chiama: `adjust_leg_seats` (definer: owner, o richiedente con
candidatura `accepted` sulla tratta; esistenza → identità → limiti; zero righe fuori limite),
`restore_system_rejected` (definer: solo se la tratta ha posti liberi; restituisce gli id),
`raise_personal_bests` (invoker, `GREATEST`). In `private`, non esposto da PostgREST: il trigger che
materializza le tratte (definer), il trigger di guardia di `match_requests` sulla riga vecchia (attivo
solo per `authenticated`/`anon`), il trigger di monotonia, il trigger su `notes.maxLength`,
`lower_note_max_length` (solo `postgres`). `search_path` vuoto, `EXECUTE` revocato a `public` e `anon`
ovunque.

**Cosa resta permesso a un client ostile, dichiarato:** il richiedente di una candidatura `accepted` può
ripetere il +1 finché la riga è `accepted` (fino a `seats_total`, non oltre). Nota del 25/10 sulla voce
*"Atomicità e idempotenza dell'accettazione"*.

**Come girano gli usecase sotto queste policy**, verificato a mano su ciascuno: `requestSeat`,
`acceptRequest` (cascata compresa: l'owner vede e chiude le righe della sua tratta), `rejectRequest`,
`refreshPersonalBests` funzionano. `cancelRequest` funziona tranne il **reintegro** (dipendenza
mancante, sopra). `computeCompanyKpi` **no**: nessuno legge le candidature di tutti — voce nuova in
`IDEAS.md` e riquadro su T16.

### Le decisioni, una riga ciascuna con l'alternativa scartata

1. **Tratta eliminata con candidature:** foreign key `RESTRICT` + guard in `save` su **qualunque**
   candidatura, su entrambi gli adapter. *Alt.:* `RESTRICT` e l'usecase che annulla prima — non c'è
   l'usecase (modifica trasferta). `CASCADE` escluso dall'umano.
2. **Candidature già chiuse:** stesso guard, nessuna cancellazione. *Alt.:* cancellare le chiuse prima
   di togliere la tratta: logica di un task che non esiste, e perde la storia di un rifiuto motivato.
3. **Incremento di `cancelRequest`:** `adjust_leg_seats` definer, che autorizza owner e richiedente
   `accepted`. *Alt.:* policy di `UPDATE` su `trip_legs`: il client potrebbe scrivere qualunque valore
   in [0, totale], e un aggiornamento relativo non si esprime comunque via PostgREST.
4. **Reintegro:** `restore_system_rejected` definer. *Alt.:* policy dedicata alle transizioni `system`:
   farebbe leggere al richiedente le note degli altri (contro la decisione sulla visibilità della nota)
   e la `WITH CHECK` non saprebbe limitare la scrittura al solo cambio di stato. **Implica un metodo
   nuovo del port, ⛔, che T09 dovrà implementare.**
5. **Monotonia lato DB:** `raise_personal_bests` con `GREATEST` + trigger che **rifiuta** un abbassamento.
   *Alt.:* `UPDATE … WHERE nuovo > corrente` — per riga, fallisce il caso misto; o un trigger che
   **corregge** in silenzio invece di rifiutare.
6. **Forma dei parametri:** chiave/valore `jsonb` con chiavi enumerate, più due tabelle per distanze e
   badge. *Alt.:* una riga a colonne tipizzate: ripete le chiavi nel DDL e rende irrappresentabile il
   parametro mancante.
7. **Abbassare `note.maxLength`:** trigger che rifiuta + funzione `private.lower_note_max_length(n)`
   chiamata da una migrazione (accorcia a `n − 1` + `…`, marca `notes_shortened`, controlla la nota
   automatica, poi scrive il parametro). *Alt.:* una procedura scritta come documento: non eseguita, non
   provata, quindi una garanzia finta.
8. **Istanti:** `timestamptz` + `CHECK` al millisecondo. *Alt.:* `timestamptz(3)`: arrotonda.
9. **`requester_trip_id`:** foreign key composta + policy. *Alt.:* la sola policy: non ferma `postgres`.
10. **Condizioni sulla riga vecchia di `match_requests`:** trigger `BEFORE UPDATE`. *Alt.:* solo policy:
    un owner potrebbe riscrivere a proprio nome la candidatura di un collega, che `memory` rifiuta.
11. **Tratte:** trigger su `trips`. *Alt.:* una funzione `save_trip` (un RPC in più per T09) o più chiamate
    REST da T09 (non atomiche, e non sanno aggiornare `seats_total` preservando il contatore).
12. **Identità come enum** + asserzione di tipo. *Alt.:* `CHECK … IN`, invisibile ai tipi generati; o una
    tabella `plants`, che non dà un tipo.
13. **`invite_codes` a T10.** *Alt.:* crearla ora, pre-impegnando le policy di un flusso non disegnato.
14. **Cartella `app/supabase/`.** *Alt.:* `projects/traveltogether/supabase/`: separa il DB dall'app, ma
    test, script di seed e tipi generati vivono in `app/` e dovrebbero uscire dalla radice di jest.
15. **Le righe invalide di candidatura diventano *solo memory*.** *Alt.:* niente `CHECK` sulla struttura,
    per lasciarle rappresentabili: verifica più debole, e la priorità dice il contrario.

### L'infrastruttura dei test di integrazione

**Via SQL, non via REST.** Ogni test apre una transazione, inserisce le sue fixture come `postgres`
(utenti in `auth.users`, profili, trasferte), poi `set local role authenticated` e
`set_config('request.jwt.claims', '{"sub": …, "role": "authenticated"}', true)` — è ciò che legge
`auth.uid()` — agisce, asserisce, e **`ROLLBACK`**. Staging non cambia. La via REST con `supabase-js`
richiederebbe la dipendenza di T09, sign-in veri con password per utenti creati via API amministrativa
(cioè la chiave `service_role`, che l'agente non ha), e niente transazioni: tutto andrebbe ripulito.

**Lo schema nei test viene dai file, non da staging.** Un helper esegue, dentro la transazione, lo
script di revert e poi le migrazioni in ordine: ogni test verifica **il SQL del repo**, prima e dopo
l'applicazione, e "applicabile su un progetto vuoto" è lo stesso helper con le sue asserzioni. Che
staging corrisponda al repo lo dice `db:status`. Prezzo: un lock esclusivo sulle tabelle per la durata
del test, solo su staging; `test:int` gira **in serie** (`maxWorkers: 1`).

**Solo la concorrenza conferma righe**, perché una seconda connessione non vede una transazione aperta.
Profili di test con email `@t08.test.invalid` e nomi fittizi, cancellati alla fine nell'ordine delle
foreign key (candidature, trasferte — le tratte vanno in cascata — massimi, profili, utenti), più una
pulizia all'avvio dei residui di un'esecuzione interrotta, **per email di test**. Nessun dato della demo
viene toccato (`ARCHITECTURE.md`: staging è per i test, prod per la demo; e comunque la cancellazione è
per identità di test). I parametri non sono mai scritti fuori da una transazione annullata.

**Dipendenza nuova, ⛔ — raccomandata, quindi applicabile per delega:**
- **`postgres`** (postgres.js), `devDependency`, ultima `3.x` con almeno due settimane di vita (stessa
  regola della CLI). **Motivo:** l'unico modo di parlare SQL con staging da un test su questa macchina:
  niente `psql` (sarebbe un'installazione), niente Docker (quindi niente `supabase test db`/pgTAP), e
  Node non ha un client Postgres. **Peso:** un pacchetto, **zero dipendenze transitive**, tipi inclusi,
  nessuno script d'installazione — quindi nessun conflitto con la regola di Fase 1 (npm 11 blocca gli
  script, e qui non ce ne sono: da verificare sul lockfile all'installazione). **Alternativa:** `pg` +
  `@types/pg`, il client più diffuso, ma circa quindici pacchetti fra dipendenze e tipi (`pg-pool`,
  `pg-protocol`, `pg-types`, `pgpass`, `postgres-*`, …), anch'essi senza script. Scelto il primo per la
  superficie: un pacchetto da rivedere invece di quindici.
- Nessun'altra dipendenza: lo script del seed usa Node 24, il wrapper della CLI `@expo/env`, già
  presente.

**Rischi da chiudere allo step 1, non assunti:** (a) TLS — il client deve verificare il certificato di
Supabase; `rejectUnauthorized: false` **non** è accettabile con una credenziale da superutente su una
rete aziendale con proxy; se serve il certificato radice di Supabase, è pubblico e si committa. (b) Il
proxy aziendale può bloccare le porte 5432/6543: lo dice il primo `select 1`. (c) La stringa deve
essere quella del **session pooler** (5432): il collegamento diretto è solo IPv6 sul piano gratuito, e il
transaction pooler (6543) non regge `set local` fra istruzioni di sessione né le istruzioni preparate.
L'agente non legge `.env`: lo verifica il test, e l'umano corregge. (d) Che `postgres` possa inserire in
`auth.users` su un progetto ospitato: provato in una transazione annullata. (e) Che il preset
`jest-expo` lasci girare un client di rete: `testEnvironment: 'node'` per `test:int`.

### Tipi generati

`app/src/adapters/supabase/database.types.ts`: dentro l'elemento `adapters`, quindi il lint vieta già a
`core/` e `ui/` di importarlo, con due reti (`boundaries` e `no-restricted-imports`); una sonda lo
mostra. Il file passa il lint come gli altri: se il generato violasse una regola di stile, un override
mirato su quel file e solo su regole di stile, dichiarato. Un modulo di conformità (non un `.test.ts`,
che senza `it` sarebbe una suite vuota e farebbe fallire jest) asserisce l'uguaglianza nei due versi fra
ogni enum generato e la union di dominio; e se il generatore emette l'oggetto `Constants` con i valori
degli enum (le versioni recenti lo fanno), un test di integrazione li confronta con `pg_enum` di staging:
è la deriva fra file e schema, verificata senza rigenerare.

### Migrazioni: struttura, applicazione, ritorno indietro

`app/supabase/migrations/` con tre file, ciascuno **sicuro da solo** (nessuna tabella nasce senza RLS):
(1) tipi, tabelle, vincoli, RLS, policy, trigger di guardia; (2) funzioni e trigger; (3) seed dei
parametri, **generato**. `app/supabase/rollback/` con lo script che annulla tutti e tre (`drop … if
exists`, così funziona anche su uno schema vuoto), provato a ogni `test:int`. Se la CLI lo richiede,
`supabase/config.toml` lo crea `supabase init` (locale, nessuna rete) e si committa dopo averlo letto.
`supabase/.temp/` è già ignorato dal `.gitignore` di radice.

**Applicazione:** `npm run db:push` = wrapper (`scripts/supabase-db.js`) che carica `.env` con
`@expo/env`, chiama `supabase db push --db-url …` (la CLI da `tools/supabase`, in testa al PATH) e
**maschera** stringa e password nell'output. `npm run db:status` = `supabase migration list --db-url …`.
`npm run db:preflight` = conteggio in sola lettura di tabelle, tipi e funzioni in `public`/`private` e
delle righe di `supabase_migrations`.

**Seed:** funzione pura `renderParameterSeedSql(seed)` in `app/src/adapters/supabase/` (solo `import
type`, così Node la esegue togliendo i tipi), script `app/scripts/generate-parameter-seed.mjs` che la
chiama su `SEED_PARAMETERS` e scrive il file. Test unitario senza rete (`fs` è permesso fuori da
`core/`): il file committato è **uguale** all'output. Ripiego, se la rimozione dei tipi di Node non
regge l'import: la scrittura la fa un test lanciato con una variabile d'ambiente, e il test normale
confronta.

**Ritorno indietro, senza reset.** Una migrazione applicata non si riscrive. Se è sbagliata: una
migrazione **nuova** — una correzione mirata, oppure la copia dello script di `rollback/`, già provato in
transazione — applicata con `db:push`. Se un file fallisce durante il push, la CLI annulla quel file
(una transazione per file: **da confermare allo step 0**); quelli prima restano, e si corregge in
avanti. **Vietati senza l'umano:** `supabase db reset`, `supabase migration repair` (riscrive la storia
in remoto), modifiche dalla dashboard, modifiche a un file già applicato.

### Il piano, in dieci step (un commit solo)

Marcati **⚠️ STAGING** i passi che modificano staging: li esegue l'orchestratore, uno alla volta, e solo
quelli. Tutti gli altri toccano staging al massimo con letture e transazioni annullate.

**Step 0 — Verifiche e decisioni. Nessun file.** L'orchestratore esegue, in sola lettura: `supabase
--version`; `--help` di `db push`, `migration list`, `gen types typescript`, `init` (esistono
`--db-url` e `--dry-run`? l'help di `gen types` nomina Docker?); `node -p process.features.typescript`
(atteso `strip`); `npm view postgres version time`. Porta all'umano: **il metodo dei tipi generati** (⛔,
raccomandazione sopra) e **il task del port del reintegro** (⛔ interfaccia). Applica per delega: la
dipendenza `postgres`. **Se `gen types --db-url` non richiede Docker, il primo ⛔ cade.**

**Step 1 — Harness SQL.** File: `package.json`, `package-lock.json` (`postgres`), `jest.int.config.js`
(`testEnvironment: 'node'`, `maxWorkers: 1`, `testTimeout`), `tests/integration/support/db.ts`
(connessione da `SUPABASE_DB_URL` con errore rumoroso se manca; transazione annullata; `comeUtente`,
`comeAnonimo`; schema dai file), `tests/integration/support/fixtures.ts` (utenti e profili in
transazione; fixture confermate con pulizia), `tests/integration/connessione.test.ts` (`select 1`;
`auth.uid()` restituisce il `sub` impostato; insert in `auth.users` annullato),
`tests/integration/credenziali.test.ts` (+ `SUPABASE_DB_URL`), `.env.example` (oggi non risulta nel
repo: se manca si crea, con valori finti), `scripts/supabase-db.js`, `scripts/db-preflight.js`, script in
`package.json`. **Staging:** solo letture e una transazione annullata. **Verde da solo:** sì, se `.env`
ha `SUPABASE_DB_URL` (la mette l'umano). *Sonde:* senza la variabile `test:int` è rosso con il
messaggio giusto; con un `sub` diverso da quello atteso l'asserzione su `auth.uid()` cade.

**Step 2 — Lo specchio in RAM, prima del SQL.** Le regole nuove in `memory`, perché il SQL le
rispecchi e non il contrario. File: `memory-trip-repository.ts` (guard di `save` su una tratta
referenziata da qualunque candidatura → `invalid-record`, storage intatto; `adjustLegSeats` autorizza
owner o richiedente `accepted`, ordine esistenza → identità → limiti; con identità nulla le letture di
trasferte e tratte sono vuote), `memory-profile-repository.ts` (idem per i profili),
`memory-match-request-repository.ts` (un'interrogazione non di port, usata dal collegamento: "ci sono
candidature su questa tratta?", "questo profilo ha una `accepted` qui?" — su **tutte** le righe, come un
indice), `memory-conditions.ts` (il collegamento e il doc), `memory.contract.test.ts` (cabla),
`repository-contract.ts` (test nuovi: tratta tolta con candidatura **chiusa** → `invalid-record` e tutto
intatto; estraneo che chiama `adjustLegSeats` → `storage-unavailable` e posti invariati; richiedente
`accepted` +1 → ok; richiedente `pending` → rifiutato; i quattro test della riga invalida **escono**, e
con loro `seminaCandidaturaGrezza`), `memory-match-request-repository.test.ts` (li riceve, identici),
`memory-conditions.test.ts` (identità nulla: trasferte, tratte, profili invisibili), doc di
`trip-repository.ts`. **Verde da solo:** sì, solo unit. *Sonde:* togliere il guard → cade la tratta
tolta; togliere il ramo del richiedente `accepted` → cade il +1; togliere l'autorizzazione → cade
l'estraneo; filtro su identità nulla tolto → cade `memory-conditions.test.ts`. **A esito noto, da non
chiedere:** un controllo d'unicità che guardi anche l'id (già sondato a T07g). **Cambiano:** solo i
quattro test spostati, con le asserzioni identiche; verificabile con `git diff` sulle `expect`.

**Step 3 — Migrazione 1: tipi, tabelle, vincoli, RLS, guardia.** File:
`app/supabase/migrations/<ts>_schema.sql`, `app/supabase/rollback/<ts>_revert.sql`,
`tests/integration/migrazioni.test.ts` (applicabile su schema vuoto; nessuna istruzione di controllo
della transazione), `tests/integration/schema.test.ts` (RLS su ogni tabella dal catalogo; ogni `CHECK`
con il suo confine; foreign key composta come `postgres`; istante al ms), `tests/integration/rls.test.ts`
(una lettura permessa e una negata per tabella; ogni regola di scrittura della tabella di T07g, positiva
e negativa; `anon` a zero righe). **Staging:** solo transazioni annullate. **Verde da solo:** sì.
*Sonde, una alla volta, ciascuna deve far cadere il suo test:* `WITH CHECK` di `INSERT` su `trips` senza
l'owner; `USING (true)` sull'`UPDATE` di `trips` (cade il dirottamento via upsert); `USING (true)` sulla
lettura di `match_requests`; la proprietà di `requester_trip_id` tolta dalla policy (cade il test che
pretende `42501`: la foreign key darebbe `23503`); la foreign key composta tolta (cade il test come
`postgres`); il trigger di guardia tolto (cade l'owner che riscrive a proprio nome); il `CHECK` di
coppia nota/`resolved_by` tolto; il `CHECK` `has_car`; `timestamptz(3)` al posto del `CHECK` al ms; RLS
disattivata su una tabella; una policy di lettura per `anon` su `trips`; `USING (true)` sulla lettura di
`personal_bests`; il `UNIQUE` della coppia.

**Step 4 — Migrazione 2: funzioni e trigger.** File: `…_functions.sql`, il revert aggiornato,
`tests/integration/funzioni.test.ts`: `adjust_leg_seats` (owner, richiedente `accepted`, `pending`
rifiutato, estraneo `42501`, tratta inesistente `P0002`, fuori limite **zero righe**);
`restore_system_rejected` (come richiedente: `UPDATE` diretto → zero righe, funzione → `pending`;
`rejected`/`owner` e `cancelled` intatti; tratta a zero → niente); `raise_personal_bests` (caso misto;
altro profilo `42501`); trigger delle tratte (con e senza rientro, senza auto, contatore preservato,
totale cambiato, contatore fuori dal nuovo totale rifiutato, rientro tolto con candidatura rifiutato);
monotonia (`UPDATE` diretto che abbassa → errore); `notes.maxLength` (sotto la nota più lunga →
rifiutato, anche come `postgres`); `lower_note_max_length` (testo con `…`, marcatura, parametro;
rifiuto se la nota automatica sfora); `EXECUTE` (`anon` sulle tre, `authenticated` su quella privata).
**Staging:** solo transazioni annullate. **Verde da solo:** sì. *Sonde:* autorizzazione tolta da
`adjust_leg_seats`; ramo del richiedente tolto; condizione `BETWEEN` tolta dal `WHERE` (il test pretende
zero righe, e il `CHECK` darebbe un errore: cade); condizione sui posti liberi tolta da
`restore_system_rejected`; filtro `resolved_by = 'system'` tolto; `GREATEST` sostituito dal valore nuovo
(cade il caso misto, per il trigger); trigger di monotonia tolto; ramo di cancellazione tolto dal trigger
delle tratte; contatore sovrascritto invece che preservato; trigger su `maxLength` tolto; funzione senza
`…` o senza marcatura; `REVOKE` tolto.

**Step 5 — Seed dei parametri.** File: `app/src/adapters/supabase/parameter-seed-sql.ts` e il suo test
(confronto con il file committato; un caso con un apostrofo, che il seed di oggi non ha, per la
quotatura), `app/scripts/generate-parameter-seed.mjs`, `…_parameter_seed.sql` (generato), test di
integrazione: righe → `parseParameters` uguale a `parseParameters(SEED_PARAMETERS)`, e i casi P3 e P4
rappresentabili (una riga tolta, un'etichetta con *"Ticket"*: inseribili, rifiutate dal parser).
**Verde da solo:** sì. *Sonde:* un valore cambiato nel seed → rosso il test unitario; quotatura rotta →
rosso il caso con l'apostrofo; numero scritto come testo jsonb → rosso il confronto di integrazione.

**Step 6 — ⚠️ STAGING: applicazione.** Solo l'orchestratore, in quest'ordine, fermandosi al primo
esito inatteso: `npm run db:preflight` (nessuna tabella in `public`, nessuna migrazione registrata);
`npm run db:status`; `npm run verify` verde (lo schema nei test viene dai file, quindi è già verificato);
**`npm run db:push`** — l'unico comando del task che cambia lo schema di staging; `npm run db:status`
(tutte applicate); `npm run test:int`. Se il push fallisce a metà: nessun reset, si corregge in avanti
con un file nuovo.

**Step 7 — ⚠️ STAGING (righe di test, ripulite): concorrenza.** File:
`tests/integration/concorrenza.test.ts`. Tre casi su due connessioni, contro lo schema **applicato**:
l'ultimo posto conteso (B ottiene zero righe); la corsa fra la cascata e una candidatura nuova (esito
pinnato come nel criterio); l'annullamento con due rifiutati dal sistema e il reintegro via funzione.
Pulizia alla fine e all'avvio. **Verde da solo:** sì, dopo lo step 6. *Sonde:* **nessuna sullo schema**,
perché questi test girano sullo schema applicato e sondarlo vorrebbe dire modificare staging; la
condizione `BETWEEN` è già sondata allo step 4, in transazione. La sonda qui è sull'intercalatura:
invertire l'ordine (B conferma prima che A prenda il lock) deve far cadere il test, che pinna **chi**
ottiene il posto. Se il developer non trova un'inversione che possa fallire, la dichiara a esito noto
invece di registrarla come prova.

**Step 8 — Tipi generati.** Dipende dal ⛔ dello step 0. File: `database.types.ts`, il modulo di
conformità degli enum, il test di deriva sugli enum se `Constants` esiste. **Staging:** sola lettura.
*Sonde:* un membro aggiunto a `LegDirection` (o a un enum nel file generato) → rosso `typecheck`;
`import` del file da `core/` → rosso `lint`.

**Step 9 — Documenti.** `ARCHITECTURE.md` § Modello dati (schema applicato, non bozza; funzioni;
`invite_codes` a T10; la riga *"il decremento… va risolta nel DB"* diventa *"è risolta in
`adjust_leg_seats`"*), doc dei port e di `memory-conditions.ts` (il `rg` del criterio). `CLAUDE.md` di
progetto, § Dati e sicurezza: accanto a *"La `service_role` key serve solo alle migrazioni"*, una riga
che dica lo stesso di `SUPABASE_DB_URL` (solo CLI e `test:int`, mai nel bundle, mai `EXPO_PUBLIC_`) —
**all'orchestratore**, non al developer.

**Chiusura:** `npm run verify` verde, ogni sonda eseguita **da sola** dal developer con l'esito in questa
voce e ripristinata con Edit, niente scritture da shell, niente worktree. Commit unico; il push su
staging è avvenuto prima, quindi **il commit va fatto subito dopo lo step 9**: finché non c'è, staging
contiene uno schema che il repo ha solo nel working tree.

**Stima: L.** Tre migrazioni e un revert, una cinquantina di test di integrazione stimati (non una
previsione), una decina di test di contratto e memory, due script. Il rischio di calendario non è nel
codice: sono lo step 0 (Docker) e i rischi di rete dello step 1, che possono fermare il task prima di una
riga di SQL.

### Voci in `IDEAS.md`

Tre nuove: *"I KPI aziendali hanno bisogno di candidature che la RLS non lascia leggere"*, *"Nessun task
applica le migrazioni a prod"*, *"Come cambia il seed dei parametri dopo la prima migrazione"*. Due note
su voci esistenti, invece di duplicarle: il reintegro come metodo del port (su *"La cascata e il
reintegro scrivono N righe una alla volta"*) e il +1 ripetibile dal richiedente (su *"Atomicità e
idempotenza dell'accettazione"*). Verificato sui titoli e sul contenuto.


### Decisioni dell'orchestratore sul piano di T08 (25/10)

- **⛔ 1, tipi generati: cade.** Provato `supabase gen types typescript --db-url … --schema public` sul
  database vuoto di staging: **exit 0, nessun Docker richiesto**, file di tipi generato. Niente token
  personale, niente passo umano: lo step 8 lo esegue l'agente.
- **⛔ 2, reintegro: aperto come task a sé, T08b**, fra T08 e T09, con i suoi criteri. Il ⛔ (port che
  cambia) sarà sciolto per delega all'apertura, come per T07b.
- **Dipendenza `postgres` (postgres.js) come devDependency: approvata per delega**, perché è la
  raccomandazione del planner. Un pacchetto, zero transitive, nessuno script d'installazione; da
  ricontrollare sul lockfile allo step 1. Alternativa scartata: `pg` + `@types/pg`, ~15 pacchetti.
- **Connessione verificata prima di partire:** Session pooler `aws-0-eu-west-1`, TLS, database vuoto
  (nessuna tabella). La Direct connection non è raggiungibile da questa rete: l'host ha solo un record
  AAAA. La password esposta in chat è stata reimpostata dall'umano; il pooler l'ha recepita con
  qualche minuto di ritardo.
- **Ordine di esecuzione:** il developer fa gli step 0–5, che non modificano staging; **review delle
  migrazioni prima di applicarle**; lo step 6 (`db:push`) lo esegue l'orchestratore, un passo per volta;
  poi il developer fa gli step 7–9 e c'è la review finale; commit subito dopo.


---

## 2026-10-25 — T08 · step 1–2 nel working tree, fermo sul certificato TLS

**Stato per chi riprende:** gli step 1 e 2 di T08 sono nel working tree, **non committati**, perché
`test:int` non può diventare verde. Lint, typecheck e **661 test unitari in 30 suite** sono verdi.
**Nessun comando ha modificato staging.**

**Il blocco.** postgres.js con la verifica TLS attiva rifiuta il pooler (*self-signed certificate in
certificate chain*), anche con la CA di sistema di Windows. Il developer si è fermato invece di
disattivare la verifica, come da brief. Diagnosi dell'orchestratore con `openssl s_client -starttls
postgres`, senza credenziali: `*.pooler.supabase.com` ← *Supabase Intermediate 2021 CA* ← **Supabase
Root 2021 CA**, autofirmata, SHA256 `80:70:25:AD:…:E6:CA:FA`. È la **CA privata di Supabase, non un
proxy**. La CLI si connette perché la incorpora.

**Decisione:** fidarsi di quella sola radice con `ssl: { ca }`, verifica attiva. Ma una radice letta
dalla stessa connessione che deve verificare non prova niente: chiesto all'umano di scaricarla dalla
dashboard (*Database → SSL Configuration*) in `app/supabase/prod-ca-2021.crt`, per confrontarne
l'impronta su un **secondo canale**. Chiesta anche la riga `SUPABASE_DB_URL` con valori finti in
`.env.example`, che le deny rules proteggono anche dall'agente.

**Step 1 (harness):** dipendenza `postgres` 3.4.9 (aprile 2026), devDependency, installata con
`--ignore-scripts`; nessuno script d'installazione, zero transitive, il lockfile cambia di una sola
voce. `scripts/oscura.js` oscura URL, password, utente e host in ogni output; `scripts/supabase-db.js`
avvolge la CLI (`db:status`, `db:push`); `tests/integration/support/db.ts` apre transazioni sempre
annullate. **postgres.js con `sslmode=require` disattiva la verifica in silenzio**: `db.ts` passa
`ssl` esplicito, che prevale sull'URL. `credenziali.test.ts` ora pretende anche `SUPABASE_DB_URL`.
**Tipi di Node** in un `tsconfig.int.json` separato (decisione dell'orchestratore): non arrivano a
`core/`. La sonda con `process.env` non distingue, perché `process` è già tipizzato da React Native;
distinguono `node:fs` e `__dirname`, che in `core/` danno errore.

**Step 2 (le regole di T08 in RAM, prima del SQL):** guard di `save` che rifiuta di togliere una tratta
referenziata da **qualunque** candidatura (`leg-referenced-by-requests`); `adjustLegSeats` solo
dall'owner o dal richiedente `accepted` su quella tratta; con identità nulla trasferte, tratte e
profili si leggono vuoti. Nove test di contratto nuovi; i quattro test della riga invalida spostati,
con `expect` identiche, in un file solo-memory, perché sotto i CHECK di T08 quella riga non si può
costruire; `seminaCandidaturaGrezza` esce dall'ambiente. Sei sonde, tutte cadute dove dovevano.


---

## 2026-10-25, 20:11 — Ripresa automatica dopo il limite di sessione

Il developer di T08 (step 3–5) è terminato sul limite di utilizzo, con reset alle 20:10. **Ripreso
dall'heartbeat alle 20:11**, senza intervento dell'umano: è la prima ripresa che il meccanismo
introdotto alle 15:17 fa da solo. Il developer ha l'istruzione di rileggere `git status` e di
controllare che nessuna sonda sia rimasta applicata prima di continuare.


---

## 2026-10-25, 20:41 — T08 · step 3–6: migrazioni rivedute, applicate a staging

**Review intermedia, prima del push: APPLICABILE**, in due giri. Al primo nessun bloccante, ma una
scelta da fare **prima**, perché dopo il push costa una migrazione (D1): il richiedente `accepted`
poteva chiamare `adjust_leg_seats` con **qualunque** delta, quindi azzerare l'offerta altrui, mentre
piano e `IDEAS.md` dichiaravano solo *"può ripetere il +1"* — un documento che prometteva **meno rischio**
di quello che il codice permetteva. Scelta (a), raccomandata: il richiedente solo ±1, l'owner libero entro
[0, totale], **nell'SQL e in RAM**, con un test per lato. Chiusi nello stesso giro quattro test che
mancavano (S1 ramo `elsif` del trigger di guardia, S2 `requester_trip_id` nella `WITH CHECK`
dell'UPDATE, S3 upsert di un estraneo → 42501, S4 `lower_note_max_length(0)`) e tre commenti resi veri.
S3 cade solo togliendo **quattro** strati insieme (USING dell'UPDATE, WITH CHECK, trigger, USING della
SELECT): difesa in profondità, e il test fissa il comportamento che serve a T09. Secondo giro:
APPLICABILE, `schema.sql` e seed verificati identici.

**Le migrazioni:** `20261025120000_schema.sql` (schema `private`, 7 enum, 8 tabelle con RLS, CHECK, FK
composte, UNIQUE, policy, trigger di guardia), `20261025120100_functions.sql` (`adjust_leg_seats` e
`restore_system_rejected` definer, `raise_personal_bests` invoker, trigger delle tratte, della
monotonia e di `notes.maxLength`, `private.lower_note_max_length`), `20261025120200_parameter_seed.sql`
(generato da `SEED_PARAMETERS`, confrontato con il generatore da un test). Un solo revert,
`rollback/20261025120000_revert.sql`, idempotente.

**Step 6, eseguito dall'orchestratore alle 20:41:** `db:preflight` (staging vuoto) → `db:status` (tre
locali, nessuna remota) → `db:push --dry-run` (tre da applicare) → **`db:push --yes`** → `db:status`
(tre locali, tre remote). Exit 0. Poi `verify` completo **verde sullo schema applicato**: **679 unit in
32 suite, 135 di integrazione in 9 suite**, 1 smoke.

**Deviazione da "un task = un commit", dichiarata:** T08 si committa in **due parti**. Dopo il push
staging ha uno schema i cui file esistevano solo nel working tree: un'interruzione avrebbe lasciato un
database che il repo non conosce. La gerarchia di `CLAUDE.md` mette la reversibilità sopra la regola
del commit unico, e le condizioni del commit ci sono — `verify` verde, migrazioni approvate dal
reviewer. La seconda parte (step 7–9: concorrenza, tipi generati, documenti, review finale) chiude il
task.

**Da qui in poi le migrazioni applicate non si toccano:** ogni correzione è una migrazione nuova.

**Due controlli di sicurezza prima del commit.** `.env.example` (modificato dall'umano, illeggibile per
l'agente) verificato con soli sì/no: nessun valore vero del `.env` dentro, tranne il codice invito —
che però nel `.env` è **esso stesso un segnaposto**. **Prima di T10 il codice invito va sostituito con uno
vero e non indovinabile, solo nel `.env`.** E un buco nel `.gitignore`: `supabase/.temp/` era ancorato
alla radice, quindi `app/supabase/.temp/` sarebbe entrato nel commit; ora è `**/supabase/.temp/`.


---

## 2026-10-25 — T08 · le sonde degli step 3–8, una per una

Il criterio *"ogni policy, vincolo, trigger e funzione è provato togliendolo, con l'esito registrato
qui"* (N3 della review finale). Eseguite dal developer, ciascuna da sola e ripristinata; dove non dice
altro, la mutazione è dentro la transazione annullata del test, quindi staging non l'ha mai vista.

### Step 3 — schema, vincoli, RLS

| Mutazione | Test che cadono |
|---|---|
| `WITH CHECK` dell'INSERT su `trips` senza owner | 1: creazione a nome altrui |
| `USING (true)` sull'UPDATE di `trips` | 2: upsert dirottato, update altrui |
| `USING (true)` sulla lettura di `match_requests` | 1 |
| ownership di `requester_trip_id` tolta dalla policy | 1: atteso 42501, arriva 23503 |
| FK composta `(requester_trip_id, requester_id)` ridotta a semplice | 1 |
| trigger di guardia tolto | 1: owner che riscrive a proprio nome |
| CHECK nota / `resolved_by` tolto | 1 |
| CHECK `has_car` tolto | 1 |
| `timestamptz(3)` al posto del CHECK al millisecondo | 1: la riga con `.9996` passa |
| RLS disattivata su `plant_distances` | 2: catalogo e anon |
| policy di lettura per `anon` su `trips` | 1 |
| `USING (true)` sulla lettura di `personal_bests` | 1 |
| UNIQUE (tratta, richiedente) tolto | 1 |
| FK delle tratte da RESTRICT a CASCADE | 1 |
| CHECK sulla `pending` aperta tolto | 1 |
| S1: ramo `elsif` del trigger di guardia (owner della trasferta vecchia) | 1 |
| S2: clausola `requester_trip_id` nella `WITH CHECK` dell'UPDATE | 1: arriva 23503 invece di 42501 |

### Step 4 — funzioni e trigger

| Mutazione | Test che cadono |
|---|---|
| autorizzazione tolta da `adjust_leg_seats` | 3 |
| ramo del richiedente `accepted` tolto | 1 |
| `BETWEEN` tolto dal `WHERE` | 1 |
| D1: limite ±1 del richiedente tolto (SQL) | 1 di integrazione |
| D1: limite ±1 del richiedente tolto (memory) | 1 di contratto |
| condizione sui posti liberi tolta da `restore_system_rejected` | 1 |
| filtro `resolved_by = 'system'` tolto | 1 |
| `GREATEST` sostituito da `excluded` su una colonna | 1 |
| trigger di monotonia dei massimi tolto | 1 |
| ramo di cancellazione tolto dal trigger delle tratte | 3 |
| contatore sovrascritto invece che preservato | 3 |
| trigger su `notes.maxLength` tolto | 2 |
| `…` tolto da `lower_note_max_length` | 2 |
| marcatura tolta da `lower_note_max_length` | 2 |
| S4: controllo `max_length < 1` tolto | 1 |
| `REVOKE` da `anon` tolto | 1 (dal catalogo: la funzione rifiuta da sé chi non ha identità) |
| `search_path` tolto da una funzione definer | 1 |

### Step 5 — seed

| Mutazione | Test che cadono |
|---|---|
| un valore del seed cambiato (`30` → `31`) | confronto del file committato con il generatore |
| quotatura rotta nel generatore | caso dell'apostrofo |
| numero scritto come testo `jsonb` | 3 di integrazione |

### Step 7 — concorrenza

| Mutazione | Test che cadono |
|---|---|
| A conferma prima che B tenti | 1 (B non è bloccato) |
| nuova candidatura inserita prima della lettura della cascata | 1 (le `pending` lette diventano 2) |

### Step 8 — tipi generati

| Mutazione | Esito |
|---|---|
| membro aggiunto a `LegDirection` nel dominio | `typecheck` rosso sull'asserzione di conformità |
| membro aggiunto all'enum `plant_id` nel file generato | `typecheck` rosso |
| import di `database.types` da `core/` | lint rosso (`no-restricted-imports`, `boundaries/dependencies`) |
| valore aggiunto a `Constants.trip_status` | `tipi.test.ts` rosso |

### Senza sonda, dichiarato

- **S3** (upsert di un estraneo sulla candidatura di R → 42501): cade solo togliendo **quattro** strati
  insieme — `USING` dell'UPDATE, `WITH CHECK`, trigger di guardia, `USING` della SELECT che il `DO UPDATE`
  richiede. Difesa in profondità: il test fissa il comportamento, non lo strato.
- **Inversione A/B** del caso 1 di concorrenza: a esito noto, perché i due ruoli sono simmetrici.
- **Caso 3** di concorrenza (annullamento con reintegro): nessuna sonda dedicata; le sonde sulla
  funzione sono quelle dello step 4.
- **Unicità che guardi anche l'id**: a esito noto, già sondata a T07g.

### Step 7–9, cosa c'è

Tre test di concorrenza su righe **vere** (fixture `@t08.test.invalid`, dominio riservato dall'RFC 2606),
pulite all'avvio, dopo ogni test e alla fine, con l'assenza di residui asserita dal test; parametri
intatti dopo il run (8 / 3 / 6). `database.types.ts` prodotto dal generatore, non a mano, confinato in
`adapters/`; conformità degli enum nei due versi via `typecheck`, e confronto con `pg_enum`. ARCHITECTURE.md
§ Modello dati riscritto sullo schema applicato. `verify` verde: 679 unit, **139 di integrazione in 11
suite**, 1 smoke.

**Review finale, primo giro: BOCCIATO** per tre punti di documento e di freno: l'harness dichiarava di
non poter confermare mentre esportava due helper che lo fanno, riservati ad un file solo per convenzione
(N1); ARCHITECTURE.md e IDEAS.md sottostimavano il richiedente accettato, che con il limite per chiamata
può ripetere anche il −1 fino a zero (N2); questa voce mancava (N3). Codice, SQL, test e tipi approvati.


**Secondo giro della review finale: APPROVATO.** N1 chiuso con una regola di lint provata dal reviewer
su quattro forme d'import (diretto, `* as`, riesportazione, e l'eccezione in `concorrenza.test.ts`); N2 e
N3 chiusi. Due riserve in `IDEAS.md`: il freno si aggira da un altro file di `support/`, e il controllo
del lock filtra per testo invece che per pid. **T08 chiuso**, secondo commit.

---

## 2026-10-25, 21:30 — Fine sessione · HANDOFF

Scritto per la prossima sessione, su questa macchina (casa) o sull'altra (lavoro). **Working tree
pulito, `origin/auto/build` allineato.** `main` fermo al commit iniziale: lo mergia l'umano.

### Stato vero

**Fase 2: chiusi T01–T07e** (sessioni precedenti) **e in questa sessione T07f, T07g, T07h, T07b, T08.**
`verify` verde: **679 unit in 32 suite, 139 di integrazione in 11 suite, 1 smoke**. **Lo schema è
applicato a staging** (tre migrazioni, 20:41) e coincide con il repo.

Commit della sessione, in ordine: `75adc14` `b118678` (T07f) · `9717649` `8a19406` (T07g) · `38f092c`
`4a4bc11` (T07h) · `065baa3` `8c5a4b2` (T07b) · `d575dc0` (prerequisiti in `tools/`) · `096b504`
`8612e07` e il commit di chiusura di T08.

### Per riprendere, in quest'ordine

1. `git pull` su `auto/build`.
2. **Solo su una macchina nuova o se `tools/setup.py` è cambiato:** `py tools/setup.py` dalla radice,
   poi `npm ci` in `projects/traveltogether/app`.
3. In ogni shell, `tools/node` e `tools/supabase` in testa al PATH.
4. **`app/.env`** con quattro variabili: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
   `EXPO_PUBLIC_INVITE_CODE`, **`SUPABASE_DB_URL`** (Session pooler `aws-0-eu-west-1`, utente
   `postgres.<ref>`, porta 5432 — la Direct connection è solo IPv6 e da qui non si raggiunge). Il `.env`
   non viaggia con git: **sulla macchina del lavoro va aggiunta `SUPABASE_DB_URL`**.
5. `CLAUDE.md`, `OFFICINA.md`, la coda di questo file, `TASKS.md`, `git log -1`, `git status`, poi
   `npm run verify`.
6. **Armare l'heartbeat** (`CronCreate`, ogni 15 minuti su minuti non tondi), come da `CLAUDE.md`: è
   ciò che fa ripartire il loop dopo un limite di utilizzo. Oggi ha funzionato una volta da solo (20:11).

### Prossimi passi, in ordine

1. **T08b ⛔** — il reintegro passa da un metodo del port (`restore_system_rejected` è già nel DB). Il
   ⛔ è un cambio d'interfaccia; con la delega dell'umano si scioglie con la raccomandazione.
2. **T09 ⛔** — adapter Supabase. **Dipendenza nuova `@supabase/supabase-js`**: è ⛔, va approvata.
   Ha accumulato molti criteri da T07b, T07f, T07g, T08 (mappatura degli errori, upsert e zero righe,
   `guasta`/`ripristina`, `pulisci` sui parametri, RPC di `adjust_leg_seats` e `raise_personal_bests`).
3. **T10** — accesso con codice invito. **Prima, l'umano sostituisce `EXPO_PUBLIC_INVITE_CODE` nel
   `.env` con un codice vero e non indovinabile**: oggi è un segnaposto. `invite_codes` è passata da
   T08 a T10.
4. **Non si aprono senza riscriverne prima i criteri: T13, T14, T15** (riquadri ⚠️ in `TASKS.md`).

### Decisioni dell'umano in questa sessione

Delega: davanti a una decisione, l'opzione raccomandata dall'agente (registrata, con l'alternativa,
in ogni voce). Node e la Supabase CLI li installa l'agente, **dentro il repo** (`tools/`), perché si
lavora su due macchine. **Le migrazioni le applica l'agente con la CLI**, con `SUPABASE_DB_URL` nel
`.env`. Il loop **riparte da solo** dopo un limite di utilizzo (heartbeat). Non installata la skill di
terze parti `supabase/agent-skills`.

### Aperto, da decidere quando servirà (in `IDEAS.md`)

- **L'owner può riassegnare una candidatura chiusa a un altro collega**: RAM e RLS lo permettono allo
  stesso modo, perché viene dalla tabella delle policy di T07g. Cambiarlo è una decisione dell'umano.
- **Il richiedente accettato può ripetere ±1** finché la riga è `accepted`: gonfiare o azzerare i posti
  in N chiamate. Rischio dichiarato per la demo; il rimedio è *"stato e posti in un'operazione sola"*.
- **Le note non hanno un limite nel database**, **i privilegi di default** (TRUNCATE ecc.), **l'indice
  su `trips(owner_id)`**, il freno sugli helper che confermano aggirabile da `support/`, il filtro per
  pid nel test del lock.
- **I KPI aziendali (T16)** hanno bisogno di candidature che le RLS non lasciano leggere.

### Tre cose da sapere sulla macchina di casa

- **L'hook guard di git non gira qui**: `.claude/settings.json` lo chiama con `python` (qui è l'alias
  del Microsoft Store) e con un percorso assoluto della macchina del lavoro. Restano le deny rules e la
  branch protection. Non corretto: `settings.json` è dell'umano.
- **Il tipo di agente `reviewer` non era caricato** in questa sessione: la review l'ha fatta un agente
  generico con le istruzioni di `reviewer.md`, su modello forte, senza modificare file.
- **La password del database è stata esposta in chat** e poi reimpostata dall'umano; quella in uso non
  è mai passata dalla conversazione.

### Le lezioni della sessione

1. **Quattro bocciature su sette sono nate da testi che promettevano più del codice** — commenti,
   documenti, doc dei port, perfino la regola dell'heartbeat. La regola in `CLAUDE.md` c'è; il difetto si
   ripresenta e lo trova solo una lettura. Vale come avviso per ogni brief.
2. **La RAM e il database vanno confrontati in tutte e due le direzioni.** T07g ha trovato una RAM più
   permissiva delle RLS; la review delle migrazioni ha cercato il contrario, e ha trovato invece un
   documento che sottostimava il rischio.
3. **Una verifica che dipende da un secondo canale vale solo se i canali sono indipendenti**: la CA
   di Supabase letta dal server non provava niente finché non è arrivata la stessa impronta dalla
   dashboard.
4. **Un'interruzione non distrugge niente se il lavoro è committato e il loop sa ripartire.** Due
   developer fermati dal limite di utilizzo sono ripartiti dal working tree senza perdere niente; e T08
   è stato committato in due parti perché, dopo il push, uno schema applicato senza i suoi file nel repo
   era il rischio più grande della giornata.
