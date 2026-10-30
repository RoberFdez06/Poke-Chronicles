// Parry (rehecho para que sea perdonador). Pulsas el botón justo ANTES de que te den: durante una ventana amplia
// (PARRY_WINDOW_MS, ~0,4 s) el siguiente golpe que te llegue se anula. Si llega en la primera mitad de la ventana es
// «perfecto» (más premio y chispas más grandes). Fallar no castiga: solo hay un enfriamiento corto antes de poder
// volver a pulsar, y si aciertas se puede encadenar casi enseguida. Lógica pura, sin Phaser: la escena dice cuándo se
// pulsa y cuándo llega un golpe.
//
// Dos relojes, a propósito:
// - La ventana y el enfriamiento van con el reloj del bucle del juego (`game.loop.time`), que avanza siempre, también
//   en pausa: una pulsación justo antes de pausar no se queda «cargada» para cuando vuelvas.
// - El contraataque (crítico seguro) va con el reloj de la escena: si pausas con el crítico pendiente, no lo pierdes.

/** Margen entre la pulsación y el golpe para que cuente (ms). Amplio: se pulsa al ver la marca de aviso. */
export const PARRY_WINDOW_MS = 400;
/** Primera parte de la ventana que cuenta como parry perfecto (ms). */
export const PARRY_PERFECT_MS = 200;
/** Enfriamiento corto tras una pulsación fallida (ms, contado desde que se cierra la ventana). Es todo el castigo. */
export const PARRY_MISS_COOLDOWN_MS = 300;
/** Tras un parry acertado se puede volver a pulsar casi enseguida (ms), para encadenar varios golpes seguidos. */
export const PARRY_HIT_COOLDOWN_MS = 120;
/** Ciclo completo de una pulsación fallida: ventana + enfriamiento (para la barra del HUD). */
export const PARRY_COOLDOWN_MS = PARRY_WINDOW_MS + PARRY_MISS_COOLDOWN_MS;
/** Tiempo para aprovechar el crítico garantizado después de un parry (ms). */
export const PARRY_COUNTER_MS = 2000;
/** Invulnerabilidad corta tras bloquear: el contacto con un enemigo se comprueba cada fotograma y sin ella el mismo
 *  enemigo te daría en el fotograma siguiente, con lo que el parry no habría bloqueado nada. */
export const PARRY_GRACE_MS = 350;
/** Con cuánta antelación se marca un golpe que se acerca (ms): da tiempo a reaccionar antes de que abra la ventana. */
export const PARRY_WARN_MS = 700;
/** Aturdimiento del atacante cuerpo a cuerpo (ms): normal, perfecto y contra jefes (más corto). */
export const PARRY_STUN_MS = { normal: 900, perfect: 1400, boss: 350 } as const;
/** Daño del proyectil devuelto: veces el daño que traía (y nunca menos que tu disparo normal). */
export const PARRY_REFLECT_MUL = { normal: 1.6, perfect: 2.5 } as const;

export type ParryResult = 'perfect' | 'normal';

export interface ParryState {
  /** Momento (reloj del bucle) de la última pulsación aún sin gastar; -Infinity si no hay ninguna viva. */
  pressedAt: number;
  /** Desde cuándo (reloj del bucle) se puede volver a pulsar. */
  readyAt: number;
  /** Cuánto dura la recarga actual (para la barra: el acierto la acorta). */
  cooldownMs: number;
  /** Hasta cuándo (reloj de la escena) el siguiente golpe tuyo es crítico; 0 = no hay contraataque. */
  counterUntil: number;
  /** Parrys acertados en la partida (para el resumen y la adrenalina). */
  hits: number;
  /** De ellos, perfectos. */
  perfects: number;
}

export const newParry = (): ParryState => ({ pressedAt: -Infinity, readyAt: 0, cooldownMs: PARRY_COOLDOWN_MS, counterUntil: 0, hits: 0, perfects: 0 });

/** Se pulsa el botón. Devuelve false si aún está en enfriamiento (y entonces no hace nada). */
export function pressParry(s: ParryState, loopNow: number): boolean {
  if (loopNow < s.readyAt) return false;
  s.pressedAt = loopNow;
  s.cooldownMs = PARRY_COOLDOWN_MS;
  s.readyAt = loopNow + PARRY_COOLDOWN_MS;
  return true;
}

/** ¿Está la ventana abierta ahora (pulsación viva y sin gastar)? */
export const parryOpen = (s: ParryState, loopNow: number): boolean => {
  const since = loopNow - s.pressedAt;
  return since >= 0 && since <= PARRY_WINDOW_MS;
};

/** Fracción del enfriamiento que queda (1 = recién pulsado, 0 = listo), para dibujarla en el HUD. */
export const parryCooldownLeft = (s: ParryState, loopNow: number): number =>
  Math.max(0, Math.min(1, (s.readyAt - loopNow) / Math.max(1, s.cooldownMs)));

/**
 * Llega un golpe. Si hay una pulsación viva dentro de la ventana (y el golpe se puede bloquear), se gasta, abre el
 * contraataque y devuelve si fue perfecto o normal; si no, null y el golpe sigue su curso. Una pulsación para un golpe.
 */
export function tryParry(s: ParryState, loopNow: number, sceneNow: number, unblockable = false): ParryResult | null {
  if (unblockable) return null;
  const since = loopNow - s.pressedAt;
  if (since < 0 || since > PARRY_WINDOW_MS) return null;
  s.pressedAt = -Infinity;
  s.hits++;
  const result: ParryResult = since <= PARRY_PERFECT_MS ? 'perfect' : 'normal';
  if (result === 'perfect') s.perfects++;
  // Acertar no te deja esperando: casi enseguida se puede volver a pulsar (para el siguiente golpe de una ráfaga)
  s.cooldownMs = PARRY_HIT_COOLDOWN_MS;
  s.readyAt = loopNow + PARRY_HIT_COOLDOWN_MS;
  // No se apila: otro parry durante el contraataque solo renueva el plazo, sigue siendo UN crítico
  s.counterUntil = sceneNow + PARRY_COUNTER_MS;
  return result;
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

/** Qué devuelve el parry: aturdimiento al que pega cuerpo a cuerpo (ms) o daño del proyectil reflejado. */
export function parryStun(result: ParryResult, boss: boolean): number {
  return boss ? PARRY_STUN_MS.boss : PARRY_STUN_MS[result];
}

export function parryReflectDamage(result: ParryResult, incoming: number, ownShot: number): number {
  return Math.max(Math.round(ownShot), Math.round(incoming * PARRY_REFLECT_MUL[result]));
}

/**
 * Milisegundos hasta que algo que está en (dx, dy) respecto al jugador, moviéndose a (vx, vy) px/s respecto a él,
 * llega a `reach` px de distancia. 0 si ya está encima; Infinity si no se acerca o pasa de largo.
 */
export function timeToImpact(dx: number, dy: number, vx: number, vy: number, reach: number): number {
  const c = dx * dx + dy * dy - reach * reach;
  if (c <= 0) return 0;
  const a = vx * vx + vy * vy;
  const b = 2 * (dx * vx + dy * vy);
  if (a < 1e-6 || b >= 0) return Infinity;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t < 0 ? Infinity : t * 1000;
}

/** Marca de aviso de un golpe que llega en `ms`: nada, «pronto» (prepárate) o «ya» (pulsa: entra en la ventana). */
export function threatLevel(ms: number): 'none' | 'soon' | 'now' {
  if (!Number.isFinite(ms) || ms > PARRY_WARN_MS) return 'none';
  return ms <= PARRY_WINDOW_MS ? 'now' : 'soon';
}
