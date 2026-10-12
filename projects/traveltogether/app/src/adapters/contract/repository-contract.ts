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
          const offerta = esito.value.find((o) => o.tripId === id);
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
          const offerta = esito.value.find((o) => o.tripId === id);
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
        tripId: TripId = offerta
      ): Promise<void> {
        await amb.comeUtente(requesterId);
        await salvaCandidatura({ id, tripId, requesterId, status: 'pending' });
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

        await salvaCandidatura({
          id,
          tripId: offerta,
          requesterId: richiedente,
          status: 'cancelled',
        });

        const esito = await amb.matchRequests.findById(id);
        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value.status).toBe('cancelled');
        }

        // listByTrip e' la vista di chi offre: si legge come owner.
        // Una sola riga, non due: e' l'asserzione che distingue un upsert da una
        // insert. In RAM non puo' fallire (la Map e' indicizzata per id), ma su
        // Supabase una insert darebbe due righe o una violazione di chiave.
        await amb.comeUtente(owner);
        const tutte = await amb.matchRequests.listByTrip(offerta);
        expect(tutte.ok).toBe(true);
        if (tutte.ok) {
          expect(tutte.value).toHaveLength(1);
        }
      });

      it('listByTrip ritorna solo le candidature di quell offerta', async () => {
        const altraOfferta = amb.nuovoTripId();
        await amb.comeUtente(owner);
        await salvaTrasferta(unaTrasferta(altraOfferta));

        const mia = amb.nuovoMatchRequestId();
        const altra = amb.nuovoMatchRequestId();
        await candidaturaDi(richiedente, mia, offerta);
        await candidaturaDi(richiedente, altra, altraOfferta);

        // listByTrip e' la vista di CHI OFFRE (T14): si legge come owner.
        await amb.comeUtente(owner);
        const esito = await amb.matchRequests.listByTrip(offerta);

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

      it('findByTripAndRequester trova la candidatura esistente', async () => {
        const id = amb.nuovoMatchRequestId();
        await candidaturaDi(richiedente, id);

        // Serve a requestSeat (T05), quindi si interroga come il richiedente.
        await amb.comeUtente(richiedente);
        const esito = await amb.matchRequests.findByTripAndRequester(offerta, richiedente);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value?.id).toBe(id);
        }
      });

      it('findByTripAndRequester ritorna null, non not-found, se non c e', async () => {
        // La distinzione conta: "non si e' ancora candidato" e' un caso normale di
        // T05, non un errore. Trattarlo come errore costringerebbe chi chiama a
        // distinguere fra un fallimento e una risposta legittima.
        await amb.comeUtente(richiedente);
        const esito = await amb.matchRequests.findByTripAndRequester(offerta, richiedente);

        expect(esito.ok).toBe(true);
        if (esito.ok) {
          expect(esito.value).toBeNull();
        }
      });
    });

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
