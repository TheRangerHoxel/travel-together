// Result — gli errori di dominio sono TIPI DI RITORNO, non eccezioni.
//
// Una funzione che puo' fallire lo dichiara nella firma, quindi il compilatore
// obbliga chi la chiama a gestire il caso. Con un'eccezione, l'unico modo di
// sapere che una chiamata puo' fallire e' leggerne il corpo o scoprirlo in
// produzione.

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}
