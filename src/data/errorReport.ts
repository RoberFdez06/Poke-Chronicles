// Pantalla de error (T43): qué se enseña y qué se copia de un error. Lógica pura, con tests.

/** Errores que no son fallos del juego y no deben sacar la pantalla (avisos del navegador, audio bloqueado…). */
const BENIGN = [/ResizeObserver loop/i, /play\(\) (failed|request was interrupted)/i, /NotAllowedError/i, /AbortError/i, /The user aborted/i];

export function isBenignError(err: unknown): boolean {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return BENIGN.some((re) => re.test(text));
}

/** Mensaje corto para el cuadro (una línea, sin la pila). */
export function shortMessage(err: unknown, max = 140): string {
  let text: string;
  if (err instanceof Error) text = err.message || err.name;
  else if (typeof err === 'string') text = err;
  else {
    try {
      text = JSON.stringify(err) ?? String(err);
    } catch {
      text = String(err);
    }
  }
  text = text.replace(/\s+/g, ' ').trim() || 'Error desconocido';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export interface ErrorContext {
  /** Pantallas activas cuando falló. */
  scenes: string[];
  url: string;
  userAgent: string;
  /** Fecha (ISO). */
  when: string;
  version?: string;
}

/** Texto completo para "Copiar detalles" (y la consola). */
export function errorDetails(err: unknown, ctx: ErrorContext): string {
  const stack = err instanceof Error && err.stack ? err.stack : '(sin pila)';
  return [
    `Poké Chronicles — informe de error`,
    `Fecha: ${ctx.when}`,
    ctx.version ? `Versión: ${ctx.version}` : null,
    `Pantallas: ${ctx.scenes.join(', ') || '(ninguna)'}`,
    `Dirección: ${ctx.url}`,
    `Navegador: ${ctx.userAgent}`,
    `Error: ${err instanceof Error ? `${err.name}: ${err.message}` : shortMessage(err, 2000)}`,
    `Pila:`,
    stack,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}
