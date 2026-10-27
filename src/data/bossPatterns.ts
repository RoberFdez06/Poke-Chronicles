// Ataques de los jefes (con aviso previo) y su segunda fase, y la mezcla de enemigos de cada sala.
// Lógica pura, sin Phaser ni red, para poder testearla.
import { EXTRA_BEHAVIORS, type EnemyBehavior } from './enemies.ts';
import { BLITZ_LABEL, type BlitzAttack } from './bossBlitz.ts';

/**
 * Ráfaga en círculo, embestida en línea recta, lluvia de proyectiles sobre el suelo e invocar ayudantes; T50: espiral
 * de proyectiles, onda expansiva (anillo con un hueco por el que pasar), láser giratorio y zonas de peligro que estallan.
 */
export type BossAttack = 'ring' | 'charge' | 'rain' | 'summon' | 'spiral' | 'shockwave' | 'laser' | 'hazard' | PatternAttack | BlitzAttack;

export const BOSS_ATTACK_LABEL: Record<BossAttack, string> = {
  ring: 'Ráfaga',
  charge: 'Embestida',
  rain: 'Lluvia',
  summon: 'Invocación',
  spiral: 'Espiral',
  shockwave: 'Onda expansiva',
  laser: 'Láser giratorio',
  hazard: 'Zona de peligro',
  star8: 'Estrella de 8 puntas',
  cross: 'Cruz y aspa',
  fan: 'Abanico',
  sweep: 'Barrido',
  // Asaltos nuevos (bossBlitz.ts)
  ...BLITZ_LABEL,
};

// --- Patrones de balas (más variedad): cada uno con aviso, por tipo del jefe ---

/**
 * star8: el anillo en 8 direcciones (rectas y diagonales) en tres pulsos que giran; cross: chorros en cruz y luego en
 * aspa (diagonales); fan: ráfagas en abanico apuntadas a ti; sweep: una cortina que barre media sala de lado a lado.
 */
export type PatternAttack = 'star8' | 'cross' | 'fan' | 'sweep';
export const PATTERN_ATTACKS: readonly PatternAttack[] = ['star8', 'cross', 'fan', 'sweep'];
export const isPatternAttack = (a: BossAttack): a is PatternAttack => (PATTERN_ATTACKS as readonly string[]).includes(a);

/** Patrón de cada tipo del jefe (el primero de sus tipos con entrada manda). */
const TYPE_PATTERN: Record<string, PatternAttack> = {
  fire: 'fan', water: 'sweep', grass: 'star8', bug: 'fan', electric: 'cross', ice: 'star8', rock: 'cross', ground: 'sweep',
  steel: 'cross', fighting: 'fan', psychic: 'star8', ghost: 'sweep', dark: 'fan', fairy: 'star8', dragon: 'sweep',
  poison: 'star8', flying: 'sweep', normal: 'fan',
};
/** Segundo patrón en la fase 2 / jefes de dos tipos: el del segundo tipo si es distinto. */
export function patternAttacks(types: readonly string[]): PatternAttack[] {
  const out = [...new Set(types.map((t) => TYPE_PATTERN[t]).filter((p): p is PatternAttack => !!p))];
  return out.length > 0 ? out.slice(0, 2) : ['fan'];
}

export interface PatternWave {
  /** Retraso de la ola desde el final del aviso (ms). */
  at: number;
  /** Direcciones de las balas (radianes; para fan/sweep relativas a `aim` ya sumado). */
  angles: number[];
}

/** Olas de balas de un patrón. `aim` = ángulo hacia el jugador, `off` = giro inicial al azar. */
export function patternWaves(p: PatternAttack, phase: 1 | 2, aim: number, off: number): PatternWave[] {
  const TAU = Math.PI * 2;
  const step = (n: number, o: number) => Array.from({ length: n }, (_, k) => o + (k / n) * TAU);
  switch (p) {
    case 'star8': {
      const pulses = phase === 2 ? 4 : 3;
      return Array.from({ length: pulses }, (_, w) => ({ at: w * 380, angles: step(8, off + w * (Math.PI / 8)) }));
    }
    case 'cross': {
      // Chorro de 4 balas por brazo en +, luego en ×; en la fase 2 se repite la cruz
      const out: PatternWave[] = [];
      const arms = phase === 2 ? 3 : 2;
      for (let w = 0; w < arms; w++)
        for (let s = 0; s < 4; s++) out.push({ at: w * 620 + s * 90, angles: step(4, (w % 2) * (Math.PI / 4)) });
      return out;
    }
    case 'fan': {
      const n = phase === 2 ? 7 : 5;
      const spread = (phase === 2 ? 70 : 56) * (Math.PI / 180);
      const bursts = phase === 2 ? 4 : 3;
      return Array.from({ length: bursts }, (_, w) => ({
        at: w * 330,
        angles: Array.from({ length: n }, (_, k) => aim - spread / 2 + (k / (n - 1)) * spread + (w % 2 ? spread / (2 * (n - 1)) : 0)),
      }));
    }
    case 'sweep': {
      const shots = phase === 2 ? 22 : 16;
      const arc = Math.PI * (phase === 2 ? 1.1 : 0.9);
      const dir = off > Math.PI ? 1 : -1;
      return Array.from({ length: shots }, (_, k) => ({ at: k * 55, angles: [aim - (dir * arc) / 2 + (dir * arc * k) / (shots - 1)] }));
    }
  }
}

/** Ángulos del aviso de un patrón (las direcciones de su primera ola, o el arco del barrido). */
export function patternWarnAngles(p: PatternAttack, phase: 1 | 2, aim: number, off: number): number[] {
  const w = patternWaves(p, phase, aim, off);
  if (p === 'sweep') return w.filter((_, k) => k % 3 === 0).map((x) => x.angles[0]);
  if (p === 'cross') return [...w[0].angles, ...w[4].angles];
  return w[0].angles;
}

/** Cuánto dura un patrón tras el aviso (ms). */
export const patternMs = (p: PatternAttack, phase: 1 | 2): number => Math.max(...patternWaves(p, phase, 0, 0).map((w) => w.at)) + 200;

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
// 20/10 (Roberto): los legendarios invocan más
export const summonCount = (phase: 1 | 2): number => (phase === 2 ? 4 : 3);
export const MAX_HELPERS = 7;
export const HELPER_HP_MUL = 0.6;

/** Cuántos ayudantes invocar ahora sin pasar del máximo (0 = mejor otro ataque). */
export const helpersToSummon = (phase: 1 | 2, alive: number): number => Math.max(0, Math.min(summonCount(phase), MAX_HELPERS - alive));

/** Por debajo de este porcentaje de vida, el jefe pasa a la fase 2 (más rápido y agresivo). */
export const BOSS_PHASE2_AT = 0.5;
export const bossPhase = (hpRatio: number): 1 | 2 => (hpRatio < BOSS_PHASE2_AT ? 2 : 1);

/** Aviso antes de cada ataque (ms): lo justo para verlo venir y esquivarlo. */
export const TELEGRAPH_MS = 750;
/** Tiempo entre ataques y cosas que cambian en la fase 2. */
// 20/10 (Roberto): los legendarios atacan más a menudo (antes 3300 y 2100)
export const attackInterval = (phase: 1 | 2): number => (phase === 2 ? 1500 : 2300);
/** Entre ataque y ataque, ráfagas cortas apuntadas al jugador (ms entre una y otra) y cuántos disparos. */
export const volleyEvery = (phase: 1 | 2): number => (phase === 2 ? 900 : 1300);
export const volleyShots = (phase: 1 | 2): number => (phase === 2 ? 5 : 3);
/** Además, cada cierto tiempo llaman refuerzos por su cuenta (ms). */
export const reinforceEvery = (phase: 1 | 2): number => (phase === 2 ? 7000 : 10000);
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
  return [...new Set<BossAttack>([...bossAttacks(types), ...biomeExtraAttacks(biomeTypes), ...patternAttacks(types)])];
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

// --- T51: comportamientos nuevos en la mezcla de cada sala, según el bioma y el piso ---

type ExtraBehavior = (typeof EXTRA_BEHAVIORS)[number];

/** Los 2 comportamientos nuevos que prefiere cada tipo de bioma (el primero que tenga entrada manda). */
const BIOME_EXTRA_BEHAVIORS: Record<string, [ExtraBehavior, ExtraBehavior]> = {
  grass: ['healer', 'mine'],
  bug: ['mine', 'healer'],
  rock: ['shielded', 'mine'],
  ground: ['mine', 'shielded'],
  water: ['orbitShooter', 'healer'],
  fire: ['mine', 'orbitShooter'],
  ghost: ['orbitShooter', 'healer'],
  psychic: ['healer', 'orbitShooter'],
  electric: ['orbitShooter', 'shielded'],
  steel: ['shielded', 'orbitShooter'],
  ice: ['shielded', 'healer'],
  poison: ['mine', 'healer'],
  dragon: ['shielded', 'orbitShooter'],
  fairy: ['healer', 'orbitShooter'],
  dark: ['orbitShooter', 'mine'],
  normal: ['shielded', 'healer'],
};

export function biomeExtraBehaviors(biomeTypes: readonly string[]): [ExtraBehavior, ExtraBehavior] {
  for (const t of biomeTypes) if (BIOME_EXTRA_BEHAVIORS[t]) return BIOME_EXTRA_BEHAVIORS[t];
  return BIOME_EXTRA_BEHAVIORS.normal;
}

/** Parte de los enemigos de una sala que cambian a un comportamiento nuevo: 0 en el piso 1, sube hasta el 35 %. */
export const twistChance = (floor: number): number => Math.min(0.35, Math.max(0, (Math.floor(floor) - 1) * 0.09));
/** Como mucho, por sala: un curandero y dos minas. */
export const MAX_HEALERS = 1;
export const MAX_MINES = 2;

/**
 * Cambia algunos enemigos de la sala a los comportamientos nuevos del bioma (T51), sin tocar a los que disparan (así
 * `mixBehaviors` sigue garantizando uno de cada tres) y sin pasar de un curandero y dos minas.
 */
export function twistBehaviors(list: readonly EnemyBehavior[], floor: number, biomeTypes: readonly string[], rng: () => number): EnemyBehavior[] {
  const [a, b] = biomeExtraBehaviors(biomeTypes);
  const chance = twistChance(floor);
  let healers = 0;
  let mines = 0;
  return list.map((beh) => {
    if (beh === 'shoot' || rng() >= chance) return beh;
    const pick = rng() < 0.6 ? a : b;
    if (pick === 'healer') {
      if (healers >= MAX_HEALERS || list.length < 2) return beh;
      healers++;
    }
    if (pick === 'mine') {
      if (mines >= MAX_MINES) return beh;
      mines++;
    }
    return pick;
  });
}

// --- T66: ataque exclusivo de la megaevolución / forma furia ---

/**
 * «Estallido mega»: el jefe marca varios rayos desde su cuerpo (aviso largo) y, al acabar, estallan a la vez. Entre
 * rayo y rayo siempre queda un hueco ancho y el aviso nunca baja de MEGA_BLAST_MIN_WARN, así que siempre se puede
 * esquivar. Se dispara dos veces seguidas, girando la segunda.
 */
export const MEGA_ATTACK_LABEL = 'Estallido mega';
export const MEGA_BLAST_MIN_WARN = 1000;
/** El ángulo libre entre rayos nunca baja de 40° (el jugador mide unos 30 px y el rayo 2 × MEGA_BLAST_WIDTH). */
export const MEGA_BLAST_MIN_GAP = (40 * Math.PI) / 180;
export const MEGA_BLAST_WIDTH = 22;

export interface MegaBlastSpec {
  beams: number;
  warnMs: number;
  length: number;
  waves: number;
  /** Giro de la segunda ola respecto a la primera (rad). */
  turn: number;
}
export function megaBlastSpec(floor: number): MegaBlastSpec {
  const d = depth(floor);
  const beams = Math.min(5, 4 + Math.round(d));
  return { beams, warnMs: Math.max(MEGA_BLAST_MIN_WARN, 1300 - Math.round(d * 300)), length: 700, waves: 2, turn: Math.PI / beams };
}

/** Ángulos de los rayos de una ola (repartidos por igual a partir de `offset`). */
export const megaBlastAngles = (spec: MegaBlastSpec, offset: number): number[] =>
  Array.from({ length: spec.beams }, (_, k) => offset + (k / spec.beams) * Math.PI * 2);

/** Hueco libre entre rayos (rad) a una distancia `r` del jefe, descontando su grosor. */
export function megaBlastGap(spec: MegaBlastSpec, r = 120): number {
  return (Math.PI * 2) / spec.beams - 2 * Math.atan(MEGA_BLAST_WIDTH / r);
}
