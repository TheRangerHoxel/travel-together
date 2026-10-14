// config — parametri iniettati: plant, distanze, costo noleggio/giorno,
// g CO2/km, finestre di tolleranza, soglie dei badge.
// Nessun segreto qui dentro: chiavi e codice invito arrivano da variabili
// d'ambiente a runtime.
// Un KPI che cambia modificando questi valori e' la prova che non e' hardcoded.

export { MATCH_CONFIG } from './matching';
export { CREATE_TRIP_CONFIG } from './trips';
export { KPI_CONFIG } from './kpi';
export { NOTE_CONFIG, CASCADE_CONFIG } from './notes';
