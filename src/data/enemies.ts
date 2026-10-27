// Enemigos: qué Pokémon salen en cada piso, cómo se comportan según su tipo y sus estadísticas.
// Lógica pura, sin Phaser ni red, para poder testearla.
// Con extensión .ts para que los tests (node --test) puedan importarlo sin bundler
import { classifyRarity, type SpeciesFact } from './gacha.ts';
import type { FloorDifficulty } from '../level/progression.ts';

/**
 * Perseguir, embestir en línea recta, disparar desde lejos, saltar/teletransportarse cerca de ti y (supervisor)
 * rodearte y lanzarse, excavar y salir debajo, enjambre a bandazos, emboscar camuflado y pasadas en picado.
 */
export const BEHAVIORS = ['chase', 'charge', 'shoot', 'hop', 'circle', 'burrow', 'swarm', 'ambush', 'swoop'] as const;
/**
 * T51: comportamientos que no van por tipo sino por sala (ver bossPatterns.ts `twistBehaviors`): tirador en círculo
 * (te rodea a distancia y dispara), mina (se acerca, se arma y estalla), escudado (solo le hace daño lo que le da por
 * la espalda; gira despacio) y curandero (se queda lejos y cura a los demás).
 */
export const EXTRA_BEHAVIORS = ['orbitShooter', 'mine', 'shielded', 'healer'] as const;
export type EnemyBehavior = (typeof BEHAVIORS)[number] | (typeof EXTRA_BEHAVIORS)[number];

export const EXTRA_BEHAVIOR_LABEL: Record<(typeof EXTRA_BEHAVIORS)[number], string> = {
  orbitShooter: 'Tirador',
  mine: 'Mina',
  shielded: 'Escudado',
  healer: 'Curandero',
};

/** Escudado: daño que pasa por delante, y lo que gira hacia ti (rad/s). */
export const SHIELD_FRONT_MUL = 0.15;
export const SHIELD_TURN = 1.4;
/** Escudo del Escudado: una reserva extra de PS (parte de sus PS máximos) que absorbe golpes de cualquier dirección. */
export const SHIELD_POOL_MUL = 1.2;
export const shieldPoolFor = (maxHp: number): number => Math.max(1, Math.round(maxHp * SHIELD_POOL_MUL));
/** Un golpe contra el escudo: lo que absorbe, lo que se pasa a los PS y lo que le queda. */
export function absorbShieldHit(shield: number, dmg: number): { absorbed: number; through: number; left: number } {
  const absorbed = Math.max(0, Math.min(shield, dmg));
  return { absorbed, through: dmg - absorbed, left: shield - absorbed };
}
/** ¿El golpe llega por delante? `facing` es hacia dónde mira; (hx, hy), de dónde viene el golpe respecto a él. */
export function hitFromFront(facing: number, hx: number, hy: number): boolean {
  if (hx === 0 && hy === 0) return true;
  let d = Math.abs(Math.atan2(hy, hx) - facing) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d < Math.PI / 2;
}
/** Gira `facing` hacia `target` como mucho `max` rad. */
export function turnToward(facing: number, target: number, max: number): number {
  let d = (target - facing) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return facing + Math.max(-max, Math.min(max, d));
}

/** Curandero: cada cuánto cura, a qué distancia y cuánto (parte de la vida máxima de cada uno). */
export const HEAL_EVERY_MS = 2600;
export const HEAL_RANGE = 280;
export const HEAL_PART = 0.12;
/** Mina: distancia a la que se arma, cuánto tarda en estallar y su radio. */
export const MINE_ARM_DIST = 100;
export const MINE_FUSE_MS = 900;
export const MINE_RADIUS = 105;
/** Tirador en círculo: distancia a la que te rodea y cada cuánto dispara. */
export const ORBIT_RADIUS = 240;
export const ORBIT_SHOT_MS = 1500;

/** Comportamiento según el tipo principal del Pokémon. */
export const BEHAVIOR_BY_TYPE: Readonly<Record<string, EnemyBehavior>> = {
  normal: 'chase',
  grass: 'chase',
  poison: 'chase',
  bug: 'chase',
  fairy: 'chase',
  fighting: 'charge',
  rock: 'charge',
  ground: 'charge',
  steel: 'charge',
  dragon: 'charge',
  fire: 'shoot',
  water: 'shoot',
  electric: 'shoot',
  ice: 'shoot',
  flying: 'hop',
  psychic: 'hop',
  ghost: 'hop',
  dark: 'hop',
};

/** Segunda forma de moverse de cada tipo (supervisor): la mitad de las especies usa esta, para que haya variedad. */
export const ALT_BEHAVIOR_BY_TYPE: Readonly<Record<string, EnemyBehavior>> = {
  normal: 'circle', grass: 'ambush', poison: 'swarm', bug: 'swarm', fairy: 'circle', fighting: 'circle',
  rock: 'burrow', ground: 'burrow', steel: 'circle', dragon: 'swoop', fire: 'circle', water: 'burrow',
  electric: 'swoop', ice: 'ambush', flying: 'swoop', psychic: 'circle', ghost: 'ambush', dark: 'ambush',
};

/** Comportamiento de una especie: el de su tipo o el alternativo, según su número (fijo para cada especie). */
export function behaviorForSpecies(types: readonly string[], id: number): EnemyBehavior {
  const alt = ALT_BEHAVIOR_BY_TYPE[types[0] ?? ''];
  return alt && id % 2 === 0 ? alt : behaviorFor(types);
}

export function behaviorFor(types: readonly string[]): EnemyBehavior {
  return BEHAVIOR_BY_TYPE[types[0] ?? ''] ?? 'chase';
}

/** Especies distintas que salen en un mismo piso. */
export const SPECIES_PER_FLOOR = 4;
/** Tamaño mínimo del grupo del que se eligen; si la franja se queda corta, se cogen los más cercanos. */
export const MIN_ENEMY_POOL = 12;

/**
 * Franja de estadísticas base de los enemigos del piso: el piso 1 tiene Pokémon débiles
 * (en torno a 280, como Rattata o Pidgey) y cada piso sube 65, hasta un tope.
 */
export function enemyBstRange(floor: number): [number, number] {
  const f = Math.max(1, Math.floor(floor));
  const center = Math.min(560, 280 + 65 * (f - 1));
  return [center - 65, center + 65];
}

/** Por si no se puede leer la lista de especies: Rattata, Pidgey, Caterpie, Zubat, Vulpix, Machop, Geodude, Gastly. */
export const FALLBACK_ENEMIES: readonly number[] = [19, 16, 10, 41, 37, 66, 74, 92];

/** Candidatos a enemigo del piso: nunca legendarios, singulares ni ultraentes (esos son jefes o premios). */
export function enemyPool(index: readonly SpeciesFact[], floor: number): number[] {
  const normal = index.filter((s) => {
    const r = classifyRarity(s);
    return r !== 'legendary' && r !== 'ultra';
  });
  if (normal.length === 0) return [...FALLBACK_ENEMIES];
  const [lo, hi] = enemyBstRange(floor);
  const inRange = normal.filter((s) => s.bst >= lo && s.bst <= hi);
  if (inRange.length >= MIN_ENEMY_POOL) return inRange.map((s) => s.id);
  const center = (lo + hi) / 2;
  return [...normal]
    .sort((a, b) => Math.abs(a.bst - center) - Math.abs(b.bst - center) || a.id - b.id)
    .slice(0, MIN_ENEMY_POOL)
    .map((s) => s.id);
}

/** Elige `n` especies distintas del grupo (todas si hay menos). Determinista con el mismo rng. */
export function pickFloorEnemies(pool: readonly number[], rng: () => number, n = SPECIES_PER_FLOOR): number[] {
  const left = [...new Set(pool.length > 0 ? pool : FALLBACK_ENEMIES)];
  const out: number[] = [];
  while (out.length < n && left.length > 0) out.push(...left.splice(Math.floor(rng() * left.length), 1));
  return out;
}

export interface EnemyStats {
  hp: number;
  /** Velocidad base en px/s (al embestir va más rápido). */
  speed: number;
  /** Daño por contacto (y por proyectil). */
  damage: number;
}

/**
 * Estadísticas de un enemigo según su suma de estadísticas base, su comportamiento y la dificultad
 * del piso. Un Rattata (253) en el piso 1 queda cerca del enemigo de antes: unos 60 PS y 10 de daño.
 */
export function enemyStats(bst: number, behavior: EnemyBehavior, d: FloorDifficulty): EnemyStats {
  const k = Math.max(0.6, bst / 260);
  // Los que disparan o saltan son más frágiles; los que embisten, más duros pero más lentos
  // T51: el escudado aguanta algo más; la mina es frágil (estalla sola)
  const hpMul = behavior === 'charge' ? 1.2 : behavior === 'chase' ? 1 : behavior === 'shielded' ? 1.1 : behavior === 'mine' ? 0.6 : 0.8;
  const speedMul =
    behavior === 'chase' ? 1
    : behavior === 'charge' ? 0.7
    : behavior === 'shoot' ? 0.75
    : behavior === 'orbitShooter' ? 0.95
    : behavior === 'mine' || behavior === 'shielded' || behavior === 'healer' ? 0.6
    : 0.5;
  return {
    // T32: base de 70 PS (antes 60); 20/10: 85, los poderes hacían mucho daño (pedido por Roberto)
    hp: Math.round(85 * k * hpMul * d.hp),
    speed: Math.round(80 * speedMul * d.speed),
    damage: Math.round(10 * Math.sqrt(k) * d.damage),
  };
}
