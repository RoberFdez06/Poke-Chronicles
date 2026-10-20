// Diseños de sala con obstáculos (como en Isaac): rocas, columnas, hierba alta, agujeros y charcos.
// La sala se divide en casillas de 40 px (20 × 12). Lógica pura, sin Phaser, para poder testearla.
// Con extensión .ts para que los tests (node --test) puedan importarlo sin bundler
import { mulberry32, type Dir, type RoomKind } from './floorGen.ts';

export const TILE = 40;
export const COLS = 20;
export const ROWS = 12;

/**
 * 'X' muro (da forma a la sala: en L, en cruz, en T…; bloquea paso y disparos y no se rompe).
 * '.' suelo · 'R' roca (bloquea paso y disparos) · 'P' columna (igual) · 'B' hierba alta (bloquea el paso y se
 * rompe a disparos) · 'H' agujero (no se cruza a pie, los disparos pasan) · 'W' charco (se cruza, más despacio).
 */
export type Cell = '.' | 'R' | 'P' | 'B' | 'H' | 'W' | 'X';
export type Grid = Cell[][];

export const isWalkable = (c: Cell): boolean => c === '.' || c === 'W';
export const blocksShots = (c: Cell): boolean => c === 'R' || c === 'P' || c === 'X';

/** Casillas por las que se entra desde cada puerta (las puertas van centradas en cada pared). */
export const DOOR_TILES: Record<Dir, [number, number][]> = {
  up: [[9, 0], [10, 0]],
  down: [[9, ROWS - 1], [10, ROWS - 1]],
  left: [[0, 5], [0, 6]],
  right: [[COLS - 1, 5], [COLS - 1, 6]],
};

/** Centro de la sala: ahí caen objetos, monedas y la trampilla, así que siempre está libre. */
export const CENTER_TILES: [number, number][] = [
  [8, 4], [9, 4], [10, 4], [11, 4],
  [8, 5], [9, 5], [10, 5], [11, 5],
  [8, 6], [9, 6], [10, 6], [11, 6],
  [8, 7], [9, 7], [10, 7], [11, 7],
];

/** Plantillas de 20 × 12. Todas dejan libres las entradas de las puertas y el centro (lo comprueban los tests). */
export const TEMPLATES: Readonly<Record<string, readonly string[]>> = {
  rocasEsquinas: [
    '....................',
    '.RB..............RB.',
    '.RR...R.....R....RR.',
    '.......R...R........',
    '....................',
    '..R..............R..',
    '..RR............RR..',
    '....................',
    '.......R...R........',
    '.BR...R.....R....BR.',
    '.RR..............RR.',
    '....................',
  ],
  columnas: [
    '....................',
    '....................',
    '..P...P......P...P..',
    '....................',
    '..B..............B..',
    '....................',
    '....................',
    '..B..............B..',
    '....................',
    '..P...P......P...P..',
    '....................',
    '....................',
  ],
  hierbaAlta: [
    '....................',
    '..BBB........BB.....',
    '.BBBB.......BBBB....',
    '..BB.........BB.....',
    '................BB..',
    '...............BB...',
    '..BB................',
    '..BBB...............',
    '...B................',
    '....BB........BB....',
    '...BBBB......BBBB...',
    '....................',
  ],
  agujeros: [
    '....................',
    '.HHH............HH..',
    '.HHHH..........HHHH.',
    '..HH............HH..',
    '....................',
    '.....W..........W...',
    '....WW..........WW..',
    '....................',
    '..HH............HH..',
    '.HHHH..........HHHH.',
    '..HHH...........HHH.',
    '....................',
  ],
  charcos: [
    '....................',
    '.WWW.......R.....WW.',
    'WWWWW..R........WWWW',
    '.WWW.............WW.',
    '.....R..........R...',
    '....RR..........RR..',
    '....................',
    '..WW...........R....',
    '.WWWW......R........',
    '..WWW.............WW',
    '...R...R........WWW.',
    '....................',
  ],
  muros: [
    '....................',
    '....................',
    '..RRRR.BB..BB.RRRR..',
    '..R..............R..',
    '....................',
    '.....B........B.....',
    '.....B........B.....',
    '....................',
    '..R..............R..',
    '..RRRR.BB..BB.RRRR..',
    '....................',
    '....................',
  ],
  matorrales: [
    '....................',
    '.BB..BBB....BBB..BB.',
    '.B.....B....B.....B.',
    '.B..................',
    '....BB........BB....',
    '....B..........B....',
    '....B..........B....',
    '....BB........BB....',
    '..................B.',
    '.B.....B....B.....B.',
    '.BB..BBB....BBB..BB.',
    '....................',
  ],
  foso: [
    '....................',
    '....................',
    '..HHHHH......HHHHH..',
    '..H..............H..',
    '..H...W......W...H..',
    '....................',
    '....................',
    '..H...W......W...H..',
    '..H..............H..',
    '..HHHHH......HHHHH..',
    '....................',
    '....................',
  ],
  anillo: [
    '....................',
    '...RRRRRR....RRRRRR.',
    '...R..............R.',
    '...R..............R.',
    '...R..............R.',
    '....................',
    '....................',
    '...R..............R.',
    '...R..............R.',
    '...R..............R.',
    '...RRRRRR....RRRRRR.',
    '....................',
  ],
  islas: [
    '....................',
    '.HH....WW....WW..HH.',
    '.HH....WW....WW..HH.',
    '....................',
    '..BB..............BB',
    '....................',
    '....................',
    '..BB..............BB',
    '....................',
    '.HH....WW....WW..HH.',
    '.HH....WW....WW..HH.',
    '....................',
  ],
  cruz: [
    '....................',
    '...RR..........RR...',
    '...RR....BB....RR...',
    '.........BB.........',
    '....................',
    '..WWW..........WWW..',
    '..WWW..........WWW..',
    '....................',
    '.........BB.........',
    '...RR....BB....RR...',
    '...RR..........RR...',
    '....................',
  ],
  pasillos: [
    '....................',
    '..RRR.RRR..RRR.RRR..',
    '....................',
    '....................',
    '..BBBB........BBBB..',
    '....................',
    '....................',
    '..BBBB........BBBB..',
    '....................',
    '....................',
    '..RRR.RRR..RRR.RRR..',
    '....................',
  ],
  diagonal: [
    '....................',
    '.R..................',
    '.RR..R..........B...',
    '..RR.RR........BB...',
    '......RR......BB....',
    '....................',
    '....................',
    '....BB......RR......',
    '...BB........RR.RR..',
    '...B..........R..RR.',
    '..................R.',
    '....................',
  ],
  estanque: [
    '....................',
    '....................',
    '...BB..........BB...',
    '....HHH......HHH....',
    '....HWW......WWH....',
    '....................',
    '....................',
    '....HWW......WWH....',
    '....HHH......HHH....',
    '...BB..........BB...',
    '....................',
    '....................',
  ],
  salaEle: [
    '............XXXXXXXX',
    '............XXXXXXXX',
    '............XXXXXXXX',
    '............XXXXXXXX',
    '............XXXXXXXX',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
  ],
  salaCruz: [
    'XXXXXX........XXXXXX',
    'XXXXXX........XXXXXX',
    'XXXXXX........XXXXXX',
    'XXXXXX........XXXXXX',
    '....................',
    '....................',
    '....................',
    '....................',
    'XXXXXX........XXXXXX',
    'XXXXXX........XXXXXX',
    'XXXXXX........XXXXXX',
    'XXXXXX........XXXXXX',
  ],
  salaT: [
    'XXXXXXX......XXXXXXX',
    'XXXXXXX......XXXXXXX',
    'XXXXXXX......XXXXXXX',
    'XXXXXXX......XXXXXXX',
    'XXXXXXX......XXXXXXX',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
  ],
  salaZ: [
    '............XXXXXXXX',
    '............XXXXXXXX',
    '............XXXXXXXX',
    '............XXXXXXXX',
    '....................',
    '....................',
    '....................',
    '....................',
    'XXXXXXXX............',
    'XXXXXXXX............',
    'XXXXXXXX............',
    'XXXXXXXX............',
  ],
  salaOctogono: [
    'XXXXXX........XXXXXX',
    'XXXX............XXXX',
    'XX................XX',
    'X..................X',
    '....................',
    '....................',
    '....................',
    '....................',
    'X..................X',
    'XX................XX',
    'XXXX............XXXX',
    'XXXXXX........XXXXXX',
  ],
  salaEleRocas: [
    '............XXXXXXXX',
    '............XXXXXXXX',
    '..BB........XXXXXXXX',
    '..BB........XXXXXXXX',
    '............XXXXXXXX',
    '....................',
    '....................',
    '....RR......RR......',
    '....RR......RR......',
    '..HH................',
    '..HH................',
    '....................',
  ],
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES);

export const parseTemplate = (rows: readonly string[]): Grid => rows.map((r) => r.split('') as Cell[]);

export const emptyGrid = (): Grid => Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill('.'));

/** Probabilidad de que una sala de combate no tenga obstáculos. */
export const EMPTY_CHANCE = 0.2;

/**
 * Diseño de una sala (`big`: casilla de una sala grande, sin recortes): solo las de combate llevan obstáculos (inicio, objeto, jefe, Centro y tienda van
 * vacías). Sale siempre igual con la misma semilla de piso y sala, y a veces en espejo.
 */
/** Plantillas sin muros 'X' (las casillas de una sala grande no se recortan: se unen con la de al lado). */
export const OPEN_TEMPLATE_NAMES = TEMPLATE_NAMES.filter((n) => !TEMPLATES[n].some((r) => r.includes('X')));

export function layoutFor(floorSeed: number, roomId: number, kind: RoomKind, big = false): Grid {
  if (kind !== 'combat') return emptyGrid();
  const rng = mulberry32((floorSeed ^ Math.imul(roomId + 1, 0x9e3779b1)) >>> 0);
  if (rng() < EMPTY_CHANCE) return emptyGrid();
  const names = big ? OPEN_TEMPLATE_NAMES : TEMPLATE_NAMES;
  let g = parseTemplate(TEMPLATES[names[Math.floor(rng() * names.length)]]);
  if (rng() < 0.5) g = g.map((row) => [...row].reverse());
  if (rng() < 0.5) g = [...g].reverse();
  return g;
}

const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const NEIGHBOURS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Distancia a pie (en casillas) desde (tx, ty) a cada casilla; Infinity si no se llega. BFS sobre la cuadrícula. */
export function flowField(grid: Grid, tx: number, ty: number): number[][] {
  const dist = Array.from({ length: ROWS }, () => Array<number>(COLS).fill(Infinity));
  if (!inside(tx, ty)) return dist;
  const queue: [number, number][] = [[tx, ty]];
  dist[ty][tx] = 0;
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(nx, ny) || dist[ny][nx] !== Infinity || !isWalkable(grid[ny][nx])) continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

/** ¿Se puede ir a pie entre todas estas casillas? */
export function allConnected(grid: Grid, tiles: readonly [number, number][]): boolean {
  if (tiles.length === 0) return true;
  if (tiles.some(([x, y]) => !isWalkable(grid[y][x]))) return false;
  const [sx, sy] = tiles[0];
  const dist = flowField(grid, sx, sy);
  return tiles.every(([x, y]) => dist[y][x] < Infinity);
}

/**
 * Hacia qué casilla vecina ir para acercarse a la meta del campo de flujo. Devuelve el desplazamiento
 * (dx, dy) en casillas, o null si ya estás en la meta o no hay camino.
 */
export function stepToward(dist: number[][], x: number, y: number): [number, number] | null {
  if (!inside(x, y)) return null;
  const here = dist[y][x];
  let best: [number, number] | null = null;
  let bestD = here;
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = x + dx;
    const ny = y + dy;
    if (inside(nx, ny) && dist[ny][nx] < bestD) {
      bestD = dist[ny][nx];
      best = [dx, dy];
    }
  }
  return best;
}

/** Casilla libre más cercana (para dejar botín o colocar enemigos sin que caigan encima de una roca). */
export function nearestWalkable(grid: Grid, x: number, y: number): [number, number] {
  const cx = Math.min(COLS - 1, Math.max(0, x));
  const cy = Math.min(ROWS - 1, Math.max(0, y));
  if (isWalkable(grid[cy][cx])) return [cx, cy];
  for (let r = 1; r < COLS; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (inside(nx, ny) && isWalkable(grid[ny][nx])) return [nx, ny];
      }
    }
  }
  return [9, 5];
}
