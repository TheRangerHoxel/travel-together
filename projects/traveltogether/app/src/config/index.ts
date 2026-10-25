// config — il seed dei parametri, in forma grezza.
//
// Non e' la fonte a runtime (lo e' la tabella, letta dal port ParameterRepository) e
// non contiene segreti: chiavi e codice invito arrivano da variabili d'ambiente a
// runtime. Serve all'ambiente memory, ai test e, a T08, alla migrazione di seed.

export { SEED_PARAMETERS } from './parameters';
