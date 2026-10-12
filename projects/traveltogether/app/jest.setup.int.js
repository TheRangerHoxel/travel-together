// Carica .env prima dei test di integrazione.
//
// Serve perche' jest NON legge i file .env da solo: li carica Expo quando avvia
// l'app o costruisce il bundle, ma 'jest --config jest.int.config.js' gira fuori
// da quel percorso. Senza questo file, test:int resterebbe rosso anche con un .env
// perfettamente compilato, e il messaggio d'errore manderebbe fuori strada.
//
// Si usa @expo/env (la stessa implementazione che usa Expo) invece di dotenv, cosi'
// la precedenza fra .env, .env.local e le variabili di sistema e' identica a quella
// che vale a runtime: un test che legge l'ambiente in modo diverso dall'app non
// sta verificando l'app.
//
// loadProjectEnv non sovrascrive le variabili gia' presenti nell'ambiente di
// sistema: in CI si passano direttamente come secret, senza nessun file.

const { loadProjectEnv } = require('@expo/env');

loadProjectEnv(__dirname, { silent: true });
