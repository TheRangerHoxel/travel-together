// Aritmetica di calendario, senza Date.
//
// PERCHE' UN FILE A PARTE E NON DENTRO instant.ts. Sono due responsabilita':
// riconoscere la forma di un istante (instant.ts) vs. contare i giorni e sapere
// quali date esistono (calendario). Il parser degli istanti passa da `civilDayNumber`
// per rifiutare le date impossibili (`2026-02-31`), dominio -> dominio e senza cicli;
// questo modulo lavora sulla parte `date` (`YYYY-MM-DD`) di un istante.
//
// DATA IMPOSSIBILE: queste funzioni ritornano `null`, mai un numero. Un conteggio
// di giorni calcolato su `2026-02-31` darebbe una risposta plausibile (come il
// 3 marzo) e sbagliata, che e' esattamente il difetto che il resto del dominio
// evita. Chi chiama e' costretto dal tipo a decidere cosa fare di `null`.
//
// Algoritmo: conversione data civile -> giorni dall'epoca 1970-01-01 (che vale 0),
// tutta in interi. Si anticipa l'anno di uno per gennaio e febbraio, cosi' il
// giorno bisestile cade a fine "anno" e non serve un caso speciale.

const DATA_CIVILE = /^(\d{4})-(\d{2})-(\d{2})$/;

const GIORNI_PER_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function isBisestile(anno: number): boolean {
  return (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0;
}

function giorniNelMese(anno: number, mese: number): number {
  if (mese === 2 && isBisestile(anno)) return 29;
  return GIORNI_PER_MESE[mese - 1] ?? 0;
}

/**
 * Numero di giorno di una data civile `YYYY-MM-DD`: giorni trascorsi dal
 * 1970-01-01 (che vale 0; le date precedenti sono negative).
 *
 * Ritorna `null` se la forma non e' `YYYY-MM-DD` **oppure se la data non esiste
 * in calendario**: `2026-02-31`, `2027-02-29`, `2026-04-31`, mese 00 o 13.
 * Il 29 febbraio esiste solo negli anni bisestili (2028 si, 2027 no, 2100 no,
 * 2000 si).
 */
export function civilDayNumber(date: string): number | null {
  const m = DATA_CIVILE.exec(date);
  if (!m) return null;

  const [, annoTesto, meseTesto, giornoTesto] = m;
  if (!annoTesto || !meseTesto || !giornoTesto) return null;

  const anno = Number(annoTesto);
  const mese = Number(meseTesto);
  const giorno = Number(giornoTesto);

  if (mese < 1 || mese > 12) return null;
  if (giorno < 1 || giorno > giorniNelMese(anno, mese)) return null;

  const a = mese <= 2 ? anno - 1 : anno;
  const era = Math.floor(a / 400);
  const annoDellEra = a - era * 400;
  const meseDaMarzo = mese > 2 ? mese - 3 : mese + 9;
  const giornoDellAnno = Math.floor((153 * meseDaMarzo + 2) / 5) + giorno - 1;
  const giornoDellEra =
    annoDellEra * 365 + Math.floor(annoDellEra / 4) - Math.floor(annoDellEra / 100) + giornoDellAnno;

  return era * 146_097 + giornoDellEra - 719_468;
}

/**
 * Quanti giorni di calendario copre l'intervallo da `startDate` a `endDate`,
 * **estremi inclusi**: dal 3 al 5 novembre sono 3, lo stesso giorno e' 1.
 *
 * Ritorna `null` se una delle due date e' malformata o impossibile, oppure se
 * `endDate` precede `startDate`: un intervallo rovesciato non ha un numero di
 * giorni sensato, e restituirne uno <= 0 lo farebbe sottrarre dai totali.
 */
export function inclusiveDaysBetween(startDate: string, endDate: string): number | null {
  const inizio = civilDayNumber(startDate);
  const fine = civilDayNumber(endDate);
  if (inizio === null || fine === null) return null;
  if (fine < inizio) return null;
  return fine - inizio + 1;
}
