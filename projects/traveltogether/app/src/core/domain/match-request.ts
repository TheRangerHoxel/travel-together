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
  /**
   * La trasferta di CHI SI CANDIDA (non quella che offre il posto, che e' `tripId`).
   * Obbligatoria: i KPI aziendali (T06) contano auto, giorni, CO2 e carburante sulla
   * trasferta del passeggero, e senza questo riferimento dovrebbero ricostruirla per
   * indizio (plant e giorno), che sbaglia con due trasferte uguali nello stesso giorno.
   */
  readonly requesterTripId: TripId;
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
  | { readonly kind: 'pending-with-resolution' }
  /** `requesterTripId` vuoto o di soli spazi: il riferimento e' obbligatorio. */
  | { readonly kind: 'requester-trip-missing' };

/** Lunghezza in code point: l'unita' che l'utente vede ('👍'.length e' 2, qui conta 1). */
function codePointLength(testo: string): number {
  return Array.from(testo).length;
}

/**
 * Il controllo di UNA nota (vuota, oltre il limite), esportato perche' lo usa anche
 * parseParameters sul testo della nota automatica: una regola, un punto.
 */
export function validaNota(
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
 * Validazione STRUTTURALE, senza config: risoluzione incompleta e `pending` con
 * risoluzione. E' quella usata in LETTURA (`findById`).
 *
 * Perche' separata dalla lunghezza delle note: il limite e' configurabile, e una
 * nota scritta sotto un limite piu' alto non e' un record corrotto quando il limite
 * scende. Se la lettura lo rifiutasse, abbassare `maxLength` renderebbe illeggibili
 * (e quindi non annullabili, non rifiutabili) candidature che nessuno ha scritto
 * male. La soglia non e' rimossa: e' spostata sul lato scrittura.
 */
export function validateMatchRequestStructure(
  campi: MatchRequest
): Result<MatchRequest, MatchRequestError> {
  if (campi.requesterTripId.trim() === '') {
    return err({ kind: 'requester-trip-missing' });
  }

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

/**
 * Costruttore di MatchRequest: il modo DA USARE per ottenerne una valida, in
 * SCRITTURA. Controlla le note contro `config` e poi la struttura. In lettura si usa
 * `validateMatchRequestStructure`, che non conosce il limite delle note.
 *
 * Attenzione, perche' il tipo non lo impone (come per `makeTrip`): input e output
 * sono entrambi `MatchRequest`, quindi qualunque modulo puo' costruire un letterale
 * e saltare questi controlli. Ogni adapter che scrive una candidatura deve passare
 * di qui.
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

  return validateMatchRequestStructure(campi);
}