// Esquiva (dash): impulso corto en la dirección en que te mueves (o hacia donde miras si estás quieto), con
// invulnerabilidad breve y recarga. No gasta adrenalina. Convive con el parry: el parry anula un golpe a tiempo;
// la esquiva te saca de en medio (también de lo que el parry no para: zonas, ondas y láseres de jefe).
// Lógica pura, sin Phaser. Todo con el reloj de la escena (ms).
import { clampDash, type Bounds } from '../level/bounds.ts';

/** Distancia que recorre (px de la sala) y cuánto tarda (ms). */
export const DASH_DISTANCE = 170;
export const DASH_MS = 170;
/** Invulnerabilidad desde que empieza (ms). */
export const DASH_INVULN_MS = 250;
/** Recarga (ms) desde que empieza. */
export const DASH_COOLDOWN_MS = 1200;
/** Por debajo de este largo, la dirección de movimiento no cuenta (stick casi suelto) y se usa la mirada. */
export const DASH_DEADZONE = 0.2;

export interface Vec {
  x: number;
  y: number;
}

export interface DashState {
  /** Desde cuándo se puede volver a esquivar. */
  readyAt: number;
  /** Hasta cuándo dura el impulso. */
  until: number;
  /** Hasta cuándo no te pueden dar. */
  invulnUntil: number;
  /** Dirección del último impulso (normalizada). */
  dir: Vec;
  /** Esquivas de la partida (para el resumen). */
  uses: number;
}

export const newDash = (): DashState => ({ readyAt: 0, until: 0, invulnUntil: 0, dir: { x: 1, y: 0 }, uses: 0 });

export const canDash = (s: DashState, now: number): boolean => now >= s.readyAt;
export const dashing = (s: DashState, now: number): boolean => now < s.until;
export const dashInvulnerable = (s: DashState, now: number): boolean => now < s.invulnUntil;

/** Fracción de la recarga que queda (1 = recién usada, 0 = lista). */
export const dashCooldownLeft = (s: DashState, now: number): number =>
  Math.max(0, Math.min(1, (s.readyAt - now) / DASH_COOLDOWN_MS));

/** Velocidad del impulso (px/s) para recorrer DASH_DISTANCE en DASH_MS. */
export const dashSpeed = (): number => DASH_DISTANCE / (DASH_MS / 1000);

/** Dirección de la esquiva: la del movimiento si se mueve; si no, hacia donde mira. Siempre de largo 1. */
export function dashDirection(move: Vec, facing: Vec): Vec {
  const ml = Math.hypot(move.x, move.y);
  if (ml >= DASH_DEADZONE) return { x: move.x / ml, y: move.y / ml };
  const fl = Math.hypot(facing.x, facing.y);
  if (fl > 1e-6) return { x: facing.x / fl, y: facing.y / fl };
  return { x: 0, y: 1 };
}

/**
 * Empieza la esquiva si está lista: devuelve la velocidad que hay que dar al jugador o null si está en recarga.
 * Las paredes y las puertas cerradas las para la física (colisiones); el borde de la sala, dashEnd/keepInside.
 */
export function startDash(s: DashState, now: number, move: Vec, facing: Vec): Vec | null {
  if (!canDash(s, now)) return null;
  const d = dashDirection(move, facing);
  s.dir = d;
  s.until = now + DASH_MS;
  s.invulnUntil = now + DASH_INVULN_MS;
  s.readyAt = now + DASH_COOLDOWN_MS;
  s.uses++;
  const v = dashSpeed();
  return { x: d.x * v, y: d.y * v };
}

/** Dónde acabaría la esquiva desde (x, y) sin salir de la sala (`margin` = medio cuerpo). */
export function dashEnd(x: number, y: number, dir: Vec, b: Bounds, margin = 0): Vec {
  return clampDash(x, y, x + dir.x * DASH_DISTANCE, y + dir.y * DASH_DISTANCE, b, margin);
}
