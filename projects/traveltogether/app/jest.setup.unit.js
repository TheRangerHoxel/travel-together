// I test unitari non toccano la rete. Qui il vincolo e' IMPOSTO, non dichiarato:
// ogni via d'uscita verso la rete viene sostituita con una che esplode.
//
// Perche' cosi' e non "si gira con la rete staccata": staccare la rete e' una
// verifica che qualcuno deve ricordarsi di fare. Questa fallisce da sola, su ogni
// esecuzione, e dice quale chiamata ha tentato di uscire.

function vietata(nome) {
  return function bloccata() {
    throw new Error(
      `test:unit ha tentato una chiamata di rete tramite ${nome}(). ` +
        'La logica in core/ si testa con l\'adapter memory: se serve la rete, ' +
        'il test e\' nel posto sbagliato oppure manca un port.'
    );
  };
}

global.fetch = vietata('fetch');

global.XMLHttpRequest = function XMLHttpRequestBloccato() {
  throw new Error(
    'test:unit ha tentato una chiamata di rete tramite XMLHttpRequest. ' +
      'La logica in core/ si testa con l\'adapter memory.'
  );
};

global.WebSocket = function WebSocketBloccato() {
  throw new Error('test:unit ha tentato di aprire una WebSocket.');
};
