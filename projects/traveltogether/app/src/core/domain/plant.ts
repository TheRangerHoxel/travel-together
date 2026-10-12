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

export type PlantId = 'pomigliano' | 'foggia' | 'grottaglie';

export const PLANT_IDS: readonly PlantId[] = ['pomigliano', 'foggia', 'grottaglie'];

export interface Plant {
  readonly id: PlantId;
  /** Nome esteso mostrato all'utente, es. "Pomigliano d'Arco". */
  readonly name: string;
}
