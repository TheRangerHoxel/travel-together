// Ponte di tipo fra PersonalStats e PersonalBests.
//
// Sta in usecases/ e non in domain/ perche' PersonalStats vive qui e il dominio non
// puo' importare i usecase. Un solo `expect` di forma; la prova vera e' `typecheck`.
// Aggiungere una metrica a PersonalStats senza aggiungerla ai massimi (o viceversa)
// rende `true` non assegnabile a `false` e `typecheck` rosso.

import type { PersonalBests } from '../domain';
import type { PersonalStats } from './compute-personal-stats';

type Metriche<T> = Exclude<keyof T, 'profileId'>;
type Uguali<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const stesseMetriche: Uguali<Metriche<PersonalStats>, Metriche<PersonalBests>> = true;

describe('ponte PersonalStats <-> PersonalBests', () => {
  it('le metriche coincidono (la prova vera e il typecheck, non questo expect)', () => {
    expect(stesseMetriche).toBe(true);
  });
});
