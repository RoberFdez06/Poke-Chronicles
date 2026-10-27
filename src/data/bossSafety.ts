// Seguridad de los jefes y de los spawns: lógica pura, sin Phaser.
// - Teletransportes: nada de aparecer pegado al jugador justo tras salir o tras una intro/fase.
// - Invulnerabilidad de fase: breve, con tope y con un seguro (watchdog) por tiempo.
// - Casillas libres: dónde poner la trampilla y a los enemigos sin que caigan dentro de obstáculos.

/** Tras aparecer, tras cada intro y tras cada cambio de fase el jefe no puede teletransportarse ni lanzarse (ms). */
export const BOSS_TELEPORT_GRACE_MS = 4500;
/** Un teletransporte del jefe nunca lo deja más cerca del jugador que esto (px). */
export const BOSS_SAFE_TELEPORT_DIST = 240;
/** Distancia mínima del jugador a la que aparece un enemigo normal (px). */
export const SPAWN_SAFE_DIST = 220;

/** ¿Puede el jefe teletransportarse / empezar un movimiento especial ahora? (nunca congelado ni en el respiro). */
export function canBossTeleport(now: number, graceUntil: number | undefined, frozen: boolean): boolean {
  if (frozen) return false;
  return graceUntil === undefined || now >= graceUntil;
}

/** Fin del respiro tras un suceso (spawn, intro, fase): nunca acorta uno que ya estuviera en marcha. */
export const extendGrace = (current: number | undefined, now: number, ms = BOSS_TELEPORT_GRACE_MS): number =>
  Math.max(current ?? 0, now + ms);

export interface Pt {
  x: number;
  y: number;
}

/**
 * De una lista de candidatos, el primero libre y a `minDist` o más del jugador; si ninguno cumple la distancia, el libre
 * más lejano. undefined si ninguno está libre.
 */
export function pickSafeSpot(cands: readonly Pt[], player: Pt, minDist: number, isFree: (p: Pt) => boolean): Pt | undefined {
  let best: Pt | undefined;
  let bestD = -1;
  for (const c of cands) {
    if (!isFree(c)) continue;
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d >= minDist) return c;
    if (d > bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * El punto libre más cercano a `ideal`: prueba en anillos cuadrados de paso `step` (hasta `rings`) y, entre los libres
 * de un mismo anillo, el más cercano de verdad. undefined si no hay ninguno.
 */
export function nearestClearPoint(ideal: Pt, isClear: (p: Pt) => boolean, step: number, rings: number): Pt | undefined {
  if (isClear(ideal)) return { x: ideal.x, y: ideal.y };
  for (let r = 1; r <= rings; r++) {
    let best: Pt | undefined;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const p = { x: ideal.x + dx * step, y: ideal.y + dy * step };
        const d = Math.hypot(dx, dy);
        if (d < bestD && isClear(p)) {
          best = p;
          bestD = d;
        }
      }
    }
    if (best) return best;
  }
  return undefined;
}

/** Rectángulo (pared, bloque) en coordenadas de mundo. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** ¿Un círculo de radio `r` en `p` se solapa con el rectángulo? */
export function circleHitsRect(p: Pt, r: number, rc: Rect): boolean {
  const cx = Math.max(rc.x, Math.min(p.x, rc.x + rc.w));
  const cy = Math.max(rc.y, Math.min(p.y, rc.y + rc.h));
  return Math.hypot(p.x - cx, p.y - cy) < r;
}

/** ¿El círculo cabe sin tocar ninguna pared? */
export const clearOfRects = (p: Pt, r: number, rects: readonly Rect[]): boolean => !rects.some((rc) => circleHitsRect(p, r, rc));

// --- Invulnerabilidad de fase (arena, megaevolución, reto final) ---

/** Lo más que puede durar una invulnerabilidad de fase (ms): pasado esto, se puede dañar sí o sí. */
export const PHASE_INVULN_MAX_MS = 6000;

/** ¿Sigue protegido por la fase? Se acaba al llegar a `until` o, como mucho, a PHASE_INVULN_MAX_MS desde `since`. */
export function phaseShieldActive(since: number | undefined, until: number | undefined, now: number): boolean {
  if (since === undefined) return false;
  const end = Math.min(until ?? since + PHASE_INVULN_MAX_MS, since + PHASE_INVULN_MAX_MS);
  return now >= since && now < end;
}

/** Seguro: ¿hay que soltar una protección que ya debería haberse acabado (o lleva demasiado)? */
export const phaseShieldStuck = (since: number | undefined, now: number, maxMs = PHASE_INVULN_MAX_MS): boolean =>
  since !== undefined && now - since >= maxMs;

// --- Congelación de las intros ---

/** Temporizadores de la IA que hay que correr al acabar una pausa (para no «saltar» al reanudar). */
export interface AiTimers {
  until: number;
  knockUntil: number;
  nextAttack?: number;
  eliteAt?: number;
  graceUntil?: number;
}

/** Corre los temporizadores `dt` ms (los infinitos o sin poner se quedan como están). */
export function shiftTimers<T extends AiTimers>(ai: T, dt: number): T {
  if (!(dt > 0)) return ai;
  const mv = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? v : v + dt);
  ai.until = mv(ai.until) as number;
  ai.knockUntil = mv(ai.knockUntil) as number;
  ai.nextAttack = mv(ai.nextAttack);
  ai.eliteAt = mv(ai.eliteAt);
  ai.graceUntil = mv(ai.graceUntil);
  return ai;
}
