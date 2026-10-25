// Oscura la stringa di connessione al database in qualunque testo che sta per uscire.
//
// SUPABASE_DB_URL ha pieni poteri sul database di staging: una riga di log o un
// messaggio d'errore che la contenesse la porterebbe fuori dalla macchina. Questo modulo
// e' l'UNICO punto che decide cosa si oscura; lo usano il wrapper della CLI, il
// preflight e l'harness dei test di integrazione (tramite oscura.d.ts), cosi' le tre
// uscite non possono divergere.
//
// Si oscurano: l'URL intera, la password (nella forma dell'URL e decodificata), l'utente
// e l'host. Resta visibile il resto (porta, codice d'errore): serve a capire cosa e'
// andato storto.
//
// Limite dichiarato: oscura cio' che conosce, cioe' le forme sopra. Un segreto derivato
// (per esempio la password in base64) non e' riconosciuto.

/** Gli utenti che sono una parola comune e non un segreto: oscurarli rovinerebbe i messaggi. */
const UTENTI_COMUNI = new Set(['postgres']);

/**
 * Le stringhe da oscurare, ciascuna con il suo segnaposto, dalla piu' lunga alla piu'
 * corta: la password dentro l'URL non deve spezzare la sostituzione dell'URL intera.
 */
function daOscurare(url) {
  const trovate = [];
  const aggiungi = (valore, segnaposto) => {
    if (typeof valore === 'string' && valore.length > 0) trovate.push([valore, segnaposto]);
  };

  aggiungi(url, '<SUPABASE_DB_URL>');

  let analizzata = null;
  try {
    analizzata = new URL(url);
  } catch {
    // URL non analizzabile: resta oscurata intera, e non si mostra neppure il perche'.
  }

  if (analizzata !== null) {
    aggiungi(analizzata.password, '<password>');
    try {
      aggiungi(decodeURIComponent(analizzata.password), '<password>');
    } catch {
      // sequenza di escape malformata: la forma dell'URL e' gia' oscurata.
    }
    aggiungi(encodeURIComponent(analizzata.password), '<password>');
    if (!UTENTI_COMUNI.has(analizzata.username)) {
      aggiungi(analizzata.username, '<utente>');
      try {
        aggiungi(decodeURIComponent(analizzata.username), '<utente>');
      } catch {
        // idem
      }
    }
    aggiungi(analizzata.hostname, '<host>');
  }

  return trovate.sort((a, b) => b[0].length - a[0].length);
}

/** Il testo, con ogni forma nota della credenziale sostituita da un segnaposto. */
function oscura(testo, url) {
  let risultato = String(testo);
  for (const [valore, segnaposto] of daOscurare(url)) {
    risultato = risultato.split(valore).join(segnaposto);
  }
  return risultato;
}

/**
 * Un errore NUOVO con messaggio e stack oscurati. Non si riusa l'originale: gli errori
 * dei driver portano proprieta' (host, utente) che il messaggio non mostra ma un
 * serializzatore si'. Del codice resta solo `code`, che serve alla diagnosi.
 */
function oscuraErrore(errore, url) {
  const messaggio = errore instanceof Error ? errore.message : String(errore);
  const nuovo = new Error(oscura(messaggio, url));
  if (errore instanceof Error && typeof errore.stack === 'string') {
    nuovo.stack = oscura(errore.stack, url);
  }
  if (errore !== null && typeof errore === 'object' && typeof errore.code === 'string') {
    nuovo.code = errore.code;
  }
  return nuovo;
}

module.exports = { oscura, oscuraErrore };
