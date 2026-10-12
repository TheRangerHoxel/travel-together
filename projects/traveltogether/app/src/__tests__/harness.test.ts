// Test dell'harness, non del prodotto.
//
// Verifica che il divieto di rete in test:unit sia davvero armato. E' il test che
// protegge tutti gli altri: se questo passa in verde quando la guardia e' spenta,
// ogni futuro test unitario potrebbe uscire in rete senza che nessuno se ne accorga.
//
// Vale la pena averlo perche' la guardia e' invisibile: nessun test la nomina, e
// una configurazione sbagliata la disattiverebbe in silenzio.

describe('harness dei test unitari', () => {
  it('blocca fetch con un messaggio che dice cosa fare', () => {
    expect(() => fetch('https://example.invalid')).toThrow(/chiamata di rete/i);
    expect(() => fetch('https://example.invalid')).toThrow(/adapter memory/i);
  });

  it('blocca XMLHttpRequest', () => {
    expect(() => new XMLHttpRequest()).toThrow(/chiamata di rete/i);
  });

  it('blocca le WebSocket', () => {
    expect(() => new WebSocket('wss://example.invalid')).toThrow(/WebSocket/i);
  });
});
