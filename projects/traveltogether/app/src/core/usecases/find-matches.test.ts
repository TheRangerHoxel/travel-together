// Il motore di matching, sui confini.
//
// I fixture sono prodotti da builder che restituiscono oggetti NUOVI e CONGELATI
// a ogni chiamata. Il congelamento non e' decorativo: e' cio' che fa sollevare se
// la funzione prova a ordinare l'array in ingresso o a scrivere su un'offerta —
// il bug classico di questo tipo di codice, invisibile a qualunque asserzione sul
// solo risultato.

import type { MatchRequest, SeatOffer, TripRequest } from '../domain';
import { findMatches } from './find-matches';
import type { MatchConfig } from './match-config';

const TOL30: MatchConfig = { toleranceMinutes: 30 };

const R = 'richiedente';
const A = 'collega-a';
const B = 'collega-b';

function unaRichiesta(modifiche: Partial<TripRequest> = {}): TripRequest {
  return Object.freeze({
    requesterId: R,
    requesterPlantId: 'pomigliano',
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    departureAt: '2026-11-03T06:00:00.000Z',
    ...modifiche,
  });
}

function unOfferta(modifiche: Partial<SeatOffer> = {}): SeatOffer {
  return Object.freeze({
    tripId: 'trip-a',
    ownerId: A,
    ownerPlantId: 'pomigliano',
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    departureAt: '2026-11-03T06:00:00.000Z',
    seatsAvailable: 3,
    ...modifiche,
  });
}

function unaCandidatura(modifiche: Partial<MatchRequest> = {}): MatchRequest {
  return Object.freeze({
    id: 'req-1',
    tripId: 'trip-a',
    requesterId: R,
    status: 'pending',
    ...modifiche,
  });
}

/** Gli id delle offerte risultanti, nell'ordine. Fallisce se la ricerca ha dato errore. */
function idsDiMatch(
  esito: ReturnType<typeof findMatches>
): readonly string[] {
  expect(esito.ok).toBe(true);
  if (!esito.ok) return [];
  return esito.value.map((m) => m.offer.tripId);
}

// =====================================================================
// VINCOLI DURI
// =====================================================================

describe('vincoli duri — tratta', () => {
  it('plant di partenza diverso: nessun match', () => {
    const esito = findMatches(unaRichiesta(), [unOfferta({ fromPlantId: 'foggia' })], [], TOL30);
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('plant di destinazione diverso: nessun match', () => {
    const esito = findMatches(unaRichiesta(), [unOfferta({ toPlantId: 'grottaglie' })], [], TOL30);
    expect(idsDiMatch(esito)).toEqual([]);
  });
});

describe('vincoli duri — tempo', () => {
  it('data diversa a parita di orario: nessun match', () => {
    // Il caso che smaschera un confronto fatto solo sull'ora del giorno: li' il
    // delta sarebbe zero e il punteggio massimo.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ departureAt: '2026-11-04T06:00:00.000Z' })],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('orario fuori dalla finestra: nessun match', () => {
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ departureAt: '2026-11-03T06:31:00.000Z' })],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('un solo secondo oltre il limite: nessun match', () => {
    // Smaschera chi tronca ai minuti interi: 30:01 passerebbe.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ departureAt: '2026-11-03T06:30:01.000Z' })],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('esattamente al limite, DOPO: e un match (confine incluso)', () => {
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ departureAt: '2026-11-03T06:30:00.000Z' })],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-a']);
  });

  it('esattamente al limite, PRIMA: e un match', () => {
    // Senza valore assoluto il delta sarebbe negativo e il confronto passerebbe
    // o cadrebbe per il motivo sbagliato.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ departureAt: '2026-11-03T05:30:00.000Z' })],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-a']);
  });

  it('una finestra che scavalca la mezzanotte UTC non esiste', () => {
    // Limite dichiarato del parser, messo sotto test perche' sia una decisione e
    // non un caso: chi un domani vorra' le finestre a cavallo della mezzanotte
    // dovra' far cadere questo test di proposito.
    const esito = findMatches(
      unaRichiesta({ departureAt: '2026-11-03T23:50:00.000Z' }),
      [unOfferta({ departureAt: '2026-11-04T00:10:00.000Z' })],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('un offerta con offset invece di Z viene omessa, non confrontata', () => {
    // Il caso piu' importante della suite: 07:00+01:00 E' le 06:00Z, cioe' lo
    // stesso istante della richiesta. Un parser permissivo la farebbe matchare
    // con delta zero, e sembrerebbe giusto.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ departureAt: '2026-11-03T07:00:00+01:00' })],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });
});

describe('vincoli duri — posti e identita', () => {
  it('zero posti disponibili: nessun match', () => {
    const esito = findMatches(unaRichiesta(), [unOfferta({ seatsAvailable: 0 })], [], TOL30);
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('un solo posto disponibile: e un match', () => {
    const esito = findMatches(unaRichiesta(), [unOfferta({ seatsAvailable: 1 })], [], TOL30);
    expect(idsDiMatch(esito)).toEqual(['trip-a']);
  });

  it('posti negativi: nessun match', () => {
    // Irraggiungibile per invariante di Trip, ma il ramo esiste: smaschera un
    // controllo scritto come `!== 0`.
    const esito = findMatches(unaRichiesta(), [unOfferta({ seatsAvailable: -1 })], [], TOL30);
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('un offerta del richiedente stesso: nessun match', () => {
    const esito = findMatches(unaRichiesta(), [unOfferta({ ownerId: R })], [], TOL30);
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('la stessa offerta di un altro collega: e un match', () => {
    // Controllo del test precedente. Senza, un `return []` secco li passerebbe
    // entrambi.
    const esito = findMatches(unaRichiesta(), [unOfferta({ ownerId: A })], [], TOL30);
    expect(idsDiMatch(esito)).toEqual(['trip-a']);
  });
});

describe('vincoli duri — candidature gia in corso', () => {
  it('candidatura pending su quell offerta: nessun match', () => {
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta()],
      [unaCandidatura({ status: 'pending' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('candidatura accepted su quell offerta: nessun match', () => {
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta()],
      [unaCandidatura({ status: 'accepted' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('candidatura rejected: l offerta torna proponibile', () => {
    // Smaschera un filtro scritto come "esiste una riga". Il PRD dice
    // "pendente o accettata", non "qualunque stato".
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta()],
      [unaCandidatura({ status: 'rejected' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-a']);
  });

  it('candidatura cancelled: l offerta torna proponibile', () => {
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta()],
      [unaCandidatura({ status: 'cancelled' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-a']);
  });

  it('candidatura pending di UN ALTRO collega: l offerta resta visibile', () => {
    // Un filtro che ignorasse requesterId permetterebbe a un collega di
    // nascondere un'offerta a tutti gli altri. Danno silenzioso e grave.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta()],
      [unaCandidatura({ requesterId: B, status: 'pending' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-a']);
  });

  it('candidatura pending su UN ALTRA offerta: non spegne questa', () => {
    // Un filtro che ignorasse tripId farebbe sparire tutti i match appena il
    // collega si candida una volta.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ tripId: 'trip-a' }), unOfferta({ tripId: 'trip-b', ownerId: B })],
      [unaCandidatura({ tripId: 'trip-a', status: 'pending' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-b']);
  });
});

describe('vincoli duri — ingressi degeneri', () => {
  it('nessuna offerta: lista vuota, non errore', () => {
    const esito = findMatches(unaRichiesta(), [], [], TOL30);
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('istante della richiesta malformato: errore, non lista vuota', () => {
    // "Non ho potuto cercare" e "nessun collega compatibile" sono due risposte
    // diverse. Confonderle significa mostrare in demo uno stato vuoto plausibile
    // al posto di un errore diagnosticabile.
    const esito = findMatches(
      unaRichiesta({ departureAt: '2026-11-03 06:00' }),
      [unOfferta()],
      [],
      TOL30
    );

    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.error.kind).toBe('invalid-request-departure-at');
    }
  });

  it('tolleranza non valida: errore esplicito', () => {
    // NaN e' il caso temuto: ogni confronto con NaN e' false, quindi senza
    // validazione TUTTI i match sparirebbero in silenzio.
    for (const toleranceMinutes of [-1, 0.5, NaN]) {
      const esito = findMatches(unaRichiesta(), [unOfferta()], [], { toleranceMinutes });

      expect(esito.ok).toBe(false);
      if (!esito.ok) {
        expect(esito.error.kind).toBe('invalid-tolerance');
      }
    }
  });

  it('tolleranza zero: solo il delta esattamente nullo', () => {
    const esito = findMatches(
      unaRichiesta(),
      [
        unOfferta({ tripId: 'trip-esatta', departureAt: '2026-11-03T06:00:00.000Z' }),
        unOfferta({ tripId: 'trip-vicina', departureAt: '2026-11-03T06:00:00.001Z', ownerId: B }),
      ],
      [],
      { toleranceMinutes: 0 }
    );
    expect(idsDiMatch(esito)).toEqual(['trip-esatta']);
  });
});

// =====================================================================
// PUNTEGGIO E ORDINAMENTO
// =====================================================================

describe('punteggio', () => {
  it('a parita di tutto, l orario piu vicino viene prima', () => {
    const esito = findMatches(
      unaRichiesta(),
      [
        unOfferta({ tripId: 'trip-lontana', departureAt: '2026-11-03T06:20:00.000Z' }),
        unOfferta({ tripId: 'trip-vicina', departureAt: '2026-11-03T06:05:00.000Z', ownerId: B }),
      ],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-vicina', 'trip-lontana']);
  });

  it('a parita di orario, lo stesso stabilimento viene prima', () => {
    const esito = findMatches(
      unaRichiesta(),
      [
        unOfferta({ tripId: 'trip-altrove', ownerPlantId: 'foggia' }),
        unOfferta({ tripId: 'trip-stesso', ownerPlantId: 'pomigliano', ownerId: B }),
      ],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-stesso', 'trip-altrove']);
  });

  it('lo stesso stabilimento vince ANCHE nel caso peggiore contro il migliore', () => {
    // Il test che pinna "precede" come enunciato senza condizioni: stesso plant
    // al limite della finestra contro plant diverso a delta zero. Con una somma
    // pesata configurabile questo si invertirebbe abbassando un numero.
    const esito = findMatches(
      unaRichiesta(),
      [
        unOfferta({ tripId: 'trip-altrove', ownerPlantId: 'foggia' }),
        unOfferta({
          tripId: 'trip-stesso',
          ownerPlantId: 'pomigliano',
          ownerId: B,
          departureAt: '2026-11-03T06:30:00.000Z',
        }),
      ],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-stesso', 'trip-altrove']);
  });

  it('il punteggio e deterministico: due esecuzioni, stesso risultato', () => {
    const offerte = [
      unOfferta({ tripId: 'trip-a', departureAt: '2026-11-03T06:10:00.000Z' }),
      unOfferta({ tripId: 'trip-b', ownerId: B, ownerPlantId: 'foggia' }),
    ];

    const prima = findMatches(unaRichiesta(), offerte, [], TOL30);
    const dopo = findMatches(unaRichiesta(), offerte, [], TOL30);

    expect(prima).toEqual(dopo);
  });

  it('a parita di punteggio l ordine NON dipende dall ordine di input', () => {
    // Due offerte con punteggio identico e tripId distinti, presentate nei due
    // ordini possibili. Con un sort solo stabile si scambierebbero: e' questo
    // test che distingue "ordine totale" da "sort stabile".
    const uno = unOfferta({ tripId: 'trip-aaa', ownerId: A });
    const due = unOfferta({ tripId: 'trip-bbb', ownerId: B });

    const diritto = findMatches(unaRichiesta(), [uno, due], [], TOL30);
    const rovescio = findMatches(unaRichiesta(), [due, uno], [], TOL30);

    expect(idsDiMatch(diritto)).toEqual(['trip-aaa', 'trip-bbb']);
    expect(idsDiMatch(rovescio)).toEqual(['trip-aaa', 'trip-bbb']);
  });

  it('il valore del punteggio e quello pinnato dalla formula', () => {
    // Fragile di proposito: la formula e' un contratto con T13, che ordina per
    // punteggio. Un cambio che la tocchi deve farsi notare qui.
    const esito = findMatches(
      unaRichiesta(),
      [
        unOfferta({ tripId: 'trip-perfetta' }),
        unOfferta({
          tripId: 'trip-lontana',
          ownerId: B,
          ownerPlantId: 'foggia',
          departureAt: '2026-11-03T06:10:00.000Z',
        }),
      ],
      [],
      TOL30
    );

    expect(esito.ok).toBe(true);
    if (!esito.ok) return;

    // finestra = 30 * 60_000 = 1_800_000; bonus = 1_800_001
    // perfetta: delta 0, stesso plant  -> 1_800_000 + 1_800_001 = 3_600_001
    // lontana:  delta 600_000, altrove -> 1_800_000 - 600_000   = 1_200_000
    expect(esito.value[0]?.score).toBe(3_600_001);
    expect(esito.value[0]?.millisApart).toBe(0);
    expect(esito.value[0]?.sameOwnerPlant).toBe(true);

    expect(esito.value[1]?.score).toBe(1_200_000);
    expect(esito.value[1]?.millisApart).toBe(600_000);
    expect(esito.value[1]?.sameOwnerPlant).toBe(false);
  });

  it('il match porta l offerta originale, non una copia parziale', () => {
    const offerta = unOfferta();
    const esito = findMatches(unaRichiesta(), [offerta], [], TOL30);

    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.value[0]?.offer).toBe(offerta);
  });
});

// =====================================================================
// PUREZZA
// =====================================================================

describe('purezza', () => {
  it('non ordina l array ricevuto in ingresso', () => {
    // I builder congelano, quindi un `offerte.sort(...)` solleverebbe in strict
    // mode. E' l'unico modo di vedere questo bug: nessuna asserzione sul solo
    // risultato lo rivelerebbe.
    const offerte = Object.freeze([
      unOfferta({ tripId: 'trip-c', departureAt: '2026-11-03T06:20:00.000Z' }),
      unOfferta({ tripId: 'trip-a', ownerId: B }),
      unOfferta({ tripId: 'trip-b', ownerId: B, departureAt: '2026-11-03T06:10:00.000Z' }),
    ]);

    const esito = findMatches(unaRichiesta(), offerte, [], TOL30);

    expect(idsDiMatch(esito)).toEqual(['trip-a', 'trip-b', 'trip-c']);
  });

  it('non muta richiesta, offerte e candidature', () => {
    // Il confronto e' con una copia profonda scattata PRIMA della chiamata: usare
    // la stessa reference confronterebbe un oggetto con se stesso e passerebbe
    // anche in caso di mutazione. E' l'errore trovato dal reviewer in T01.
    const richiesta = unaRichiesta();
    const offerte = [unOfferta(), unOfferta({ tripId: 'trip-b', ownerId: B })];
    const candidature = [unaCandidatura({ status: 'rejected' })];

    const primaRichiesta = structuredClone(richiesta);
    const primaOfferte = structuredClone(offerte);
    const primaCandidature = structuredClone(candidature);

    findMatches(richiesta, offerte, candidature, TOL30);

    expect(richiesta).toEqual(primaRichiesta);
    expect(offerte).toEqual(primaOfferte);
    expect(candidature).toEqual(primaCandidature);
  });
});
