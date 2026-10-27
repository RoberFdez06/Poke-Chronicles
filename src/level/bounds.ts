// Límites de la arena: nada sale del mapa (jugador, enemigos, invocados, proyectiles, embestidas y teletransportes).
// Lógica pura, sin Phaser.

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const clampN = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));

/** El punto dentro de la arena dejando `margin` (medio cuerpo) de hueco con la pared. */
export function clampToBounds(x: number, y: number, b: Bounds, margin = 0): { x: number; y: number } {
  return { x: clampN(x, b.x0 + margin, b.x1 - margin), y: clampN(y, b.y0 + margin, b.y1 - margin) };
}

/** ¿Está fuera de la arena (con `slack` de tolerancia hacia fuera)? */
export function outOfBounds(x: number, y: number, b: Bounds, slack = 0): boolean {
  return x < b.x0 - slack || x > b.x1 + slack || y < b.y0 - slack || y > b.y1 + slack;
}

/**
 * Destino de una embestida o teletransporte de (x, y) hacia (tx, ty): se para justo en el borde de la arena (con
 * `margin`), en la misma dirección, en lugar de atravesar la pared.
 */
export function clampDash(x: number, y: number, tx: number, ty: number, b: Bounds, margin = 0): { x: number; y: number } {
  const s = clampToBounds(x, y, b, margin);
  const dx = tx - s.x;
  const dy = ty - s.y;
  let t = 1;
  const lx = b.x0 + margin;
  const hx = b.x1 - margin;
  const ly = b.y0 + margin;
  const hy = b.y1 - margin;
  if (dx > 0 && s.x + dx > hx) t = Math.min(t, (hx - s.x) / dx);
  if (dx < 0 && s.x + dx < lx) t = Math.min(t, (lx - s.x) / dx);
  if (dy > 0 && s.y + dy > hy) t = Math.min(t, (hy - s.y) / dy);
  if (dy < 0 && s.y + dy < ly) t = Math.min(t, (ly - s.y) / dy);
  t = Math.max(0, t);
  return clampToBounds(s.x + dx * t, s.y + dy * t, b, margin);
}

/** Velocidad que no empuja más allá del borde: si está pegado a un lado, se anula la componente hacia fuera. */
export function clampVelocity(x: number, y: number, vx: number, vy: number, b: Bounds, margin = 0): { vx: number; vy: number } {
  return {
    vx: (x <= b.x0 + margin && vx < 0) || (x >= b.x1 - margin && vx > 0) ? 0 : vx,
    vy: (y <= b.y0 + margin && vy < 0) || (y >= b.y1 - margin && vy > 0) ? 0 : vy,
  };
}

/**
 * Longitud real de un haz que sale de (x, y) con ángulo `a` y largo `len`: se corta donde toca el borde de la arena
 * (con `margin` de hueco), para que ni se dibuje ni golpee fuera del mapa. Origen fuera: se acota primero al borde.
 */
export function clipBeamToBounds(x: number, y: number, a: number, len: number, b: Bounds, margin = 0): number {
  const o = clampToBounds(x, y, b, margin);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const lx = b.x0 + margin;
  const hx = b.x1 - margin;
  const ly = b.y0 + margin;
  const hy = b.y1 - margin;
  let t = len;
  if (dx > 1e-9) t = Math.min(t, (hx - o.x) / dx);
  else if (dx < -1e-9) t = Math.min(t, (lx - o.x) / dx);
  if (dy > 1e-9) t = Math.min(t, (hy - o.y) / dy);
  else if (dy < -1e-9) t = Math.min(t, (ly - o.y) / dy);
  return Math.max(0, Math.min(len, t));
}
