// MatchRequest — la candidatura di un collega a un posto offerto.

import type { NoteConfig } from './note-config';
import type { ProfileId } from './profile';
import { type Result, err, ok } from './result';
import type { TripId } from './trip';
import type { LegDirection } from './trip-leg';

export type MatchRequestId = string;

/**
 * Union di letterali, non string. E' un criterio di accettazione esplicito di T01,
 * e il motivo e' pratico: gli stati governano il decremento dei posti (T05) e il
 * calcolo dei KPI (T06, dove pending e rejected non devono contribuire). Uno stato
 * scritto male come stringa libera falserebbe i numeri in silenzio.
 */
export type MatchRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

/** Chi ha chiuso la candidatura. `system` e' la cascata di auto-rifiuto (T05). */
export type ResolvedBy = 'owner' | 'requester' | 'system';

export interface MatchRequest {
  readonly id: MatchRequestId;
  /** La trasferta che OFFRE il posto, non quella di chi si candida. */
  readonly tripId: TripId;
  /**
   * La tratta della trasferta a cui ci si candida. Con `tripId` forma l'identita'
   * di tratta: lo stesso collega puo' candidarsi su andata e ritorno della stessa
   * trasferta, e sono due righe distinte.
   */
  readonly direction: LegDirection;
  readonly requesterId: ProfileId;
  readonly status: MatchRequestStatus;
  /** Nota facoltativa di chi si candida. `null` = nessuna nota. */
  readonly requestNote: string | null;
  /** Nota di chi chiude la candidatura. Va impostata insieme a `resolvedBy`. */
  readonly resolutionNote: string | null;
  /** Chi ha chiuso la candidatura. Va impostato insieme a `resolutionNote`. */
  readonly resolvedBy: ResolvedBy | null;
}

export type NoteField = 'requestNote' | 'resolutionNote';

export type MatchRequestError =
  /** Nota oltre il limite di `NoteConfig.maxLength` (in code point). Mai troncata. */
  | {
      readonly kind: 'note-too-long';
      readonly field: NoteField;
      readonly length: number;
      readonly maxLength: number;
    }
  /** Nota vuota o di soli spazi: non e' una nota, e non si normalizza a null. */
  | { readonly kind: 'note-blank'; readonly field: NoteField }
  /** `resolutionNote` e `resolvedBy` devono essere entrambi null o entrambi valorizzati. */
  | { readonly kind: 'resolution-incomplete' }
  /** Una candidatura `pending` e' aperta: non puo' avere una risoluzione. */
  | { readonly kind: 'pending-with-resolution' };

/** Lunghezza in code point: l'unita' che l'utente vede ('👍'.length e' 2, qui conta 1). */
function codePointLength(testo: string): number {
  return Array.from(testo).length;
}

function validaNota(
  field: NoteField,
  nota: string | null,
  config: NoteConfig
): MatchRequestError | null {
  if (nota === null) return null;

  // Soli spazi (o stringa vuota): rifiutata, non normalizzata a null. Normalizzarla
  // permetterebbe di adempiere all'obbligo di nota al rifiuto scrivendo uno spazio.
  if (nota.trim() === '') return { kind: 'note-blank', field };

  const length = codePointLength(nota);
  if (length > config.maxLength) {
    return { kind: 'note-too-long', field, length, maxLength: config.maxLength };
  }

  return null;
}

/**
 * Costruttore di MatchRequest: il modo DA USARE per ottenerne una valida.
 *
 * Attenzione, perche' il tipo non lo impone (come per `makeTrip`): input e output
 * sono entrambi `MatchRequest`, quindi qualunque modulo puo' costruire un letterale
 * e saltare questi controlli. Ogni adapter che scrive o ricostruisce da storage una
 * candidatura deve passare di qui.
 *
 * Limite noto e DELIBERATO: la nota obbligatoria al rifiuto NON e' imposta qui.
 * Dipende dallo stato *precedente* della riga (pending -> rejected), che questo
 * modello non conserva; la impone l'usecase di T05.
 */
export function makeMatchRequest(
  campi: MatchRequest,
  noteConfig: NoteConfig
): Result<MatchRequest, MatchRequestError> {
  const errNota =
    validaNota('requestNote', campi.requestNote, noteConfig) ??
    validaNota('resolutionNote', campi.resolutionNote, noteConfig);
  if (errNota) return err(errNota);

  const haNota = campi.resolutionNote !== null;
  const haChi = campi.resolvedBy !== null;

  if (campi.status === 'pending' && (haNota || haChi)) {
    return err({ kind: 'pending-with-resolution' });
  }

  if (haNota !== haChi) {
    return err({ kind: 'resolution-incomplete' });
  }

  return ok(campi);
}
