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
