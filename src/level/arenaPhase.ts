// T78: arenas de los jefes que cambian de fase al bajar al 66 % y al 33 % de PS.
// Lógica pura, sin Phaser: qué cambia, en qué casillas y cuándo puede empezar sin pisarse con la megaevolución (T66).
import { mulberry32 } from './floorGen.ts';
import { allConnected, CENTER_TILES, COLS, ROWS, SPAWN_TILES, type Grid } from './roomLayouts.ts';

/** Umbrales de vida (proporción) en los que la arena cambia: fase 1 al 66 % y fase 2 al 33 %. */
export const ARENA_AT: readonly number[] = [0.66, 0.33];
/** Aviso previo antes de que cambie el suelo, ms. */
export const ARENA_WARN_MS = 1500;
/** Margen tras la megaevolución antes de avisar de un cambio de arena (para que no coincidan en pantalla), ms. */
export const ARENA_AFTER_MEGA_MS = 600;
/** Casillas que cambian en cada fase (como mucho; se ponen menos si no caben sin cerrar el paso). */
export const ARENA_CELLS: Readonly<Record<ArenaKind, number>> = { grietas: 14, inundacion: 26, bloques: 10 };

/**
 * Tipos de cambio:
 * - grietas: el suelo se rompe y quema (daño continuo al pisarlas).
 * - inundacion: agua (más lento, como los charcos).
 * - bloques: se levantan rocas que cambian por dónde moverse (se pueden romper con bombas).
 */
export type ArenaKind = 'grietas' | 'inundacion' | 'bloques';

export const ARENA_WARNING: Readonly<Record<ArenaKind, string>> = {
  grietas: '¡El suelo empieza a resquebrajarse!',
  inundacion: '¡El agua empieza a subir!',
  bloques: '¡La tierra empieza a temblar!',
};

/** Fase de la arena según la vida: 0 (entera), 1 (por debajo del 66 %), 2 (por debajo del 33 %). */
export function arenaStage(hpRatio: number): 0 | 1 | 2 {
  if (hpRatio < ARENA_AT[1]) return 2;
  if (hpRatio < ARENA_AT[0]) return 1;
  return 0;
}

const BIOME_KINDS: Readonly<Record<string, readonly ArenaKind[]>> = {
  bosque: ['bloques', 'inundacion'],
  cueva: ['bloques', 'grietas'],
  mar: ['inundacion', 'bloques'],
  volcan: ['grietas', 'bloques'],
  torre: ['grietas', 'bloques'],
  ciudad: ['bloques', 'grietas'],
  nieve: ['inundacion', 'bloques'],
  pantano: ['inundacion', 'grietas'],
  cumbre: ['grietas', 'bloques'],
};

const TYPE_KIND: Readonly<Record<string, ArenaKind>> = {
  water: 'inundacion', ice: 'inundacion',
  fire: 'grietas', electric: 'grietas', poison: 'grietas', ghost: 'grietas', dark: 'grietas', dragon: 'grietas',
  rock: 'bloques', ground: 'bloques', steel: 'bloques', fighting: 'bloques', grass: 'bloques',
};

/**
 * Qué cambio toca en esta fase. La primera la decide el tipo principal del jefe (si encaja con alguno) o el bioma;
 * la segunda es otra distinta, para que la sala cambie de verdad. Determinista por semilla.
 */
export function arenaKindFor(biomeId: string, bossTypes: readonly string[], stage: 1 | 2, seed: number): ArenaKind {
  const biome = BIOME_KINDS[biomeId] ?? ['bloques', 'grietas'];
  const fromType = bossTypes.map((t) => TYPE_KIND[t]).find((k) => k !== undefined);
  const first = fromType ?? biome[mulberry32(seed ^ 0x51ed27)() < 0.5 ? 0 : 1];
  if (stage === 1) return first;
  const others = (['grietas', 'inundacion', 'bloques'] as const).filter((k) => k !== first);
  const pref = biome.find((k) => k !== first);
  return pref ?? others[Math.floor(mulberry32(seed ^ 0x9e3779)() * others.length)];
}

export interface ArenaPhaseInput {
  grid: Grid;
  biomeId: string;
  bossTypes: readonly string[];
  stage: 1 | 2;
  seed: number;
  /** Casilla del jugador al empezar el aviso: ni ella ni sus vecinas cambian. */
  player: readonly [number, number];
  /** Casillas ya afectadas por una fase anterior (peligro o bloque): no se repiten y cuentan como no seguras. */
  taken?: readonly (readonly [number, number])[];
}

export interface ArenaPhase {
  stage: 1 | 2;
  kind: ArenaKind;
  cells: [number, number][];
}

const key = (x: number, y: number) => `${x},${y}`;

/**
 * Elige las casillas que cambian. Garantías:
 * - solo suelo libre ('.'), nunca las casillas de las puertas ni el centro (ahí cae la trampilla);
 * - nunca la casilla del jugador ni sus vecinas (no le cae nada encima de golpe);
 * - siempre queda camino seguro (sin peligro ni bloque) entre todas las puertas, el centro y el jugador;
 * - misma entrada, misma salida (semilla).
 */
export function arenaPhase(input: ArenaPhaseInput): ArenaPhase {
  const { grid, stage, seed, player } = input;
  const kind = arenaKindFor(input.biomeId, input.bossTypes, stage, seed);
  const rng = mulberry32((seed ^ (stage * 0x2545f491)) >>> 0);
  const banned = new Set<string>();
  for (const [x, y] of [...SPAWN_TILES, ...CENTER_TILES]) banned.add(key(x, y));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) banned.add(key(player[0] + dx, player[1] + dy));
  for (const [x, y] of input.taken ?? []) banned.add(key(x, y));
  // Rejilla «segura»: lo ya afectado cuenta como bloqueado al comprobar el camino
  const safe: Grid = grid.map((row) => [...row]);
  for (const [x, y] of input.taken ?? []) if (safe[y]?.[x] !== undefined) safe[y][x] = 'X';
  const must: [number, number][] = [...SPAWN_TILES, CENTER_TILES[0]].filter(([x, y]) => safe[y][x] === '.' || safe[y][x] === 'W');
  if (safe[player[1]]?.[player[0]] === '.' || safe[player[1]]?.[player[0]] === 'W') must.push([player[0], player[1]]);
  const candidates: [number, number][] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] === '.' && !banned.has(key(x, y))) candidates.push([x, y]);
  // Mezcla determinista; el agua y las grietas se agrupan en manchas (crecen desde las casillas ya elegidas)
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const want = ARENA_CELLS[kind];
  const cells: [number, number][] = [];
  const chosen = new Set<string>();
  const tryAdd = (x: number, y: number): boolean => {
    if (cells.length >= want || chosen.has(key(x, y)) || banned.has(key(x, y)) || grid[y]?.[x] !== '.') return false;
    safe[y][x] = 'X';
    if (!allConnected(safe, must)) {
      safe[y][x] = grid[y][x];
      return false;
    }
    chosen.add(key(x, y));
    cells.push([x, y]);
    return true;
  };
  const clumpy = kind !== 'bloques';
  for (const [x, y] of candidates) {
    if (cells.length >= want) break;
    if (!tryAdd(x, y) || !clumpy) continue;
    // Mancha: unas cuantas vecinas
    const n = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rng() * 4)];
      tryAdd(x + dx, y + dy);
    }
  }
  return { stage, kind, cells };
}

/**
 * ¿Puede empezar ya el aviso de cambio de arena? Espera a que acabe la megaevolución (y un pequeño margen),
 * para que los dos avisos y los dos cambios nunca caigan en el mismo instante.
 */
export function arenaCanStart(now: number, megaAt: number | undefined, megaWarnMs: number): boolean {
  if (megaAt === undefined) return true;
  return now < megaAt || now >= megaAt + megaWarnMs + ARENA_AFTER_MEGA_MS;
}

/** ¿Puede empezar ya la megaevolución? No mientras dure el aviso de un cambio de arena. */
export const megaCanStart = (now: number, arenaWarnAt: number | undefined): boolean =>
  arenaWarnAt === undefined || now < arenaWarnAt || now >= arenaWarnAt + ARENA_WARN_MS;
