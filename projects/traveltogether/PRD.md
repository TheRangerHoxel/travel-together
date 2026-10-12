# PRD — TravelTogether

**Versione:** 0.1 (Fase 0, in attesa di approvazione)
**Data:** 12/10/2026
**Natura dell'MVP:** demo dimostrabile per il pitch, su dati sintetici.

---

## Il problema

Nella BU Aerostrutture esistono trasferte ricorrenti tra plant — Pomigliano d'Arco, Foggia,
Grottaglie — e i dipendenti noleggiano auto **separatamente** per tratte e periodi sovrapposti.
Il risultato: noleggi duplicati, costi elevati, e nessuna visibilità su colleghi che si spostano
nello stesso momento verso la stessa destinazione.

Il problema non è la mancanza di buona volontà: è la **mancanza di informazione**. Nessuno sa che un
collega parte domani per lo stesso plant con tre posti liberi in auto.

## Cosa fa TravelTogether

Rende visibili le trasferte compatibili e permette di condividere l'auto.

1. Un dipendente dichiara una trasferta: plant di partenza, plant di destinazione, data, orario,
   durata. Se ha noleggiato un'auto, dichiara quanti **posti liberi** offre.
2. Un altro dipendente dichiara una trasferta compatibile e vede le offerte di passaggio disponibili,
   ordinate per quanto bene combaciano.
3. Si candida. Chi offre il posto **accetta o rifiuta**. Nessuno si trova un collega assegnato in auto.
4. A match accettato, l'app conta: un'auto in meno, giorni di noleggio risparmiati, euro risparmiati,
   CO₂ evitata.
5. Due dashboard mostrano l'impatto: una aziendale aggregata, una personale con badge.

Il valore non è il car sharing in sé: è **renderlo visibile nel momento in cui serve**, come
suggerimento volontario e non invasivo.

## Per chi

**Utente dell'MVP:** dipendenti Leonardo della BU Aerostrutture in trasferta tra i plant del pilota.
Popolazione chiusa: si entra con un **codice invito condiviso**.

**Nell'MVP sono dati sintetici.** Nessun dipendente reale, nessun dato personale vero. Questo è
deliberato: elimina il nodo GDPR e la necessità di un via libera IT, che bloccherebbero una demo.

**Destinatario del pitch:** chi decide se il pilota si fa. Per questo i KPI economici e di CO₂ sono
parte dell'MVP e non un extra: sono la risposta a "quanto ci fa risparmiare?".

## Il cuore: il motore di matching

Se manca questo, non c'è prodotto. Tutto il resto è contorno.

**Vincoli duri** — se uno non è soddisfatto, non è un match:
- stesso plant di partenza
- stesso plant di destinazione
- data di partenza compatibile
- orario di partenza entro una finestra di tolleranza configurabile
- posti disponibili > 0
- il richiedente non è l'offerente
- il richiedente non ha già una richiesta pendente o accettata su quell'offerta

**Punteggio morbido** — ordina i match validi, non li esclude:
- vicinanza dell'orario di partenza
- sovrapposizione della durata della trasferta (rientro compatibile)
- stesso plant di appartenenza

Il motore è una **funzione pura**: nessun I/O, nessuna rete, nessun orologio di sistema. È la scelta
che rende il pezzo più importante del prodotto anche il più verificabile.

## Metriche

**Dashboard aziendale:** trasferte registrate, match proposti, match accettati, auto evitate,
giorni di noleggio evitati, saving stimato in €, CO₂ evitata in kg.

**Dashboard personale:** viaggi condivisi, CO₂ evitata, saving generato, badge ottenuti.

Saving e CO₂ sono **stime da parametri configurabili** (costo noleggio/giorno, g CO₂/km, distanze tra
plant), non misure. L'app deve mostrarlo esplicitamente: una cifra presentata come misura e poi
smontata in sede di pitch fa più danno che non averla.

**Badge:** riconoscimenti simbolici sui traguardi personali (primo viaggio condiviso, N viaggi,
N kg di CO₂ evitati). Gamification, non premi.

---

## Fuori scope per l'MVP — esplicitamente

Queste cose **non si fanno**, e non sono dimenticanze:

| Fuori scope | Perché |
|---|---|
| **Integrazione SAP Concur** | Non otteniamo l'accesso. Le trasferte si inseriscono a mano nell'app. È il taglio più pesante: elimina il "suggerimento automatico dentro il workflow travel", che è il cuore della proposta originale. |
| **Integrazione Uvet / Hertz / provider noleggio** | Stesso motivo. |
| **"Travel Together Forest" / alberi piantati (Treedom)** | Richiede un partner esterno e un flusso di denaro reale: non è realizzabile da un'app in APK. |
| **Buoni welfare, punti convertibili, OneFlex** | Implica movimento di denaro e integrazione con piattaforme aziendali. I badge restano, perché sono simbolici. |
| **App iOS** | Apple Developer costa 99 $/anno ricorrenti. L'MVP è Android via APK. |
| **Pubblicazione su store** | Nessun costo e nessuna review: distribuzione come APK diretto. |
| **Notifiche push** | Non necessarie per una demo, e introducono infrastruttura. |
| **Chat in-app** | Il coordinamento dell'ultimo miglio si fa fuori dall'app. |
| **Mappe, geocodifica, percorsi reali** | Google Maps non è gratuito. I plant sono una lista chiusa e le distanze una tabella statica. |
| **Preferenza di matching per genere** | Dato particolarmente delicato sotto GDPR, e su dati sintetici non aggiunge nulla al valore dimostrato. → `IDEAS.md` |
| **Matching di gruppo** (il sistema accorpa più persone e decide chi noleggia) | Molto più complesso da verificare. Il modello dell'MVP è asimmetrico: chi ha l'auto offre posti. → `IDEAS.md` |
| **Multi-BU, multi-paese, scalabilità di Gruppo** | È la roadmap del documento, non l'MVP. |
| **Autenticazione aziendale reale (SSO, dominio email)** | L'MVP usa un codice invito. Un pilota vero richiederebbe un via libera privacy/IT. |

## Rischi dichiarati

1. **Il taglio di SAP svuota la novità principale.** La proposta originale vive sull'intercettazione
   automatica della richiesta auto. Inserendo le trasferte a mano, l'app dimostra che **il matching
   funziona**, non che si integra. Il pitch deve raccontare l'integrazione come passo successivo, non
   come cosa fatta.
2. **Un APK sideloaded non si installa su telefoni aziendali gestiti via MDM.** Se i destinatari della
   demo hanno device aziendali, serve un telefono personale o il tuo per mostrarla.
3. **Il progetto Supabase free va in pausa dopo 1 settimana di inattività.** Se dorme, l'app sul palco
   non risponde. Mitigazione: ping schedulato **più** un controllo manuale il giorno prima.
4. **"Demo con dati sintetici" e "trasferte inserite a mano" convivono male.** Con il DB vuoto, alla
   prima apertura non c'è nulla da matchare. Un seed di demo disattivabile risolve, ed è un task a sé.

## Definizione di successo dell'MVP

Su un telefono Android, con l'APK installato: si entra col codice invito, si crea una trasferta
Pomigliano → Foggia, si vede almeno un match proposto con il suo punteggio, si invia una candidatura,
si accetta da un secondo profilo, e le due dashboard mostrano l'auto evitata con saving e CO₂ coerenti.

Se questo percorso gira davanti a una persona, l'MVP ha fatto il suo lavoro.
