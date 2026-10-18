// Generador de pisos: lógica pura, sin Phaser, determinista por semilla.

export type RoomKind = 'start' | 'combat' | 'item' | 'boss';
export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];
export const DIR_DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export interface Room {
  id: number;
  gx: number;
  gy: number;
  kind: RoomKind;
  /** Distancia en salas desde la sala inicial. */
  depth: number;
  /** Sala vecina a la que lleva cada puerta. */
  doors: Partial<Record<Dir, number>>;
}

export interface Floor {
  seed: number;
  cols: number;
  rows: number;
  rooms: Room[];
  startId: number;
  itemId: number;
  bossId: number;
}

export interface FloorOptions {
  seed: number;
  roomCount?: number;
  cols?: number;
  rows?: number;
}

/** PRNG mulberry32: rápido y reproducible a partir de una semilla de 32 bits. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_ATTEMPTS = 500;

/**
 * Genera un piso al estilo Isaac: crecimiento en anchura desde el centro,
 * sin formar bloques de 2x2, con al menos dos salas sin salida para el
 * objeto y el jefe. El jefe va en la sala sin salida más lejana.
 */
export function generateFloor(opts: FloorOptions): Floor {
  const cols = opts.cols ?? 9;
  const rows = opts.rows ?? 9;
  const target = opts.roomCount ?? 10;
  if (target < 3) throw new Error('roomCount debe ser al menos 3');
  if (target > cols * rows) throw new Error('roomCount no cabe en la cuadrícula');

  const rng = mulberry32(opts.seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const floor = tryGenerate(rng, opts.seed, cols, rows, target);
    if (floor) return floor;
  }
  throw new Error(`No se pudo generar un piso con ${target} salas`);
}

function tryGenerate(rng: () => number, seed: number, cols: number, rows: number, target: number): Floor | null {
  const grid: (number | undefined)[] = new Array(cols * rows);
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= cols || y >= rows ? undefined : grid[y * cols + x];
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
  const occupiedNeighbours = (x: number, y: number) =>
    DIRS.filter((d) => at(x + DIR_DELTA[d].dx, y + DIR_DELTA[d].dy) !== undefined).length;

  const rooms: Room[] = [];
  const add = (gx: number, gy: number, depth: number) => {
    const room: Room = { id: rooms.length, gx, gy, kind: 'combat', depth, doors: {} };
    rooms.push(room);
    grid[gy * cols + gx] = room.id;
    return room;
  };

  const start = add(Math.floor(cols / 2), Math.floor(rows / 2), 0);
  const queue: Room[] = [start];

  while (queue.length > 0 && rooms.length < target) {
    const cur = queue.shift()!;
    for (const d of shuffled(DIRS, rng)) {
      if (rooms.length >= target) break;
      const nx = cur.gx + DIR_DELTA[d].dx;
      const ny = cur.gy + DIR_DELTA[d].dy;
      if (!inside(nx, ny) || at(nx, ny) !== undefined) continue;
      // Evita bucles y bloques compactos: la nueva sala solo toca a su padre
      if (occupiedNeighbours(nx, ny) > 1) continue;
      if (rng() < 0.5) continue;
      queue.push(add(nx, ny, cur.depth + 1));
    }
  }
  if (rooms.length < target) return null;

  // Puertas entre todas las salas adyacentes
  for (const r of rooms) {
    for (const d of DIRS) {
      const n = at(r.gx + DIR_DELTA[d].dx, r.gy + DIR_DELTA[d].dy);
      if (n !== undefined) r.doors[d] = n;
    }
  }

  const deadEnds = rooms.filter((r) => r.id !== start.id && Object.keys(r.doors).length === 1);
  if (deadEnds.length < 2) return null;

  const maxDepth = Math.max(...deadEnds.map((r) => r.depth));
  const farthest = deadEnds.filter((r) => r.depth === maxDepth);
  const boss = farthest[Math.floor(rng() * farthest.length)];
  // Isaac no pone el jefe pegado a la sala inicial
  if (boss.depth < 2) return null;

  const others = deadEnds.filter((r) => r !== boss);
  const item = others[Math.floor(rng() * others.length)];

  start.kind = 'start';
  boss.kind = 'boss';
  item.kind = 'item';

  return { seed, cols, rows, rooms, startId: start.id, itemId: item.id, bossId: boss.id };
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
