# TravelTogether — convenzioni di progetto

Valgono **insieme** alle regole dell'officina in [../../CLAUDE.md](../../CLAUDE.md), che restano
prioritarie. Qui c'è solo ciò che è specifico di questo progetto.

Contesto del prodotto: [PRD.md](PRD.md) · Architettura: [ARCHITECTURE.md](ARCHITECTURE.md) ·
Backlog: [TASKS.md](TASKS.md) · Proposte: [IDEAS.md](IDEAS.md) · Diario: [PROGRESS.md](PROGRESS.md)

## Cos'è questo MVP

Una **demo per il pitch** su dati sintetici, non un prodotto in produzione. Nessun dato personale
reale, mai. Se un task sembra richiedere dati di una persona vera, è un errore nel task: fermati.

## Stack

Expo (React Native) + TypeScript · Supabase (Postgres + Auth + RLS) · jest + jest-expo · eslint

## Confini — imposti dal lint, non negoziabili

```
ui/  →  core/usecases/  →  core/ports/  ←  adapters/
```

- `core/` **non** importa `adapters/` né `ui/`
- `ui/` **non** importa `adapters/`: passa sempre dagli usecase
- `core/` **non** usa `new Date()` né alcun membro di `Date` (`Date.now`, `Date.parse`, `Date.UTC`…),
  test compresi: il tempo entra dal port `Clock`. Per convenzione, non per lint, gli istanti si
  leggono solo con `normalizeUtcInstant`
- `core/` **non** importa `@supabase/supabase-js`, né rete, né filesystem

Violarli fa fallire `verify`. Se un task sembra richiedere di violarli, quasi sempre **manca un port**:
proponi l'interfaccia, non la scorciatoia.

## Convenzioni di codice

- TypeScript `strict` con `noUncheckedIndexedAccess`. Nessun `any`, nessun `as` per zittire il compilatore.
- Gli stati sono union di letterali, non `string`.
- Gli errori di dominio sono **tipi di ritorno**, non eccezioni: un usecase che può fallire lo dichiara
  nella firma.
- Niente valori magici nella logica: soglie, costi, tolleranze e distanze stanno in `config/`.
  Un KPI che cambia modificando `config` è la prova che non è hardcoded.
- Nomi di dominio in inglese nel codice (`Trip`, `SeatOffer`), testi utente in italiano.

## Test

- La logica in `core/` si testa **senza rete e senza mock di Supabase**: si usa l'adapter `memory`.
- Gli adapter si verificano con una **suite di contratto condivisa**: la stessa suite deve passare su
  `memory` e su `supabase`, senza modifiche. Se va adattata per uno dei due, il port è sbagliato.
- Sui vincoli numerici si testano **i confini**, non solo il centro: zero posti, un posto, orario
  esattamente al limite della finestra di tolleranza.
- `test:int` senza credenziali **fallisce**. Non si salta, non si marca skip.

## Dati e sicurezza

- Chiavi Supabase, codice invito e parametri di `config` arrivano da `.env`, iniettati. **Mai nel codice**,
  nemmeno nei test, nei commenti o nei file di esempio.
- `.env.example` elenca i nomi delle variabili con valori finti.
- **RLS attiva su ogni tabella**, anche nella demo: una struttura con RLS permissive verrebbe portata
  così com'è in un eventuale pilota con dati veri.
- La `service_role` key serve solo alle migrazioni, non entra mai nell'app.

## Numeri mostrati all'utente

Saving € e CO₂ sono **stime da parametri configurabili**, non misure. Le schermate devono dirlo.
Una cifra presentata come misura e poi smontata in sede di pitch fa più danno che non averla.

I badge sono simbolici. Nessun premio, nessun buono, nessun denaro: welfare e alberi piantati sono
fuori scope per decisione dell'umano.
