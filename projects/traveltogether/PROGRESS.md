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

**Mancante per chiudere F1.2**
- Riavvio della sessione (carica hook + deny rules, e risolve il PATH)
- Identità git: `user.name` e `user.email` non configurati
- URL del repo GitHub privato (da creare dall'umano: `gh` è bloccato dal proxy)

**Nessun commit ancora creato.** Il repo è inizializzato e vuoto.
