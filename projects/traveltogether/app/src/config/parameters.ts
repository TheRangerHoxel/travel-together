// Il SEED dei parametri: i valori iniziali, in forma GREZZA.
//
// Non e' la fonte a runtime. A runtime i parametri arrivano dal port
// ParameterRepository, cioe' dalla tabella, e dopo la prima migrazione la tabella puo'
// divergere da questo file: e' il punto della decisione (ritarare un numero senza
// ricompilare). Nessun valore di default, quindi: un fallback su questo file renderebbe
// un parametro mancante un parametro silenzioso.
//
// Serve a tre cose: all'ambiente memory e ai test (che lo passano da parseParameters),
// e a T08, dove la migrazione di seed ne e' DERIVATA invece di riscritta a mano.
//
// Forma grezza e niente annotazione di tipo: config/ non puo' importare il core. Sono
// le stesse righe che parseParameters riceve, e la validazione e' li'.
//
// Sono STIME da parametri, non misure (CLAUDE.md di progetto, "Numeri mostrati
// all'utente"). Un valore e' ancora provvisorio: la distanza Pomigliano-Foggia.

export const SEED_PARAMETERS = {
  values: {
    /** Finestra di tolleranza sull'orario di partenza, in minuti. Confine incluso. */
    'match.toleranceMinutes': 30,

    /** Massimo di posti offribili con un'auto. Confine incluso. */
    'createTrip.maxSeatsOffered': 8,

    /**
     * g CO2/km. Ancorato ai dati EEA: 96,7 g/km sulle nuove immatricolazioni 2025 e
     * 106,7 g/km nel 2024. Quelle medie INCLUDONO le elettriche a 0 g/km, quindi
     * un'auto termica da noleggio sta sopra la media: 110 e' conservativo e
     * SOTTOSTIMA il beneficio invece di gonfiarlo.
     */
    'kpi.gramsCo2PerKm': 110,

    /** Costo auto per giorno, in euro: 120. Cifra reale indicata dall'umano. */
    'kpi.rentalCostPerDay': 120,

    /**
     * Consumo in litri ogni 100 km: 7,0. E' una MEDIA benzina per auto non
     * performanti, non un dato del parco auto aziendale: il parametro e' qui per
     * essere ritarato. A 2,2 euro/litro sono 15,4 euro ogni 100 km.
     */
    'kpi.fuelConsumptionLitersPer100Km': 7.0,

    /** Prezzo del carburante, in euro al litro: 2,2. Dato indicato dall'umano. */
    'kpi.fuelPricePerLiter': 2.2,

    /** Lunghezza massima di una nota, in code point. Confine incluso. */
    'notes.maxLength': 280,

    /** Nota sulle candidature chiuse dal sistema all'esaurirsi dei posti. Entro notes.maxLength. */
    'cascade.autoRejectNote': 'Posti esauriti: è stato accettato un altro collega.',
  },

  /**
   * Distanze in km, una volta sola per coppia: la ricerca nel core e' simmetrica,
   * quindi Foggia-Pomigliano non va ripetuta.
   */
  plantDistances: [
    // DA SOSTITUIRE. 165 km e' una STIMA NON CONFERMATA, da verificare.
    { fromPlantId: 'pomigliano', toPlantId: 'foggia', km: 165 },
    // Derivato: Pomigliano-Taranto 308-329 km, Grottaglie a 23 km da Taranto.
    { fromPlantId: 'pomigliano', toPlantId: 'grottaglie', km: 320 },
    // Confermato da un calcolatore di percorsi (232 km, circa 2h24).
    { fromPlantId: 'foggia', toPlantId: 'grottaglie', km: 232 },
  ],

  /**
   * Passeggero: trasferte condivise. Conducente: tratte offerte con almeno una
   * candidatura accettata, colleghi trasportati, km condivisi. Valori da demo, da
   * ritarare. Le etichette non citano le soglie in numeri.
   */
  badges: [
    { badgeId: 'primo-viaggio', threshold: 1, label: 'Primo viaggio condiviso' },
    { badgeId: 'cinque-viaggi', threshold: 5, label: 'Viaggiatore ricorrente' },
    { badgeId: 'dieci-viaggi', threshold: 10, label: 'Viaggiatore esperto' },
    { badgeId: 'primo-passaggio', threshold: 1, label: 'Primo passaggio offerto' },
    { badgeId: 'cinque-colleghi', threshold: 5, label: 'Compagno di strada' },
    { badgeId: 'mille-km', threshold: 1000, label: 'Lunga strada condivisa' },
  ],
} as const;
