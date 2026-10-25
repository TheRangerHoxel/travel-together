// Le istruzioni SQL di un testo, senza commenti, stringhe e corpi di funzione.
//
// Serve a due controlli che non possono guardare il testo grezzo:
//  - un file di migrazione non deve contenere `begin`/`commit`/`rollback` come
//    ISTRUZIONE (renderebbero distruttivo il test che le esegue dentro una transazione
//    annullata), ma `begin` ed `end` compaiono legittimamente DENTRO il corpo di ogni
//    funzione plpgsql;
//  - l'harness rifiuta di passare a Postgres un'istruzione che chiude la transazione.
//
// Non e' un parser SQL: toglie commenti (`--`, `/* */`), stringhe tra apici, identificatori
// tra virgolette e corpi tra `$tag$ ... $tag$`, poi divide sul `;`. Basta a questo scopo.

/** Le parole con cui inizia un'istruzione che apre, chiude o rende definitiva una transazione. */
const CONTROLLO_TRANSAZIONE = [
  'begin',
  'start',
  'commit',
  'end',
  'abort',
  'rollback',
  'prepare',
  'savepoint',
  'release',
] as const;

/** Il testo con commenti, stringhe e corpi dollar-quoted sostituiti da uno spazio. */
export function senzaCorpiECommenti(sql: string): string {
  let fuori = '';
  let i = 0;
  while (i < sql.length) {
    const resto = sql.slice(i);

    if (resto.startsWith('--')) {
      const fine = sql.indexOf('\n', i);
      i = fine === -1 ? sql.length : fine;
      continue;
    }
    if (resto.startsWith('/*')) {
      const fine = sql.indexOf('*/', i + 2);
      i = fine === -1 ? sql.length : fine + 2;
      fuori += ' ';
      continue;
    }
    const carattere = sql.charAt(i);
    if (carattere === "'" || carattere === '"') {
      // Un apice raddoppiato ('') resta dentro la stringa: la chiusura vera e' l'apice solo.
      let j = i + 1;
      while (j < sql.length) {
        if (sql.charAt(j) === carattere) {
          if (sql.charAt(j + 1) === carattere) {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      i = j + 1;
      fuori += ' ';
      continue;
    }
    const dollaro = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(resto);
    if (dollaro) {
      const apertura = dollaro[0];
      const fine = sql.indexOf(apertura, i + apertura.length);
      i = fine === -1 ? sql.length : fine + apertura.length;
      fuori += ' ';
      continue;
    }
    fuori += carattere;
    i += 1;
  }
  return fuori;
}

/** Le istruzioni del testo, nell'ordine, ciascuna con gli spazi normalizzati. */
export function istruzioni(sql: string): string[] {
  return senzaCorpiECommenti(sql)
    .split(';')
    .map((istruzione) => istruzione.replace(/\s+/g, ' ').trim())
    .filter((istruzione) => istruzione.length > 0);
}

/**
 * Le istruzioni di controllo della transazione presenti nel testo (la prima parola e'
 * una di CONTROLLO_TRANSAZIONE). `rollback to savepoint` e `release savepoint` sono
 * comprese: i file di migrazione non ne hanno bisogno, e l'harness le usa per conto suo.
 */
export function controlliDiTransazione(sql: string): string[] {
  return istruzioni(sql).filter((istruzione) => {
    const prima = istruzione.split(' ')[0]?.toLowerCase();
    return CONTROLLO_TRANSAZIONE.some((parola) => parola === prima);
  });
}
