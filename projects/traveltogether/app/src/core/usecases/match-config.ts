// Parametri configurabili del matching.
//
// Il TIPO sta qui, nel core, perche' e' parte della firma di findMatches, cioe'
// del contratto del core. I VALORI stanno in src/config/, e vi arrivano come
// parametro: il core resta compilabile ed eseguibile senza config/.
//
// Cio' che tiene insieme le due meta' e' match-config.test.ts, che lega i valori
// reali a questo tipo e fa diventare rosso `tsc --noEmit` se divergono. Senza,
// config/ esporterebbe un oggetto che nessuno confronta con niente, e un campo
// rinominato arriverebbe a runtime come undefined — che nei conti diventa NaN, e
// NaN fa fallire ogni confronto in silenzio.

export interface MatchConfig {
  /**
   * Quanto puo' distare l'orario di un'offerta da quello richiesto, in minuti.
   * Il confine e' **incluso**: con 30, un'offerta a esattamente 30 minuti e' un match.
   * Deve essere un intero >= 0.
   */
  readonly toleranceMinutes: number;
}
