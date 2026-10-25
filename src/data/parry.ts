// T53: Parry. Si pulsas el botón justo antes de que te den, bloqueas el golpe entero y tu siguiente ataque que
// impacte es crítico seguro. Lógica pura, sin Phaser: la escena solo dice cuándo se pulsa y cuándo llega un golpe.
//
// Dos relojes distintos, a propósito:
// - La ventana y la recarga van con el reloj del bucle del juego (`game.loop.time`), que avanza siempre, también en
//   pausa: así una pulsación justo antes de pausar no se queda "cargada" para cuando vuelvas (el reloj de la escena
//   se para en pausa y la recarga se congelaría con él).
// - El contraataque va con el reloj de la escena: si pausas con el crítico pendiente, no lo pierdes por estar en el menú.

/** Margen entre la pulsación y el golpe para que cuente (ms). Corto, para que pida reflejos. */
export const PARRY_WINDOW_MS = 200;
/**
 * Recarga tras pulsar, acierte o no (ms). Roberto escribió «0.5 ms» pero quería medio segundo: con 0,5 ms se podría
 * aporrear el botón y bloquearlo todo. Si se siente mal, se toca aquí.
 */
export const PARRY_COOLDOWN_MS = 500;
/** Tiempo para aprovechar el crítico garantizado después de un parry (ms). */
export const PARRY_COUNTER_MS = 2000;
/** Invulnerabilidad corta tras bloquear: el contacto con un enemigo se comprueba cada fotograma y sin ella el mismo
 *  enemigo te daría en el fotograma siguiente, con lo que el parry no habría bloqueado nada. */
export const PARRY_GRACE_MS = 350;

export interface ParryState {
  /** Momento (reloj del bucle) de la última pulsación aún sin gastar; -Infinity si no hay ninguna viva. */
  pressedAt: number;
  /** Desde cuándo (reloj del bucle) se puede volver a pulsar. */
  readyAt: number;
  /** Hasta cuándo (reloj de la escena) el siguiente golpe tuyo es crítico; 0 = no hay contraataque. */
  counterUntil: number;
  /** Parrys acertados en la partida (para el resumen y la adrenalina). */
  hits: number;
}

export const newParry = (): ParryState => ({ pressedAt: -Infinity, readyAt: 0, counterUntil: 0, hits: 0 });

/** Se pulsa el botón. Devuelve false si aún está en recarga (y entonces no hace nada). */
export function pressParry(s: ParryState, loopNow: number): boolean {
  if (loopNow < s.readyAt) return false;
  s.pressedAt = loopNow;
  s.readyAt = loopNow + PARRY_COOLDOWN_MS;
  return true;
}

/** Fracción de la recarga que queda (1 = recién pulsado, 0 = listo), para dibujarla en el HUD. */
export const parryCooldownLeft = (s: ParryState, loopNow: number): number =>
  Math.max(0, Math.min(1, (s.readyAt - loopNow) / PARRY_COOLDOWN_MS));

/**
 * Llega un golpe. Si hay una pulsación viva dentro de la ventana (y el golpe se puede bloquear), se gasta y abre el
 * contraataque: devuelve true y el golpe no hace daño. Una pulsación bloquea un solo golpe.
 */
export function tryParry(s: ParryState, loopNow: number, sceneNow: number, unblockable = false): boolean {
  if (unblockable) return false;
  const since = loopNow - s.pressedAt;
  if (since < 0 || since > PARRY_WINDOW_MS) return false;
  s.pressedAt = -Infinity;
  s.hits++;
  // No se apila: otro parry durante el contraataque solo renueva el plazo, sigue siendo UN crítico
  s.counterUntil = sceneNow + PARRY_COUNTER_MS;
  return true;
}

/** ¿Este golpe tuyo es el crítico del contraataque? Si lo es, lo gasta (solo uno por parry). */
export function takeCounterCrit(s: ParryState, sceneNow: number): boolean {
  if (s.counterUntil <= 0 || sceneNow >= s.counterUntil) {
    s.counterUntil = 0;
    return false;
  }
  s.counterUntil = 0;
  return true;
}
