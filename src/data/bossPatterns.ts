// Ataques de los jefes (con aviso previo) y su segunda fase, y la mezcla de enemigos de cada sala.
// Lógica pura, sin Phaser ni red, para poder testearla.
import type { EnemyBehavior } from './enemies.ts';

/**
 * Ráfaga en círculo, embestida en línea recta, lluvia de proyectiles sobre el suelo e invocar ayudantes; T50: espiral
 * de proyectiles, onda expansiva (anillo con un hueco por el que pasar), láser giratorio y zonas de peligro que estallan.
 */
export type BossAttack = 'ring' | 'charge' | 'rain' | 'summon' | 'spiral' | 'shockwave' | 'laser' | 'hazard';

export const BOSS_ATTACK_LABEL: Record<BossAttack, string> = {
  ring: 'Ráfaga',
  charge: 'Embestida',
  rain: 'Lluvia',
  summon: 'Invocación',
  spiral: 'Espiral',
  shockwave: 'Onda expansiva',
  laser: 'Láser giratorio',
  hazard: 'Zona de peligro',
};

/** Tipos "de cuerpo a cuerpo": su jefe embiste; los demás hacen llover proyectiles. Dragón hace las tres. */
const PHYSICAL = new Set(['fighting', 'rock', 'ground', 'steel', 'normal', 'dark', 'bug']);

/** Tipos que llaman a ayudantes (T26): los "místicos" y los que van en grupo. */
const SUMMONERS = new Set(['psychic', 'ghost', 'poison', 'grass', 'fairy', 'ice']);

/**
 * 2-3 ataques por jefe: siempre la ráfaga, embestida o lluvia según su tipo y, si es de un tipo invocador, también
 * invocar ayudantes. Dragón hace ráfaga, embestida y lluvia.
 */
export function bossAttacks(types: readonly string[]): BossAttack[] {
  if (types.includes('dragon')) return ['ring', 'charge', 'rain'];
  const out: BossAttack[] = ['ring', types.some((t) => PHYSICAL.has(t)) ? 'charge' : 'rain'];
  if (types.some((t) => SUMMONERS.has(t))) out.push('summon');
  return out;
}

/** Ayudantes por invocación (más en la fase 2), cuántos puede haber a la vez y su vida respecto a un enemigo normal. */
export const summonCount = (phase: 1 | 2): number => (phase === 2 ? 3 : 2);
export const MAX_HELPERS = 4;
export const HELPER_HP_MUL = 0.6;

/** Cuántos ayudantes invocar ahora sin pasar del máximo (0 = mejor otro ataque). */
export const helpersToSummon = (phase: 1 | 2, alive: number): number => Math.max(0, Math.min(summonCount(phase), MAX_HELPERS - alive));

/** Por debajo de este porcentaje de vida, el jefe pasa a la fase 2 (más rápido y agresivo). */
export const BOSS_PHASE2_AT = 0.5;
export const bossPhase = (hpRatio: number): 1 | 2 => (hpRatio < BOSS_PHASE2_AT ? 2 : 1);

/** Aviso antes de cada ataque (ms): lo justo para verlo venir y esquivarlo. */
export const TELEGRAPH_MS = 750;
/** Tiempo entre ataques y cosas que cambian en la fase 2. */
export const attackInterval = (phase: 1 | 2): number => (phase === 2 ? 2100 : 3300);
export const ringCount = (phase: 1 | 2): number => (phase === 2 ? 16 : 10);
export const rainCount = (phase: 1 | 2): number => (phase === 2 ? 6 : 4);
export const PHASE2_SPEED = 1.3;

/** Siguiente ataque al azar, sin repetir el último si hay otros. */
export function pickAttack(attacks: readonly BossAttack[], rng: () => number, last?: BossAttack): BossAttack {
  const options = attacks.length > 1 ? attacks.filter((a) => a !== last) : attacks;
  return options[Math.floor(rng() * options.length)];
}

/**
 * En cada sala, al menos uno de cada tres enemigos dispara (sea del tipo que sea), para que siempre haya
 * proyectiles que esquivar. Convierte a los primeros que no disparan.
 */
export function mixBehaviors(list: readonly EnemyBehavior[]): EnemyBehavior[] {
  const out = [...list];
  const need = Math.ceil(out.length / 3);
  let have = out.filter((b) => b === 'shoot').length;
  for (let i = 0; i < out.length && have < need; i++) {
    if (out[i] !== 'shoot') {
      out[i] = 'shoot';
      have++;
    }
  }
  return out;
}

// --- T50: ataques extra según el bioma, que se ponen más duros con el piso (sin dejar de poder esquivarse) ---

export type ExtraAttack = 'spiral' | 'shockwave' | 'laser' | 'hazard';
export const EXTRA_ATTACKS: readonly ExtraAttack[] = ['spiral', 'shockwave', 'laser', 'hazard'];

/** Los 2 ataques extra que da cada tipo (el primero del bioma): fuego → onda, eléctrico → láser… */
const TYPE_EXTRA: Record<string, [ExtraAttack, ExtraAttack]> = {
  fire: ['shockwave', 'hazard'],
  water: ['spiral', 'shockwave'],
  grass: ['hazard', 'spiral'],
  bug: ['hazard', 'spiral'],
  electric: ['laser', 'spiral'],
  ice: ['spiral', 'hazard'],
  rock: ['shockwave', 'hazard'],
  ground: ['shockwave', 'hazard'],
  steel: ['laser', 'shockwave'],
  fighting: ['shockwave', 'hazard'],
  psychic: ['laser', 'spiral'],
  ghost: ['spiral', 'laser'],
  dark: ['laser', 'hazard'],
  fairy: ['spiral', 'laser'],
  dragon: ['laser', 'shockwave'],
  poison: ['hazard', 'spiral'],
  flying: ['spiral', 'shockwave'],
  normal: ['spiral', 'hazard'],
};

/** Ataques extra del bioma (por sus tipos; el primero que tenga entrada manda). */
export function biomeExtraAttacks(biomeTypes: readonly string[]): [ExtraAttack, ExtraAttack] {
  for (const t of biomeTypes) if (TYPE_EXTRA[t]) return TYPE_EXTRA[t];
  return TYPE_EXTRA.normal;
}

/** Ataques del jefe con los 2 extra de su bioma (sin repetir). */
export function bossAttacksFor(types: readonly string[], biomeTypes: readonly string[]): BossAttack[] {
  return [...new Set<BossAttack>([...bossAttacks(types), ...biomeExtraAttacks(biomeTypes)])];
}

/** 0 en el piso 1 y 1 desde el 6: cuánto aprieta el piso. */
const depth = (floor: number): number => Math.min(1, Math.max(0, (Math.floor(floor) - 1) / 5));

export interface SpiralSpec {
  /** Brazos de la espiral, disparos por brazo, ms entre disparos y giro entre disparos (rad). */
  arms: number;
  shots: number;
  everyMs: number;
  turn: number;
}
export function spiralSpec(floor: number, phase: 1 | 2): SpiralSpec {
  const d = depth(floor);
  return {
    arms: Math.min(4, 2 + Math.round(d * 1.4) + (phase === 2 ? 1 : 0)),
    shots: 10 + Math.round(d * 6),
    // Nunca más seguido que cada 90 ms: entre brazo y brazo siempre hay hueco
    everyMs: Math.max(90, 150 - Math.round(d * 50) - (phase === 2 ? 20 : 0)),
    turn: 0.22 + d * 0.06,
  };
}

export interface ShockwaveSpec {
  /** Ondas seguidas, velocidad (px/s), radio máximo y ancho del hueco por el que pasar (rad). */
  waves: number;
  speed: number;
  maxRadius: number;
  gap: number;
  /** ms entre una onda y la siguiente. */
  everyMs: number;
}
export function shockwaveSpec(floor: number, phase: 1 | 2): ShockwaveSpec {
  const d = depth(floor);
  return {
    waves: Math.min(3, 1 + Math.round(d) + (phase === 2 ? 1 : 0)),
    speed: Math.min(340, 240 + Math.round(d * 80) + (phase === 2 ? 20 : 0)),
    maxRadius: 620,
    // El hueco nunca baja de 50° (siempre cabe el jugador)
    gap: Math.max((50 * Math.PI) / 180, ((80 - d * 25) * Math.PI) / 180),
    everyMs: 900,
  };
}

export interface LaserSpec {
  /** Rayos, giro (rad/s, como mucho 75°/s para poder rodearlo), duración (ms) y largo. */
  beams: number;
  turnSpeed: number;
  durationMs: number;
  length: number;
}
export function laserSpec(floor: number, phase: 1 | 2): LaserSpec {
  const d = depth(floor);
  return {
    beams: Math.min(3, 1 + Math.round(d) + (phase === 2 ? 1 : 0)),
    turnSpeed: Math.min((75 * Math.PI) / 180, ((45 + d * 25) * Math.PI) / 180 + (phase === 2 ? 0.1 : 0)),
    durationMs: 2400 + Math.round(d * 800),
    length: 700,
  };
}
/** Daño del láser: un golpe cada tanto mientras lo tocas (la invulnerabilidad tras el golpe hace el resto). */
export const LASER_WIDTH = 18;

export interface HazardSpec {
  /** Zonas, su radio, aviso antes de estallar (ms; nunca menos de 900) y si una cae justo donde estás. */
  zones: number;
  radius: number;
  warnMs: number;
  onPlayer: boolean;
}
export function hazardSpec(floor: number, phase: 1 | 2): HazardSpec {
  const d = depth(floor);
  return {
    zones: Math.min(7, 3 + Math.round(d * 3) + (phase === 2 ? 1 : 0)),
    radius: 70,
    warnMs: Math.max(900, 1300 - Math.round(d * 300) - (phase === 2 ? 100 : 0)),
    onPlayer: true,
  };
}

/** ¿Toca un rayo que sale de (cx, cy) con ángulo `a` y largo `len` al punto (x, y)? (distancia al segmento) */
export function laserHits(cx: number, cy: number, a: number, len: number, x: number, y: number, width = LASER_WIDTH): boolean {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const t = Math.max(0, Math.min(len, (x - cx) * dx + (y - cy) * dy));
  const px = cx + dx * t;
  const py = cy + dy * t;
  return Math.hypot(x - px, y - py) <= width;
}

/** ¿El punto está en el anillo de la onda (radio r, grosor w) y fuera del hueco (centrado en `gapAt`)? */
export function shockwaveHits(cx: number, cy: number, r: number, gapAt: number, gap: number, x: number, y: number, w = 22): boolean {
  const d = Math.hypot(x - cx, y - cy);
  if (Math.abs(d - r) > w / 2) return false;
  const a = Math.atan2(y - cy, x - cx);
  let diff = Math.abs(a - gapAt) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff > gap / 2;
}
