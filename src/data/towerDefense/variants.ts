// Defensa de torres: cada nivel de un mapa cambia el mapa de verdad. Sobre la plantilla del mapa (maps.ts) cada nivel
// elige una variante: atajos o caminos alternativos, entradas nuevas que se abren a mitad del nivel, rutas que se
// cierran, rocas nuevas y zonas de terreno que dan bonus o penalización a las torres (o frenan y aceleran a los
// enemigos). Todo fijo por mapa y nivel (sin azar de la partida) para poder probarlo. Lógica pura, sin Phaser.
import { hashStr } from './chiefs.ts';
import { TD_COLS, TD_ROWS, buildableCells, pathCells, polyLength, pathPoints, type Cell, type TdMap } from './maps.ts';
import { wavesInLevel } from './waves.ts';

const c = (x: number, y: number): Cell => ({ x, y });
const key = (x: number, y: number) => `${x},${y}`;

/** Caminos extra de cada plantilla (sin voltear): un atajo (o camino alternativo) y una entrada nueva («rama»). */
interface Extra {
  kind: 'atajo' | 'rama';
  path: Cell[];
}

export const LAYOUT_EXTRAS: readonly (readonly Extra[])[] = [
  [
    { kind: 'atajo', path: [c(0, 2), c(10, 2), c(10, 3), c(15, 3)] },
    { kind: 'rama', path: [c(7, 10), c(7, 7), c(10, 7), c(10, 3), c(15, 3)] },
  ],
  [
    { kind: 'atajo', path: [c(0, 1), c(5, 1), c(5, 4), c(2, 4), c(2, 8), c(15, 8)] },
    { kind: 'rama', path: [c(4, 10), c(4, 8), c(15, 8)] },
  ],
  [
    { kind: 'atajo', path: [c(0, 9), c(4, 9), c(4, 5), c(15, 5)] },
    { kind: 'rama', path: [c(11, 0), c(11, 5), c(15, 5)] },
  ],
  [
    { kind: 'atajo', path: [c(3, 0), c(3, 4), c(8, 4), c(8, 2), c(12, 2), c(12, 10)] },
    { kind: 'rama', path: [c(0, 9), c(10, 9), c(10, 10), c(12, 10)] },
  ],
  [
    { kind: 'atajo', path: [c(6, 0), c(6, 4), c(8, 4), c(8, 8), c(15, 8)] },
    { kind: 'rama', path: [c(15, 2), c(13, 2), c(13, 8), c(15, 8)] },
  ],
  [
    { kind: 'atajo', path: [c(0, 9), c(3, 9), c(3, 5), c(15, 5)] },
    { kind: 'rama', path: [c(11, 0), c(11, 5), c(15, 5)] },
  ],
  [
    { kind: 'atajo', path: [c(0, 1), c(14, 1), c(14, 5), c(12, 5), c(12, 7), c(4, 7), c(4, 5), c(9, 5)] },
    { kind: 'rama', path: [c(7, 10), c(7, 9), c(1, 9), c(1, 3), c(12, 3), c(12, 7), c(4, 7), c(4, 5), c(9, 5)] },
  ],
  [
    { kind: 'atajo', path: [c(12, 0), c(12, 5), c(15, 5)] },
    { kind: 'rama', path: [c(0, 8), c(6, 8), c(6, 7), c(10, 7), c(10, 5), c(15, 5)] },
  ],
  [
    { kind: 'atajo', path: [c(0, 3), c(10, 3), c(10, 1), c(14, 1), c(14, 9)] },
    { kind: 'rama', path: [c(4, 10), c(4, 8), c(6, 8), c(6, 1), c(14, 1), c(14, 9)] },
  ],
  [
    { kind: 'atajo', path: [c(0, 5), c(15, 5)] },
    { kind: 'rama', path: [c(9, 10), c(9, 9), c(11, 9), c(11, 5), c(15, 5)] },
  ],
  [
    { kind: 'atajo', path: [c(0, 1), c(3, 1), c(3, 5), c(15, 5)] },
    { kind: 'rama', path: [c(15, 0), c(13, 0), c(13, 5), c(15, 5)] },
  ],
  [
    { kind: 'atajo', path: [c(10, 0), c(10, 3), c(14, 3), c(14, 9), c(15, 9)] },
    { kind: 'rama', path: [c(0, 7), c(3, 7), c(3, 5), c(12, 5), c(12, 9), c(15, 9)] },
  ],
];

/** Ruta de un mapa de nivel: de dónde sale y desde qué oleada está abierta. */
export interface RouteInfo {
  kind: 'base' | 'atajo' | 'rama';
  /** Oleada desde la que se usa (1 = desde el principio). */
  opensAt: number;
  /** Primera casilla solo de esta ruta (donde se pone la barricada o se ve que está cerrada), o null si no tiene. */
  gate: Cell | null;
  /** Casillas que solo son de esta ruta (para elegirla con el cursor). */
  own: Cell[];
}

/** Terreno especial: para torres (colina, cristal, lodo) o en el camino (barro frena, corriente acelera). */
export type TerrainKind = 'alto' | 'cristal' | 'lodo' | 'barro' | 'corriente';
export interface TerrainCell extends Cell {
  kind: TerrainKind;
}

export const TERRAIN_INFO: Readonly<Record<TerrainKind, { name: string; desc: string; color: number; road: boolean }>> = {
  alto: { name: 'Colina', desc: '+20 % de alcance', color: 0x8fd06a, road: false },
  cristal: { name: 'Cristal', desc: '+20 % de daño', color: 0x8fe0ff, road: false },
  lodo: { name: 'Lodazal', desc: '−20 % de cadencia', color: 0x8a6a3a, road: false },
  barro: { name: 'Barro', desc: 'Los enemigos van un 30 % más lentos', color: 0x6a4a2a, road: true },
  corriente: { name: 'Corriente', desc: 'Los enemigos van un 30 % más rápido', color: 0xc8f0ff, road: true },
};
export const TERRAIN_RANGE = 1.2;
export const TERRAIN_DAMAGE = 1.2;
export const TERRAIN_RATE = 0.8;
export const MUD_SPEED = 0.7;
export const STREAM_SPEED = 1.3;

export interface VariantInfo {
  id: number;
  name: string;
  desc: string;
}

/** Variantes de la más sencilla a la más enrevesada. */
export const VARIANTS: readonly VariantInfo[] = [
  { id: 0, name: 'Camino de siempre', desc: 'El trazado del mapa, con sus rocas y su terreno' },
  { id: 1, name: 'Atajo abierto', desc: 'Hay un atajo desde el principio' },
  { id: 2, name: 'Camino que se abre', desc: 'A mitad del nivel se abre una entrada nueva' },
  { id: 3, name: 'Ruta cortada', desc: 'Una ruta está cerrada y otra se abre a mitad del nivel' },
  { id: 4, name: 'Cruce de rutas', desc: 'Atajo desde el principio y entrada nueva a mitad del nivel' },
  { id: 5, name: 'Asalto total', desc: 'Todas las rutas abiertas desde el principio' },
];

/** Mapa de un nivel concreto: caminos con su ruta, rocas y terreno de este nivel. */
export interface LevelMap extends TdMap {
  /** Nivel (0 = infinito). */
  level: number;
  routes: RouteInfo[];
  terrain: TerrainCell[];
  variant: VariantInfo;
  /** Rocas añadidas en este nivel (además de las del mapa). */
  rocks: Cell[];
}

export const isLevelMap = (m: TdMap): m is LevelMap => Array.isArray((m as LevelMap).routes);

const flip = (q: Cell, m: boolean): Cell => (m ? c(TD_COLS - 1 - q.x, q.y) : q);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Variante de cada nivel: el 1 siempre el de siempre; luego más enrevesadas con el mapa y el nivel y nunca la misma dos niveles seguidos. */
export function variantFor(m: TdMap, level: number): number {
  if (level <= 0) return 4;
  let prev = 0;
  for (let l = 2; l <= level; l++) {
    const cap = Math.min(VARIANTS.length - 1, 1 + Math.floor(m.tier / 3) + Math.floor(((l - 1) * 3) / Math.max(1, m.levels - 1)));
    let v = hashStr(`${m.id}|${l}|variante`) % (cap + 1);
    if (v === prev) v = (v + 1) % (cap + 1);
    prev = v;
  }
  return prev;
}

/** El mapa de un nivel: rutas, rocas y terreno. Siempre el mismo para un mapa y nivel. */
export function mapForLevel(m: TdMap, level: number): LevelMap {
  if (isLevelMap(m)) return m;
  const lv = Math.max(0, Math.floor(level));
  const vid = variantFor(m, lv);
  const extras = (LAYOUT_EXTRAS[m.layout] ?? []).map((e) => ({ kind: e.kind, path: e.path.map((q) => flip(q, m.mirrored)) }));
  const atajo = extras.find((e) => e.kind === 'atajo');
  const rama = extras.find((e) => e.kind === 'rama');
  const waves = lv > 0 ? wavesInLevel(lv, m.levels) : 12;
  const mid = lv > 0 ? Math.max(2, Math.ceil(waves / 2)) : 6;
  let base = m.paths.map((p) => ({ kind: 'base' as const, path: p, opensAt: 1 }));
  const add: { kind: 'atajo' | 'rama'; path: Cell[]; opensAt: number }[] = [];
  if (vid === 1 && atajo) add.push({ ...atajo, opensAt: 1 });
  if (vid === 2 && rama) add.push({ ...rama, opensAt: mid });
  if (vid === 3) {
    if (base.length > 1) base = base.slice(0, -1);
    if (rama) add.push({ ...rama, opensAt: mid });
    else if (atajo) add.push({ ...atajo, opensAt: mid });
  }
  if (vid === 4) {
    if (atajo) add.push({ ...atajo, opensAt: 1 });
    if (rama) add.push({ ...rama, opensAt: mid });
  }
  if (vid === 5) for (const e of extras) add.push({ ...e, opensAt: 1 });
  const all = [...base, ...add];
  const paths = all.map((r) => r.path);
  const cellSets = paths.map((p) => new Set(pathCells(p).map((q) => key(q.x, q.y))));
  const routes: RouteInfo[] = all.map((r, i) => {
    const own = pathCells(r.path).filter((q) => !cellSets.some((s, j) => j !== i && s.has(key(q.x, q.y))));
    return { kind: r.kind, opensAt: r.opensAt, gate: own[0] ?? null, own };
  });
  const lm: LevelMap = { ...m, paths, routes, terrain: [], rocks: [], level: lv, variant: VARIANTS[vid], blocked: [...m.blocked] };
  // Rocas nuevas (ninguna en el nivel 1) y terreno; nunca junto a la base ni a las entradas
  const r = rng(hashStr(`${m.id}|${lv}|terreno`));
  const road = new Set(cellSets.flatMap((s) => [...s]));
  const ends = [paths[0][paths[0].length - 1], ...paths.map((p) => p[0])];
  const nearEnd = (q: Cell) => ends.some((e) => Math.abs(e.x - q.x) <= 1 && Math.abs(e.y - q.y) <= 1);
  const nearRoad = (q: Cell) => [...road].some((k) => {
    const [x, y] = k.split(',').map(Number);
    return Math.abs(x - q.x) <= 1 && Math.abs(y - q.y) <= 1;
  });
  const pick = <T>(list: T[]): T | undefined => (list.length ? list.splice(Math.floor(r() * list.length), 1)[0] : undefined);
  const nRocks = lv === 1 ? 0 : Math.min(6, 1 + Math.floor((lv || m.levels) / 3) + Math.floor(m.tier / 4));
  let free = buildableCells(lm).filter((q) => !nearEnd(q));
  for (let i = 0; i < nRocks && free.length > 60; i++) {
    const q = pick(free);
    if (!q) break;
    lm.rocks.push(q);
    lm.blocked.push(q);
  }
  free = buildableCells(lm).filter((q) => nearRoad(q) && !nearEnd(q));
  const goods: TerrainKind[] = ['alto', 'cristal'];
  const nGood = 2 + (lv % 2);
  for (let i = 0; i < nGood; i++) {
    const q = pick(free);
    if (q) lm.terrain.push({ ...q, kind: goods[(i + lv) % 2] });
  }
  const nBad = lv >= 3 || lv === 0 ? 1 + Math.floor(m.tier / 6) : 0;
  for (let i = 0; i < nBad; i++) {
    const q = pick(free);
    if (q) lm.terrain.push({ ...q, kind: 'lodo' });
  }
  // Tramos de barro (frena) o de corriente (acelera) en el camino principal, de 3 casillas
  const main = pathCells(paths[0]).slice(2, -3);
  const patch = (kind: TerrainKind) => {
    if (main.length < 6) return;
    const at = Math.floor(r() * (main.length - 3));
    for (const q of main.slice(at, at + 3)) if (!lm.terrain.some((t) => t.x === q.x && t.y === q.y)) lm.terrain.push({ ...q, kind });
  };
  if (lv >= 2 || lv === 0) patch(hashStr(`${m.id}|${lv}|tramo`) % 2 === 0 || m.tier < 3 ? 'barro' : 'corriente');
  if ((lv >= 4 || lv === 0) && m.tier >= 4) patch('corriente');
  return lm;
}

export const terrainAt = (m: TdMap, x: number, y: number): TerrainKind | null =>
  isLevelMap(m) ? m.terrain.find((t) => t.x === x && t.y === y)?.kind ?? null : null;

/** Largo de cada ruta (para decir si un atajo es más corto). */
export const routeLength = (m: TdMap, i: number): number => polyLength(pathPoints(m.paths[i]));

/** Nombre que se enseña de una ruta extra. */
export function routeLabel(m: LevelMap, i: number): string {
  const r = m.routes[i];
  if (!r) return 'Ruta';
  if (r.kind === 'rama') return 'Entrada nueva';
  if (r.kind === 'atajo') return routeLength(m, i) < Math.min(...m.routes.map((q, j) => (q.kind === 'base' ? routeLength(m, j) : Infinity))) ? 'Atajo' : 'Camino alternativo';
  return `Ruta ${i + 1}`;
}

/** Ruta que se elige al pulsar en una casilla del camino (solo si la casilla es de una ruta y no compartida). */
export function routeAtCell(m: TdMap, x: number, y: number): number {
  if (!isLevelMap(m)) return -1;
  return m.routes.findIndex((r) => r.own.some((q) => q.x === x && q.y === y));
}

/** Resumen de una variante para el menú de niveles. */
export function variantSummary(m: TdMap, level: number): string {
  const lm = mapForLevel(m, level);
  const kinds = [...new Set(lm.terrain.map((t) => TERRAIN_INFO[t.kind].name))];
  const extra = lm.routes.filter((r) => r.kind !== 'base').length;
  return `${lm.variant.name}${extra ? ` (${extra} ruta${extra > 1 ? 's' : ''} extra)` : ''}${lm.rocks.length ? ` · ${lm.rocks.length} roca${lm.rocks.length > 1 ? 's' : ''} nueva${lm.rocks.length > 1 ? 's' : ''}` : ''}${kinds.length ? ` · ${kinds.join(', ')}` : ''}`;
}
