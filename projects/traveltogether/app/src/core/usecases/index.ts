// core/usecases — la logica applicativa. Dipende da domain/ e ports/.
//
// Non importa config/: i valori entrano come parametro, quindi il core resta
// compilabile ed eseguibile senza. L'unico file che importa config/ e' il test di
// conformita', che lega i valori reali ai tipi del core.
//
// Popolato da T03 in poi.

export type { MatchConfig } from './match-config';
export type { ScoredMatch, MatchError } from './find-matches';
export { findMatches } from './find-matches';
