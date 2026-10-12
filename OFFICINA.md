# Officina Software — il sistema

Come si porta un'idea a MVP qui dentro. Vale per ogni progetto, non solo per il primo.

L'obiettivo non è un sistema **infallibile**: è un sistema **contenibile**. Quando sbaglia, sbaglia in
piccolo, l'errore è visibile ed è reversibile. Tutto il resto è subordinato a questo.

## Le fasi

| Fase | Cosa produce | Chi guida |
|---|---|---|
| **0 — Idea → Spec** | `PRD.md`, `ARCHITECTURE.md`, `TASKS.md`, `IDEAS.md`, `CLAUDE.md` | Umano, intervistato |
| **1 — Scaffolding + harness** | Struttura e `verify` funzionante, **prima** della logica | Agente, con ⛔ |
| **2 — Build loop** | Un task per volta: planner → developer → `verify` → reviewer → commit | Agente |

Ogni fase finisce con un **cancello ⛔**: non si procede senza approvazione umana esplicita.

**Regola zero:** nessuna riga di codice prima che la Fase 0 sia approvata.

## Perché l'harness viene prima della logica

La Fase 1 esiste per una sola ragione: **serve un segnale pass/fail reale prima che il loop parta.**
Un agente che costruisce senza un verify affidabile non sta costruendo, sta accumulando debito
non misurato. La Fase 1 non è finita finché `lint`, `typecheck`, `test` e uno **smoke test che l'app
parta davvero** non girano da un comando unico.

## Il ciclo della Fase 2

1. **planner** scompone il task, se serve, in step con criteri di accettazione.
2. **developer** implementa, solo ciò che è nel task.
3. `verify`.
4. **reviewer**, indipendente dal developer: codice, criteri di accettazione, confini di modularità,
   dipendenze, scope.
5. Verde **e** reviewer approva → commit + push su `auto/build`.
   Rosso → il reviewer diagnostica, il developer corregge, si ripete.

Dopo **3 round senza progresso** sullo stesso task: stop ed escalation all'umano.

**Completamento:** tutti i task di `TASKS.md` fatti, `verify` verde, reviewer approva,
nessuno scope fuori da `TASKS.md`.

## I tre agenti

- **planner** — scompone, non scrive codice. Registra i miglioramenti in `IDEAS.md`. Modello forte.
- **developer** — implementa un task per volta, dentro lo scope. Modello economico.
- **reviewer** — indipendente dal developer, **ha potere di bocciare**. Modello forte.

L'indipendenza del reviewer è strutturale, non dichiarata: non ha strumenti di scrittura. Non può
aggiustare ciò che boccia, quindi non ha modo di scivolare nel ruolo di chi ha scritto il codice.

## Le tre reti su git

1. `permissions.deny` in `.claude/settings.json` — primo filtro
2. hook `PreToolUse` (`.claude/hooks/guard-git.py`) — blocca o escala all'umano
3. branch protection su `main`, lato GitHub — ultima rete, fuori dalla portata dell'agente

**Perché l'hook è in Python e non in PowerShell:** su questa macchina Python 3.12 è l'unico interprete
presente, e un `.py` non è soggetto all'ExecutionPolicy di PowerShell, che su una macchina Enterprise
gestita può essere imposta via GPO. Il freno deve funzionare proprio quando l'ambiente è restrittivo.

Le deny rules e l'hook **non si verificano leggendoli**: nella Fase 1 si prova a eseguire un comando
vietato e si controlla che venga fermato. Un freno non testato non è un freno.

## Osservabilità

`PROGRESS.md`, uno per progetto, aggiornato a ogni ciclo: cosa è stato fatto, cosa è fallito, perché,
quali decisioni sono state prese. Serve a ricostruire la storia senza rileggere i diff.

## Il canale proposte

Durante il lavoro nascono idee fuori dal task corrente: refactor, feature, scelte tecniche migliori,
debito da ripagare. **Non si implementano.** Si annotano in `IDEAS.md` e si prosegue.

Una proposta non ferma e non rallenta il task in corso. Non entra nello scope da sola: la approva
l'umano, e solo allora diventa un task con criteri di accettazione.

## Struttura

```
officina-software/
  .claude/
    settings.json
    agents/{planner,developer,reviewer}.md
    hooks/guard-git.py
    skills/                  ← istruzioni lunghe on-demand
  CLAUDE.md                  ← regole operative, vincolanti
  OFFICINA.md                ← questo file
  projects/
    <progetto>/
      PRD.md ARCHITECTURE.md TASKS.md IDEAS.md PROGRESS.md CLAUDE.md
      app/
```

Un solo repo git alla radice, con `main` protetto e `auto/build` come branch di lavoro.
