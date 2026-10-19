// Biomas por piso: colores de la sala, aspecto de los obstáculos y tipos de los enemigos y del jefe.
// Lógica pura, sin Phaser ni red, para poder testearla.
// Con extensión .ts para que los tests (node --test) puedan importarlo sin bundler
import { classifyRarity, type SpeciesFact } from '../data/gacha.ts';
import { enemyBstRange, enemyPool } from '../data/enemies.ts';
import { bossPool } from './progression.ts';
import type { GameMode } from '../data/modes.ts';

export interface Biome {
  id: string;
  name: string;
  /** Tipos de los enemigos (y, si se puede, del jefe) de este bioma. */
  types: readonly string[];
  colors: {
    floor: number;
    wall: number;
    rock: number;
    rockTop: number;
    /** Tinte de la hierba alta (blanco = sin cambio). */
    bush: number;
    puddle: number;
    hole: number;
  };
  /** Cómo se llaman los charcos aquí (en el volcán son de lava, en la nieve de hielo). */
  puddleName: string;
}

export const BIOMES: readonly Biome[] = [
  {
    id: 'bosque',
    name: 'Bosque',
    types: ['grass', 'bug'],
    colors: { floor: 0x9cd67c, wall: 0x2f5a2a, rock: 0x6b6b58, rockTop: 0x8f9a74, bush: 0xffffff, puddle: 0x6fa8dc, hole: 0x1f1a10 },
    puddleName: 'charco',
  },
  {
    id: 'cueva',
    name: 'Cueva',
    types: ['rock', 'ground'],
    colors: { floor: 0xcdae80, wall: 0x4a3b2a, rock: 0x6e5a44, rockTop: 0x9b8366, bush: 0xc9b98a, puddle: 0x5f87b0, hole: 0x120c06 },
    puddleName: 'charco',
  },
  {
    id: 'mar',
    name: 'Mar',
    types: ['water', 'flying'],
    colors: { floor: 0xf2dc9c, wall: 0x1f4f7a, rock: 0x7d8a96, rockTop: 0xaab8c4, bush: 0x9fd8c8, puddle: 0x3d8fd6, hole: 0x0b2a48 },
    puddleName: 'agua',
  },
  {
    id: 'volcan',
    name: 'Volcán',
    types: ['fire', 'rock'],
    colors: { floor: 0xd8987a, wall: 0x5a2420, rock: 0x4a3a3a, rockTop: 0x6e5656, bush: 0xd89a6a, puddle: 0xff7a2a, hole: 0x200806 },
    puddleName: 'lava',
  },
  {
    id: 'torre',
    name: 'Torre fantasma',
    types: ['ghost', 'psychic', 'dark'],
    colors: { floor: 0xbcaed8, wall: 0x2e2448, rock: 0x5b5470, rockTop: 0x847c9c, bush: 0xb9a6d8, puddle: 0x8a6fc8, hole: 0x0c0818 },
    puddleName: 'niebla',
  },
  {
    id: 'ciudad',
    name: 'Ciudad',
    types: ['normal', 'electric', 'steel'],
    colors: { floor: 0xc4c8d4, wall: 0x3a4152, rock: 0x6f7480, rockTop: 0x9aa0ad, bush: 0xb8d8a0, puddle: 0x7aa7c8, hole: 0x15171c },
    puddleName: 'charco',
  },
  {
    id: 'nieve',
    name: 'Montaña nevada',
    types: ['ice', 'fighting'],
    colors: { floor: 0xeef6fb, wall: 0x4a6a86, rock: 0x8b98a6, rockTop: 0xd8e4ee, bush: 0xe0f0f0, puddle: 0x9fd4ef, hole: 0x1a2a3a },
    puddleName: 'hielo',
  },
  {
    id: 'pantano',
    name: 'Pantano',
    types: ['poison', 'water', 'grass'],
    colors: { floor: 0xa6b878, wall: 0x3a3a24, rock: 0x5e5a40, rockTop: 0x86825c, bush: 0xa8c070, puddle: 0x8a6fa8, hole: 0x14140a },
    puddleName: 'lodo',
  },
  {
    id: 'cumbre',
    name: 'Cumbre dragón',
    types: ['dragon', 'fairy'],
    colors: { floor: 0xd2c4ea, wall: 0x3c2a6a, rock: 0x6a5a8a, rockTop: 0x9a8abd, bush: 0xf0b8d8, puddle: 0xb08ae0, hole: 0x14082a },
    puddleName: 'charco',
  },
];

export const biomeById = (id: string): Biome => BIOMES.find((b) => b.id === id) ?? BIOMES[0];

/** Orden fijo del modo Normal (5 pisos): de lo más tranquilo a lo más tenebroso. */
export const NORMAL_ORDER = ['bosque', 'cueva', 'mar', 'volcan', 'torre'] as const;

/**
 * Bioma de un piso (Normal, Infinito, Rush) o de un nivel de Oleadas. Normal sigue su orden fijo; el resto
 * rota por todos los biomas.
 */
export function biomeFor(mode: GameMode, n: number): Biome {
  const i = Math.max(1, Math.floor(n)) - 1;
  if (mode === 'normal') return biomeById(NORMAL_ORDER[Math.min(i, NORMAL_ORDER.length - 1)]);
  return BIOMES[i % BIOMES.length];
}

/** Si en la franja del piso hay pocas especies del bioma, se buscan en todas las fuerzas (las más cercanas). */
export const MIN_BIOME_POOL = 6;

const hasBiomeType = (s: SpeciesFact, b: Biome) => (s.types ?? []).some((t) => b.types.includes(t));

/**
 * Candidatos a enemigo del piso que sean de un tipo del bioma, sin salirse mucho de la fuerza del piso.
 * Si la lista no tiene tipos (índice antiguo), los de siempre.
 */
export function biomeEnemyPool(index: readonly SpeciesFact[], floor: number, biome: Biome): number[] {
  const base = enemyPool(index, floor);
  const inBase = new Set(base);
  const typed = index.filter((s) => inBase.has(s.id) && hasBiomeType(s, biome));
  if (typed.length >= MIN_BIOME_POOL) return typed.map((s) => s.id);
  const [lo, hi] = enemyBstRange(floor);
  const center = (lo + hi) / 2;
  const wide = index
    .filter((s) => {
      const r = classifyRarity(s);
      return r !== 'legendary' && r !== 'ultra' && hasBiomeType(s, biome);
    })
    .sort((a, b) => Math.abs(a.bst - center) - Math.abs(b.bst - center) || a.id - b.id)
    .slice(0, MIN_BIOME_POOL)
    .map((s) => s.id);
  return wide.length > 0 ? wide : base;
}

/** Jefes legendarios o singulares del tipo del bioma; si no hay ninguno, cualquiera. */
export function biomeBossPool(index: readonly SpeciesFact[], biome: Biome): number[] {
  const all = bossPool(index);
  const ids = new Set(all);
  const typed = index.filter((s) => ids.has(s.id) && hasBiomeType(s, biome)).map((s) => s.id);
  return typed.length > 0 ? typed : all;
}
