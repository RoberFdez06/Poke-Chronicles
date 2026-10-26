// T78: arenas de los jefes que cambian de fase según la vida del jefe.
// - Fase 1 (por debajo del 67 %): desperfectos. Grietas que queman un poco, escombros (rocas) y charcos en las esquinas.
//   La sala sigue siendo la misma.
// - Fase 2 (por debajo del 34 %): el suelo se derrumba y jugador y jefe caen a OTRA arena, según el tipo del jefe
//   (lava, inundada, hielo, raíces o ruinas de roca).
// - La megaevolución del jefe (T66, al 50 %) va entre las dos y nunca coincide con ninguna: una espera a la otra.
// Lógica pura, sin Phaser.
import { mulberry32 } from './floorGen.ts';
import { allConnected, CENTER_TILES, COLS, emptyGrid, ROWS, SPAWN_TILES, type Cell, type Grid } from './roomLayouts.ts';
import { MEGA_AT } from '../data/megaBoss.ts';

/** Umbrales de vida (proporción): fase 1 al bajar del 67 % (-33 %) y fase 2 al bajar del 34 % (-66 %). */
export const ARENA_AT: readonly [number, number] = [0.67, 0.34];
/** Aviso de la fase 1 (casillas marcadas) antes de que se rompa el suelo, ms. */
export const ARENA_WARN_MS = 1500;
/** Margen entre dos sucesos del jefe (fase de arena y megaevolución) para que se aprecien por separado, ms. */
export const EVENT_GAP_MS = 1000;
/** Derrumbe de la fase 2: temblor, fundido a negro, cambio de arena y vuelta (todo dentro de FALL_TOTAL_MS). */
export const FALL_SHAKE_MS = 500;
export const FALL_FADE_MS = 300;
export const FALL_HOLD_MS = 200;
export const FALL_TOTAL_MS = FALL_SHAKE_MS + FALL_FADE_MS * 2 + FALL_HOLD_MS;

/** Fase de la arena según la vida: 0 (entera), 1 (por debajo del 67 %), 2 (por debajo del 34 %). */
export function arenaStage(hpRatio: number): 0 | 1 | 2 {
  if (hpRatio < ARENA_AT[1]) return 2;
  if (hpRatio < ARENA_AT[0]) return 1;
  return 0;
}

// --- Orden de los sucesos del jefe ---

export type BossEvent = 'arena1' | 'mega' | 'arena2';

export interface BossEventState {
  ratio: number;
  /** Fase de arena ya empezada (0, 1 o 2). */
  arenaDone: 0 | 1 | 2;
  /** Ya ha megaevolucionado (o no puede: minijefe, ayudante…); entonces no se le espera. */
  megaDone: boolean;
  /** Este enemigo cambia la arena (solo jefes). */
  arena: boolean;
  /** Este enemigo puede megaevolucionar. */
  mega: boolean;
  now: number;
  /** Hasta cuándo dura el último suceso (aviso de fase 1, megaevolución o derrumbe); undefined = ninguno aún. */
  busyUntil: number | undefined;
}

/**
 * Qué suceso toca ahora, o null. Van siempre en orden (fase 1 → mega → fase 2), uno detrás de otro y con
 * EVENT_GAP_MS de margen entre el final de uno y el principio del siguiente. Si un golpe muy fuerte baja la vida de
 * golpe, salen igualmente en ese orden y nunca dos a la vez.
 */
export function nextBossEvent(s: BossEventState): BossEvent | null {
  if (s.busyUntil !== undefined && s.now < s.busyUntil + EVENT_GAP_MS) return null;
  if (s.ratio <= 0) return null;
  if (s.arena && s.arenaDone < 1 && s.ratio < ARENA_AT[0]) return 'arena1';
  if (s.mega && !s.megaDone && s.ratio < MEGA_AT) return 'mega';
  if (s.arena && s.arenaDone < 2 && s.ratio < ARENA_AT[1]) return 'arena2';
  return null;
}

// --- Utilidades comunes ---

const key = (x: number, y: number) => `${x},${y}`;
type Tile = readonly [number, number];

/** Casillas prohibidas: puertas, centro (trampilla) y la casilla de cada persona indicada con sus vecinas. */
function bannedSet(people: readonly Tile[], extra: readonly Tile[] = []): Set<string> {
  const banned = new Set<string>();
  for (const [x, y] of [...SPAWN_TILES, ...CENTER_TILES, ...extra]) banned.add(key(x, y));
  for (const [px, py] of people) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) banned.add(key(px + dx, py + dy));
  return banned;
}

const walkable = (c: Cell | undefined) => c === '.' || c === 'W';

/** Casillas que tienen que seguir unidas por un camino seguro: puertas, centro y las personas. */
function mustTiles(safe: Grid, people: readonly Tile[]): [number, number][] {
  const must: [number, number][] = [...SPAWN_TILES, CENTER_TILES[0]].filter(([x, y]) => walkable(safe[y]?.[x]));
  for (const [x, y] of people) if (walkable(safe[y]?.[x])) must.push([x, y]);
  return must;
}

function shuffled<T>(list: T[], rng: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Coloca hasta `want` casillas desde `candidates` (en orden), en manchas si `clump`. Cada casilla elegida cuenta como
 * no segura en `safe` y solo se acepta si todas las `must` siguen unidas.
 */
function place(
  grid: Grid,
  safe: Grid,
  banned: Set<string>,
  must: [number, number][],
  candidates: readonly Tile[],
  want: number,
  clump: number,
  rng: () => number,
  out: [number, number][],
): void {
  let added = 0;
  const tryAdd = (x: number, y: number): boolean => {
    if (added >= want || x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (banned.has(key(x, y)) || grid[y][x] !== '.' || safe[y][x] !== '.') return false;
    safe[y][x] = 'X';
    if (!allConnected(safe, must)) {
      safe[y][x] = '.';
      return false;
    }
    added++;
    out.push([x, y]);
    return true;
  };
  for (const [x, y] of candidates) {
    if (added >= want) break;
    if (!tryAdd(x, y) || clump <= 0) continue;
    const n = clump + Math.floor(rng() * 3);
    let [cx, cy] = [x, y];
    for (let k = 0; k < n; k++) {
      const [dx, dy] = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)[Math.floor(rng() * 4)];
      if (tryAdd(cx + dx, cy + dy)) [cx, cy] = [cx + dx, cy + dy];
    }
  }
}

// --- Fase 1: desperfectos ---

export type DamageKind = 'grieta' | 'escombro' | 'charco';

export interface ArenaPhaseInput {
  grid: Grid;
  seed: number;
  /** Casilla del jugador al empezar el aviso: ni ella ni sus vecinas cambian. */
  player: Tile;
  /** Casilla del jefe (opcional): tampoco le cae nada encima. */
  boss?: Tile;
}

export interface ArenaPhase {
  stage: 1;
  /** Grietas (queman un poco al pisarlas), escombros (rocas, se rompen con bombas) y charcos (más lento). */
  cells: { x: number; y: number; kind: DamageKind }[];
}

/** Cuántas casillas de cada cosa, como mucho (se ponen menos si no caben sin cerrar el paso). */
export const DAMAGE_CELLS: Readonly<Record<DamageKind, number>> = { grieta: 10, escombro: 4, charco: 8 };

/**
 * Fase 1: el suelo se agrieta, caen escombros y salen charcos en las esquinas. Peligro leve: la sala sigue igual de
 * reconocible. Garantías: solo suelo libre, nunca puertas ni centro, nunca encima del jugador o del jefe ni de sus
 * vecinas, siempre camino seguro entre puertas, centro y jugador; misma entrada, misma salida.
 */
export function arenaPhase(input: ArenaPhaseInput): ArenaPhase {
  const { grid, seed, player } = input;
  const rng = mulberry32((seed ^ 0x2545f491) >>> 0);
  const people: Tile[] = input.boss ? [player, input.boss] : [player];
  const banned = bannedSet(people);
  const safe: Grid = grid.map((row) => row.map((c) => (c === 'W' ? '.' : c)));
  const must = mustTiles(safe, [player]);
  const free: [number, number][] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] === '.' && !banned.has(key(x, y))) free.push([x, y]);
  // Charcos: de las esquinas hacia dentro
  const corner = (x: number, y: number) => Math.min(x, COLS - 1 - x) + Math.min(y, ROWS - 1 - y);
  const byCorner = shuffled([...free], rng).sort((a, b) => corner(a[0], a[1]) - corner(b[0], b[1]));
  const cells: ArenaPhase['cells'] = [];
  const push = (kind: DamageKind, list: [number, number][]) => list.forEach(([x, y]) => cells.push({ x, y, kind }));
  const charcos: [number, number][] = [];
  place(grid, safe, banned, must, byCorner, DAMAGE_CELLS.charco, 1, rng, charcos);
  push('charco', charcos);
  const escombros: [number, number][] = [];
  place(grid, safe, banned, must, shuffled([...free], rng), DAMAGE_CELLS.escombro, 0, rng, escombros);
  push('escombro', escombros);
  const grietas: [number, number][] = [];
  place(grid, safe, banned, must, shuffled([...free], rng), DAMAGE_CELLS.grieta, 2, rng, grietas);
  push('grieta', grietas);
  return { stage: 1, cells };
}

// --- Fase 2: caída a otra arena según el tipo del jefe ---

/**
 * - lava (fuego): charcas de lava que queman al pisarlas y rocas.
 * - inundada (agua): casi toda el agua cubre el suelo (más lento) y alguna roca.
 * - hielo: placas de hielo resbaladizas y columnas de hielo.
 * - raices (planta y bicho): raíces que cortan el paso (se rompen a disparos, como la hierba alta) y rocas.
 * - ruinas (el resto): rocas, columnas y algún foso.
 */
export type FallTheme = 'lava' | 'inundada' | 'hielo' | 'raices' | 'ruinas';

const TYPE_THEME: Readonly<Record<string, FallTheme>> = { fire: 'lava', water: 'inundada', ice: 'hielo', grass: 'raices', bug: 'raices' };

/** Arena a la que se cae: la del primer tipo del jefe que tenga regla propia; si ninguno, ruinas. */
export const fallTheme = (bossTypes: readonly string[]): FallTheme => bossTypes.map((t) => TYPE_THEME[t]).find((t) => t !== undefined) ?? 'ruinas';

export const FALL_WARNING = '¡El suelo se derrumba!';
export const FALL_LANDING: Readonly<Record<FallTheme, string>> = {
  lava: '¡Habéis caído a una cueva de lava! Cuidado con dónde pisas',
  inundada: '¡Habéis caído a una sala inundada! El agua te frena',
  hielo: '¡Habéis caído a una caverna helada! El hielo resbala',
  raices: '¡Habéis caído entre raíces! Ábrete paso a disparos',
  ruinas: '¡Habéis caído a unas ruinas! Todo ha cambiado',
};
/** Tinte del suelo nuevo (color liso hasta que haya arte). */
export const FALL_TINT: Readonly<Record<FallTheme, number>> = { lava: 0x5a1a0a, inundada: 0x1a4a7a, hielo: 0xbfe6ff, raices: 0x2e4a1e, ruinas: 0x5a5048 };

export interface FallInput {
  bossTypes: readonly string[];
  seed: number;
  player: Tile;
  boss?: Tile;
}

export interface ArenaFall {
  stage: 2;
  theme: FallTheme;
  /** Obstáculos nuevos (sustituye a toda la cuadrícula de la sala). */
  grid: Grid;
  /** Casillas especiales sobre suelo libre: lava (daño) o hielo (resbala). Vacío en el resto de temas. */
  hazards: [number, number][];
}

const FALL_PLAN: Readonly<Record<FallTheme, readonly { cell: Cell | 'hazard'; n: number; clump: number }[]>> = {
  lava: [{ cell: 'hazard', n: 34, clump: 3 }, { cell: 'R', n: 8, clump: 1 }],
  inundada: [{ cell: 'W', n: 90, clump: 4 }, { cell: 'R', n: 6, clump: 0 }],
  hielo: [{ cell: 'hazard', n: 70, clump: 4 }, { cell: 'P', n: 6, clump: 0 }],
  raices: [{ cell: 'B', n: 22, clump: 2 }, { cell: 'R', n: 6, clump: 0 }],
  ruinas: [{ cell: 'R', n: 16, clump: 1 }, { cell: 'P', n: 6, clump: 0 }, { cell: 'H', n: 6, clump: 1 }],
};

/**
 * Fase 2: la arena nueva. Garantías: puertas y centro libres, nada encima del jugador ni del jefe (ni de sus vecinas),
 * siempre camino seguro (sin obstáculos ni lava) entre puertas, centro, jugador y jefe; determinista por semilla.
 * El agua y el hielo se pueden cruzar, así que no cierran el paso.
 */
export function arenaFall(input: FallInput): ArenaFall {
  const theme = fallTheme(input.bossTypes);
  const rng = mulberry32((input.seed ^ 0x7f4a7c15) >>> 0);
  const people: Tile[] = input.boss ? [input.player, input.boss] : [input.player];
  const banned = bannedSet(people);
  const grid = emptyGrid();
  const safe = emptyGrid();
  const must = mustTiles(safe, people);
  const hazards: [number, number][] = [];
  const all: [number, number][] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) all.push([x, y]);
  for (const step of FALL_PLAN[theme]) {
    const out: [number, number][] = [];
    const candidates = shuffled(all.filter(([x, y]) => grid[y][x] === '.' && !hazards.some(([hx, hy]) => hx === x && hy === y)), rng);
    // Lo que se cruza a pie (agua, hielo) no cierra el paso: se coloca sin tocar la rejilla segura
    const passable = step.cell === 'W' || (step.cell === 'hazard' && theme === 'hielo');
    if (passable) {
      const scratch = safe.map((r) => [...r]);
      place(grid, scratch, banned, must, candidates, step.n, step.clump, rng, out);
    } else place(grid, safe, banned, must, candidates, step.n, step.clump, rng, out);
    for (const [x, y] of out) {
      if (step.cell === 'hazard') hazards.push([x, y]);
      else grid[y][x] = step.cell;
    }
  }
  return { stage: 2, theme, grid, hazards };
}
