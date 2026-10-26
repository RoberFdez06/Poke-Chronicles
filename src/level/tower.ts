// T72: modo Torre de 100 pisos. Cada piso es UNA sola sala (normal o grande) y esta lógica pura decide cómo es:
// qué toca (combate, minijefe, jefe, descanso, suministros), su forma, su plantilla, su bioma, su regla especial
// y los peligros del suelo. Determinista por piso y semilla, sin Phaser, para poder testearla.
// Con extensión .ts para que los tests (node --test) puedan importarlo sin bundler
import { mulberry32, type Dir, type Floor, type Room, type RoomKind } from './floorGen.ts';
import {
  allConnected, CENTER_TILES, clearSpawnZones, COLS, DOOR_TILES, emptyGrid, isWalkable, OPEN_TEMPLATE_NAMES, parseTemplate, ROWS,
  TEMPLATE_NAMES, TEMPLATES, type Grid,
} from './roomLayouts.ts';
import { BIOMES, type Biome } from './biomes.ts';
import { ROOM_RULES, type RoomRule } from './roomRules.ts';
import type { LootDrop } from '../data/loot.ts';

import { TOWER_FLOORS } from '../data/modes.ts';

/** Pisos de la Torre (100, en modes.ts). El último es el reto final. */
export { TOWER_FLOORS };
/** Cada cuántos pisos cambia el bioma (y hay jefe al final del tramo). */
export const TOWER_SEGMENT = 10;
/** Caramelos por cada tramo que te saltas al empezar desde un punto de control (constante fácil de cambiar). */
export const TOWER_CHECKPOINT_CANDY = 40;
/** El minijefe «chetado» de la Torre: multiplicadores sobre un minijefe normal. */
export const TOWER_MINIBOSS_HP_MUL = 1.8;
export const TOWER_MINIBOSS_DMG_MUL = 1.35;

export type TowerFloorKind = 'combat' | 'miniboss' | 'boss' | 'final' | 'rest' | 'supply';
/** Forma de la sala: pequeña (plantilla con muros), normal, grande 2x1, 1x2, en L (3 casillas) o 2x2 (4 casillas). */
export type TowerShape = 'small' | 'normal' | 'wide' | 'tall' | 'ell' | 'square';
export type TowerHazard = 'spikes' | 'lava' | 'ice';

export const TOWER_HAZARD_LABEL: Record<TowerHazard, string> = { spikes: 'pinchos', lava: 'lava', ice: 'hielo' };

export interface HazardTile {
  /** Casilla de la sala grande (índice en `cells`). */
  cell: number;
  tx: number;
  ty: number;
}

export interface TowerFloorSpec {
  floor: number;
  kind: TowerFloorKind;
  shape: TowerShape;
  /** Casillas de la sala (posición en la cuadrícula del piso). La 0 es donde apareces. */
  cells: readonly [number, number][];
  /** Plantilla de obstáculos (null = sala vacía) y si va en espejo. */
  template: string | null;
  flipX: boolean;
  flipY: boolean;
  biome: Biome;
  rule: RoomRule | null;
  hazard: TowerHazard;
  hazards: HazardTile[];
}

const SHAPE_CELLS: Record<TowerShape, [number, number][]> = {
  small: [[0, 0]],
  normal: [[0, 0]],
  wide: [[0, 0], [1, 0]],
  tall: [[0, 0], [0, 1]],
  ell: [[0, 0], [1, 0], [0, 1]],
  square: [[0, 0], [1, 0], [0, 1], [1, 1]],
};
const BIG_SHAPES: readonly TowerShape[] = ['wide', 'tall', 'ell', 'square'];
const ALL_SHAPES: readonly TowerShape[] = ['small', 'normal', 'wide', 'tall', 'ell', 'square'];
/** Plantillas con muros 'X' (salas pequeñas: los muros recortan la sala). */
const WALLED_TEMPLATE_NAMES = TEMPLATE_NAMES.filter((n) => !OPEN_TEMPLATE_NAMES.includes(n));

const clampFloor = (f: number) => Math.min(TOWER_FLOORS, Math.max(1, Math.floor(f)));

/** Qué toca en cada piso. Descanso justo después de cada jefe (11, 21…), suministros en algunos pisos x3 y x8. */
export function towerFloorKind(floor: number, seed: number): TowerFloorKind {
  const f = clampFloor(floor);
  if (f === TOWER_FLOORS) return 'final';
  if (f % TOWER_SEGMENT === 0) return 'boss';
  if (f % 5 === 0) return 'miniboss';
  if (f > 1 && f % TOWER_SEGMENT === 1) return 'rest';
  if (f % 5 === 3 && mulberry32((seed ^ Math.imul(f, 0x85ebca6b)) >>> 0)() < 0.6) return 'supply';
  return 'combat';
}

export const isTowerBossFloor = (f: number) => f % TOWER_SEGMENT === 0;
/** Piso de descanso: aquí se guarda la partida y es el punto de control. */
export const isTowerRestFloor = (f: number, seed = 0) => towerFloorKind(f, seed) === 'rest';

/** Bioma por tramo de 10: la primera vuelta en el orden de BIOMES y las siguientes barajadas con la semilla. */
export function towerBiome(floor: number, seed: number): Biome {
  const seg = Math.floor((clampFloor(floor) - 1) / TOWER_SEGMENT);
  const lap = Math.floor(seg / BIOMES.length);
  const order = BIOMES.map((_, i) => i);
  if (lap > 0) {
    const rng = mulberry32((seed ^ Math.imul(lap, 0x27d4eb2f)) >>> 0);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // Que el cambio de vuelta no repita el bioma del tramo anterior
    if (order[0] === BIOMES.length - 1) [order[0], order[1]] = [order[1], order[0]];
  }
  return BIOMES[order[seg % BIOMES.length]];
}

/** Peligro del suelo según el bioma: lava en el volcán, hielo donde hace frío o hay agua, pinchos en el resto. */
export function hazardFor(biome: Biome): TowerHazard {
  if (biome.id === 'volcan') return 'lava';
  if (biome.id === 'nieve' || biome.id === 'cumbre' || biome.id === 'mar') return 'ice';
  return 'spikes';
}

/** Cuántas casillas de peligro por casilla de sala: sube poco a poco con el piso (0 en los 2 primeros). */
export const hazardCount = (floor: number): number => (floor < 3 ? 0 : Math.min(14, 1 + Math.floor(floor / 8)));

/** Nivel de dificultad (el de `difficultyFor`): sube suave, un punto cada ~8 pisos, hasta 13 en el piso 100. */
export const towerLevel = (floor: number): number => 1 + Math.round((clampFloor(floor) - 1) * 0.12);

/** Casillas donde no puede haber peligros: junto a las puertas (zona de aparición, 2 casillas) y el centro. */
function protectedTile(tx: number, ty: number): boolean {
  const near = (pts: readonly [number, number][]) => pts.some(([x, y]) => Math.abs(x - tx) <= 2 && Math.abs(y - ty) <= 2);
  return (Object.keys(DOOR_TILES) as Dir[]).some((d) => near(DOOR_TILES[d])) || near(CENTER_TILES);
}

const KEY_TILES: [number, number][] = [...(Object.values(DOOR_TILES).flat() as [number, number][]), ...CENTER_TILES];

/** Rejilla de la casilla con la plantilla (en espejo si toca). */
export function towerGrid(spec: Pick<TowerFloorSpec, 'template' | 'flipX' | 'flipY'>): Grid {
  if (!spec.template) return emptyGrid();
  let g = parseTemplate(TEMPLATES[spec.template]);
  if (spec.flipX) g = g.map((row) => [...row].reverse());
  if (spec.flipY) g = [...g].reverse();
  return clearSpawnZones(g);
}

/** Rejilla con los peligros que hacen daño marcados como no pisables (para comprobar que siempre hay paso). */
export function gridWithHazards(grid: Grid, tiles: readonly HazardTile[], cell: number): Grid {
  const g = grid.map((r) => [...r]);
  for (const h of tiles) if (h.cell === cell) g[h.ty][h.tx] = 'H';
  return g;
}

function placeHazards(grid: Grid, cell: number, count: number, rng: () => number): HazardTile[] {
  const out: HazardTile[] = [];
  const free: [number, number][] = [];
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (grid[y][x] === '.' && !protectedTile(x, y)) free.push([x, y]);
  for (let tries = 0; out.length < count && tries < count * 8 && free.length > 0; tries++) {
    const [x, y] = free.splice(Math.floor(rng() * free.length), 1)[0];
    const next = [...out, { cell, tx: x, ty: y }];
    // Nunca cortan el paso: puertas y centro siguen unidos aunque los peligros fueran muro
    if (allConnected(gridWithHazards(grid, next, cell), KEY_TILES)) out.push({ cell, tx: x, ty: y });
  }
  return out;
}

interface Picked {
  shape: TowerShape;
  template: string | null;
}

/** Forma y plantilla de cada piso, en orden, para que nunca se repitan dos seguidas. */
function pickShapeAndTemplate(f: number, kind: TowerFloorKind, prev: Picked | null, rng: () => number): Picked {
  const choose = <T>(list: readonly T[], avoid: T | undefined): T => {
    const ok = list.filter((x) => x !== avoid);
    const from = ok.length > 0 ? ok : list;
    return from[Math.floor(rng() * from.length)];
  };
  let shapes: readonly TowerShape[];
  if (kind === 'boss' || kind === 'final' || kind === 'miniboss') shapes = BIG_SHAPES;
  else if (kind === 'rest' || kind === 'supply') shapes = ['normal'];
  else shapes = ALL_SHAPES;
  const shape = choose(shapes, prev?.shape);
  if (kind === 'rest' || kind === 'supply') return { shape, template: null };
  const names = shape === 'small' ? WALLED_TEMPLATE_NAMES : OPEN_TEMPLATE_NAMES;
  return { shape, template: choose(names, prev?.template ?? undefined) };
}

/**
 * Cómo es el piso `floor` de la Torre con la semilla de la partida. Se calcula recorriendo los pisos anteriores
 * (son 100 como mucho) para cumplir que no se repita forma ni plantilla ni regla seguidas.
 */
export function towerFloorSpec(floor: number, seed: number): TowerFloorSpec {
  const target = clampFloor(floor);
  const rng = mulberry32((seed ^ 0x7f4a7c15) >>> 0);
  let prev: Picked | null = null;
  let nextRuleAt = 6 + Math.floor(rng() * 2);
  let lastRule: RoomRule | null = null;
  for (let f = 1; ; f++) {
    const kind = towerFloorKind(f, seed);
    const picked = pickShapeAndTemplate(f, kind, prev, rng);
    // Regla cada 6 o 7 pisos; si cae en un piso que no es de combate, pasa al siguiente que sí
    let rule: RoomRule | null = null;
    if (f >= nextRuleAt && kind === 'combat') {
      const ok = ROOM_RULES.filter((r) => r !== lastRule);
      rule = ok[Math.floor(rng() * ok.length)];
      lastRule = rule;
      nextRuleAt = f + 6 + Math.floor(rng() * 2);
    }
    const flipX = rng() < 0.5;
    const flipY = rng() < 0.5;
    if (f === target) {
      const biome = towerBiome(f, seed);
      const hazard = hazardFor(biome);
      const cells = SHAPE_CELLS[picked.shape];
      const spec: TowerFloorSpec = { floor: f, kind, shape: picked.shape, cells, template: picked.template, flipX, flipY, biome, rule, hazard, hazards: [] };
      // Peligros solo en pisos de pelea (en descanso y suministros no)
      if (kind !== 'rest' && kind !== 'supply') {
        const hr = mulberry32((seed ^ Math.imul(f, 0x165667b1)) >>> 0);
        const grid = towerGrid(spec);
        cells.forEach((_, c) => spec.hazards.push(...placeHazards(grid, c, hazardCount(f), hr)));
      }
      return spec;
    }
    prev = picked;
  }
}

/** Regla del piso siguiente, para el cartel antes de subir. */
export const upcomingRule = (floor: number, seed: number): RoomRule | null =>
  floor >= TOWER_FLOORS ? null : towerFloorSpec(floor + 1, seed).rule;

/** RoomKind de las casillas del piso: los descansos usan el Centro Pokémon (la fuente) y los suministros, sala vacía. */
export function towerRoomKind(kind: TowerFloorKind): RoomKind {
  if (kind === 'boss' || kind === 'final') return 'boss';
  if (kind === 'rest') return 'center';
  if (kind === 'supply') return 'start';
  return 'combat';
}

/** El piso como `Floor` de una sola sala (con varias casillas unidas si es grande), sin puertas hacia fuera. */
export function towerFloor(spec: TowerFloorSpec, seed: number): Floor {
  const kind = towerRoomKind(spec.kind);
  const big = spec.cells.length > 1;
  const rooms: Room[] = spec.cells.map(([gx, gy], id) => ({ id, gx, gy, kind, depth: 0, doors: {}, ...(big ? { group: 0 } : {}) }));
  for (const a of rooms)
    for (const b of rooms) {
      if (b.gx === a.gx + 1 && b.gy === a.gy) { a.doors.right = b.id; b.doors.left = a.id; }
      if (b.gy === a.gy + 1 && b.gx === a.gx) { a.doors.down = b.id; b.doors.up = a.id; }
    }
  return {
    seed, cols: 2, rows: 2, rooms, startId: 0, itemId: 0, bossId: 0,
    ...(kind === 'center' ? { centerId: 0 } : {}),
    ...(big ? { groups: [rooms.map((r) => r.id)] } : {}),
  };
}

/** Las tres cosas a elegir de la sala de suministros (se coge una). */
export const SUPPLY_CHOICES: readonly LootDrop[] = [{ kind: 'potion' }, { kind: 'key' }, { kind: 'berry', id: 'aranja' }];

/** Punto de control: el piso de descanso tras el último jefe vencido (1 si ninguno). */
export function towerCheckpoint(bestFloor: number): number {
  const boss = Math.floor(Math.max(0, Math.min(TOWER_FLOORS - 1, bestFloor)) / TOWER_SEGMENT) * TOWER_SEGMENT;
  return boss > 0 ? boss + 1 : 1;
}

/** Caramelos que cuesta empezar desde ese punto de control. */
export const towerCheckpointCost = (checkpoint: number): number =>
  checkpoint <= 1 ? 0 : TOWER_CHECKPOINT_CANDY * Math.floor((checkpoint - 1) / TOWER_SEGMENT);

/** Las casillas de la sala son todas jugables (las usan los tests y GameScene para no fiarse a ciegas). */
export function towerPlayable(spec: TowerFloorSpec): boolean {
  const grid = towerGrid(spec);
  return spec.cells.every((_, c) => {
    const g = gridWithHazards(grid, spec.hazards, c);
    return allConnected(g, KEY_TILES) && spec.hazards.filter((h) => h.cell === c).every((h) => isWalkable(grid[h.ty][h.tx]) && !protectedTile(h.tx, h.ty));
  });
}
