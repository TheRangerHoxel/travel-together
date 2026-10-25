// Plant — gli stabilimenti. Lista CHIUSA: non si digitano, si scelgono.
//
// E' una union di letterali e non una stringa perche' cosi' un plant inesistente
// e' un errore di compilazione invece che un dato sbagliato scoperto a runtime.
// Il prezzo e' che aggiungere uno stabilimento richiede toccare il codice: per il
// pilota (tre sedi, decise) e' il compromesso giusto. Se le sedi diventassero molte
// o variabili, la lista andrebbe in config/ — annotato in IDEAS.md.
//
// I DATI dei plant (nomi, distanze fra tratte) stanno in config/, non qui:
// il dominio conosce l'identita' di uno stabilimento, non quanti km dista.

// L'array e' la fonte e il tipo ne e' derivato: aggiungere una sede e' un solo punto
// da toccare, e non esiste una union piu' larga della lista che la enumera.
export const PLANT_IDS = ['pomigliano', 'foggia', 'grottaglie'] as const;

export type PlantId = (typeof PLANT_IDS)[number];

export interface Plant {
  readonly id: PlantId;
  /** Nome esteso mostrato all'utente, es. "Pomigliano d'Arco". */
  readonly name: string;
}
