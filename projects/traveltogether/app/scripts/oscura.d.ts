// Tipi di oscura.js, per l'harness dei test di integrazione (TypeScript).

export function oscura(testo: string, url: string): string;

/** Un errore nuovo: messaggio e stack oscurati, `code` conservato se c'era. */
export function oscuraErrore(errore: unknown, url: string): Error & { code?: string };
