// L'harness SQL, provato da solo, prima che ci sia uno schema: la connessione, la verifica
// del certificato, l'identita che leggono le RLS, e la possibilita di creare un utente
// in `auth.users` senza lasciare traccia.

import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import { CERTIFICATO_RADICE, inTransazioneAnnullata, provaConnessioneConCa } from './support/db';
import { creaUtente } from './support/fixtures';

describe('connessione a staging', () => {
  it('risponde a select 1', async () => {
    const righe = await inTransazioneAnnullata((s) => s.esegui('select 1 as uno'));
    expect(righe).toEqual([{ uno: 1 }]);
  });

});

describe('verifica del certificato TLS', () => {
  // Non si guarda pg_stat_ssl: il TLS termina sul pooler, e il lato server vede la
  // connessione interna (ssl = false). La prova e' lato client: la connessione riesce con la
  // CA di Supabase e FALLISCE fidandosi di un'altra.
  it('con la CA radice di Supabase la connessione riesce', async () => {
    expect(await provaConnessioneConCa(readFileSync(CERTIFICATO_RADICE, 'utf8'))).toEqual({ ok: true });
  });

  it('fidandosi di una CA diversa la connessione e rifiutata per il certificato', async () => {
    const altraCa = rootCertificates[0];
    expect(altraCa).toBeDefined();
    const esito = await provaConnessioneConCa(altraCa ?? '');
    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.codice).toMatch(/CERT|ISSUER|SELF_SIGNED|VERIFY/);
    }
  });
});

describe('identita nelle RLS', () => {
  it('auth.uid() restituisce il sub impostato da comeUtente', async () => {
    const atteso = '11111111-1111-4111-8111-111111111111';
    const visto = await inTransazioneAnnullata(async (s) => {
      await s.comeUtente(atteso);
      return s.chiSono();
    });
    expect(visto).toEqual({ ruolo: 'authenticated', uid: atteso });
  });

  it('comeAnonimo: ruolo anon e nessuna identita', async () => {
    const visto = await inTransazioneAnnullata(async (s) => {
      await s.comeAnonimo();
      return s.chiSono();
    });
    expect(visto).toEqual({ ruolo: 'anon', uid: null });
  });

  it('comePostgres riporta al ruolo della connessione, senza identita', async () => {
    const visto = await inTransazioneAnnullata(async (s) => {
      const iniziale = (await s.chiSono()).ruolo;
      await s.comeUtente('11111111-1111-4111-8111-111111111111');
      await s.comePostgres();
      return { ...(await s.chiSono()), iniziale };
    });
    expect(visto.ruolo).toBe(visto.iniziale);
    expect(visto.uid).toBeNull();
  });
});

describe('auth.users e il rollback', () => {
  it('un utente creato in transazione si legge dentro e non resta fuori', async () => {
    const id = await inTransazioneAnnullata(async (s) => {
      const creato = await creaUtente(s);
      const dentro = await s.esegui('select count(*)::int as n from auth.users where id = $1::uuid', [creato]);
      expect(dentro).toEqual([{ n: 1 }]);
      return creato;
    });

    const fuori = await inTransazioneAnnullata((s) =>
      s.esegui('select count(*)::int as n from auth.users where id = $1::uuid', [id])
    );
    expect(fuori).toEqual([{ n: 0 }]);
  });
});

describe('l harness non lascia confermare', () => {
  it.each(['commit', 'end', 'rollback', 'begin', 'savepoint x', 'prepare transaction \'t\''])(
    '%s e rifiutato',
    async (istruzione) => {
      await expect(inTransazioneAnnullata((s) => s.esegui(istruzione))).rejects.toThrow(
        /controllo della transazione/
      );
    }
  );
});
