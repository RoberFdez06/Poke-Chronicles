// Defensa de torres: cada nivel de un mapa cambia el mapa de verdad. Sobre la plantilla del mapa (maps.ts) cada nivel
// elige una variante: atajos o caminos alternativos, entradas nuevas que se abren a mitad del nivel, rutas que se
// cierran, rocas nuevas y zonas de terreno que dan bonus o penalización a las torres (o frenan y aceleran a los
// enemigos). Todo fijo por mapa y nivel (sin azar de la partida) para poder probarlo. Lógica pura, sin Phaser.
import { hashStr } from './chiefs.ts';
import { TD_COLS, TD_ROWS, buildableCells, pathCells, polyLength, pathPoints, type Cell, type TdMap } from './maps.ts';
import { wavesInLevel } from './waves.ts';
import { levelTheme } from './themes.ts';

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

/**
 * Terreno especial: para torres (colina, cristal, lodo) o en el camino (barro frena, corriente acelera), y uno propio
 * de cada tipo tema (themes.ts) con su efecto: lava y charco tóxico queman, la niebla de almas esconde, la placa de
 * acero protege del aturdimiento…
 */
export const BASE_TERRAINS = ['alto', 'cristal', 'lodo', 'barro', 'corriente'] as const;
export const THEME_TERRAINS = [
  'entreno', 'lava', 'charca', 'generador', 'hierba', 'hielo', 'dojo', 'toxico', 'arenas',
  'termica', 'runa', 'seda', 'losas', 'almas', 'escamas', 'penumbra', 'placa', 'hadas',
] as const;
export type TerrainKind = (typeof BASE_TERRAINS)[number] | (typeof THEME_TERRAINS)[number];
export interface TerrainCell extends Cell {
  kind: TerrainKind;
}

export interface TerrainInfo {
  name: string;
  desc: string;
  color: number;
  road: boolean;
  /** Bueno (verde) o malo (rojo) para ti, para el color del texto. */
  good: boolean;
}

export const TERRAIN_INFO: Readonly<Record<TerrainKind, TerrainInfo>> = {
  alto: { name: 'Colina', desc: '+20 % de alcance', color: 0x8fd06a, road: false, good: true },
  cristal: { name: 'Cristal', desc: '+20 % de daño', color: 0x8fe0ff, road: false, good: true },
  lodo: { name: 'Lodazal', desc: '−20 % de cadencia', color: 0x8a6a3a, road: false, good: false },
  barro: { name: 'Barro', desc: 'Los enemigos van un 30 % más lentos', color: 0x6a4a2a, road: true, good: true },
  corriente: { name: 'Corriente', desc: 'Los enemigos van un 30 % más rápido', color: 0xc8f0ff, road: true, good: false },
  // Terrenos de los niveles temáticos (uno por tipo)
  entreno: { name: 'Campo de entreno', desc: '+20 % de cadencia', color: 0xd8d0a8, road: false, good: true },
  lava: { name: 'Lava', desc: 'Quema a los de tierra (no Fuego)', color: 0xff6a20, road: true, good: true },
  charca: { name: 'Charca', desc: 'Frena un 35 % (no Agua)', color: 0x5aa0e0, road: true, good: true },
  generador: { name: 'Generador', desc: '+25 % de cadencia', color: 0xffe14a, road: false, good: true },
  hierba: { name: 'Hierba curativa', desc: 'Los enemigos se curan', color: 0x6ad05a, road: true, good: false },
  hielo: { name: 'Hielo', desc: 'Patinan: un 35 % más rápido (no Hielo)', color: 0xbfeaff, road: true, good: false },
  dojo: { name: 'Tatami', desc: '+25 % de daño', color: 0xe08a50, road: false, good: true },
  toxico: { name: 'Charco tóxico', desc: 'Envenena (no Veneno ni Acero)', color: 0xb060d0, road: true, good: true },
  arenas: { name: 'Arenas movedizas', desc: 'Frena un 40 %', color: 0xd8b070, road: true, good: true },
  termica: { name: 'Corriente térmica', desc: '+25 % de alcance', color: 0xc8b8ff, road: false, good: true },
  runa: { name: 'Círculo psíquico', desc: '+15 % de daño y de alcance', color: 0xff7aa8, road: false, good: true },
  seda: { name: 'Seda', desc: 'Frena un 25 % (no Bicho)', color: 0xe8e8d0, road: true, good: true },
  losas: { name: 'Losas', desc: 'Reciben un 25 % menos de daño', color: 0xa89a70, road: true, good: false },
  almas: { name: 'Niebla de almas', desc: 'No se les apunta (el área sí les da)', color: 0x9a80d0, road: true, good: false },
  escamas: { name: 'Escamas', desc: '+30 % de daño', color: 0x8a60f0, road: false, good: true },
  penumbra: { name: 'Penumbra', desc: '−25 % de alcance', color: 0x4a3a50, road: false, good: false },
  placa: { name: 'Placa de acero', desc: 'La torre no se puede aturdir', color: 0xc8c8e0, road: false, good: true },
  hadas: { name: 'Círculo de hadas', desc: '+20 % de daño y +10 % de crítico', color: 0xff9ad0, road: false, good: true },
};

/** Efecto de cada terreno: en la torre (alcance, daño, cadencia, crítico, sin aturdir) o en el enemigo de tierra. */
export interface TerrainFx {
  range?: number;
  damage?: number;
  rate?: number;
  crit?: number;
  noStun?: boolean;
  /** Velocidad del enemigo de tierra. */
  speed?: number;
  /** Daño por segundo (parte de su vida máxima) y tipos a los que no les hace nada. */
  burn?: number;
  /** Cura por segundo (parte de su vida máxima). */
  heal?: number;
  /** Daño que recibe el enemigo encima. */
  armor?: number;
  /** No se le puede apuntar. */
  hide?: boolean;
  /** Tipos a los que no les afecta (velocidad o quemadura). */
  immune?: readonly string[];
}

export const TERRAIN_RANGE = 1.2;
export const TERRAIN_DAMAGE = 1.2;
export const TERRAIN_RATE = 0.8;
export const MUD_SPEED = 0.7;
export const STREAM_SPEED = 1.3;
/** Lava y charco tóxico: parte de la vida máxima por segundo (al jefe, la cuarta parte). */
export const BURN_RATE = 0.04;
export const HEAL_RATE = 0.025;

export const TERRAIN_FX: Readonly<Record<TerrainKind, TerrainFx>> = {
  alto: { range: TERRAIN_RANGE },
  cristal: { damage: TERRAIN_DAMAGE },
  lodo: { rate: TERRAIN_RATE },
  barro: { speed: MUD_SPEED },
  corriente: { speed: STREAM_SPEED },
  entreno: { rate: 1.2 },
  lava: { burn: BURN_RATE, immune: ['fire'] },
  charca: { speed: 0.65, immune: ['water'] },
  generador: { rate: 1.25 },
  hierba: { heal: HEAL_RATE },
  hielo: { speed: 1.35, immune: ['ice'] },
  dojo: { damage: 1.25 },
  toxico: { burn: BURN_RATE, immune: ['poison', 'steel'] },
  arenas: { speed: 0.6 },
  termica: { range: 1.25 },
  runa: { damage: 1.15, range: 1.15 },
  seda: { speed: 0.75, immune: ['bug'] },
  losas: { armor: 0.75 },
  almas: { hide: true },
  escamas: { damage: 1.3 },
  penumbra: { range: 0.75 },
  placa: { noStun: true },
  hadas: { damage: 1.2, crit: 0.1 },
};

/** Terreno propio de cada tipo tema. */
export const THEME_TERRAIN: Readonly<Record<string, TerrainKind>> = {
  normal: 'entreno', fire: 'lava', water: 'charca', electric: 'generador', grass: 'hierba', ice: 'hielo', fighting: 'dojo',
  poison: 'toxico', ground: 'arenas', flying: 'termica', psychic: 'runa', bug: 'seda', rock: 'losas', ghost: 'almas',
  dragon: 'escamas', dark: 'penumbra', steel: 'placa', fairy: 'hadas',
};

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
  /** Rocas añadidas en este nivel (además de las del mapa); se dibujan como obstáculos del tipo tema. */
  rocks: Cell[];
  /** Tipo tema del nivel (themes.ts). */
  theme: string;
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
  const lm: LevelMap = { ...m, paths, routes, terrain: [], rocks: [], level: lv, variant: VARIANTS[vid], blocked: [...m.blocked], theme: levelTheme(m, lv) };
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
  addThemeTerrain(lm, free, road, nearEnd);
  return lm;
}

/**
 * Terreno del tipo tema (con su propia tirada para no cambiar el resto): si es de torre, 2 casillas junto al camino
 * (3 en niveles altos); si es de camino, un tramo de 3 casillas en una ruta (2 tramos en niveles altos), sin pisar
 * otro terreno, la base ni las entradas.
 */
function addThemeTerrain(lm: LevelMap, freeNearRoad: Cell[], road: Set<string>, nearEnd: (q: Cell) => boolean) {
  const kind = THEME_TERRAIN[lm.theme];
  if (!kind) return;
  const r = rng(hashStr(`${lm.id}|${lm.level}|tema`));
  const taken = (q: Cell) => lm.terrain.some((t) => t.x === q.x && t.y === q.y);
  const high = lm.level === 0 || lm.level > lm.levels / 2;
  if (!TERRAIN_INFO[kind].road) {
    const free = freeNearRoad.filter((q) => !taken(q));
    for (let i = 0; i < (high ? 3 : 2) && free.length; i++) {
      const q = free.splice(Math.floor(r() * free.length), 1)[0];
      lm.terrain.push({ ...q, kind });
    }
    return;
  }
  // Los de camino que te perjudican (curan, aceleran, protegen o esconden), un solo tramo
  for (let n = 0; n < (high && TERRAIN_INFO[kind].good ? 2 : 1); n++) {
    const segs: Cell[][] = [];
    for (const p of lm.paths) {
      const cells = pathCells(p).slice(2, -3).filter((q) => road.has(key(q.x, q.y)) && !nearEnd(q));
      for (let i = 0; i + 3 <= cells.length; i++) {
        const seg = cells.slice(i, i + 3);
        // Tres casillas seguidas de verdad (sin saltos al quitar las de junto a la base o las entradas)
        const joined = seg.every((q, j) => j === 0 || Math.abs(q.x - seg[j - 1].x) + Math.abs(q.y - seg[j - 1].y) === 1);
        if (joined && !seg.some(taken)) segs.push(seg);
      }
    }
    if (!segs.length) break;
    for (const q of segs[Math.floor(r() * segs.length)]) lm.terrain.push({ ...q, kind });
  }
}

export const terrainFx = (kind: TerrainKind | null): TerrainFx | null => (kind ? TERRAIN_FX[kind] : null);

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
