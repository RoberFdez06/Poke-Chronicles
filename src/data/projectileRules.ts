// Qué ataques chocan con las estructuras (paredes, rocas, bloques, muros interiores de las salas grandes) y cuáles
// pasan por encima. Lógica pura, sin Phaser; con extensión .ts para los tests (node --test).
//
// Regla del juego: todo lo que viaja a ras de suelo o en línea (disparos, balas, orbes, bumeranes, teledirigidos,
// chorros, rayos, láseres, ondas lineales, cadenas eléctricas) se para en la primera estructura (o rebota si el ataque
// ya rebota). Lo que «vuela y cae» (bombas en parábola, meteoros, lluvias desde arriba, géiseres y ataques de zona que
// golpean el suelo, minas, juicios desde el cielo) pasa por encima.

export interface Box { x: number; y: number; w: number; h: number }

/** Todos los tipos de ataque del juego: patrones del motor (attacks.ts) y ataques propios de los jefes (GameScene). */
export const ATTACK_KINDS = [
  // Motor de ataques (jugador, enemigos, fusiones)
  'shot', 'stream', 'beam', 'nova', 'quake', 'rain', 'lob', 'orbit', 'wall', 'chain', 'eruption', 'mine', 'dash', 'vortex',
  // Disparo básico del jugador y de los enemigos
  'playerShot', 'foeShot',
  // Jefes: patrones de disparos, extras, ráfagas, final y megaataque
  'ring', 'star8', 'cross', 'fan', 'sweep', 'spiral', 'helix', 'charge', 'summon', 'bossRain', 'hazard', 'shockwave',
  'laser', 'megaBlast', 'meteor', 'wallGap', 'crossMines', 'gridBeams', 'bounce', 'miasma', 'lineDash', 'judgment', 'finaleNova',
] as const;
export type AttackKind = (typeof ATTACK_KINDS)[number];

/**
 * true: vuela y cae (o sale del suelo) y pasa por encima de las estructuras. false: viaja en línea y choca.
 * `dash`, `charge` y `lineDash` son el cuerpo del atacante (sus choques los lleva la física), `summon` no daña y
 * `orbit` gira pegado a quien lo lanza: se marcan como «chocan» para que, si un orbe toca una roca, se apague.
 */
export const PASSES_OVER: Readonly<Record<AttackKind, boolean>> = {
  shot: false, stream: false, beam: false, nova: false, quake: true, rain: true, lob: true, orbit: false, wall: false,
  chain: false, eruption: true, mine: true, dash: false, vortex: true,
  playerShot: false, foeShot: false,
  ring: false, star8: false, cross: false, fan: false, sweep: false, spiral: false, helix: false, charge: false,
  summon: true, bossRain: true, hazard: true, shockwave: false, laser: false, megaBlast: false, meteor: true,
  wallGap: false, crossMines: false, gridBeams: false, bounce: false, miasma: true, lineDash: false, judgment: true,
  finaleNova: false,
};

export const passesOverStructures = (kind: AttackKind): boolean => PASSES_OVER[kind];

/**
 * Distancia hasta la primera estructura que corta el segmento que sale de (x, y) con ángulo `a` y largo `len`
 * (rayos, láseres, brazos de las minas en cruz). Sin choque, `len`. Las cajas que ya contienen el origen se ignoran
 * (un jefe pegado a una roca no se queda sin rayo). `pad` engorda las cajas (medio ancho del haz, si se quiere).
 */
export function clipSegmentToRects(x: number, y: number, a: number, len: number, rects: readonly Box[], pad = 0): number {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let best = len;
  for (const r of rects) {
    const x0 = r.x - pad;
    const y0 = r.y - pad;
    const x1 = r.x + r.w + pad;
    const y1 = r.y + r.h + pad;
    if (x > x0 && x < x1 && y > y0 && y < y1) continue;
    let tmin = 0;
    let tmax = best;
    if (Math.abs(dx) < 1e-9) {
      if (x <= x0 || x >= x1) continue;
    } else {
      let t1 = (x0 - x) / dx;
      let t2 = (x1 - x) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
    }
    if (Math.abs(dy) < 1e-9) {
      if (y <= y0 || y >= y1) continue;
    } else {
      let t1 = (y0 - y) / dy;
      let t2 = (y1 - y) / dy;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
    }
    if (tmin < tmax && tmin < best) best = tmin;
  }
  return Math.max(0, best);
}

/** ¿Hay estructura entre (ax, ay) y (bx, by)? (cadenas eléctricas, ondas que te tapa una roca). */
export function segmentBlocked(ax: number, ay: number, bx: number, by: number, rects: readonly Box[]): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  if (d < 1e-6) return false;
  return clipSegmentToRects(ax, ay, Math.atan2(by - ay, bx - ax), d, rects) < d - 0.5;
}

/** Orbe que rebota: si se mete en una estructura, sale por el lado de menos recorrido con la velocidad reflejada. */
export function bounceOffRects<T extends { x: number; y: number; vx: number; vy: number; left: number }>(o: T, r: number, rects: readonly Box[]): T {
  for (const b of rects) {
    const x0 = b.x - r;
    const y0 = b.y - r;
    const x1 = b.x + b.w + r;
    const y1 = b.y + b.h + r;
    if (o.x <= x0 || o.x >= x1 || o.y <= y0 || o.y >= y1) continue;
    const opts = [
      { d: o.x - x0, f: () => ({ ...o, x: x0, vx: -Math.abs(o.vx) }) },
      { d: x1 - o.x, f: () => ({ ...o, x: x1, vx: Math.abs(o.vx) }) },
      { d: o.y - y0, f: () => ({ ...o, y: y0, vy: -Math.abs(o.vy) }) },
      { d: y1 - o.y, f: () => ({ ...o, y: y1, vy: Math.abs(o.vy) }) },
    ].sort((p, q) => p.d - q.d);
    return { ...opts[0].f(), left: o.left - 1 };
  }
  return o;
}
