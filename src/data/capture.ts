// T65: capturar enemigos con una Poké Ball (uno por piso). Lógica pura: quién se puede capturar, la probabilidad según
// los PS que le quedan, la espera tras un fallo y el aliado temporal (reutiliza el ayudante del huevo, `allyId`).

/** Solo se puede lanzar con el enemigo al 25 % de PS o menos (así hay que debilitarlo antes, como en los juegos). */
export const CAPTURE_HP_RATIO = 0.25;
/** Tras un fallo hay que esperar 3 s para volver a lanzar (si no, bastaría con machacar el botón). */
export const CAPTURE_RETRY_MS = 3000;
/** Distancia máxima (px) a la que llega la Poké Ball. */
export const CAPTURE_RANGE = 170;
/** Probabilidad con el enemigo casi a 0 PS y justo al 25 %: más baja la vida, más fácil. */
export const CAPTURE_CHANCE_MAX = 0.9;
export const CAPTURE_CHANCE_MIN = 0.3;

/** Lo que importa de un enemigo para saber si se puede capturar. */
export interface CaptureTarget {
  hp: number;
  maxHp: number;
  boss?: boolean;
  miniboss?: boolean;
  elite?: boolean;
  /** Legendario o singular (aunque saliera como enemigo normal). */
  legendary?: boolean;
  /** Ayudante invocado por un jefe. */
  helper?: boolean;
  /** Shiny de jefe (los shinies normales sí se pueden capturar). */
  shinyBoss?: boolean;
  /** Enemigos de evento (el que huye, el mímico, el reto final…): son parte de la sala, no se capturan. */
  special?: boolean;
}

/** ¿Es de los que nunca se pueden capturar, tenga la vida que tenga? */
export function isCapturableKind(t: CaptureTarget): boolean {
  return !t.boss && !t.miniboss && !t.elite && !t.legendary && !t.helper && !t.shinyBoss && !t.special;
}

/** ¿Está lo bastante débil (25 % o menos, pero vivo)? */
export function isWeakEnough(hp: number, maxHp: number): boolean {
  return maxHp > 0 && hp > 0 && hp / maxHp <= CAPTURE_HP_RATIO + 1e-9;
}

export const canCapture = (t: CaptureTarget): boolean => isCapturableKind(t) && isWeakEnough(t.hp, t.maxHp);

/** Probabilidad de que la captura salga bien: lineal del 90 % (casi sin PS) al 30 % (justo al 25 %). 0 si no vale. */
export function captureChance(hp: number, maxHp: number): number {
  if (!isWeakEnough(hp, maxHp)) return 0;
  const r = Math.min(1, hp / maxHp / CAPTURE_HP_RATIO);
  return CAPTURE_CHANCE_MAX - (CAPTURE_CHANCE_MAX - CAPTURE_CHANCE_MIN) * r;
}

/** Estado de la captura en el piso actual. */
export interface CaptureState {
  /** Ya has capturado en este piso (solo un éxito por piso). */
  done: boolean;
  /** Momento (ms del reloj del juego) desde el que se puede volver a lanzar. */
  readyAt: number;
  /** Ayudante del huevo que llevabas antes de capturar (se recupera al cambiar de piso); null = no hay aliado capturado. */
  prevAllyId: number | null;
}

export const newCaptureState = (): CaptureState => ({ done: false, readyAt: 0, prevAllyId: null });

export type ThrowCheck = 'ok' | 'done' | 'cooldown';

/** ¿Se puede lanzar ahora? */
export function canThrow(s: CaptureState, now: number): ThrowCheck {
  if (s.done) return 'done';
  return now < s.readyAt ? 'cooldown' : 'ok';
}

/**
 * Resultado de un lanzamiento. Si sale bien: gasta la captura del piso y el capturado pasa a ser el ayudante (se guarda
 * el que había para devolverlo al cambiar de piso). Si falla: no gasta nada, pero hay que esperar CAPTURE_RETRY_MS.
 */
export function resolveThrow(s: CaptureState, now: number, success: boolean, allyId: number, caughtId: number): { state: CaptureState; allyId: number } {
  if (!success) return { state: { ...s, readyAt: now + CAPTURE_RETRY_MS }, allyId };
  return { state: { done: true, readyAt: now, prevAllyId: s.prevAllyId ?? allyId }, allyId: caughtId };
}

/** Lanza la Poké Ball con un número al azar [0, 1). */
export const rollCapture = (hp: number, maxHp: number, roll: number): boolean => roll < captureChance(hp, maxHp);

/** Al pasar de piso: el capturado se va (vuelve el ayudante del huevo si lo había) y la captura se recarga. */
export function nextFloorCapture(s: CaptureState, allyId: number): { state: CaptureState; allyId: number } {
  return { state: newCaptureState(), allyId: s.prevAllyId ?? allyId };
}
