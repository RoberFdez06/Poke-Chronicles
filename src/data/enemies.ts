// Enemigos: qué Pokémon salen en cada piso, cómo se comportan según su tipo y sus estadísticas.
// Lógica pura, sin Phaser ni red, para poder testearla.
// Con extensión .ts para que los tests (node --test) puedan importarlo sin bundler
import { classifyRarity, type SpeciesFact } from './gacha.ts';
import type { FloorDifficulty } from '../level/progression.ts';

/** Perseguir, embestir en línea recta, disparar desde lejos o saltar/teletransportarse cerca de ti. */
export const BEHAVIORS = ['chase', 'charge', 'shoot', 'hop'] as const;
export type EnemyBehavior = (typeof BEHAVIORS)[number];

export const BEHAVIOR_LABEL: Record<EnemyBehavior, string> = {
  chase: 'Persigue',
  charge: 'Embiste',
  shoot: 'Dispara',
  hop: 'Salta',
};

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
  const hpMul = behavior === 'charge' ? 1.2 : behavior === 'chase' ? 1 : 0.8;
  const speedMul = behavior === 'chase' ? 1 : behavior === 'charge' ? 0.7 : behavior === 'shoot' ? 0.75 : 0.5;
  return {
    hp: Math.round(60 * k * hpMul * d.hp),
    speed: Math.round(80 * speedMul * d.speed),
    damage: Math.round(10 * Math.sqrt(k) * d.damage),
  };
}
