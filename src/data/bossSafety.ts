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

// --- Vigilante de la vida del jefe (que nunca se quede «a mitad de vida» sin bajar) ---

/** Lo más que puede seguir protegido un jefe (fase, megaevolución, derrumbe) mientras le pegas (ms). */
export const BOSS_PROTECT_MAX_MS = 4000;
/** Si le pegas durante este tiempo y su vida no baja nada, se corta cualquier protección y se aplica el daño (ms). */
export const BOSS_STALL_MS = 3000;
/** Sin golpes durante esto, el contador de «le pego y no baja» vuelve a empezar (ms). */
export const BOSS_STALL_RESET_MS = 1200;
/** Daño guardado durante una protección que se aplica al acabar: como mucho esta parte de su vida máxima. */
export const BOSS_HELD_CAP = 0.15;

export interface BossGuard {
  /** Desde cuándo está protegido (undefined: no lo está). */
  protSince?: number;
  /** Daño recibido mientras estaba protegido (se aplica al acabar, con tope). */
  held: number;
  /** Primer golpe de la racha en la que su vida no baja, su vida entonces y el daño de la racha. */
  stallSince?: number;
  stallHp?: number;
  stallDmg: number;
  lastHitAt: number;
}

export const newBossGuard = (): BossGuard => ({ held: 0, stallDmg: 0, lastHitAt: -Infinity });

/** Apunta un golpe al jefe (`hpBefore`: su vida antes del golpe; `prot`: si estaba protegido). */
export function noteBossHit(g: BossGuard, now: number, hpBefore: number, dmg: number, prot: boolean, maxHp: number): void {
  if (!(dmg > 0)) return;
  g.lastHitAt = now;
  if (prot) g.held = Math.min(g.held + dmg, maxHp * BOSS_HELD_CAP);
  if (g.stallSince === undefined) {
    g.stallSince = now;
    g.stallHp = hpBefore;
    g.stallDmg = 0;
  }
  g.stallDmg += dmg;
}

export interface BossGuardTick {
  /** Hay que soltar YA cualquier protección (la lleva demasiado o le pegas y no baja). */
  release: boolean;
  /** Si viene, su vida debe quedar como mucho en esto (daño guardado que se aplica; nunca por debajo de 1). */
  hpAtMost?: number;
}

/** Un fotograma del vigilante: decide si se corta la protección y cuánto daño guardado se aplica. */
export function tickBossGuard(g: BossGuard, now: number, hp: number, prot: boolean, maxHp: number): BossGuardTick {
  if (prot && g.protSince === undefined) g.protSince = now;
  // Su vida ha bajado de verdad: no está atascado
  if (g.stallHp !== undefined && hp < g.stallHp - 0.5) resetStall(g);
  // Ya no le pegas: la racha se olvida
  if (g.stallSince !== undefined && now - g.lastHitAt > BOSS_STALL_RESET_MS) resetStall(g);
  const tooLong = prot && g.protSince !== undefined && now - g.protSince >= BOSS_PROTECT_MAX_MS;
  const stalled = g.stallSince !== undefined && now - g.stallSince >= BOSS_STALL_MS;
  const release = tooLong || stalled;
  let cap: number | undefined;
  if (stalled && g.stallHp !== undefined) cap = g.stallHp - Math.min(g.stallDmg, maxHp * BOSS_HELD_CAP);
  if ((!prot || release) && g.protSince !== undefined) {
    if (g.held > 0) cap = Math.min(cap ?? Infinity, hp - g.held);
    g.held = 0;
    g.protSince = undefined;
  }
  if (stalled) resetStall(g);
  return { release, hpAtMost: cap === undefined ? undefined : Math.max(1, cap) };
}

function resetStall(g: BossGuard) {
  g.stallSince = undefined;
  g.stallHp = undefined;
  g.stallDmg = 0;
}

// --- Casilla del jefe en una sala grande ---

export interface CellPt extends Pt {
  id: number;
}

/**
 * Orden de casillas donde puede aparecer un jefe o minijefe: nunca la del jugador (si hay más de una) y de la más
 * lejana a la más cercana al jugador. Con una sola casilla, esa.
 */
export function bossCellOrder(cells: readonly CellPt[], playerCell: number, player: Pt): number[] {
  const others = cells.filter((c) => c.id !== playerCell);
  const pool = others.length > 0 ? others : cells;
  return [...pool].sort((a, b) => Math.hypot(b.x - player.x, b.y - player.y) - Math.hypot(a.x - player.x, a.y - player.y) || a.id - b.id).map((c) => c.id);
}
