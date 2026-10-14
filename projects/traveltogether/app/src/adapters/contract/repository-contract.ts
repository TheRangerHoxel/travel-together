// Suite di contratto: UNA sola definizione del comportamento che ogni adapter deve
// avere, eseguita identica su memory e (da T09) su supabase.
//
// Perche' condivisa e non duplicata: se le due suite fossero due file, divergerebbero.
// La regola e' che questo file non si tocca per far passare un adapter. Se va
// adattato per uno dei due, **il port e' sbagliato** — e' il segnale che l'astrazione
// sta perdendo (ARCHITECTURE.md § Test).
//
// Non e' un file di test: niente suffisso .test.ts, quindi jest non lo raccoglie da
// solo. Lo invoca il test di ciascun adapter.
//
// ---
// Cosa l'ambiente deve fornire, e perche' ogni voce esiste. Sono i punti in cui RAM
// e Postgres differiscono per NATURA: nasconderli qui e' cio' che permette alle
// asserzioni di restare le stesse.
//
//  - autenticazione: con le RLS attive (obbligatorie), un adapter Supabase non
//    autenticato vedrebbe ogni scrittura respinta. In RAM e' un no-op.
//  - id: 'trip-1' non e' inseribile in una colonna uuid, e un id malformato su
//    Postgres non da' not-found ma un errore di sintassi. Li fornisce l'ambiente.
//  - provisioning dei profili: su Supabase nascono da auth.users, non da una insert
//    del client. Non e' un'operazione del port.
//  - teardown: in RAM bastano oggetti nuovi; su uno staging condiviso le righe
//    restano e i test si contaminano — e listOpenOffers, che non filtra, vedrebbe
//    i residui di tutti i casi precedenti.

import type {
  LegDirection,
  MatchRequest,
  MatchRequestId,
  PlantId,
  ProfileId,
  Trip,
  TripId,
} from '../../core/domain';
import type {
  MatchRequestRepository,
  ProfileRepository,
  SessionGateway,
  TripRepository,
} from '../../core/ports';

export interface AmbienteDiContratto {
  readonly trips: TripRepository;
  readonly matchRequests: MatchRequestRepository;
  readonly profiles: ProfileRepository;
  readonly sessions: SessionGateway;

  /** Autentica le chiamate successive come quel profilo. No-op in RAM. */
  comeUtente(profileId: ProfileId): Promise<void>;

  /** Crea un profilo e ne ritorna l'id. Amministrazione, non operazione del port. */
  creaProfilo(dati: { displayName: string; plantId: PlantId }): Promise<ProfileId>;

  /** Id di forma valida per lo storage sottostante, non ancora usati. */
  nuovoTripId(): TripId;
  nuovoMatchRequestId(): MatchRequestId;
  /** Id di forma VALIDA ma inesistente: serve a provare il ramo not-found. */
  idInesistente(): ProfileId;

  registraCodiceInvito(codice: string, profileId: ProfileId): Promise<void>;
  disattivaCodiceInvito(codice: string): Promise<void>;

  /**
   * Abbassa il limite delle note applicato dall'adapter DOPO le scritture gia'
   * fatte. Serve a provare che il limite vale in scrittura e non in lettura: una
   * nota scritta sotto un limite piu' alto non diventa illeggibile quando scende.
   *
   * **Su Supabase NON e' un no-op, e scriverlo come tale romperebbe la suite.**
   * Il doc del port impone che `save` validi con `makeMatchRequest` prima di
   * scrivere, e `makeMatchRequest` richiede un `NoteConfig`: quindi l'adapter
   * Supabase lo ricevera' iniettato esattamente come quello memory, e l'hook si
   * implementa allo stesso modo — mutando l'oggetto iniettato.
   * Se a T09 diventasse un no-op succederebbero due cose, e nessuna delle due
   * sarebbe colpa del port: il test "si rilegge dopo l'abbassamento" diventerebbe
   * **vacuo** (il limite non scende mai, quindi la rilettura riesce banalmente) e il
   * test "la scrittura resta rifiutata" diventerebbe **rosso** (col limite ancora a
   * 280 una nota di 11 caratteri si salva benissimo). Si finirebbe ad "adattare la
   * suite", che per ARCHITECTURE.md e' il segnale che il port e' sbagliato — mentre
   * qui sarebbe sbagliato solo questo commento.
   */
  abbassaLimiteNote(maxLength: number): Promise<void>;

  /**
   * Scrive una candidatura SENZA validarla, bypassando `save`: riproduce uno storage
   * che contiene gia' una riga invalida (migrazione, query a mano). Non e' un'
   * operazione del port. Su Supabase sara' una insert con credenziali di servizio.
   */
  seminaCandidaturaGrezza(request: MatchRequest): Promise<void>;
  /** Riporta lo storage allo stato vuoto. */
  pulisci(): Promise<void>;
}

/**
 * @param nome etichetta dell'adapter sotto esame, finisce nel nome dei test
 * @param creaAmbiente deve restituire un ambiente pronto all'uso
 */
export function eseguiSuiteDiContratto(
  nome: string,
  creaAmbiente: () => Promise<AmbienteDiContratto>
): void {
  describe(`contratto dei port — adapter ${nome}`, () => {
    let amb: AmbienteDiContratto;
    let owner: ProfileId;

    beforeEach(async () => {
      amb = await creaAmbiente();
      await amb.pulisci();
      owner = await amb.creaProfilo({ displayName: 'Collega Fittizio', plantId: 'pomigliano' });
      await amb.comeUtente(owner);
    });

    afterEach(async () => {
      await amb.pulisci();
    });

    /** Trasferta valida di default. Ogni test cambia solo il campo che prova. */
    function unaTrasferta(id: TripId, modifiche: Partial<Trip> = {}): Trip {
      return {
        id,
        ownerId: owner,
        fromPlantId: 'pomigliano',
        toPlantId: 'foggia',
        departureAt: '2026-11-03T06:30:00.000Z',
        returnAt: '2026-11-05T16:00:00.000Z',
        hasCar: true,
        seatsTotal: 3,
        seatsAvailable: 3,
        status: 'published',
        ...modifiche,
      };
    }

    /** Salva e pretende che sia andata bene: un setup fallito non deve passare per verde. */
    async function salvaTrasferta(trip: Trip): Promise<void> {
      const esito = await amb.trips.save(trip);
      expect(esito.ok).toBe(true);
    }

    async function salvaCandidatura(request: MatchRequest): Promise<void> {
      const esito = await amb.matchRequests.save(request);
      expect(esito.ok).toBe(true);
    }

    describe('ProfileRepository', () => {
      it('rilegge un profilo creato', async () => {
        const esito = await amb.profiles.findById(owner);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.displayName).toBe('Collega Fittizio');
          expect(esito.value.plantId).toBe('pomigliano');
        }
      });

      it('su id inesistente ritorna not-found, non solleva', async () => {
        const esito = await amb.profiles.findById(amb.idInesistente());

        expect(esito.ok).toBe(false);
        if (!esito.ok) {
          expect(esito.error.kind).toBe('not-found');
        }
      });

      it('listByIds omette gli id sconosciuti invece di fallire', async () => {
        const altro = await amb.creaProfilo({ displayName: 'Altro', plantId: 'foggia' });

        const esito = await amb.profiles.listByIds([owner, amb.idInesistente(), altro]);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect([...esito.value.map((p) => p.id)].sort()).toEqual([owner, altro].sort());
        }
      });

      it('listByIds su lista vuota ritorna lista vuota', async () => {
        const esito = await amb.profiles.listByIds([]);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value).toEqual([]);
        }
      });
    });

    describe('TripRepository', () => {
      it('rilegge una trasferta salvata', async () => {
        const id = amb.nuovoTripId();
        await salvaTrasferta(unaTrasferta(id));

        const esito = await amb.trips.findById(id);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.seatsAvailable).toBe(3);
          expect(esito.value.fromPlantId).toBe('pomigliano');
        }
      });

      it('save e un upsert: salvare due volte lo stesso id sostituisce', async () => {
        const id = amb.nuovoTripId();
        await salvaTrasferta(unaTrasferta(id, { seatsAvailable: 3 }));
        await salvaTrasferta(unaTrasferta(id, { seatsAvailable: 2 }));

        const esito = await amb.trips.findById(id);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.seatsAvailable).toBe(2);
        }
      });

      it('save rifiuta un record invalido e NON lo scrive', async () => {
        // Un dato invalido che arriva dallo storage non e' meno invalido di uno
        // scritto a mano: il confine di validazione e' la scrittura.
        const id = amb.nuovoTripId();

        const esito = await amb.trips.save(unaTrasferta(id, { seatsTotal: 2, seatsAvailable: 5 }));

        expect(esito.ok).toBe(false);
        if (!esito.ok) {
          expect(esito.error.kind).toBe('invalid-record');
        }

        // Senza questa seconda meta', un save che rifiuta ma scrive comunque
        // passerebbe il test. L'ordine giusto e' validare prima di scrivere, ed
        // e' il genere di cosa che si inverte senza accorgersene.
        const riletto = await amb.trips.findById(id);
        expect(riletto.ok).toBe(false);
        if (!riletto.ok) {
          expect(riletto.error.kind).toBe('not-found');
        }
      });

      it('due letture ritornano oggetti indipendenti, non la stessa reference', async () => {
        // Lo storage vero costruisce un oggetto nuovo a ogni lettura. L'adapter in
        // RAM deve fare lo stesso: se restituisse la propria istanza interna, un
        // chiamante potrebbe alterarne lo stato.
        // Si asserisce sull'IDENTITA' e non sulla mutazione perche' i campi di Trip
        // sono readonly: mutarli richiederebbe un cast, vietato dalle convenzioni, e
        // un test che non puo' compiere l'azione che vuole escludere non prova nulla.
        const id = amb.nuovoTripId();
        await salvaTrasferta(unaTrasferta(id));

        const prima = await amb.trips.findById(id);
        const dopo = await amb.trips.findById(id);

        expect(prima.ok && dopo.ok).toBe(true);
        if (prima.ok && dopo.ok) {
          expect(prima.value).toEqual(dopo.value);
          expect(prima.value).not.toBe(dopo.value);
        }
      });

      it('findById su id inesistente ritorna not-found', async () => {
        const esito = await amb.trips.findById(amb.idInesistente());

        expect(esito.ok).toBe(false);
        if (!esito.ok) {
          expect(esito.error.kind).toBe('not-found');
        }
      });

      it('listByOwner ritorna solo le trasferte di quel collega', async () => {
        const altro = await amb.creaProfilo({ displayName: 'Altro', plantId: 'foggia' });
        const mia = amb.nuovoTripId();
        const sua = amb.nuovoTripId();

        await salvaTrasferta(unaTrasferta(mia, { ownerId: owner }));
        await amb.comeUtente(altro);
        await salvaTrasferta(unaTrasferta(sua, { ownerId: altro }));
        await amb.comeUtente(owner);

        const esito = await amb.trips.listByOwner(owner);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.map((t) => t.id)).toEqual([mia]);
        }
      });

      it('listByOwner senza trasferte ritorna lista vuota, non errore', async () => {
        const esito = await amb.trips.listByOwner(owner);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value).toEqual([]);
        }
      });

      it('listOpenOffers riporta il plant del PROFILO di chi offre, non quello di partenza', async () => {
        // Il caso che conta: chi offre appartiene a Foggia ma parte da Pomigliano.
        // Se l'adapter ripiegasse sul plant di partenza, ownerPlantId sarebbe
        // 'pomigliano' e il punteggio di T03 ("stesso plant di appartenenza
        // precede") classificherebbe sulla base di un dato inventato.
        const pendolare = await amb.creaProfilo({ displayName: 'Pendolare', plantId: 'foggia' });
        await amb.comeUtente(pendolare);

        const id = amb.nuovoTripId();
        await salvaTrasferta(
          unaTrasferta(id, { ownerId: pendolare, fromPlantId: 'pomigliano' })
        );

        const esito = await amb.trips.listOpenOffers();

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          const offerta = esito.value.find((o) => o.tripId === id && o.direction === 'outbound');
          expect(offerta?.ownerPlantId).toBe('foggia');
          expect(offerta?.fromPlantId).toBe('pomigliano');
        }
      });

      it('listOpenOffers esclude le offerte senza posti liberi, ma la trasferta resta', async () => {
        const id = amb.nuovoTripId();
        await salvaTrasferta(unaTrasferta(id, { seatsTotal: 3, seatsAvailable: 0 }));

        // Si dimostra che la riga esiste: altrimenti il test sarebbe verde anche
        // se il salvataggio fosse fallito, cioe' verde perche' rotto.
        const scritta = await amb.trips.findById(id);
        expect(scritta.ok).toBe(true);

        const esito = await amb.trips.listOpenOffers();
        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.map((o) => o.tripId)).not.toContain(id);
        }
      });

      it('listOpenOffers include il confine: un solo posto libero', async () => {
        const id = amb.nuovoTripId();
        await salvaTrasferta(unaTrasferta(id, { seatsTotal: 3, seatsAvailable: 1 }));

        const esito = await amb.trips.listOpenOffers();

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          const offerta = esito.value.find((o) => o.tripId === id && o.direction === 'outbound');
          expect(offerta?.seatsAvailable).toBe(1);
        }
      });

      it('listOpenOffers esclude le trasferte annullate, ma la trasferta resta', async () => {
        const id = amb.nuovoTripId();
        await salvaTrasferta(unaTrasferta(id, { status: 'cancelled' }));

        const scritta = await amb.trips.findById(id);
        expect(scritta.ok).toBe(true);

        const esito = await amb.trips.listOpenOffers();
        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.map((o) => o.tripId)).not.toContain(id);
        }
      });

      describe('listOpenOffers a tratte', () => {
        /** Le offerte di UNA trasferta, per direzione. */
        async function offerteDi(id: TripId) {
          const esito = await amb.trips.listOpenOffers();
          expect(esito.ok).toBe(true);
          return esito.ok ? esito.value.filter((o) => o.tripId === id) : [];
        }

        it('con auto e rientro produce DUE offerte: andata e ritorno con plant invertiti', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id));

          const offerte = await offerteDi(id);
          const andata = offerte.find((o) => o.direction === 'outbound');
          const ritorno = offerte.find((o) => o.direction === 'return');

          expect(offerte).toHaveLength(2);
          expect(andata?.fromPlantId).toBe('pomigliano');
          expect(andata?.toPlantId).toBe('foggia');
          expect(andata?.departureAt).toBe('2026-11-03T06:30:00.000Z');
          expect(ritorno?.fromPlantId).toBe('foggia');
          expect(ritorno?.toPlantId).toBe('pomigliano');
          expect(ritorno?.departureAt).toBe('2026-11-05T16:00:00.000Z');
        });

        it('con auto e senza rientro produce UNA sola offerta', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id, { returnAt: null }));

          const offerte = await offerteDi(id);

          expect(offerte.map((o) => o.direction)).toEqual(['outbound']);
        });

        it('senza auto non produce nessuna offerta', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(
            unaTrasferta(id, { hasCar: false, seatsTotal: 0, seatsAvailable: 0 })
          );

          expect(await offerteDi(id)).toEqual([]);
        });

        it('il filtro dei posti e PER TRATTA: andata esaurita, ritorno libero, una sola offerta', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id));
          await amb.trips.adjustLegSeats(id, 'outbound', -3);

          const offerte = await offerteDi(id);

          expect(offerte.map((o) => o.direction)).toEqual(['return']);
        });

        it('i posti dell offerta vengono dalla tratta, non da Trip.seatsAvailable', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id));
          await amb.trips.adjustLegSeats(id, 'outbound', -1);

          const offerte = await offerteDi(id);

          expect(offerte.find((o) => o.direction === 'outbound')?.seatsAvailable).toBe(2);
          expect(offerte.find((o) => o.direction === 'return')?.seatsAvailable).toBe(3);
        });

        it('la trasferta degenere (from == to) produce comunque due offerte distinte', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id, { fromPlantId: 'foggia', toPlantId: 'foggia' }));

          const offerte = await offerteDi(id);

          expect(offerte.map((o) => o.direction).sort()).toEqual(['outbound', 'return']);
        });
      });

      describe('tratte (TripLeg)', () => {
        it('con auto, 3 posti e rientro: ENTRAMBE le tratte hanno 3 posti', async () => {
          // 3 su ciascuna tratta, non 3 in tutto.
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id, { seatsTotal: 3, seatsAvailable: 3 }));

          const andata = await amb.trips.findLeg(id, 'outbound');
          const ritorno = await amb.trips.findLeg(id, 'return');

          expect(andata.ok && ritorno.ok).toBe(true);
          if (andata.ok && ritorno.ok) {
            expect(andata.value.seatsAvailable).toBe(3);
            expect(ritorno.value.seatsAvailable).toBe(3);
            expect(andata.value.seatsTotal).toBe(3);
            expect(ritorno.value.seatsTotal).toBe(3);
          }
        });

        it('senza rientro esiste la sola andata', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id, { returnAt: null }));

          const andata = await amb.trips.findLeg(id, 'outbound');
          const ritorno = await amb.trips.findLeg(id, 'return');

          expect(andata.ok).toBe(true);
          expect(ritorno.ok).toBe(false);
          if (!ritorno.ok) {
            expect(ritorno.error.kind).toBe('not-found');
          }
        });

        it('senza auto non esiste nessuna tratta', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(
            unaTrasferta(id, { hasCar: false, seatsTotal: 0, seatsAvailable: 0 })
          );

          const andata = await amb.trips.findLeg(id, 'outbound');
          const ritorno = await amb.trips.findLeg(id, 'return');

          expect(andata.ok).toBe(false);
          expect(ritorno.ok).toBe(false);
        });

        it('scritto l andata a 2, la rilettura da andata 2 e ritorno 3', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id));

          const scritta = await amb.trips.adjustLegSeats(id, 'outbound', -1);
          expect(scritta.ok).toBe(true);

          const andata = await amb.trips.findLeg(id, 'outbound');
          const ritorno = await amb.trips.findLeg(id, 'return');
          expect(andata.ok && ritorno.ok).toBe(true);
          if (andata.ok && ritorno.ok) {
            expect(andata.value.seatsAvailable).toBe(2);
            expect(ritorno.value.seatsAvailable).toBe(3);
          }
        });

        it('il contatore non scende sotto zero: il confine 0 e valido, -1 e rifiutato', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id, { seatsTotal: 3, seatsAvailable: 3 }));

          const azzerata = await amb.trips.adjustLegSeats(id, 'outbound', -3);
          expect(azzerata.ok).toBe(true);

          const sotto = await amb.trips.adjustLegSeats(id, 'outbound', -1);
          expect(sotto.ok).toBe(false);
          if (!sotto.ok) {
            expect(sotto.error.kind).toBe('invalid-record');
          }

          const riletta = await amb.trips.findLeg(id, 'outbound');
          expect(riletta.ok && riletta.value.seatsAvailable).toBe(0);
        });

        it('il contatore non supera i totali: il confine e valido, +1 e rifiutato', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id, { seatsTotal: 3, seatsAvailable: 3 }));

          const sopra = await amb.trips.adjustLegSeats(id, 'outbound', 1);
          expect(sopra.ok).toBe(false);
          if (!sopra.ok) {
            expect(sopra.error.kind).toBe('invalid-record');
          }

          await amb.trips.adjustLegSeats(id, 'outbound', -1);
          const alTetto = await amb.trips.adjustLegSeats(id, 'outbound', 1);
          expect(alTetto.ok && alTetto.value.seatsAvailable).toBe(3);
        });

        it('adjustLegSeats su una tratta inesistente ritorna not-found', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id, { returnAt: null }));

          const esito = await amb.trips.adjustLegSeats(id, 'return', -1);

          expect(esito.ok).toBe(false);
          if (!esito.ok) {
            expect(esito.error.kind).toBe('not-found');
          }
        });

        it('un save rifiutato non scrive nemmeno le tratte', async () => {
          const id = amb.nuovoTripId();
          await amb.trips.save(unaTrasferta(id, { seatsTotal: 2, seatsAvailable: 5 }));

          const andata = await amb.trips.findLeg(id, 'outbound');

          expect(andata.ok).toBe(false);
        });

        it('risalvare la trasferta PRESERVA il contatore di tratta gia scritto', async () => {
          // Il test che fallisce se save azzera i posti in silenzio: l'andata e'
          // a 2 dopo un'accettazione, e risalvare la stessa trasferta (che porta
          // ancora seatsAvailable = 3) non deve riportarla a 3.
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id));
          await amb.trips.adjustLegSeats(id, 'outbound', -1);

          await salvaTrasferta(unaTrasferta(id));

          const andata = await amb.trips.findLeg(id, 'outbound');
          const ritorno = await amb.trips.findLeg(id, 'return');
          expect(andata.ok && ritorno.ok).toBe(true);
          if (andata.ok && ritorno.ok) {
            expect(andata.value.seatsAvailable).toBe(2);
            expect(ritorno.value.seatsAvailable).toBe(3);
          }
        });

        it('risalvare senza rientro elimina il ritorno e preserva l andata', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id));
          await amb.trips.adjustLegSeats(id, 'outbound', -1);

          await salvaTrasferta(unaTrasferta(id, { returnAt: null }));

          const andata = await amb.trips.findLeg(id, 'outbound');
          const ritorno = await amb.trips.findLeg(id, 'return');
          expect(andata.ok && andata.value.seatsAvailable).toBe(2);
          expect(ritorno.ok).toBe(false);
        });

        it('risalvare senza auto elimina tutte le tratte', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id));

          await salvaTrasferta(unaTrasferta(id, { hasCar: false, seatsTotal: 0, seatsAvailable: 0 }));

          expect((await amb.trips.findLeg(id, 'outbound')).ok).toBe(false);
          expect((await amb.trips.findLeg(id, 'return')).ok).toBe(false);
        });

        it('aggiungere il rientro crea il ritorno ai posti della trasferta, senza toccare l andata', async () => {
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id, { returnAt: null }));
          await amb.trips.adjustLegSeats(id, 'outbound', -1);

          await salvaTrasferta(unaTrasferta(id));

          const andata = await amb.trips.findLeg(id, 'outbound');
          const ritorno = await amb.trips.findLeg(id, 'return');
          expect(andata.ok && andata.value.seatsAvailable).toBe(2);
          expect(ritorno.ok && ritorno.value.seatsAvailable).toBe(3);
        });

        it('un save che renderebbe il contatore preservato incoerente col totale e rifiutato', async () => {
          // Andata a 3 posti liberi, poi si risalva con un'auto da 2: il contatore
          // preservato (3) supera il nuovo totale. Rifiuto, e nulla cambia.
          const id = amb.nuovoTripId();
          await salvaTrasferta(unaTrasferta(id, { seatsTotal: 3, seatsAvailable: 3 }));

          const esito = await amb.trips.save(unaTrasferta(id, { seatsTotal: 2, seatsAvailable: 2 }));

          expect(esito.ok).toBe(false);
          if (!esito.ok) {
            expect(esito.error.kind).toBe('invalid-record');
          }
          const andata = await amb.trips.findLeg(id, 'outbound');
          expect(andata.ok && andata.value.seatsTotal).toBe(3);
        });
      });
    });

    describe('MatchRequestRepository', () => {
      let offerta: TripId;
      let richiedente: ProfileId;

      beforeEach(async () => {
        offerta = amb.nuovoTripId();
        await salvaTrasferta(unaTrasferta(offerta));
        richiedente = await amb.creaProfilo({ displayName: 'Richiedente', plantId: 'foggia' });
      });

      /**
       * Candidatura scritta DALL'IDENTITA' che possiedera' la riga.
       *
       * Non e' pedanteria: su Postgres la policy di insert sensata su
       * match_requests e' `requester_id = auth.uid()`, altrimenti chiunque
       * potrebbe forgiare candidature a nome di un collega. Una suite che scrive
       * tutto come un unico utente costringerebbe, a T09, o a modificarla (e il
       * criterio dice "senza modifiche") o ad allentare la policy per farla
       * passare — che e' il modo in cui nascono le fughe di dati.
       */
      async function candidaturaDi(
        requesterId: ProfileId,
        id: MatchRequestId,
        tripId: TripId = offerta,
        direction: LegDirection = 'outbound'
      ): Promise<void> {
        await amb.comeUtente(requesterId);
        await salvaCandidatura(unaCandidatura(requesterId, id, tripId, direction));
      }

      /** Candidatura aperta di default: nota assente, nessuna risoluzione. */
      function unaCandidatura(
        requesterId: ProfileId,
        id: MatchRequestId,
        tripId: TripId,
        direction: LegDirection,
        modifiche: Partial<MatchRequest> = {}
      ): MatchRequest {
        return {
          id,
          tripId,
          direction,
          requesterId,
          requesterTripId: `trip-di-${requesterId}`,
          status: 'pending',
          requestNote: null,
          resolutionNote: null,
          resolvedBy: null,
          ...modifiche,
        };
      }

      it('rilegge una candidatura salvata', async () => {
        const id = amb.nuovoMatchRequestId();
        await candidaturaDi(richiedente, id);

        const esito = await amb.matchRequests.findById(id);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.status).toBe('pending');
        }
      });

      it('requesterTripId sopravvive a scrittura e rilettura', async () => {
        // Il KPI aziendale (T06) conta sulla trasferta del richiedente: se l'adapter
        // perdesse il campo, tornerebbe l'indovinello per plant e giorno.
        const id = amb.nuovoMatchRequestId();
        await amb.comeUtente(richiedente);
        await salvaCandidatura(
          unaCandidatura(richiedente, id, offerta, 'outbound', {
            requesterTripId: 'trasferta-del-richiedente',
          })
        );

        const esito = await amb.matchRequests.findById(id);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.requesterTripId).toBe('trasferta-del-richiedente');
        }
      });

      it('save e un upsert anche sulle candidature: cambia stato, stesso id', async () => {
        // E' il meccanismo su cui poggia un criterio di T05 ("una richiesta gia'
        // accepted non puo' essere accettata di nuovo"): se save fosse una insert,
        // quel passaggio di stato fallirebbe invece di aggiornare.
        //
        // La transizione provata e' pending -> cancelled, NON pending -> accepted,
        // ed e' deliberato: accettare spetta solo a chi offre (T05, "un altro
        // utente riceve errore"), quindi scrivere accepted dall'identita' del
        // richiedente modellerebbe un'operazione che a T05 gli sara' vietata — e
        // costringerebbe T08 a una policy piu' larga del necessario per far passare
        // la suite. Annullare la propria candidatura appartiene senza ambiguita' al
        // richiedente, e prova l'upsert altrettanto bene.
        const id = amb.nuovoMatchRequestId();
        await candidaturaDi(richiedente, id);

        await salvaCandidatura(
          unaCandidatura(richiedente, id, offerta, 'outbound', { status: 'cancelled' })
        );

        const esito = await amb.matchRequests.findById(id);
        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.status).toBe('cancelled');
        }

        // listByLeg e' la vista di chi offre: si legge come owner.
        // Una sola riga, non due: e' l'asserzione che distingue un upsert da una
        // insert. In RAM non puo' fallire (la Map e' indicizzata per id), ma su
        // Supabase una insert darebbe due righe o una violazione di chiave.
        await amb.comeUtente(owner);
        const tutte = await amb.matchRequests.listByLeg(offerta, 'outbound');
        expect(tutte.ok).toBe(true);
        if (tutte.ok) {
          expect(tutte.value).toHaveLength(1);
        }
      });

      it('listByLeg ritorna solo le candidature di quella tratta', async () => {
        const altraOfferta = amb.nuovoTripId();
        await amb.comeUtente(owner);
        await salvaTrasferta(unaTrasferta(altraOfferta));

        const mia = amb.nuovoMatchRequestId();
        const altra = amb.nuovoMatchRequestId();
        await candidaturaDi(richiedente, mia, offerta);
        await candidaturaDi(richiedente, altra, altraOfferta);

        // listByLeg e' la vista di CHI OFFRE (T14): si legge come owner.
        await amb.comeUtente(owner);
        const esito = await amb.matchRequests.listByLeg(offerta, 'outbound');

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.map((r) => r.id)).toEqual([mia]);
        }
      });

      it('listByRequester ritorna solo le candidature di quel collega', async () => {
        const altroRichiedente = await amb.creaProfilo({
          displayName: 'Altro richiedente',
          plantId: 'grottaglie',
        });

        const sua = amb.nuovoMatchRequestId();
        const altrui = amb.nuovoMatchRequestId();
        await candidaturaDi(richiedente, sua);
        await candidaturaDi(altroRichiedente, altrui);

        // listByRequester e' la vista di CHI SI CANDIDA (T13): si legge come lui.
        await amb.comeUtente(richiedente);
        const esito = await amb.matchRequests.listByRequester(richiedente);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.map((r) => r.id)).toEqual([sua]);
        }
      });

      it('findByLegAndRequester trova la candidatura esistente', async () => {
        const id = amb.nuovoMatchRequestId();
        await candidaturaDi(richiedente, id);

        // Serve a requestSeat (T05), quindi si interroga come il richiedente.
        await amb.comeUtente(richiedente);
        const esito = await amb.matchRequests.findByLegAndRequester(
          offerta,
          'outbound',
          richiedente
        );

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value?.id).toBe(id);
        }
      });

      it('findByLegAndRequester ritorna null, non not-found, se non c e', async () => {
        // La distinzione conta: "non si e' ancora candidato" e' un caso normale di
        // T05, non un errore. Trattarlo come errore costringerebbe chi chiama a
        // distinguere fra un fallimento e una risposta legittima.
        await amb.comeUtente(richiedente);
        const esito = await amb.matchRequests.findByLegAndRequester(
          offerta,
          'outbound',
          richiedente
        );

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value).toBeNull();
        }
      });

      it('due candidature dello stesso collega sulle due tratte convivono come righe distinte', async () => {
        const idAndata = amb.nuovoMatchRequestId();
        const idRitorno = amb.nuovoMatchRequestId();
        await candidaturaDi(richiedente, idAndata, offerta, 'outbound');
        await candidaturaDi(richiedente, idRitorno, offerta, 'return');

        await amb.comeUtente(richiedente);
        const andata = await amb.matchRequests.findByLegAndRequester(offerta, 'outbound', richiedente);
        const ritorno = await amb.matchRequests.findByLegAndRequester(offerta, 'return', richiedente);
        const sue = await amb.matchRequests.listByRequester(richiedente);

        expect(andata.ok && ritorno.ok && sue.ok).toBe(true);
        if (andata.ok && ritorno.ok && sue.ok) {
          expect(andata.value?.id).toBe(idAndata);
          expect(ritorno.value?.id).toBe(idRitorno);
          expect(sue.value).toHaveLength(2);
        }
      });

      it('findByLegAndRequester sul ritorno NON restituisce la candidatura dell andata', async () => {
        await candidaturaDi(richiedente, amb.nuovoMatchRequestId(), offerta, 'outbound');

        await amb.comeUtente(richiedente);
        const esito = await amb.matchRequests.findByLegAndRequester(offerta, 'return', richiedente);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value).toBeNull();
        }
      });

      it('listByLeg non mescola le tratte della stessa trasferta', async () => {
        const idAndata = amb.nuovoMatchRequestId();
        const idRitorno = amb.nuovoMatchRequestId();
        await candidaturaDi(richiedente, idAndata, offerta, 'outbound');
        await candidaturaDi(richiedente, idRitorno, offerta, 'return');

        await amb.comeUtente(owner);
        const ritorno = await amb.matchRequests.listByLeg(offerta, 'return');

        expect(ritorno.ok).toBe(true);
        if (ritorno.ok) {
          expect(ritorno.value.map((r) => r.id)).toEqual([idRitorno]);
        }
      });

      it('note e resolvedBy sopravvivono a scrittura e rilettura', async () => {
        const id = amb.nuovoMatchRequestId();
        await amb.comeUtente(richiedente);
        await salvaCandidatura(
          unaCandidatura(richiedente, id, offerta, 'outbound', {
            requestNote: 'Parto da Napoli, posso aspettare 10 minuti',
          })
        );

        // Chiudere una candidatura altrui spetta a chi offre (T05).
        await amb.comeUtente(owner);
        await salvaCandidatura(
          unaCandidatura(richiedente, id, offerta, 'outbound', {
            status: 'rejected',
            requestNote: 'Parto da Napoli, posso aspettare 10 minuti',
            resolutionNote: 'Ho dato il posto a un collega del mio reparto',
            resolvedBy: 'owner',
          })
        );

        const esito = await amb.matchRequests.findById(id);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.status).toBe('rejected');
          expect(esito.value.requestNote).toBe('Parto da Napoli, posso aspettare 10 minuti');
          expect(esito.value.resolutionNote).toBe('Ho dato il posto a un collega del mio reparto');
          expect(esito.value.resolvedBy).toBe('owner');
        }
      });

      it('una riga cancelled torna a pending riusando lo stesso id', async () => {
        const id = amb.nuovoMatchRequestId();
        await candidaturaDi(richiedente, id);
        await salvaCandidatura(
          unaCandidatura(richiedente, id, offerta, 'outbound', {
            status: 'cancelled',
            resolutionNote: 'Ho cambiato programma',
            resolvedBy: 'requester',
          })
        );

        // Ricandidatura: stessa riga, di nuovo aperta, risoluzione azzerata.
        await salvaCandidatura(
          unaCandidatura(richiedente, id, offerta, 'outbound', {
            requestNote: 'Ci ho ripensato',
          })
        );

        const esito = await amb.matchRequests.findById(id);
        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.status).toBe('pending');
          expect(esito.value.requestNote).toBe('Ci ho ripensato');
          expect(esito.value.resolutionNote).toBeNull();
          expect(esito.value.resolvedBy).toBeNull();
        }

        // Una riga sola per quella tratta: la ricandidatura non ne ha creata un'altra.
        await amb.comeUtente(owner);
        const tutte = await amb.matchRequests.listByLeg(offerta, 'outbound');
        expect(tutte.ok).toBe(true);
        if (tutte.ok) {
          expect(tutte.value.map((r) => r.id)).toEqual([id]);
        }
      });

      it('save rifiuta una risoluzione incompleta e NON scrive', async () => {
        const id = amb.nuovoMatchRequestId();
        await amb.comeUtente(richiedente);

        const esito = await amb.matchRequests.save(
          unaCandidatura(richiedente, id, offerta, 'outbound', {
            status: 'cancelled',
            resolutionNote: 'Nota senza chi',
            resolvedBy: null,
          })
        );

        expect(esito.ok).toBe(false);
        if (!esito.ok) {
          expect(esito.error.kind).toBe('invalid-record');
        }

        const riletta = await amb.matchRequests.findById(id);
        expect(riletta.ok).toBe(false);
        if (!riletta.ok) {
          expect(riletta.error.kind).toBe('not-found');
        }
      });

      it('una nota scritta sotto un limite piu alto resta leggibile dopo che il limite scende', async () => {
        const id = amb.nuovoMatchRequestId();
        const nota = 'n'.repeat(200);
        await amb.comeUtente(richiedente);
        await salvaCandidatura(
          unaCandidatura(richiedente, id, offerta, 'outbound', { requestNote: nota })
        );

        await amb.abbassaLimiteNote(10);

        const esito = await amb.matchRequests.findById(id);
        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.requestNote).toBe(nota);
        }
      });

      it('dopo che il limite scende, save di una nota oltre il limite resta invalid-record e NON scrive', async () => {
        await amb.abbassaLimiteNote(10);
        const id = amb.nuovoMatchRequestId();
        await amb.comeUtente(richiedente);

        const esito = await amb.matchRequests.save(
          unaCandidatura(richiedente, id, offerta, 'outbound', { requestNote: 'n'.repeat(11) })
        );

        expect(esito.ok).toBe(false);
        if (!esito.ok) {
          expect(esito.error.kind).toBe('invalid-record');
        }
        const riletta = await amb.matchRequests.findById(id);
        expect(riletta.ok).toBe(false);
        if (!riletta.ok) {
          expect(riletta.error.kind).toBe('not-found');
        }
      });

      it('una riga strutturalmente invalida nello storage da invalid-record in lettura', async () => {
        const id = amb.nuovoMatchRequestId();
        await amb.seminaCandidaturaGrezza(
          unaCandidatura(richiedente, id, offerta, 'outbound', {
            status: 'cancelled',
            resolutionNote: 'Nota senza chi',
            resolvedBy: null,
          })
        );

        const esito = await amb.matchRequests.findById(id);

        expect(esito.ok).toBe(false);
        if (!esito.ok) {
          expect(esito.error.kind).toBe('invalid-record');
        }
      });    });

    describe('SessionGateway', () => {
      // Nessun test di questo blocco deve ereditare la sessione aperta dal
      // beforeEach esterno: su Supabase `comeUtente` fara' un sign-in vero, e un
      // test che asserisce "nessuna sessione" sarebbe rosso per una sessione che
      // non ha chiesto. Si parte da uno stato dichiarato, non ereditato.
      beforeEach(async () => {
        await amb.sessions.signOut();
      });

      it('un codice valido apre una sessione sul profilo giusto', async () => {
        await amb.registraCodiceInvito('codice-di-prova', owner);

        const esito = await amb.sessions.signInWithInviteCode('codice-di-prova');

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.profileId).toBe(owner);
        }
      });

      it('un codice non valido da invalid-code e nessuna sessione', async () => {
        const esito = await amb.sessions.signInWithInviteCode('codice-sbagliato');

        expect(esito.ok).toBe(false);
        if (!esito.ok) {
          expect(esito.error.kind).toBe('invalid-code');
        }

        const sessione = await amb.sessions.currentSession();
        expect(sessione.ok).toBe(false);
      });

      it('un codice disattivato da code-disabled, distinto da invalid-code', async () => {
        await amb.registraCodiceInvito('codice-scaduto', owner);
        await amb.disattivaCodiceInvito('codice-scaduto');

        const esito = await amb.sessions.signInWithInviteCode('codice-scaduto');

        expect(esito.ok).toBe(false);
        if (!esito.ok) {
          expect(esito.error.kind).toBe('code-disabled');
        }
      });

      it('disattivare un codice MAI registrato non lo fa esistere: resta invalid-code', async () => {
        // Su Postgres invite_codes e' una riga con un flag: un codice assente da'
        // sempre invalid-code. Un adapter che tenesse i disattivati in una
        // struttura separata risponderebbe code-disabled, e divergerebbe.
        await amb.disattivaCodiceInvito('codice-mai-esistito');

        const esito = await amb.sessions.signInWithInviteCode('codice-mai-esistito');

        expect(esito.ok).toBe(false);
        if (!esito.ok) {
          expect(esito.error.kind).toBe('invalid-code');
        }
      });

      it('senza accesso, currentSession da no-session', async () => {
        const esito = await amb.sessions.currentSession();

        expect(esito.ok).toBe(false);
        if (!esito.ok) {
          expect(esito.error.kind).toBe('no-session');
        }
      });

      it('dopo signOut la sessione non c e piu', async () => {
        await amb.registraCodiceInvito('codice-di-prova', owner);
        await amb.sessions.signInWithInviteCode('codice-di-prova');

        await amb.sessions.signOut();

        const esito = await amb.sessions.currentSession();
        expect(esito.ok).toBe(false);
      });
    });
  });
}
