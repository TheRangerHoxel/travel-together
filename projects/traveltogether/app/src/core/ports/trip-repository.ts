// TripRepository — persistenza delle trasferte.

import type {
  LegDirection,
  ProfileId,
  Result,
  SeatOffer,
  Trip,
  TripId,
  TripLeg,
} from '../domain';
import type { RepositoryError } from './repository-error';

export interface TripRepository {
  /**
   * Scrive la trasferta. Semantica **upsert**: salvare due volte lo stesso `id`
   * sostituisce la versione precedente, non produce un conflitto.
   *
   * Valida gli invarianti di dominio **prima** di scrivere e ritorna
   * `invalid-record` se non reggono, lasciando lo storage intatto. E' il confine
   * in cui la validazione avviene, e vale per entrambi gli adapter.
   *
   * **Materializza le tratte** (`TripLeg`) quando la trasferta ha l'auto: una riga
   * per l'andata e, se `returnAt` non e' null, una per il ritorno; senza auto
   * nessuna. Una tratta nuova parte con `seatsAvailable` uguale a quello della
   * trasferta: i posti sono PER TRATTA, non in tutto.
   *
   * **Preserva i contatori esistenti.** Se una tratta c'e' gia', il suo
   * `seatsAvailable` NON viene toccato: risalvare la trasferta non puo' azzerare
   * in silenzio i posti gia' accettati. Si creano solo le tratte mancanti e si
   * eliminano quelle che la nuova forma non prevede (auto tolta: tutte; `returnAt`
   * tolto: il ritorno). I posti di una tratta esistente si cambiano solo con
   * `adjustLegSeats`. Se `seatsTotal` cambia, il contatore preservato deve
   * comunque stare in [0, nuovo totale]: altrimenti il salvataggio e' rifiutato
   * con `invalid-record` e non scrive nulla.
   *
   * **Non toglie una tratta referenziata da una candidatura**, in qualunque stato
   * (anche `rejected` o `cancelled`): ritorna `invalid-record` e lascia lo storage
   * intatto, trasferta compresa. Su Postgres e' la foreign key `RESTRICT` da
   * `match_requests` a `trip_legs`; in RAM un controllo su tutte le candidature. Chi
   * vuole togliere la tratta deve prima gestire le candidature (task di modifica
   * trasferta, non ancora nel backlog).
   */
  save(trip: Trip): Promise<Result<Trip, RepositoryError>>;

  /**
   * Rilegge una trasferta. Valida gli invarianti: un record invalido che arriva
   * dallo storage produce `invalid-record`, non un `Trip` malformato in circolo.
   */
  findById(id: TripId): Promise<Result<Trip, RepositoryError>>;

  /**
   * Le trasferte di un collega. **Omette** le righe che `makeTrip` rifiuta, invece di
   * far fallire la lista: vedi la nota su `invalid-record`.
   */
  listByOwner(ownerId: ProfileId): Promise<Result<readonly Trip[], RepositoryError>>;

  /**
   * Le TRATTE delle trasferte pubblicate con almeno un posto libero, proiettate in
   * SeatOffer. Una trasferta con auto e `returnAt` non null produce DUE offerte:
   * l'andata (`from -> to` all'orario di `departureAt`) e il ritorno (plant
   * INVERTITI, orario di `returnAt`); con `returnAt` null ne produce una; senza
   * auto nessuna.
   *
   * I posti si leggono dal contatore di TRATTA, non da `Trip.seatsAvailable`, e il
   * filtro "almeno un posto libero" e' per tratta: andata esaurita e ritorno libero
   * danno una sola offerta, quella del ritorno.
   *
   * Non serve filtrare su `hasCar`: le tratte esistono solo per le trasferte con
   * auto. Aggiungere quel filtro darebbe un predicato irraggiungibile, cioe' non
   * verificabile da nessun test.
   *
   * E' una **proiezione**, non una ricerca: definisce cosa *e'* un'offerta, non
   * *quali* offerte servano a un dato collega. Nessun filtro su plant, data od
   * orario: quelli sono i vincoli duri del matching e stanno in findMatches (T03),
   * funzione pura testabile sui confini. Spostarli qui li renderebbe logica di
   * business dentro un adapter — vietato da T09 — e li costringerebbe a esistere
   * due volte, in RAM e in SQL, con l'obbligo di restare d'accordo.
   *
   * `ownerPlantId` si ottiene con una join sul profilo di chi offre. Semantica di
   * **inner join**: se il profilo non esiste, l'offerta viene omessa. Non si
   * sostituisce un valore di ripiego — `ownerPlantId` pesa nel punteggio di T03, e
   * un dato inventato ma plausibile falserebbe la classifica senza farsi notare.
   * Omettere una sola offerta e' anche il degrado giusto: far fallire tutta la
   * ricerca per una riga incoerente lascerebbe la demo con una schermata vuota.
   *
   * Per lo stesso motivo **omette** la trasferta che `makeTrip` rifiuta e la tratta
   * che `makeTripLeg` rifiuta (vedi la nota su `invalid-record`): una tratta con 2
   * posti totali e 5 liberi non diventa un'offerta con cinque posti.
   *
   * Ogni coppia (`tripId`, `direction`) compare **una sola volta**: e' la
   * precondizione dell'ordine totale di `findMatches` e dello stato che marca ogni
   * offerta. Un adapter su Postgres che la ottenesse da una join deve evitare che
   * la join la duplichi.
   *
   * Cosa lo schema di T08 garantisce a questo metodo (entrambe necessarie):
   * - la RLS di lettura su `trips`, `trip_legs` e `profiles` e' `SELECT` per ogni
   *   `authenticated`: le offerte pubblicate di tutti i colleghi sono visibili. Senza,
   *   findMatches non vedrebbe nulla e la suite di contratto, in RAM, non se ne
   *   accorgerebbe. Con `anon` (nessuna identita') le liste sono vuote, non un errore.
   * - la foreign key `trips.owner_id -> profiles.id`: lo stato "offerta con owner
   *   inesistente" non esiste su Postgres, quindi l'omissione descritta sopra non puo'
   *   nascondere una perdita silenziosa.
   */
  listOpenOffers(): Promise<Result<readonly SeatOffer[], RepositoryError>>;

  /**
   * Lo stato dei posti di una tratta. `not-found` se la tratta non esiste: la
   * trasferta non c'e', non ha l'auto, o e' senza rientro e si chiede il ritorno.
   * Valida gli invarianti come `findById`.
   */
  findLeg(tripId: TripId, direction: LegDirection): Promise<Result<TripLeg, RepositoryError>>;

  /**
   * Aggiunge `delta` (intero, positivo o negativo) ai posti liberi di una tratta e
   * ritorna la tratta aggiornata.
   *
   * La firma e' RELATIVA di proposito. Un `setLegSeats(.., n)` obbligherebbe chi
   * chiama a leggere, calcolare e riscrivere: fra la lettura e la scrittura una
   * seconda accettazione concorrente vedrebbe lo stesso valore, e l'ultimo posto
   * verrebbe venduto due volte (criterio di T05). Con un delta l'adapter lo fa in
   * un'unica operazione atomica. Su Postgres e' la funzione `adjust_leg_seats(trip_id,
   * direction, delta)` (T08, `security definer`), che contiene
   * `UPDATE trip_legs SET seats_available = seats_available + :delta
   *  WHERE trip_id = :t AND direction = :d
   *  AND seats_available + :delta BETWEEN 0 AND seats_total`:
   * PostgREST non esprime un aggiornamento relativo a una colonna, quindi l'adapter la
   * chiama come rpc. Zero righe restituite si traduce nell'errore sotto; la tratta
   * inesistente e' l'errore `P0002`, un chiamante non autorizzato `42501`.
   *
   * Se il risultato uscirebbe da [0, seatsTotal] ritorna `invalid-record` (il
   * `detail` e' il `kind` di `TripLegError`) e lo storage resta intatto: il
   * contatore non scende sotto zero ne' supera i totali. `not-found` se la tratta
   * non esiste.
   *
   * **Chi puo' chiamarlo:** il proprietario della trasferta, oppure il richiedente di
   * una candidatura `accepted` su quella tratta (`cancelRequest` restituisce il posto
   * prima di scrivere `cancelled`, quindi la riga e' ancora `accepted`). Il richiedente
   * puo' solo `+1` o `-1` (la compensazione dopo una save fallita), ma lo puo' ripetere
   * finche' la riga e' `accepted` (rischio dichiarato, vedi ARCHITECTURE.md); l'owner e' libero entro
   * i limiti. Chiunque altro, o un altro delta per il richiedente, e' rifiutato con
   * `storage-unavailable`, come ogni scrittura negata. Ordine dei
   * controlli: esistenza (`not-found`), identita', limiti (`invalid-record`).
   */
  adjustLegSeats(
    tripId: TripId,
    direction: LegDirection,
    delta: number
  ): Promise<Result<TripLeg, RepositoryError>>;
}
