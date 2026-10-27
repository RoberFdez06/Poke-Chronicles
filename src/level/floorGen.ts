// Generador de pisos: lógica pura, sin Phaser, determinista por semilla.

/**
 * center = Centro Pokémon (te cura una vez por piso); shop = tienda (se paga con monedas de la partida);
 * secret = sala secreta (sus puertas están ocultas y se abren con una bomba); challenge = sala de desafío (oleadas).
 */
export type RoomKind = 'start' | 'combat' | 'item' | 'boss' | 'center' | 'shop' | 'secret' | 'challenge';
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
  /** Sala grande: número del grupo de salas unidas (sin pared entre ellas). */
  group?: number;
}

export interface Floor {
  seed: number;
  cols: number;
  rows: number;
  rooms: Room[];
  startId: number;
  itemId: number;
  bossId: number;
  /** Centro Pokémon y tienda (solo con `special: true`). */
  centerId?: number;
  shopId?: number;
  /** Sala secreta, sala de desafío y salas con cofre (solo con `extra: true`). */
  secretId?: number;
  challengeId?: number;
  chestRooms?: number[];
  /** Puertas ocultas ("sala:dirección", en los dos lados): parecen pared hasta que una bomba las abre. */
  hiddenDoors?: string[];
  /** Salas grandes (solo con `big: true`): cada grupo son 2 o 3 salas de combate contiguas unidas en una. */
  groups?: number[][];
}

export interface FloorOptions {
  seed: number;
  roomCount?: number;
  cols?: number;
  rows?: number;
  /**
   * Añade Centro Pokémon y tienda. Se eligen con un generador aparte a partir de la semilla, así el resto
   * del piso sale igual que sin ellas (las partidas guardadas antes de tenerlas se siguen cargando bien).
   */
  special?: boolean;
  /** Además: sala secreta, sala de desafío y cofres (diseño 3; también con un generador aparte). */
  extra?: boolean;
  /** Además: salas grandes (diseño 4; también con un generador aparte). */
  big?: boolean;
  /** Además: la sala del jefe es una arena grande de 4 a 9 casillas (addBossArena). */
  bossArena?: boolean;
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
    if (!floor) continue;
    const withSpecial = opts.special || opts.extra ? addSpecialRooms(floor) : floor;
    const withExtra = opts.extra ? addExtraRooms(withSpecial) : withSpecial;
    const withBig = opts.big ? addBigRooms(withExtra) : withExtra;
    return opts.bossArena ? addBossArena(withBig) : withBig;
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

/**
 * Convierte dos salas de combate en Centro Pokémon y tienda: mejor sin salida, nunca la de inicio, la del
 * objeto ni la del jefe.
 */
export function addSpecialRooms(floor: Floor): Floor {
  const rng = mulberry32(floor.seed ^ 0xc3a5c85c);
  const rooms = floor.rooms.map((r) => ({ ...r, doors: { ...r.doors } }));
  const candidates = rooms.filter((r) => r.kind === 'combat');
  const deadEnds = candidates.filter((r) => Object.keys(r.doors).length === 1);
  const pick = (): Room | undefined => {
    const pool = deadEnds.length > 0 ? deadEnds : candidates;
    if (pool.length === 0) return undefined;
    const room = pool[Math.floor(rng() * pool.length)];
    for (const list of [deadEnds, candidates]) {
      const i = list.indexOf(room);
      if (i !== -1) list.splice(i, 1);
    }
    return room;
  };
  const center = pick();
  if (center) center.kind = 'center';
  const shop = pick();
  if (shop) shop.kind = 'shop';
  return { ...floor, rooms, centerId: center?.id, shopId: shop?.id };
}

/** Cuántas salas de combate tienen cofre en cada piso. */
export const CHESTS_PER_FLOOR = 2;

/** Clave de una puerta oculta. */
export const doorKey = (roomId: number, d: Dir) => `${roomId}:${d}`;

/**
 * Sala secreta (como en Isaac): una celda vacía pegada a cuantas más salas mejor (solo de combate o la de inicio,
 * nunca la del jefe ni otra especial), con puertas ocultas. Además convierte una sala de combate en sala de
 * desafío y elige salas con cofre. Usa su propio generador, así lo demás sale igual.
 */
export function addExtraRooms(floor: Floor): Floor {
  const rng = mulberry32(floor.seed ^ 0x51ed270b);
  const rooms = floor.rooms.map((r) => ({ ...r, doors: { ...r.doors } }));
  const cell = (gx: number, gy: number) => `${gx},${gy}`;
  const at = new Map(rooms.map((r) => [cell(r.gx, r.gy), r]));
  const hiddenDoors: string[] = [];

  // Sala secreta: celda libre con el mayor número de vecinas válidas
  let best: { gx: number; gy: number }[] = [];
  let bestN = 0;
  for (let gy = 0; gy < floor.rows; gy++) {
    for (let gx = 0; gx < floor.cols; gx++) {
      if (at.has(cell(gx, gy))) continue;
      const n = DIRS.map((d) => at.get(cell(gx + DIR_DELTA[d].dx, gy + DIR_DELTA[d].dy))).filter((x): x is Room => !!x);
      if (n.length === 0 || n.some((x) => x.kind !== 'combat' && x.kind !== 'start')) continue;
      if (n.length > bestN) {
        bestN = n.length;
        best = [];
      }
      if (n.length === bestN) best.push({ gx, gy });
    }
  }
  let secretId: number | undefined;
  if (best.length > 0) {
    const c = best[Math.floor(rng() * best.length)];
    const secret: Room = { id: rooms.length, gx: c.gx, gy: c.gy, kind: 'secret', depth: 0, doors: {} };
    let depth = Infinity;
    for (const d of DIRS) {
      const n = at.get(cell(c.gx + DIR_DELTA[d].dx, c.gy + DIR_DELTA[d].dy));
      if (!n) continue;
      secret.doors[d] = n.id;
      n.doors[OPPOSITE[d]] = secret.id;
      hiddenDoors.push(doorKey(secret.id, d), doorKey(n.id, OPPOSITE[d]));
      depth = Math.min(depth, n.depth + 1);
    }
    secret.depth = depth;
    rooms.push(secret);
    secretId = secret.id;
  }

  // Sala de desafío: una de combate, mejor sin salida (sin contar puertas ocultas)
  const visibleDoors = (x: Room) => DIRS.filter((d) => x.doors[d] !== undefined && !hiddenDoors.includes(doorKey(x.id, d))).length;
  const combat = rooms.filter((x) => x.kind === 'combat');
  const ends = combat.filter((x) => visibleDoors(x) === 1);
  const pool = ends.length > 0 ? ends : combat;
  const challenge = pool.length > 0 ? pool[Math.floor(rng() * pool.length)] : undefined;
  if (challenge) challenge.kind = 'challenge';

  // Cofres en algunas salas de combate
  const left = rooms.filter((x) => x.kind === 'combat');
  const chestRooms: number[] = [];
  while (chestRooms.length < CHESTS_PER_FLOOR && left.length > 0) {
    chestRooms.push(left.splice(Math.floor(rng() * left.length), 1)[0].id);
  }

  return { ...floor, rooms, secretId, challengeId: challenge?.id, chestRooms: chestRooms.sort((a, b) => a - b), hiddenDoors };
}

/** ¿Estas dos salas están unidas en una sala grande? */
export function sameGroup(a: Room, b: Room): boolean {
  return a.group !== undefined && a.group === b.group;
}

/** Máximo de salas grandes por piso. */
export const MAX_BIG_ROOMS = 3;

/**
 * Salas grandes (como en Isaac): junta 2 o 3 salas de combate contiguas (por una puerta visible) en una sola. Vale
 * una pareja (2×1 o 1×2), una línea de 3 o una L. Nunca incluye inicio, objeto, jefe, tiendas, secreta ni desafío.
 * Usa su propio generador, así lo demás del piso sale igual.
 */
export function addBigRooms(floor: Floor): Floor {
  const rng = mulberry32(floor.seed ^ 0x2b7e1516);
  const rooms = floor.rooms.map((r) => ({ ...r, doors: { ...r.doors } }));
  const hidden = new Set(floor.hiddenDoors ?? []);
  const free = (r: Room) => r.kind === 'combat' && r.group === undefined;
  const link = (a: Room, d: Dir): Room | undefined => {
    const n = a.doors[d] !== undefined ? rooms[a.doors[d]!] : undefined;
    return n && free(n) && !hidden.has(doorKey(a.id, d)) ? n : undefined;
  };
  const combat = rooms.filter((r) => r.kind === 'combat');
  const maxGroups = Math.min(MAX_BIG_ROOMS, Math.max(1, Math.floor(combat.length / 4)));
  const groups: number[][] = [];
  for (const start of shuffled(combat, rng)) {
    if (groups.length >= maxGroups) break;
    if (!free(start)) continue;
    const size = rng() < 0.6 ? 2 : 3;
    const members = [start];
    while (members.length < size) {
      const options: Room[] = [];
      for (const m of members) for (const d of DIRS) {
        const n = link(m, d);
        if (n && !members.includes(n)) options.push(n);
      }
      if (options.length === 0) break;
      members.push(options[Math.floor(rng() * options.length)]);
      // Evita 2×2: con 3 salas ya vale la L
    }
    if (members.length < 2) continue;
    members.forEach((m) => (m.group = groups.length));
    groups.push(members.map((m) => m.id).sort((a, b) => a - b));
  }
  return { ...floor, rooms, groups };
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Arena del jefe: siempre una sala grande de 4 a 9 casillas ---

/** Casillas mínimas y máximas de una arena de jefe (todos los modos). */
export const BOSS_ARENA_MIN = 4;
export const BOSS_ARENA_MAX = 9;
/** Formas de arena de jefe [ancho, alto]: 2×2, 2×3, 3×2 y 3×3 (todas entre 4 y 9 casillas). */
export const BOSS_ARENA_SHAPES: readonly (readonly [number, number])[] = [[2, 2], [3, 2], [2, 3], [3, 3]];

/** Forma de la arena del jefe para esta semilla (variedad pseudoaleatoria). */
export function bossArenaShape(seed: number): readonly [number, number] {
  const rng = mulberry32((seed ^ 0x51ed270b) >>> 0);
  return BOSS_ARENA_SHAPES[Math.floor(rng() * BOSS_ARENA_SHAPES.length)];
}

/**
 * Agranda la sala del jefe a una arena de bossArenaShape(seed) casillas (o la mayor que quepa) en celdas libres de la
 * cuadrícula, pegada a la sala del jefe original, que sigue siendo la entrada (misma id y misma puerta). Las casillas
 * nuevas van al final de `rooms` (las ids de siempre no cambian) y forman un grupo. Si no cabe ni 2×2, ensancha la
 * cuadrícula (mueve todas las salas) y vuelve a probar.
 */
export function addBossArena(floor: Floor): Floor {
  for (let pad = 0; pad <= 4; pad += 2) {
    const f = pad === 0 ? floor : padFloor(floor, pad);
    const out = tryBossArena(f);
    if (out) return out;
  }
  return floor;
}

function padFloor(floor: Floor, pad: number): Floor {
  return { ...floor, cols: floor.cols + pad * 2, rows: floor.rows + pad * 2, rooms: floor.rooms.map((r) => ({ ...r, gx: r.gx + pad, gy: r.gy + pad, doors: { ...r.doors } })) };
}

function tryBossArena(floor: Floor): Floor | null {
  const rng = mulberry32((floor.seed ^ 0x1b873593) >>> 0);
  const boss = floor.rooms[floor.bossId];
  if (!boss || boss.group !== undefined) return floor;
  const taken = new Set(floor.rooms.map((r) => `${r.gx},${r.gy}`));
  const first = bossArenaShape(floor.seed);
  // Primero la forma de la semilla, luego las demás de mayor a menor
  const rest = [...BOSS_ARENA_SHAPES].filter((s) => s !== first).sort((a, b) => b[0] * b[1] - a[0] * a[1]);
  for (const [w, h] of [first, ...rest]) {
    const spots: [number, number][] = [];
    for (let ox = 0; ox < w; ox++)
      for (let oy = 0; oy < h; oy++) {
        const x0 = boss.gx - ox;
        const y0 = boss.gy - oy;
        if (x0 < 0 || y0 < 0 || x0 + w > floor.cols || y0 + h > floor.rows) continue;
        let ok = true;
        for (let x = x0; x < x0 + w && ok; x++) for (let y = y0; y < y0 + h && ok; y++) if (!(x === boss.gx && y === boss.gy) && taken.has(`${x},${y}`)) ok = false;
        if (ok) spots.push([x0, y0]);
      }
    if (spots.length === 0) continue;
    const [x0, y0] = spots[Math.floor(rng() * spots.length)];
    const group = floor.groups?.length ?? 0;
    const rooms = floor.rooms.map((r) => ({ ...r, doors: { ...r.doors } }));
    const cells: Room[] = [];
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        if (x === boss.gx && y === boss.gy) {
          rooms[boss.id].group = group;
          cells.push(rooms[boss.id]);
        } else {
          const r: Room = { id: rooms.length, gx: x, gy: y, kind: 'boss', depth: boss.depth, doors: {}, group };
          rooms.push(r);
          cells.push(r);
        }
      }
    for (const a of cells)
      for (const b of cells) {
        if (b.gx === a.gx + 1 && b.gy === a.gy) { a.doors.right = b.id; b.doors.left = a.id; }
        if (b.gy === a.gy + 1 && b.gx === a.gx) { a.doors.down = b.id; b.doors.up = a.id; }
      }
    return { ...floor, rooms, groups: [...(floor.groups ?? []), cells.map((c) => c.id).sort((a, b) => a - b)] };
  }
  return null;
}

/** Piso de una sola arena de jefe (Rush, reto final) con la forma de la semilla; entrada en la casilla 0. */
export function bossArenaFloor(seed: number): Floor {
  const [w, h] = bossArenaShape(seed);
  const rooms: Room[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rooms.push({ id: rooms.length, gx: x, gy: y, kind: 'boss', depth: 0, doors: {}, group: 0 });
  for (const a of rooms)
    for (const b of rooms) {
      if (b.gx === a.gx + 1 && b.gy === a.gy) { a.doors.right = b.id; b.doors.left = a.id; }
      if (b.gy === a.gy + 1 && b.gx === a.gx) { a.doors.down = b.id; b.doors.up = a.id; }
    }
  return { seed, cols: w, rows: h, rooms, startId: 0, itemId: 0, bossId: 0, groups: [rooms.map((r) => r.id)] };
}
