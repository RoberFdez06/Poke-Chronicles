// IA de enemigos: piezas puras (sin Phaser) que GameScene aplica encima de cada comportamiento.
// Separación entre enemigos, detector de atascos (desatascar rodeando), vigilante de inactividad (nadie se queda
// quieto con el jugador parado), línea de visión en la rejilla de la sala, arquetipos y retirada con poca vida.
// Con extensión .ts para que los tests (node --test) puedan importarlo sin bundler.
import type { EnemyBehavior } from './enemies.ts';

export interface V2 { x: number; y: number }

/** Arquetipo táctico de cada comportamiento: cómo se coloca respecto al jugador. */
export type Archetype = 'acosador' | 'flanqueador' | 'francotirador' | 'embestidor' | 'enjambre' | 'apoyo';
export const ARCHETYPE: Record<EnemyBehavior, Archetype> = {
  chase: 'acosador',
  hop: 'acosador',
  burrow: 'acosador',
  ambush: 'flanqueador',
  circle: 'flanqueador',
  swoop: 'flanqueador',
  shoot: 'francotirador',
  orbitShooter: 'francotirador',
  charge: 'embestidor',
  shielded: 'embestidor',
  mine: 'embestidor',
  swarm: 'enjambre',
  healer: 'apoyo',
};

/** Radio en el que dos enemigos se empujan para no apilarse (px), y cuánto pesa ese empuje. */
export const SEPARATION_RADIUS = 56;
export const SEPARATION_WEIGHT = 0.9;
/** Atasco: si en esta ventana avanza menos de esto queriendo moverse, rodea hacia un lado un rato. */
export const STUCK_WINDOW_MS = 700;
export const STUCK_MIN_MOVE = 10;
export const UNSTICK_MS = 650;
/** Vigilante: tras tanto tiempo casi quieto (fuera de una telegrafía) se le obliga a acercarse. */
export const IDLE_LIMIT_MS = 1200;
/** Máximo que se queda escondido el emboscador antes de lanzarse (antes 9 s: con el jugador quieto ni se movía). */
export const AMBUSH_MAX_HIDE_MS = 2600;
/** Ritmo de ataques: como la IA presiona más, sus pausas entre ataques son algo más largas (no sube la dificultad). */
export const AI_ATTACK_SLOWDOWN = 1.12;
/** Poca vida: por debajo de esta parte de PS los que no son enjambre/embestidor se retiran un momento. */
export const RETREAT_HP = 0.25;
export const RETREAT_MS = 900;
export const RETREAT_COOLDOWN_MS = 5000;
/** Tras una esquiva o un parry del jugador cerca, los cuerpo a cuerpo dudan y se apartan un instante. */
export const FLINCH_RANGE = 150;
export const FLINCH_MS = 380;

export const len = (v: V2) => Math.hypot(v.x, v.y);
export function norm(v: V2): V2 {
  const l = len(v);
  return l > 1e-6 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
}

/** Empuje de separación: suma de los vecinos más cercanos de SEPARATION_RADIUS, más fuerte cuanto más pegados. */
export function separation(self: V2, others: readonly V2[], radius = SEPARATION_RADIUS): V2 {
  let x = 0;
  let y = 0;
  for (const o of others) {
    const dx = self.x - o.x;
    const dy = self.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d >= radius) continue;
    if (d < 1e-3) {
      // Exactamente encima: se aparta hacia un lado fijo según la posición (determinista)
      const a = ((self.x * 7 + self.y * 13) % 360) * (Math.PI / 180);
      x += Math.cos(a);
      y += Math.sin(a);
      continue;
    }
    const w = (radius - d) / radius;
    x += (dx / d) * w;
    y += (dy / d) * w;
  }
  return { x, y };
}

/** Mezcla la dirección deseada con la separación y devuelve una dirección unitaria (o la deseada si se anulan). */
export function steer(desired: V2, sep: V2, weight = SEPARATION_WEIGHT): V2 {
  const v = norm({ x: desired.x + sep.x * weight, y: desired.y + sep.y * weight });
  return len(v) > 0 ? v : norm(desired);
}

/** Estado por enemigo para atascos e inactividad. */
export interface AIMemo {
  /** Posición de referencia y cuándo se tomó (ventana del detector de atascos). */
  refX: number;
  refY: number;
  refAt: number;
  /** Desatascando hasta este momento, hacia este lado (1 / -1). */
  unstickUntil: number;
  unstickSide: number;
  /** Desde cuándo está casi quieto (o -1 si se mueve). */
  idleSince: number;
  /** Retirada por poca vida. */
  retreatUntil: number;
  nextRetreatAt: number;
  /** Duda tras esquiva/parry del jugador. */
  flinchUntil: number;
}

export function newMemo(x: number, y: number, now: number): AIMemo {
  return { refX: x, refY: y, refAt: now, unstickUntil: 0, unstickSide: 1, idleSince: -1, retreatUntil: 0, nextRetreatAt: 0, flinchUntil: 0 };
}

/**
 * Detector de atascos: llámalo cada fotograma con la posición y si quiere moverse. Devuelve true mientras deba
 * desatascarse (rodear de lado). Si lleva STUCK_WINDOW_MS avanzando menos de STUCK_MIN_MOVE, empieza a rodear.
 */
export function tickStuck(m: AIMemo, x: number, y: number, now: number, wantsMove: boolean): boolean {
  if (now < m.unstickUntil) return true;
  if (!wantsMove) {
    m.refX = x;
    m.refY = y;
    m.refAt = now;
    return false;
  }
  if (now - m.refAt >= STUCK_WINDOW_MS) {
    const moved = Math.hypot(x - m.refX, y - m.refY);
    m.refX = x;
    m.refY = y;
    m.refAt = now;
    if (moved < STUCK_MIN_MOVE) {
      m.unstickSide = -m.unstickSide;
      m.unstickUntil = now + UNSTICK_MS;
      return true;
    }
  }
  return false;
}

/** Dirección para desatascarse: de lado respecto a la deseada, algo hacia delante. */
export function unstickDir(desired: V2, side: number): V2 {
  return norm({ x: -desired.y * side + desired.x * 0.35, y: desired.x * side + desired.y * 0.35 });
}

/**
 * Vigilante de inactividad: con velocidad real `speed` (px/s). Devuelve true si lleva más de IDLE_LIMIT_MS casi
 * quieto sin estar telegrafiando (`busy`) y está lejos del jugador: hay que empujarlo hacia él.
 */
export function tickIdle(m: AIMemo, speed: number, now: number, busy: boolean, dist: number): boolean {
  if (busy || speed > 12 || dist < 80) {
    m.idleSince = -1;
    return false;
  }
  if (m.idleSince < 0) m.idleSince = now;
  return now - m.idleSince > IDLE_LIMIT_MS;
}

/** ¿Se retira por poca vida? Solo arquetipos que no viven de pegarse; con enfriamiento para no huir siempre. */
export function tickRetreat(m: AIMemo, arch: Archetype, hpRatio: number, now: number, boss: boolean): boolean {
  if (now < m.retreatUntil) return true;
  if (boss || arch === 'enjambre' || arch === 'embestidor') return false;
  if (hpRatio > RETREAT_HP || now < m.nextRetreatAt) return false;
  m.retreatUntil = now + RETREAT_MS;
  m.nextRetreatAt = now + RETREAT_COOLDOWN_MS;
  return true;
}

/** El jugador esquivó o hizo parry hace poco y cerca: los cuerpo a cuerpo dudan (se apartan un instante). */
export function shouldFlinch(arch: Archetype, playerActionAt: number, now: number, dist: number): boolean {
  if (arch === 'francotirador' || arch === 'apoyo') return false;
  return now - playerActionAt >= 0 && now - playerActionAt < 60 && dist < FLINCH_RANGE;
}

/**
 * Línea de visión en la rejilla (casillas de `tile` px desde el origen de la sala): false si una casilla bloqueante
 * corta el segmento. `blocked(tx, ty)` dice si una casilla tapa (rocas, pilares…; fuera de la rejilla no tapa).
 */
export function lineOfSight(a: V2, b: V2, tile: number, blocked: (tx: number, ty: number) => boolean): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(d / (tile / 3)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocked(Math.floor((a.x + (b.x - a.x) * t) / tile), Math.floor((a.y + (b.y - a.y) * t) / tile))) return false;
  }
  return true;
}

/**
 * Tirador: distancia óptima con recolocación. Lejos o sin visión → acercarse (por el camino); muy cerca → alejarse en
 * diagonal; en su franja → strafe lateral con un poco de corrección radial (nunca velocidad cero).
 */
export function rangedDir(toPlayer: V2, dist: number, keep: number, side: number, hasLos: boolean, path: V2): V2 {
  if (!hasLos || dist > keep + 90) return norm(path);
  const tan = { x: -toPlayer.y * side, y: toPlayer.x * side };
  if (dist < keep - 60) return norm({ x: -toPlayer.x + tan.x * 0.6, y: -toPlayer.y + tan.y * 0.6 });
  const radial = Math.max(-0.5, Math.min(0.5, (dist - keep) / 120));
  return norm({ x: tan.x + toPlayer.x * radial, y: tan.y + toPlayer.y * radial });
}

/**
 * Punto de flanqueo: cada enemigo tiene su ángulo alrededor del jugador (según su índice), así varios cuerpo a cuerpo
 * le rodean en vez de hacer cola. Devuelve la dirección hacia ese punto (o directa si ya está cerca).
 */
export function flankDir(self: V2, player: V2, slot: number, slots: number, radius: number): V2 {
  const base = Math.atan2(self.y - player.y, self.x - player.x);
  const n = Math.max(1, slots);
  const a = (Math.round((base / (Math.PI * 2)) * n) / n) * Math.PI * 2 + (slot % 2 === 0 ? 0.35 : -0.35);
  const tx = player.x + Math.cos(a) * radius;
  const ty = player.y + Math.sin(a) * radius;
  const dPlayer = Math.hypot(self.x - player.x, self.y - player.y);
  if (dPlayer < radius * 1.1) return norm({ x: player.x - self.x, y: player.y - self.y });
  return norm({ x: tx - self.x, y: ty - self.y });
}
