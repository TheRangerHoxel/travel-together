// Il lettore di istruzioni SQL, provato senza rete: da lui dipendono due garanzie (nessuna
// migrazione chiude la transazione di test, l harness non confermi mai).

import { controlliDiTransazione, istruzioni, senzaCorpiECommenti } from './support/istruzioni';

describe('controlliDiTransazione', () => {
  it.each([
    ['begin', 'begin;'],
    ['commit', 'create table t (a int); commit;'],
    ['rollback', 'select 1;\nROLLBACK;'],
    ['end', 'end'],
    ['start transaction', 'start transaction isolation level serializable;'],
    ['savepoint', 'savepoint x;'],
    ['prepare transaction', "prepare transaction 'x';"],
  ])('trova %s come istruzione', (_nome, sql) => {
    expect(controlliDiTransazione(sql)).not.toEqual([]);
  });

  it('non scambia begin/end di una funzione plpgsql per istruzioni', () => {
    const sql = `
      create function f() returns int language plpgsql as $$
      begin
        return 1;
      end;
      $$;
      create function g() returns int language plpgsql as $corpo$ begin commit; end $corpo$;
    `;
    expect(controlliDiTransazione(sql)).toEqual([]);
    expect(istruzioni(sql)).toHaveLength(2);
  });

  it('non guarda commenti, stringhe e identificatori', () => {
    const sql = `
      -- commit; rollback;
      /* begin; commit; */
      insert into t values ('commit; rollback;', 'l''apice; commit');
      select "commit" from t;
    `;
    expect(controlliDiTransazione(sql)).toEqual([]);
  });

  it('non scambia una colonna chiamata come una parola di controllo', () => {
    expect(controlliDiTransazione('select ended, beginning from t;')).toEqual([]);
    expect(controlliDiTransazione('update t set commit_at = now();')).toEqual([]);
  });
});

describe('senzaCorpiECommenti', () => {
  it('toglie un commento che arriva a fine file senza a capo', () => {
    expect(senzaCorpiECommenti('select 1; -- commit;')).toBe('select 1; ');
  });
});
