// Defensa de torres (modo nuevo): mapas en rejilla con caminos fijos. Unos tienen un solo camino con curvas y otros
// dos o tres entradas que confluyen hacia la base. Lógica pura, sin Phaser, para poder testearla.

export const TD_COLS = 16;
export const TD_ROWS = 11;

export interface Cell {
  x: number;
  y: number;
}

export interface TdMap {
  id: string;
  name: string;
  /** Bioma del juego normal (colores, baldosas y Pokémon salvajes). */
  biome: string;
  /** Texto corto para el menú. */
  desc: string;
  /** Esquinas de cada camino, de la entrada a la base (tramos rectos en horizontal o vertical). */
  paths: Cell[][];
  /** Casillas con roca o agua donde no se puede colocar. */
  blocked: Cell[];
  /** Dificultad del mapa: 0 el primero, sube de uno en uno. */
  tier: number;
  /** Dinero al empezar cada nivel. */
  startMoney: number;
  /** Plantilla de la que sale (para el arte: decoración distinta). */
  layout: number;
  /** Plantilla volteada en horizontal. */
  mirrored: boolean;
}

const c = (x: number, y: number): Cell => ({ x, y });

/** Plantillas de camino: unas de un solo camino con curvas y otras de 2-3 entradas que confluyen. */
interface Layout {
  paths: Cell[][];
  blocked: Cell[];
  shape: string;
}

export const LAYOUTS: readonly Layout[] = [
  { shape: 'Un camino con curvas', paths: [[c(0, 2), c(5, 2), c(5, 7), c(10, 7), c(10, 3), c(15, 3)]], blocked: [c(2, 8), c(13, 8), c(8, 1), c(14, 10)] },
  { shape: 'Un túnel en zigzag', paths: [[c(0, 1), c(13, 1), c(13, 4), c(2, 4), c(2, 8), c(15, 8)]], blocked: [c(7, 6), c(8, 6), c(15, 4), c(0, 10)] },
  {
    shape: 'Dos entradas que se juntan',
    paths: [[c(0, 2), c(7, 2), c(7, 5), c(15, 5)], [c(0, 9), c(7, 9), c(7, 5), c(15, 5)]],
    blocked: [c(12, 1), c(13, 1), c(12, 9), c(13, 9), c(3, 5)],
  },
  { shape: 'Un sendero largo que sube y baja', paths: [[c(3, 0), c(3, 8), c(8, 8), c(8, 2), c(12, 2), c(12, 10)]], blocked: [c(0, 5), c(15, 1), c(15, 6), c(6, 10)] },
  {
    shape: 'Dos entradas que se cruzan',
    paths: [
      [c(6, 0), c(6, 4), c(11, 4), c(11, 8), c(15, 8)],
      [c(0, 9), c(4, 9), c(4, 4), c(11, 4), c(11, 8), c(15, 8)],
    ],
    blocked: [c(1, 2), c(9, 1), c(14, 3), c(8, 9), c(13, 10)],
  },
  {
    shape: 'Tres entradas en paralelo',
    paths: [
      [c(0, 1), c(8, 1), c(8, 5), c(15, 5)],
      [c(0, 5), c(8, 5), c(15, 5)],
      [c(0, 9), c(8, 9), c(8, 5), c(15, 5)],
    ],
    blocked: [c(4, 3), c(4, 7), c(12, 2), c(12, 8)],
  },
  { shape: 'Una espiral hacia el centro', paths: [[c(0, 1), c(14, 1), c(14, 9), c(1, 9), c(1, 3), c(12, 3), c(12, 7), c(4, 7), c(4, 5), c(9, 5)]], blocked: [c(15, 5), c(0, 6)] },
  {
    shape: 'Tres entradas que confluyen',
    paths: [
      [c(0, 2), c(6, 2), c(6, 5), c(15, 5)],
      [c(6, 10), c(6, 7), c(10, 7), c(10, 5), c(15, 5)],
      [c(12, 0), c(12, 3), c(10, 3), c(10, 5), c(15, 5)],
    ],
    blocked: [c(2, 7), c(14, 9), c(3, 0), c(14, 1)],
  },
];

/** Los 16 mapas, de principiante a experto: nombre, bioma, plantilla y si va volteada. */
const MAP_LIST: readonly [string, string, string, number, boolean][] = [
  ['pradera', 'Pradera Verde', 'bosque', 0, false],
  ['gruta', 'Gruta Honda', 'cueva', 1, false],
  ['arboleda', 'Arboleda Brisa', 'bosque', 0, true],
  ['costa', 'Costa Coral', 'mar', 2, false],
  ['cantera', 'Cantera Roja', 'cueva', 1, true],
  ['nevada', 'Ladera Nevada', 'nieve', 3, false],
  ['ciudad', 'Ciudad Voltio', 'ciudad', 2, true],
  ['cienaga', 'Ciénaga Turbia', 'pantano', 4, false],
  ['glaciar', 'Glaciar Eterno', 'nieve', 3, true],
  ['volcan', 'Cráter Ígneo', 'volcan', 5, false],
  ['arrecife', 'Arrecife Hondo', 'mar', 4, true],
  ['torre', 'Torre Espectral', 'torre', 6, false],
  ['fundicion', 'Fundición', 'ciudad', 5, true],
  ['lodazal', 'Lodazal Negro', 'pantano', 7, false],
  ['caldera', 'Caldera Final', 'volcan', 6, true],
  ['cumbre', 'Cumbre Celeste', 'cumbre', 7, true],
];

const flip = (q: Cell, m: boolean): Cell => (m ? c(TD_COLS - 1 - q.x, q.y) : q);

export const TD_MAPS: readonly TdMap[] = MAP_LIST.map(([id, name, biome, layout, mirrored], tier) => {
  const L = LAYOUTS[layout];
  const n = L.paths.length;
  return {
    id, name, biome, tier, layout, mirrored,
    startMoney: 240 + tier * 10,
    desc: `${L.shape}${n > 1 ? ` (${n} entradas)` : ''}. ${tier < 4 ? 'Para empezar.' : tier < 9 ? 'Dificultad media.' : tier < 13 ? 'Difícil.' : 'Solo para expertos.'}`,
    paths: L.paths.map((p) => p.map((q) => flip(q, mirrored))),
    blocked: L.blocked.map((q) => flip(q, mirrored)),
  };
});

export const mapById = (id: string): TdMap | undefined => TD_MAPS.find((m) => m.id === id);
export const mapIndex = (id: string): number => TD_MAPS.findIndex((m) => m.id === id);

const key = (x: number, y: number) => `${x},${y}`;

/** Casillas por las que pasa un camino, en orden (sin repetir la esquina al girar). */
export function pathCells(path: readonly Cell[]): Cell[] {
  const out: Cell[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let x = a.x;
    let y = a.y;
    if (i === 0) out.push(c(x, y));
    while (x !== b.x || y !== b.y) {
      x += dx;
      y += dy;
      out.push(c(x, y));
    }
  }
  return out;
}

/** La base: el final común de todos los caminos. */
export const baseCell = (m: TdMap): Cell => m.paths[0][m.paths[0].length - 1];
export const entryCells = (m: TdMap): Cell[] => m.paths.map((p) => p[0]);

/** Todas las casillas de camino (de cualquier entrada). */
export function roadSet(m: TdMap): Set<string> {
  const s = new Set<string>();
  for (const p of m.paths) for (const q of pathCells(p)) s.add(key(q.x, q.y));
  return s;
}

/** ¿Se puede colocar una torre en esta casilla? (dentro, sin camino, roca ni base). */
export function isBuildable(m: TdMap, x: number, y: number, road = roadSet(m)): boolean {
  if (x < 0 || y < 0 || x >= TD_COLS || y >= TD_ROWS) return false;
  if (road.has(key(x, y))) return false;
  return !m.blocked.some((b) => b.x === x && b.y === y);
}

export function buildableCells(m: TdMap): Cell[] {
  const road = roadSet(m);
  const out: Cell[] = [];
  for (let y = 0; y < TD_ROWS; y++) for (let x = 0; x < TD_COLS; x++) if (isBuildable(m, x, y, road)) out.push(c(x, y));
  return out;
}

/** Puntos (centros de casilla) que siguen los enemigos de tierra: las esquinas del camino. */
export const pathPoints = (path: readonly Cell[]): { x: number; y: number }[] => path.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));

/** Largo del recorrido en casillas. */
export function polyLength(pts: readonly { x: number; y: number }[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return n;
}

/** Posición y dirección a `d` casillas del comienzo del recorrido. */
export function pointAt(pts: readonly { x: number; y: number }[], d: number): { x: number; y: number; dx: number; dy: number } {
  let left = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len || i === pts.length - 1) {
      const k = len > 0 ? Math.min(1, left / len) : 1;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: len > 0 ? (b.x - a.x) / len : 0, dy: len > 0 ? (b.y - a.y) / len : 0 };
    }
    left -= len;
  }
  const p = pts[pts.length - 1];
  return { x: p.x, y: p.y, dx: 0, dy: 0 };
}

/** Recorrido de los voladores: en línea recta de la entrada a la base. */
export const flightPoints = (m: TdMap, pathIdx: number) => {
  const p = m.paths[pathIdx];
  return pathPoints([p[0], p[p.length - 1]]);
};
