// test:int — tocca il progetto Supabase di staging: schema, policy RLS, codice invito.
// Senza credenziali FALLISCE, rumorosamente. Non si salta, non si marca skip:
// un verde falso e' peggio di un rosso.

// babel-preset-expo non e' una dipendenza diretta: sta sotto `expo`, che e' quella che la
// dichiara. Si risolve da li' invece di aggiungerla a package.json.
const presetExpo = require.resolve('babel-preset-expo', {
  paths: [require.resolve('expo/package.json')],
});

module.exports = {
  // NIENTE preset jest-expo: il suo setup e' quello di React Native (Promise e timer
  // sostituiti), e con un client di rete vero la connessione a Postgres non si completa mai.
  // Questi test girano in Node puro; serve solo la trasformazione di TypeScript, che e' la
  // stessa (babel-preset-expo) del resto del progetto.
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js)$': ['babel-jest', { presets: [presetExpo] }],
  },
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  // jest non legge .env da solo: lo carica questo setup. Senza, test:int sarebbe
  // rosso anche con le credenziali presenti.
  setupFiles: ['<rootDir>/jest.setup.int.js'],
  // In serie: ogni test applica lo schema dentro la propria transazione, che prende lock
  // esclusivi sulle tabelle. Due test insieme si aspetterebbero a vicenda su staging.
  maxWorkers: 1,
  // Ogni test fa piu' viaggi di rete verso un pooler remoto (revert + migrazioni + fixture).
  testTimeout: 60000,
};
