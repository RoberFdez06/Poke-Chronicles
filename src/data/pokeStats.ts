// Estadísticas reales de cada Pokémon (PokeAPI `stats`) convertidas en estadísticas de juego.
// El Pokémon medio queda como BASE_STATS y los extremos tienen límites para no romper el juego.
// Lógica pura, sin Phaser ni red, para poder testearla.
import { BASE_STATS, type PlayerStats } from './items.ts';
import type { EnemyStats } from './enemies.ts';
import type { FloorDifficulty } from '../level/progression.ts';

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

export const STAT_KEYS = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'] as const;

export const STAT_LABEL: Record<keyof BaseStats, string> = {
  hp: 'PS',
  attack: 'Ataque',
  defense: 'Defensa',
  spAttack: 'At. Esp.',
  spDefense: 'Def. Esp.',
  speed: 'Velocidad',
};

/** Nombre de PokeAPI → campo nuestro. */
const API_NAMES: Record<string, keyof BaseStats> = {
  hp: 'hp',
  attack: 'attack',
  defense: 'defense',
  'special-attack': 'spAttack',
  'special-defense': 'spDefense',
  speed: 'speed',
};

/** Un Pokémon "medio": unos 70 en cada estadística (la media real de todas las especies anda por ahí). */
export const AVERAGE_STAT = 70;
export const AVERAGE_STATS: Readonly<BaseStats> = {
  hp: AVERAGE_STAT,
  attack: AVERAGE_STAT,
  defense: AVERAGE_STAT,
  spAttack: AVERAGE_STAT,
  spDefense: AVERAGE_STAT,
  speed: AVERAGE_STAT,
};

/** Lee `stats` de `pokemon/{id}`; lo que falte se queda en la media. */
export function parseApiStats(stats: readonly { base_stat: number; stat: { name: string } }[] | undefined): BaseStats {
  const out: BaseStats = { ...AVERAGE_STATS };
  for (const s of stats ?? []) {
    const k = API_NAMES[s.stat.name];
    if (k && Number.isFinite(s.base_stat) && s.base_stat > 0) out[k] = s.base_stat;
  }
  return out;
}

export const statTotal = (b: BaseStats): number => STAT_KEYS.reduce((n, k) => n + b[k], 0);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Multiplicador suave: 1 para el valor de referencia, `k` controla cuánto pesa la diferencia y
 * [lo, hi] lo limita. Con k = 0,5, un 140 (el doble de la media) da ×1,5.
 */
export function statScale(value: number, ref: number, k: number, lo: number, hi: number): number {
  return clamp(1 + k * (value / ref - 1), lo, hi);
}

/** Límites de cada multiplicador del jugador. */
export const PLAYER_LIMITS = {
  hp: [0.7, 1.6],
  attack: [0.7, 1.6],
  spAttack: [0.7, 1.6],
  speed: [0.8, 1.3],
  /** Daño recibido: más defensa, menos daño. */
  damageTaken: [0.65, 1.3],
} as const;

/** Estadísticas base del jugador según su Pokémon (los objetos pasivos se aplican después, con computeStats). */
export function playerBaseStats(b: BaseStats): PlayerStats {
  const L = PLAYER_LIMITS;
  const def = (b.defense + b.spDefense) / 2;
  const speed = statScale(b.speed, AVERAGE_STAT, 0.35, L.speed[0], L.speed[1]);
  return {
    ...BASE_STATS,
    maxHp: Math.round(BASE_STATS.maxHp * statScale(b.hp, AVERAGE_STAT, 0.5, L.hp[0], L.hp[1])),
    damage: BASE_STATS.damage * statScale(b.attack, AVERAGE_STAT, 0.5, L.attack[0], L.attack[1]),
    powerMul: statScale(b.spAttack, AVERAGE_STAT, 0.5, L.spAttack[0], L.spAttack[1]),
    damageTaken: statScale(def, AVERAGE_STAT, -0.4, L.damageTaken[0], L.damageTaken[1]),
    speed: BASE_STATS.speed * speed,
    // Los rápidos también disparan antes (menos espera entre disparos)
    fireDelay: BASE_STATS.fireDelay / statScale(b.speed, AVERAGE_STAT, 0.3, L.speed[0], L.speed[1]),
  };
}

/**
 * Reparto de un enemigo: cuánto destaca una estadística frente a la media de las suyas.
 * Así la fuerza total la siguen marcando el piso y la suma de estadísticas, y esto solo la reparte.
 */
function share(value: number, b: BaseStats, k = 0.5): number {
  return statScale(value, statTotal(b) / 6, k, 0.6, 1.6);
}

/** Ajusta las estadísticas de un enemigo (o jefe) según su reparto: muchos PS, más vida; mucho ataque, más daño… */
export function shapeEnemyStats(st: EnemyStats, b: BaseStats): EnemyStats {
  return {
    hp: Math.max(1, Math.round(st.hp * share(b.hp, b))),
    damage: Math.max(1, Math.round(st.damage * share(Math.max(b.attack, b.spAttack), b))),
    speed: Math.round(st.speed * share(b.speed, b, 0.35)),
  };
}

export const BOSS_BASE = { hp: 1300, damage: 26 } as const;

/** Jefe: base fija por piso (como antes) repartida según sus estadísticas. */
export function bossStats(b: BaseStats, d: FloorDifficulty): EnemyStats {
  // T32: bastante más vida y daño (antes 500 y 20): un jefe del piso 1 dura ~30-60 s sin mejoras
  return shapeEnemyStats({ hp: Math.round(BOSS_BASE.hp * d.hp), damage: Math.round(BOSS_BASE.damage * d.damage), speed: Math.round(70 * d.speed) }, b);
}

/** Para mostrar en barras: fracción sobre un máximo razonable (255 es el tope de los juegos). */
export const statBar = (value: number): number => clamp(value / 180, 0.04, 1);

