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

## Scope

- Fai **solo** ciò che è nel task corrente di `TASKS.md`. Niente feature "utili" non richieste.
- Un miglioramento che ti viene in mente → una voce in `IDEAS.md`, e **avanti col task**.
- Le proposte in `IDEAS.md` **non entrano nello scope da sole**. Solo l'umano le approva; quando le
  marca `accettata` diventano task in `TASKS.md`. Finché non lo sono, per il loop non esistono.
- Niente duplicati in `IDEAS.md`: se l'idea c'è già, non riscriverla.

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
