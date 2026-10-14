// Valori di configurazione dei KPI aziendali.
//
// Niente annotazione di tipo, per lo stesso motivo di MATCH_CONFIG: config/ non
// puo' importare il core. Il legame col tipo e' in core/usecases/kpi-config.test.ts.
//
// Sono STIME da parametri, non misure (CLAUDE.md di progetto, "Numeri mostrati
// all'utente"). Un valore e' ancora provvisorio ed e' marcato "DA SOSTITUIRE":
// la distanza Pomigliano-Foggia (stima non confermata).

export const KPI_CONFIG = {
  /**
   * g CO2/km. Ancorato ai dati EEA: 96,7 g/km sulle nuove immatricolazioni 2025 e
   * 106,7 g/km nel 2024. Quelle medie INCLUDONO le elettriche a 0 g/km, quindi
   * un'auto termica da noleggio sta sopra la media: 110 e' conservativo e
   * SOTTOSTIMA il beneficio invece di gonfiarlo.
   */
  gramsCo2PerKm: 110,

  /** Costo auto per giorno, in euro: 120. Cifra reale indicata dall'umano. */
  rentalCostPerDay: 120,

  /**
   * Consumo in litri ogni 100 km: 7,0. E' una MEDIA benzina per auto non
   * performanti, non un dato del parco auto aziendale: il parametro e' qui per
   * essere ritarato. A 2,2 euro/litro sono 15,4 euro ogni 100 km.
   */
  fuelConsumptionLitersPer100Km: 7.0,

  /** Prezzo del carburante, in euro al litro: 2,2. Dato indicato dall'umano. */
  fuelPricePerLiter: 2.2,

  /**
   * Distanze in km, una volta sola per coppia: la ricerca nel core e' simmetrica,
   * quindi Foggia-Pomigliano non va ripetuta.
   */
  distanceKm: {
    pomigliano: {
      /** DA SOSTITUIRE. 165 km e' una STIMA NON CONFERMATA, da verificare. */
      foggia: 165,
      /** Derivato: Pomigliano-Taranto 308-329 km, Grottaglie a 23 km da Taranto. */
      grottaglie: 320,
    },
    foggia: {
      /** Confermato da un calcolatore di percorsi (232 km, circa 2h24). */
      grottaglie: 232,
    },
  },
} as const;
