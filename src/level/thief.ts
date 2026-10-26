// T70: equipo de ladrones. Evento de sala: un ladrón rápido y sin ataque te roba monedas al tocarte y corre hacia una
// puerta. Si lo abates antes de que salga, te devuelve lo robado y un extra; si escapa, esas monedas se pierden.
// Lógica pura, sin Phaser, para poder probarla con `node --test`.

/** Parte de tus monedas que se lleva el ladrón (antes del tope). */
export const THIEF_STEAL_RATE = 0.35;
/** Mínimo que intenta robar (si llevas pocas monedas, el tope de la mitad manda). */
export const THIEF_MIN_STEAL = 3;
/** Extra al recuperar lo robado: un 50 % más, y al menos 2 monedas, para que perseguirlo merezca la pena. */
export const THIEF_BONUS_RATE = 0.5;
export const THIEF_MIN_BONUS = 2;
/** Velocidad respecto a un enemigo normal: es más rápido que tú andando, pero se le puede alcanzar con disparos. */
export const THIEF_SPEED_MUL = 1.45;
/** Vida respecto a un enemigo normal: frágil, que la gracia es cazarlo a tiempo. */
export const THIEF_HP_MUL = 0.8;
/** Distancia (px) a la puerta a la que se da por escapado. */
export const THIEF_ESCAPE_DIST = 40;

/** Sin monedas no hay nada que robar: el evento no aparece y la sala es de combate normal. */
export const thiefCanAppear = (coins: number): boolean => Math.floor(coins) > 0;

/**
 * Monedas que roba con `coins` en el bolsillo: un 35 % (al menos 3), pero **nunca más de la mitad** (redondeando
 * abajo, salvo con 1 moneda, que se lleva esa) y nunca más de las que tienes, así la cuenta no baja de 0.
 */
export function thiefSteal(coins: number): number {
  const c = Math.max(0, Math.floor(coins));
  if (c === 0) return 0;
  const cap = Math.max(1, Math.floor(c / 2));
  return Math.min(c, cap, Math.max(THIEF_MIN_STEAL, Math.round(c * THIEF_STEAL_RATE)));
}

/** Lo que te devuelve si lo abates: lo robado más el extra. Si no te había robado nada, solo un pequeño premio. */
export function thiefRefund(stolen: number): number {
  const s = Math.max(0, Math.floor(stolen));
  return s + Math.max(THIEF_MIN_BONUS, Math.round(s * THIEF_BONUS_RATE));
}

/** Monedas tras el robo (nunca negativas). */
export const coinsAfterTheft = (coins: number, stolen: number): number => Math.max(0, Math.floor(coins) - Math.max(0, Math.floor(stolen)));

export interface Point {
  x: number;
  y: number;
}

/** Puerta hacia la que huye: la más alejada del jugador (así no corre hacia ti). `null` si la sala no tiene puertas. */
export function thiefEscapeDoor<T extends Point>(doors: readonly T[], player: Point): T | null {
  let best: T | null = null;
  let bestD = -1;
  for (const d of doors) {
    const dist = (d.x - player.x) ** 2 + (d.y - player.y) ** 2;
    if (dist > bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

/** ¿Ha llegado ya a la puerta? */
export const thiefEscaped = (thief: Point, door: Point): boolean => Math.hypot(thief.x - door.x, thief.y - door.y) <= THIEF_ESCAPE_DIST;
