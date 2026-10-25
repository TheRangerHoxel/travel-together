// L'adapter memory messo alla prova dalla suite di contratto condivisa.
//
// Questo file NON contiene asserzioni proprie: tutte stanno in
// ../contract/repository-contract.ts, lo stesso che da T09 verra' eseguito
// sull'adapter Supabase. Qui si costruisce solo l'ambiente.
//
// Gira senza rete: la guardia in jest.setup.unit.js fa esplodere fetch,
// XMLHttpRequest e WebSocket, quindi "senza rete" e' imposto, non promesso.

import { SEED_PARAMETERS } from '../../config';
import type { MatchRequest, ProfileId } from '../../core/domain';
import { parseParameters } from '../../core/domain';
import { type AmbienteDiContratto, eseguiSuiteDiContratto } from '../contract/repository-contract';
import { nuoveCondizioni } from './memory-conditions';
import { MemoryMatchRequestRepository } from './memory-match-request-repository';
import { MemoryParameterRepository } from './memory-parameter-repository';
import { MemoryPersonalBestsRepository } from './memory-personal-bests-repository';
import { MemoryProfileRepository } from './memory-profile-repository';
import { MemorySessionGateway } from './memory-session-gateway';
import { MemoryTripRepository } from './memory-trip-repository';

/** Il limite delle note del seed, passato dal parser come ogni altro parametro. */
function limiteNoteDelSeed(): number {
  const parametri = parseParameters(SEED_PARAMETERS);
  if (!parametri.ok) {
    throw new Error(`il seed non passa parseParameters: ${parametri.error.key}`);
  }
  return parametri.value.notes.maxLength;
}

/**
 * Id di forma uuid anche in RAM.
 *
 * In memoria basterebbe 'trip-1', ma lo schema di T08 usera' colonne uuid: una
 * stringa libera non e' inseribile, e su Postgres un id malformato non produce
 * not-found ma un errore di sintassi. Generarli gia' validi qui significa che la
 * suite non dovra' essere toccata quando arrivera' l'adapter Supabase — che e'
 * esattamente il criterio di accettazione.
 */
function creaGeneratoreDiId(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
  };
}

eseguiSuiteDiContratto('memory', async (): Promise<AmbienteDiContratto> => {
  // Lo stato condiviso dell'ambiente: chi sta chiamando e se lo storage risponde.
  // Lo vedono TUTTI gli adapter, cosi' `comeUtente` e `guasta` lo cambiano in un
  // punto solo.
  const condizioni = nuoveCondizioni();
  const profiles = new MemoryProfileRepository(condizioni);
  const trips = new MemoryTripRepository(profiles, condizioni);
  // Copia MUTABILE: l'adapter tiene il riferimento, quindi mutarla dal test e' il
  // modo di abbassare il limite dopo che le note sono state scritte.
  const limiteNote: { maxLength: number } = { maxLength: limiteNoteDelSeed() };
  const matchRequests = new MemoryMatchRequestRepository(limiteNote, { condizioni, trips });
  const sessions = new MemorySessionGateway();
  // Nessuna riga all'inizio: niente seed implicito, ogni test scrive quelle che vuole.
  const parameters = new MemoryParameterRepository(
    { values: {}, plantDistances: [], badges: [] },
    condizioni
  );

  const prossimoId = creaGeneratoreDiId();

  return {
    trips,
    matchRequests,
    profiles,
    sessions,
    personalBests: new MemoryPersonalBestsRepository(condizioni),
    parameters,

    // In RAM le RLS non esistono, ma gli adapter ne imitano le policy scritte su T08:
    // l'identita' registrata qui decide cosa possono scrivere e vedere. Cosi' un test
    // scritto come se le RLS non esistessero e' rosso gia' su memory, non a T09.
    // Su Supabase questo hook fara' un vero sign-in.
    async comeUtente(profileId: ProfileId) {
      condizioni.identita = profileId;
    },

    async guasta() {
      condizioni.guasto = true;
    },

    async ripristina() {
      condizioni.guasto = false;
    },

    async creaProfilo({ displayName, plantId }) {
      const id = prossimoId();
      profiles.semina({ id, displayName, plantId });
      return id;
    },

    nuovoTripId: prossimoId,
    nuovoMatchRequestId: prossimoId,
    idInesistente: () => '00000000-0000-4000-8000-ffffffffffff',

    async abbassaLimiteNote(maxLength: number) {
      limiteNote.maxLength = maxLength;
    },

    async seminaCandidaturaGrezza(request: MatchRequest) {
      matchRequests.seminaGrezzo(request);
    },

    async scriviParametriGrezzi(righe) {
      parameters.sostituisci(righe);
    },

    async registraCodiceInvito(codice, profileId) {
      sessions.semina(codice, profileId);
    },

    async disattivaCodiceInvito(codice) {
      sessions.disattiva(codice);
    },

    // Istanze nuove a ogni test rendono la pulizia superflua in RAM, ma l'hook
    // deve esistere perche' su staging le righe restano fra un test e l'altro.
    // Ripristina anche il guasto: un test che cade fra `guasta` e `ripristina`
    // lascerebbe l'`afterEach` eseguito sotto guasto, e lo staging sporco.
    async pulisci() {
      condizioni.guasto = false;
      await sessions.signOut();
    },
  };
});
