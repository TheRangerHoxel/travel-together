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
