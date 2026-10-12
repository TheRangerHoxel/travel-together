// test:unit — logica pura e componenti, con l'adapter memory. Nessuna rete.
// Separato da test:int perche' i due hanno prerequisiti diversi: questo deve
// girare sempre, quello richiede credenziali di staging.

module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.unit.js'],
};
