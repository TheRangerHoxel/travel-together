// Il motore di matching, sui confini.
//
// I fixture sono prodotti da builder che restituiscono oggetti NUOVI e CONGELATI
// a ogni chiamata. Il congelamento non e' decorativo: e' cio' che fa sollevare se
// la funzione prova a ordinare l'array in ingresso o a scrivere su un'offerta —
// il bug classico di questo tipo di codice, invisibile a qualunque asserzione sul
// solo risultato.

import type { MatchRequest, SeatOffer, TripRequest } from '../domain';
import { utc } from '../domain/instant-fixture';
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
    departureAt: utc('2026-11-03T06:00:00.000Z'),
    ...modifiche,
  });
}

function unOfferta(modifiche: Partial<SeatOffer> = {}): SeatOffer {
  return Object.freeze({
    tripId: 'trip-a',
    direction: 'outbound',
    ownerId: A,
    ownerPlantId: 'pomigliano',
    fromPlantId: 'pomigliano',
    toPlantId: 'foggia',
    departureAt: utc('2026-11-03T06:00:00.000Z'),
    seatsAvailable: 3,
    ...modifiche,
  });
}

function unaCandidatura(modifiche: Partial<MatchRequest> = {}): MatchRequest {
  return Object.freeze({
    id: 'req-1',
    tripId: 'trip-a',
    direction: 'outbound',
    requesterId: R,
    requesterTripId: 'trip-richiedente',
    status: 'pending',
    requestNote: null,
    resolutionNote: null,
    resolvedBy: null,
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

// =====================================================================
// BLOCCO DI NON-REGRESSIONE SU T03
//
// SEI vincoli che continuano a OMETTERE l'offerta, intatti dopo T04b:
// plant di partenza diverso, plant di destinazione diverso, data diversa,
// orario fuori finestra, seatsAvailable == 0, offerta del richiedente stesso.
//
// Piu' un SETTIMO criterio di T03 che e' di segno OPPOSTO e va contato a parte:
// l'orario esattamente al limite della finestra **deve essere un match**
// (confine incluso). Tenerlo nell'elenco degli omessi, o nasconderlo in una
// parentesi, conflaterebbe una regola che esclude con una che include.
//
// Sette in tutto, perche' i due criteri di T03 sulle candidature gia' esistenti
// sono stati EMENDATI il 13 ottobre 2026: ora l'offerta torna marcata invece di
// sparire (vedi TASKS.md, nota sopra i criteri di T03). Non erano nove su nove
// sbagliati: il requisito e' cambiato, l'implementazione era corretta.
//
// Questi test non sono stati riscritti da T04b: se uno cade, l'algoritmo e'
// cambiato e non doveva.
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
      [unOfferta({ departureAt: utc('2026-11-04T06:00:00.000Z') })],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('orario fuori dalla finestra: nessun match', () => {
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ departureAt: utc('2026-11-03T06:31:00.000Z') })],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('un solo secondo oltre il limite: nessun match', () => {
    // Smaschera chi tronca ai minuti interi: 30:01 passerebbe.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ departureAt: utc('2026-11-03T06:30:01.000Z') })],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('esattamente al limite, DOPO: e un match (confine incluso)', () => {
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ departureAt: utc('2026-11-03T06:30:00.000Z') })],
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
      [unOfferta({ departureAt: utc('2026-11-03T05:30:00.000Z') })],
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
      unaRichiesta({ departureAt: utc('2026-11-03T23:50:00.000Z') }),
      [unOfferta({ departureAt: utc('2026-11-04T00:10:00.000Z') })],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });

  // Rimosso in T07f: "un'offerta con offset invece di Z viene omessa". Lo stato
  // non e' piu' rappresentabile (un `SeatOffer` porta un `UtcInstant`); l'intenzione
  // — +01:00 non si confonde con Z — e' nei test di `normalizeUtcInstant`.
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

describe('stato della candidatura — le offerte tornano marcate, non omesse', () => {
  /** Lo stato attaccato alla prima offerta risultante, o undefined se non ce ne sono. */
  function statoDelPrimo(esito: ReturnType<typeof findMatches>) {
    expect(esito.ok).toBe(true);
    return esito.ok ? esito.value[0]?.requestStatus : undefined;
  }

  it('candidatura pending su quell offerta: l offerta TORNA, marcata pending', () => {
    // Cambiata in T04b: prima era "nessun match" (pending ometteva); ora l'offerta
    // si restituisce con lo stato attaccato.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta()],
      [unaCandidatura({ status: 'pending' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-a']);
    expect(statoDelPrimo(esito)).toBe('pending');
  });

  it('candidatura accepted su quell offerta: l offerta TORNA, marcata accepted', () => {
    // Cambiata in T04b: prima era "nessun match" (accepted ometteva).
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta()],
      [unaCandidatura({ status: 'accepted' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-a']);
    expect(statoDelPrimo(esito)).toBe('accepted');
  });

  it('candidatura rejected: l offerta torna MARCATA rejected', () => {
    // Cambiata in T04b: prima tornava "pulita" (proponibile); ora il rifiuto si
    // vede nella lista, con lo stato attaccato.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta()],
      [unaCandidatura({ status: 'rejected' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-a']);
    expect(statoDelPrimo(esito)).toBe('rejected');
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

  it('candidatura cancelled NON marca: lo stato e null, come se la riga non ci fosse', () => {
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta()],
      [unaCandidatura({ status: 'cancelled' })],
      TOL30
    );
    expect(statoDelPrimo(esito)).toBeNull();
  });

  it('senza candidature lo stato e null (mai candidato)', () => {
    const esito = findMatches(unaRichiesta(), [unOfferta()], [], TOL30);
    expect(statoDelPrimo(esito)).toBeNull();
  });

  it('posti esauriti VINCE sulla candidatura: accepted sull ultimo posto -> offerta OMESSA', () => {
    // Pinna la PRECEDENZA fra due criteri di T04b che tirano in direzioni opposte:
    // "seatsAvailable == 0 -> nessun match" (vincolo duro di T03, NON emendato) e
    // "la candidatura marca invece di filtrare". Vince il primo, e questo test
    // impedisce che qualcuno inverta l'ordine in find-matches.ts credendo di
    // "sistemare" la lista di chi si e' candidato: quella vista e' listByRequester
    // (T13), non questa. Senza questo test la precedenza non e' pinnata da niente,
    // perche' ogni altro caso ha i posti disponibili.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ seatsAvailable: 0 })],
      [unaCandidatura({ status: 'accepted' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual([]);
  });

  it('candidatura pending di UN ALTRO collega: l offerta resta visibile e NON marcata', () => {
    // Un filtro che ignorasse requesterId farebbe vedere a un collega lo stato di
    // un altro. Danno silenzioso e grave.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta()],
      [unaCandidatura({ requesterId: B, status: 'pending' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-a']);
    expect(statoDelPrimo(esito)).toBeNull();
  });

  it('candidatura pending su UN ALTRA offerta: non marca questa', () => {
    // Un filtro che ignorasse tripId marcherebbe tutte le offerte appena il
    // collega si candida una volta.
    const esito = findMatches(
      unaRichiesta(),
      [unOfferta({ tripId: 'trip-a' }), unOfferta({ tripId: 'trip-b', ownerId: B })],
      [unaCandidatura({ tripId: 'trip-a', status: 'pending' })],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-a', 'trip-b']);
    expect(esito.ok && esito.value.map((m) => m.requestStatus)).toEqual(['pending', null]);
  });

  it('la corrispondenza e per TRATTA: la candidatura sull andata non marca il ritorno', () => {
    // Stessa trasferta, stesso tripId, stesso richiedente: cambia solo la direzione.
    const esito = findMatches(
      unaRichiesta(),
      [
        unOfferta({ tripId: 'trip-x', direction: 'outbound' }),
        unOfferta({ tripId: 'trip-x', direction: 'return' }),
      ],
      [unaCandidatura({ tripId: 'trip-x', direction: 'outbound', status: 'pending' })],
      TOL30
    );
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.value.map((m) => [m.offer.direction, m.requestStatus])).toEqual([
      ['outbound', 'pending'],
      ['return', null],
    ]);
  });

  it('lo stato non entra nel punteggio: marcata o no, stesso score', () => {
    const libera = findMatches(unaRichiesta(), [unOfferta()], [], TOL30);
    const marcata = findMatches(
      unaRichiesta(),
      [unOfferta()],
      [unaCandidatura({ status: 'accepted' })],
      TOL30
    );
    expect(libera.ok && marcata.ok).toBe(true);
    if (libera.ok && marcata.ok) {
      expect(marcata.value[0]?.score).toBe(libera.value[0]?.score);
    }
  });
});
describe('vincoli duri — ingressi degeneri', () => {
  it('nessuna offerta: lista vuota, non errore', () => {
    const esito = findMatches(unaRichiesta(), [], [], TOL30);
    expect(idsDiMatch(esito)).toEqual([]);
  });

  // Rimosso in T07f: "istante della richiesta malformato: errore, non lista vuota".
  // Lo stato non e' piu' rappresentabile (un `TripRequest` porta un `UtcInstant`);
  // l'intenzione passa ai test di `normalizeUtcInstant`, dove si rifiuta.

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
        unOfferta({ tripId: 'trip-esatta', departureAt: utc('2026-11-03T06:00:00.000Z') }),
        unOfferta({ tripId: 'trip-vicina', departureAt: utc('2026-11-03T06:00:00.001Z'), ownerId: B }),
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
        unOfferta({ tripId: 'trip-lontana', departureAt: utc('2026-11-03T06:20:00.000Z') }),
        unOfferta({ tripId: 'trip-vicina', departureAt: utc('2026-11-03T06:05:00.000Z'), ownerId: B }),
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
          departureAt: utc('2026-11-03T06:30:00.000Z'),
        }),
      ],
      [],
      TOL30
    );
    expect(idsDiMatch(esito)).toEqual(['trip-stesso', 'trip-altrove']);
  });

  it('il punteggio e deterministico: due esecuzioni, stesso risultato', () => {
    const offerte = [
      unOfferta({ tripId: 'trip-a', departureAt: utc('2026-11-03T06:10:00.000Z') }),
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

  it('a parita di punteggio e di tripId decide la direzione: andata prima del ritorno, in ogni permutazione', () => {
    // Due tratte della STESSA trasferta con punteggio identico. Con tripId come
    // unica ultima chiave il comparatore tornerebbe 0 e l'ordine dipenderebbe
    // dall'input.
    const andata = unOfferta({ tripId: 'trip-x', direction: 'outbound' });
    const ritorno = unOfferta({ tripId: 'trip-x', direction: 'return' });

    const diritto = findMatches(unaRichiesta(), [andata, ritorno], [], TOL30);
    const rovescio = findMatches(unaRichiesta(), [ritorno, andata], [], TOL30);

    const direzioni = (e: typeof diritto) => (e.ok ? e.value.map((m) => m.offer.direction) : null);
    expect(direzioni(diritto)).toEqual(['outbound', 'return']);
    expect(direzioni(rovescio)).toEqual(['outbound', 'return']);
  });

  it('trasferta degenere (from == to): le due tratte matchano la stessa richiesta e restano in ordine totale', () => {
    // fromPlantId == toPlantId non e' un invariante di makeTrip ma una regola di
    // creazione di T04: e' raggiungibile. Le due tratte hanno stessi plant, stesso
    // orario, stesso tripId, quindi stesso punteggio: la classe di input su cui un
    // comparatore a sola chiave tripId ritorna 0.
    const richiesta = unaRichiesta({ fromPlantId: 'foggia', toPlantId: 'foggia' });
    const andata = unOfferta({
      tripId: 'trip-deg',
      direction: 'outbound',
      fromPlantId: 'foggia',
      toPlantId: 'foggia',
    });
    const ritorno = unOfferta({
      tripId: 'trip-deg',
      direction: 'return',
      fromPlantId: 'foggia',
      toPlantId: 'foggia',
    });

    const permutazioni = [
      [andata, ritorno],
      [ritorno, andata],
    ];
    for (const offerte of permutazioni) {
      const esito = findMatches(richiesta, offerte, [], TOL30);
      expect(esito.ok).toBe(true);
      if (!esito.ok) return;
      expect(esito.value).toHaveLength(2);
      expect(esito.value[0]?.score).toBe(esito.value[1]?.score);
      expect(esito.value.map((m) => m.offer.direction)).toEqual(['outbound', 'return']);
    }
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
          departureAt: utc('2026-11-03T06:10:00.000Z'),
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
      unOfferta({ tripId: 'trip-c', departureAt: utc('2026-11-03T06:20:00.000Z') }),
      unOfferta({ tripId: 'trip-a', ownerId: B }),
      unOfferta({ tripId: 'trip-b', ownerId: B, departureAt: utc('2026-11-03T06:10:00.000Z') }),
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
