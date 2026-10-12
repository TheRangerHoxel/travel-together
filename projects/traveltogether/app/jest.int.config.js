// test:int — tocca il progetto Supabase di staging: schema, policy RLS, codice invito.
// Senza credenziali FALLISCE, rumorosamente. Non si salta, non si marca skip:
// un verde falso e' peggio di un rosso.

module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  // jest non legge .env da solo: lo carica questo setup. Senza, test:int sarebbe
  // rosso anche con le credenziali presenti.
  setupFiles: ['<rootDir>/jest.setup.int.js'],
};
