// smoke, parte (b): la root dell'app monta davvero e la prima schermata compare.
//
// Separato da test:unit perche' risponde a una domanda diversa. test:unit chiede
// "la logica e' corretta?"; lo smoke chiede "l'app parte?". Un bundle che non si
// costruisce o una root che non monta passerebbero inosservati a una suite di
// test unitari tutta verde.

module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/smoke/**/*.test.tsx'],
};
