// L'oscuramento della stringa di connessione, provato senza rete. Una credenziale che esce in
// un log e un danno che non si annulla, quindi la funzione che la nasconde ha i suoi test.
//
// L'URL qui sotto e FITTIZIA (dominio riservato .invalid, password inventata).

import { oscura, oscuraErrore } from '../../scripts/oscura';

const URL_FINTA = 'postgresql://postgres.progettofinto:p%40ss%2Ffinta@db.esempio.invalid:5432/postgres';

describe('oscura', () => {
  it('nasconde l URL intera', () => {
    expect(oscura(`connessione a ${URL_FINTA} fallita`, URL_FINTA)).toBe(
      'connessione a <SUPABASE_DB_URL> fallita'
    );
  });

  it('nasconde la password nella forma dell URL e in quella decodificata', () => {
    const testo = 'password p%40ss%2Ffinta, ovvero p@ss/finta';
    const risultato = oscura(testo, URL_FINTA);
    expect(risultato).not.toContain('p%40ss');
    expect(risultato).not.toContain('p@ss');
    expect(risultato).toBe('password <password>, ovvero <password>');
  });

  it('nasconde utente e host, e lascia porta e codice', () => {
    const risultato = oscura(
      'connect ETIMEDOUT db.esempio.invalid:5432 come postgres.progettofinto',
      URL_FINTA
    );
    expect(risultato).toBe('connect ETIMEDOUT <host>:5432 come <utente>');
  });

  it('non oscura la parola postgres quando e l utente', () => {
    const url = 'postgresql://postgres:segreto-finto@db.esempio.invalid:5432/postgres';
    expect(oscura('database postgres', url)).toBe('database postgres');
    expect(oscura('segreto-finto', url)).toBe('<password>');
  });

  it('una URL non analizzabile viene comunque oscurata intera', () => {
    const rotta = 'non-e-una-url con-un-segreto';
    expect(oscura(`errore su ${rotta}`, rotta)).toBe('errore su <SUPABASE_DB_URL>');
  });

  it('con una password che e dentro altre parole non le rovina oltre il necessario', () => {
    expect(oscura('niente da nascondere qui', URL_FINTA)).toBe('niente da nascondere qui');
  });
});

describe('oscuraErrore', () => {
  it('ritorna un errore nuovo con messaggio e stack oscurati e il code conservato', () => {
    const originale = Object.assign(new Error(`fallita ${URL_FINTA}`), {
      code: 'ECONNREFUSED',
      host: 'db.esempio.invalid',
    });

    const risultato = oscuraErrore(originale, URL_FINTA);

    expect(risultato).not.toBe(originale);
    expect(risultato.message).toBe('fallita <SUPABASE_DB_URL>');
    expect(risultato.stack ?? '').not.toContain('p%40ss');
    expect(risultato.stack ?? '').not.toContain('db.esempio.invalid');
    expect(risultato.code).toBe('ECONNREFUSED');
    expect(JSON.stringify(risultato)).not.toContain('db.esempio.invalid');
  });

  it('accetta anche un valore che non e un Error', () => {
    expect(oscuraErrore(`boom ${URL_FINTA}`, URL_FINTA).message).toBe('boom <SUPABASE_DB_URL>');
  });
});
