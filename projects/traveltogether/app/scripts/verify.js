// verify — il segnale pass/fail del progetto. Un comando solo.
//
// Perche' uno script e non una catena di && in package.json: quando una catena
// cade, il terminale mostra l'errore dell'ultimo comando e tocca a chi legge
// capire QUALE anello si e' rotto. Qui lo step caduto ha un nome, stampato
// esplicitamente. Il valore di verify sta nella diagnosi, non nel codice di uscita.
//
// Nessuna dipendenza: solo stdlib di Node.

const { spawnSync } = require('node:child_process');

/** Ordine deliberato: prima gli step rapidi, cosi' un errore banale si vede subito. */
const STEP = [
  ['lint', 'Confini di modularita e qualita del codice'],
  ['typecheck', 'Tipi, strict e noUncheckedIndexedAccess'],
  ['test:unit', 'Logica con adapter memory, senza rete'],
  ['test:int', 'Supabase staging: schema, RLS, codice invito'],
  ['smoke', 'Il bundle si costruisce e la root monta'],
];

const caduti = [];

for (const [nome, descrizione] of STEP) {
  process.stdout.write(`\n=== verify · ${nome} — ${descrizione}\n`);

  const esito = spawnSync('npm', ['run', nome], {
    stdio: 'inherit',
    shell: true,
  });

  if (esito.status !== 0) {
    caduti.push(nome);
    // Non si esce al primo rosso: sapere che cadono tre step e' informazione
    // diversa dal sapere che ne cade uno, e costa solo qualche secondo.
  }
}

process.stdout.write('\n' + '='.repeat(60) + '\n');

if (caduti.length === 0) {
  process.stdout.write('verify VERDE — tutti gli step passati\n');
  process.exit(0);
}

process.stdout.write(`verify ROSSO — step caduti: ${caduti.join(', ')}\n`);
process.stdout.write(
  'Nessun commit finche non torna verde. Si corregge in avanti, non si rollbacka.\n'
);
process.exit(1);
