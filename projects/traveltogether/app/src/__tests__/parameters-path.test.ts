// Il percorso port -> usecase, in RAM: righe grezze -> adapter memory -> `load` ->
// usecase. Dimostra che cambiando UNA riga il risultato di un usecase cambia.
//
// Cosa NON dimostra: "senza ricompilare". In RAM la riga e' un oggetto, quindi la
// prova che un valore ritarato in tabella arrivi a un processo gia' avviato si fa
// su una tabella vera (T09, staging).
//
// Non c'e' un chiamante di produzione: nessuna schermata, nessuna radice di
// composizione. Questo test e' la composizione che i task di UI faranno, scritta una
// volta: `load` dopo l'accesso, poi `p.matching` a findMatches e `p.badges` ad
// awardBadges. Sta in src/__tests__/ perche' compone adapters/ e usecases/, e il lint
// lo consente solo a questo elemento (e non a ui/).

import { MemoryParameterRepository } from '../adapters/memory/memory-parameter-repository';
import { nuoveCondizioni } from '../adapters/memory/memory-conditions';
import { SEED_PARAMETERS } from '../config';
import type { AppParameters, RawParameters, SeatOffer, TripRequest } from '../core/domain';
import { utc } from '../core/domain/instant-fixture';
import { awardBadges, findMatches } from '../core/usecases';

async function caricaDopoAccesso(
  repo: MemoryParameterRepository,
  condizioni: ReturnType<typeof nuoveCondizioni>
): Promise<AppParameters> {
  condizioni.identita = 'collega-1';
  const esito = await repo.load();
  if (!esito.ok) throw new Error(`load fallito: ${esito.error.kind}`);
  return esito.value;
}

const RICHIESTA: TripRequest = {
  requesterId: 'richiedente',
  requesterPlantId: 'foggia',
  fromPlantId: 'pomigliano',
  toPlantId: 'foggia',
  departureAt: utc('2026-11-03T06:00:00.000Z'),
};

/** Un'offerta 20 minuti dopo la richiesta: dentro 30, fuori 10. */
const OFFERTA: SeatOffer = {
  tripId: 'trip-1',
  direction: 'outbound',
  ownerId: 'conducente',
  ownerPlantId: 'pomigliano',
  fromPlantId: 'pomigliano',
  toPlantId: 'foggia',
  departureAt: utc('2026-11-03T06:20:00.000Z'),
  seatsAvailable: 2,
};

describe('percorso port -> usecase: cambiata una riga, cambia il risultato', () => {
  it('tolleranza da 30 a 10: l\'offerta a 20 minuti esce da findMatches', async () => {
    const condizioni = nuoveCondizioni();
    const repo = new MemoryParameterRepository(SEED_PARAMETERS, condizioni);

    const prima = await caricaDopoAccesso(repo, condizioni);
    const trovatePrima = findMatches(RICHIESTA, [OFFERTA], [], prima.matching);
    // Il PRIMA: senza, il test passerebbe anche con una tolleranza gia' a 10.
    expect(prima.matching.toleranceMinutes).toBe(30);
    expect(trovatePrima.ok && trovatePrima.value.map((m) => m.offer.tripId)).toEqual(['trip-1']);

    const ritarata: RawParameters = {
      ...SEED_PARAMETERS,
      values: { ...SEED_PARAMETERS.values, 'match.toleranceMinutes': 10 },
    };
    repo.sostituisci(ritarata);
    const dopo = await caricaDopoAccesso(repo, condizioni);
    const trovateDopo = findMatches(RICHIESTA, [OFFERTA], [], dopo.matching);

    expect(dopo.matching.toleranceMinutes).toBe(10);
    expect(trovateDopo).toEqual({ ok: true, value: [] });
  });

  it('un\'etichetta cambiata: awardBadges assegna il badge con il testo nuovo', async () => {
    const condizioni = nuoveCondizioni();
    const repo = new MemoryParameterRepository(SEED_PARAMETERS, condizioni);
    const statistiche = {
      profileId: 'collega-1',
      sharedTrips: 1,
      sharedLegs: 0,
      transportedColleagues: 0,
      sharedKm: 0,
    };

    const prima = await caricaDopoAccesso(repo, condizioni);
    const badgePrima = awardBadges(statistiche, prima.badges);
    // Il PRIMA: il testo del seed, altrimenti il test passerebbe con l'etichetta gia' cambiata.
    expect(badgePrima).toEqual({
      ok: true,
      value: [{ id: 'primo-viaggio', label: 'Primo viaggio condiviso' }],
    });

    repo.sostituisci({
      ...SEED_PARAMETERS,
      badges: SEED_PARAMETERS.badges.map((b) =>
        b.badgeId === 'primo-viaggio' ? { ...b, label: 'Prima tappa' } : b
      ),
    });
    const dopo = await caricaDopoAccesso(repo, condizioni);

    expect(awardBadges(statistiche, dopo.badges)).toEqual({
      ok: true,
      value: [{ id: 'primo-viaggio', label: 'Prima tappa' }],
    });
  });
});
