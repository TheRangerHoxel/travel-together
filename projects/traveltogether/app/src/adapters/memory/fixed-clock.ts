// FixedClock — un orologio fermo, che si sposta solo quando glielo si dice.
//
// E' il motivo per cui Clock esiste come port: con questo, "la data di partenza e'
// nel passato" diventa una proprieta' dei dati e non del momento in cui gira la
// suite. I test sui confini temporali (T04) sarebbero altrimenti impossibili da
// scrivere in modo deterministico.

import type { Clock } from '../../core/ports';

export class FixedClock implements Clock {
  private istante: string;

  constructor(istante: string) {
    this.istante = istante;
  }

  now(): string {
    return this.istante;
  }

  /** Sposta l'orologio. Serve ai test che verificano un passaggio di stato nel tempo. */
  set(istante: string): void {
    this.istante = istante;
  }
}
