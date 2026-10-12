// Valori di configurazione del matching.
//
// Niente annotazione di tipo: il lint vieta a config/ di importare domain/ e
// usecases/, quindi `const MATCH_CONFIG: MatchConfig = {...}` non compilerebbe.
// Il legame col tipo e' in core/usecases/match-config.test.ts, che fa diventare
// rosso `tsc --noEmit` se la forma diverge.
//
// `as const` non ricade nel divieto di `as` delle convenzioni: quello riguarda
// l'assertion usata per zittire il compilatore, mentre qui restringe i letterali
// e aumenta il controllo.
//
// Questi non sono segreti e non arrivano da .env: una soglia di tolleranza letta
// da variabile d'ambiente sarebbe `string | undefined` a runtime, cioe' non
// verificabile a compile time, e un campo mancante diventerebbe NaN facendo
// sparire tutti i match senza errori.

export const MATCH_CONFIG = {
  /** Finestra di tolleranza sull'orario di partenza, in minuti. Confine incluso. */
  toleranceMinutes: 30,
} as const;
