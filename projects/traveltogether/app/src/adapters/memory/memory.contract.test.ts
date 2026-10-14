// L'adapter memory messo alla prova dalla suite di contratto condivisa.
//
// Questo file NON contiene asserzioni proprie: tutte stanno in
// ../contract/repository-contract.ts, lo stesso che da T09 verra' eseguito
// sull'adapter Supabase. Qui si costruisce solo l'ambiente.
//
// Gira senza rete: la guardia in jest.setup.unit.js fa esplodere fetch,
// XMLHttpRequest e WebSocket, quindi "senza rete" e' imposto, non promesso.

import { NOTE_CONFIG } from '../../config';
import type { MatchRequest, ProfileId } from '../../core/domain';
import { type AmbienteDiContratto, eseguiSuiteDiContratto } from '../contract/repository-contract';
import { MemoryMatchRequestRepository } from './memory-match-request-repository';
import { MemoryProfileRepository } from './memory-profile-repository';
import { MemorySessionGateway } from './memory-session-gateway';
import { MemoryTripRepository } from './memory-trip-repository';

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
  const profiles = new MemoryProfileRepository();
  const trips = new MemoryTripRepository(profiles);
  // Copia MUTABILE: l'adapter tiene il riferimento, quindi mutarla dal test e' il
  // modo di abbassare il limite dopo che le note sono state scritte.
  const limiteNote: { maxLength: number } = { maxLength: NOTE_CONFIG.maxLength };
  const matchRequests = new MemoryMatchRequestRepository(limiteNote);
  const sessions = new MemorySessionGateway();

  const prossimoId = creaGeneratoreDiId();

  return {
    trips,
    matchRequests,
    profiles,
    sessions,

    // In RAM non esistono RLS: l'autenticazione non cambia cosa si vede.
    // Su Supabase questo hook fara' un vero sign-in, ed e' il motivo per cui
    // esiste gia' adesso: aggiungerlo dopo imporrebbe di riscrivere la suite.
    async comeUtente(_profileId: ProfileId) {
      // no-op
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

    async registraCodiceInvito(codice, profileId) {
      sessions.semina(codice, profileId);
    },

    async disattivaCodiceInvito(codice) {
      sessions.disattiva(codice);
    },

    // Istanze nuove a ogni test rendono la pulizia superflua in RAM, ma l'hook
    // deve esistere perche' su staging le righe restano fra un test e l'altro.
    async pulisci() {
      await sessions.signOut();
    },
  };
});
