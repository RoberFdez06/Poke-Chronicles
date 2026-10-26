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
export const FALL_SHAKE_MS = 1500;
export const FALL_FADE_MS = 400;
export const FALL_HOLD_MS = 300;
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
 * Temas por tipo (los de siempre):
 * - lava (fuego): charcas de lava que queman al pisarlas y rocas.
 * - inundada (agua): casi toda el agua cubre el suelo (más lento) y alguna roca.
 * - hielo: placas de hielo resbaladizas y columnas de hielo.
 * - raices (planta y bicho): raíces que cortan el paso (se rompen a disparos, como la hierba alta) y rocas.
 * - ruinas (el resto, y los Regis): rocas, columnas y algún foso.
 * Temas por concepto (legendarios y, como respaldo, algunos tipos):
 * - tiempo (Dialga, Celebi, Koraidon, Miraidon; acero): cámara del tiempo con columnas-reloj.
 * - espacio (Palkia, Solgaleo, Lunala, Necrozma, Eternatus, Jirachi): vacío estelar con fosos al vacío.
 * - distorsion (Giratina, Yveltal, Darkrai, Hoopa; fantasma y siniestro): mundo distorsión con islas y fosos.
 * - cielo (Rayquaza, Tornado, Latios, Latias; dragón y volador): sobre las nubes, huecos entre ellas y la columna celeste.
 * - mar (Kyogre, Lugia, Manaphy, Suicune): el océano con un torbellino; casi todo agua.
 * - magma (Groudon, Heatran, Entei, Volcanion, Landorus; tierra): tierra partida con ríos de magma.
 * - creacion (Arceus, Mew, Xerneas, Calyrex, Zacian, Zamazenta, Terapagos; hada): salón del origen con columnas y flores.
 * - arcoiris (Ho-Oh, Reshiram): torre del fuego sagrado bajo el arcoíris, con llamas sagradas.
 * - tormenta (Zekrom, Zapdos, Raikou, Thundurus, Tapu Koko; eléctrico): meseta bajo la tormenta con rocas.
 * - psique (Mewtwo, Deoxys, trío del lago; psíquico): laboratorio psíquico con columnas flotantes.
 */
export type FallTheme =
  | 'lava' | 'inundada' | 'hielo' | 'raices' | 'ruinas'
  | 'tiempo' | 'espacio' | 'distorsion' | 'cielo' | 'mar' | 'magma' | 'creacion' | 'arcoiris' | 'tormenta' | 'psique';

export const FALL_THEMES: readonly FallTheme[] = ['lava', 'inundada', 'hielo', 'raices', 'ruinas', 'tiempo', 'espacio', 'distorsion', 'cielo', 'mar', 'magma', 'creacion', 'arcoiris', 'tormenta', 'psique'];

const TYPE_THEME: Readonly<Record<string, FallTheme>> = { fire: 'lava', water: 'inundada', ice: 'hielo', grass: 'raices', bug: 'raices' };
/** Respaldo por tipo para los que no tienen tema de los de siempre (va después de TYPE_THEME). */
const TYPE_CONCEPT: Readonly<Record<string, FallTheme>> = {
  electric: 'tormenta', psychic: 'psique', ghost: 'distorsion', dark: 'distorsion', dragon: 'cielo', flying: 'cielo', steel: 'tiempo', fairy: 'creacion', ground: 'magma',
};
/** Tema por especie (número de la Pokédex nacional): lo que representa el legendario, no solo su tipo. */
export const SPECIES_THEME: Readonly<Record<number, FallTheme>> = {
  // Tiempo
  483: 'tiempo', 251: 'tiempo', 1007: 'tiempo', 1008: 'tiempo',
  // Espacio y cosmos
  484: 'espacio', 789: 'espacio', 790: 'espacio', 791: 'espacio', 792: 'espacio', 800: 'espacio', 890: 'espacio', 385: 'espacio',
  // Mundo distorsión y oscuridad
  487: 'distorsion', 717: 'distorsion', 491: 'distorsion', 720: 'distorsion',
  // Cielo
  384: 'cielo', 641: 'cielo', 380: 'cielo', 381: 'cielo',
  // Mares
  382: 'mar', 249: 'mar', 490: 'mar', 489: 'mar', 245: 'mar',
  // Tierra y magma
  383: 'magma', 485: 'magma', 244: 'magma', 721: 'magma', 645: 'magma',
  // Creación y luz sagrada
  493: 'creacion', 151: 'creacion', 716: 'creacion', 898: 'creacion', 888: 'creacion', 889: 'creacion', 1024: 'creacion',
  // Arcoíris y fuego sagrado
  250: 'arcoiris', 643: 'arcoiris',
  // Tormenta
  644: 'tormenta', 145: 'tormenta', 243: 'tormenta', 642: 'tormenta', 785: 'tormenta',
  // Mente
  150: 'psique', 386: 'psique', 480: 'psique', 481: 'psique', 482: 'psique',
  // Los de un solo elemento: lo básico de su tipo
  146: 'lava', 144: 'hielo', 378: 'hielo', 646: 'hielo',
  // Los Regis y Regigigas: ruinas antiguas
  377: 'ruinas', 379: 'ruinas', 486: 'ruinas', 894: 'ruinas', 895: 'ruinas',
  // Guardianes de la naturaleza
  492: 'raices', 787: 'raices', 1017: 'raices',
};

/**
 * Arena a la que se cae: la de la especie si tiene una propia; si no, la del primer tipo con tema de los de siempre
 * (fuego, agua, hielo, planta, bicho), luego la del primer tipo con tema de concepto; si ninguno, ruinas.
 */
export const fallTheme = (bossTypes: readonly string[], speciesId?: number): FallTheme =>
  (speciesId !== undefined ? SPECIES_THEME[speciesId] : undefined) ??
  bossTypes.map((t) => TYPE_THEME[t]).find((t) => t !== undefined) ??
  bossTypes.map((t) => TYPE_CONCEPT[t]).find((t) => t !== undefined) ??
  'ruinas';

/** Qué hacen las casillas especiales de cada tema: 'lava' hace daño (no cuenta como camino), 'hielo' resbala. */
export const FALL_HAZARD: Readonly<Record<FallTheme, 'lava' | 'hielo' | null>> = {
  lava: 'lava', inundada: null, hielo: 'hielo', raices: null, ruinas: null,
  tiempo: null, espacio: null, distorsion: null, cielo: null, mar: null, magma: 'lava', creacion: null, arcoiris: 'lava', tormenta: null, psique: 'hielo',
};

export const FALL_WARNING = '¡El suelo se derrumba!';
export const FALL_LANDING: Readonly<Record<FallTheme, string>> = {
  lava: '¡Habéis caído a una cueva de lava! Cuidado con dónde pisas',
  inundada: '¡Habéis caído a una sala inundada! El agua te frena',
  hielo: '¡Habéis caído a una caverna helada! El hielo resbala',
  raices: '¡Habéis caído entre raíces! Ábrete paso a disparos',
  ruinas: '¡Habéis caído a unas ruinas! Todo ha cambiado',
  tiempo: '¡Habéis caído a la cámara del tiempo! Los relojes no se detienen',
  espacio: '¡Habéis caído al vacío del espacio! No te acerques a los abismos',
  distorsion: '¡Habéis caído al mundo distorsión! Arriba y abajo ya no existen',
  cielo: '¡Habéis caído sobre las nubes! Cuidado con los huecos',
  mar: '¡Habéis caído al fondo del océano! El agua te frena',
  magma: '¡Habéis caído a la tierra en llamas! El magma quema',
  creacion: '¡Habéis caído al salón del origen! Aquí empezó todo',
  arcoiris: '¡Habéis caído a la torre del fuego sagrado! Sus llamas queman',
  tormenta: '¡Habéis caído en plena tormenta! Los rayos caen sin parar',
  psique: '¡Habéis caído a un espacio psíquico! El suelo flota y resbala',
};
/** Tinte del suelo nuevo (debajo va el fondo animado de cada tema). */
export const FALL_TINT: Readonly<Record<FallTheme, number>> = {
  lava: 0x5a1a0a, inundada: 0x1a4a7a, hielo: 0xbfe6ff, raices: 0x2e4a1e, ruinas: 0x5a5048,
  tiempo: 0x1c3048, espacio: 0x120a28, distorsion: 0x1e1a24, cielo: 0x6fb4e8, mar: 0x0e3a6a, magma: 0x2a0c06,
  creacion: 0xe8dcb4, arcoiris: 0x7a3a1a, tormenta: 0x2a3038, psique: 0x3a1a4a,
};
/** Color de luz de cada tema (grietas del derrumbe, aterrizaje). */
export const FALL_GLOW: Readonly<Record<FallTheme, number>> = {
  lava: 0xff8a30, inundada: 0x4aa8ff, hielo: 0xbfe6ff, raices: 0x9ade5a, ruinas: 0xff9a4a,
  tiempo: 0x7fd4ff, espacio: 0xff7ad8, distorsion: 0xc04aff, cielo: 0x6aff8a, mar: 0x4ad0ff, magma: 0xff5a1f,
  creacion: 0xfff0a0, arcoiris: 0xffb04a, tormenta: 0xffe94a, psique: 0xff70d0,
};

export interface FallInput {
  bossTypes: readonly string[];
  /** Especie del jefe (Pokédex nacional): elige el tema por concepto antes que por tipo. */
  speciesId?: number;
  seed: number;
  player: Tile;
  boss?: Tile;
}

export interface ArenaFall {
  stage: 2;
  theme: FallTheme;
  /** Obstáculos nuevos (sustituye a toda la cuadrícula de la sala). */
  grid: Grid;
  /** Casillas especiales sobre suelo libre: lava (daño) o hielo (resbala) según FALL_HAZARD. Vacío en el resto de temas. */
  hazards: [number, number][];
}

export const FALL_PLAN: Readonly<Record<FallTheme, readonly { cell: Cell | 'hazard'; n: number; clump: number }[]>> = {
  lava: [{ cell: 'hazard', n: 34, clump: 3 }, { cell: 'R', n: 8, clump: 1 }],
  inundada: [{ cell: 'W', n: 90, clump: 4 }, { cell: 'R', n: 6, clump: 0 }],
  hielo: [{ cell: 'hazard', n: 70, clump: 4 }, { cell: 'P', n: 6, clump: 0 }],
  raices: [{ cell: 'B', n: 22, clump: 2 }, { cell: 'R', n: 6, clump: 0 }],
  ruinas: [{ cell: 'R', n: 16, clump: 1 }, { cell: 'P', n: 6, clump: 0 }, { cell: 'H', n: 6, clump: 1 }],
  // Columnas-reloj en filas ordenadas y algún bloque de piedra
  tiempo: [{ cell: 'P', n: 10, clump: 0 }, { cell: 'R', n: 6, clump: 1 }],
  // Abismos al vacío en manchas y pocas columnas
  espacio: [{ cell: 'H', n: 16, clump: 2 }, { cell: 'P', n: 4, clump: 0 }],
  // Islas rotas: fosos y rocas sueltas
  distorsion: [{ cell: 'H', n: 12, clump: 1 }, { cell: 'R', n: 10, clump: 1 }],
  // Huecos entre las nubes y la columna celeste
  cielo: [{ cell: 'H', n: 18, clump: 3 }, { cell: 'P', n: 4, clump: 0 }],
  // El océano: agua casi por todas partes y algún arrecife
  mar: [{ cell: 'W', n: 120, clump: 5 }, { cell: 'R', n: 4, clump: 0 }],
  // Ríos de magma y placas de roca levantadas
  magma: [{ cell: 'hazard', n: 26, clump: 3 }, { cell: 'R', n: 12, clump: 1 }],
  // Columnas del origen y flores
  creacion: [{ cell: 'P', n: 8, clump: 0 }, { cell: 'B', n: 12, clump: 1 }],
  // Llamas sagradas y columnas de la torre
  arcoiris: [{ cell: 'hazard', n: 18, clump: 2 }, { cell: 'P', n: 6, clump: 0 }],
  // Peñascos partidos por los rayos y charcos de lluvia
  tormenta: [{ cell: 'R', n: 12, clump: 1 }, { cell: 'W', n: 24, clump: 2 }],
  // Suelo que flota y resbala y columnas psíquicas
  psique: [{ cell: 'hazard', n: 40, clump: 3 }, { cell: 'P', n: 8, clump: 0 }],
};

/**
 * Fase 2: la arena nueva. Garantías: puertas y centro libres, nada encima del jugador ni del jefe (ni de sus vecinas),
 * siempre camino seguro (sin obstáculos ni lava) entre puertas, centro, jugador y jefe; determinista por semilla.
 * El agua y el hielo se pueden cruzar, así que no cierran el paso.
 */
export function arenaFall(input: FallInput): ArenaFall {
  const theme = fallTheme(input.bossTypes, input.speciesId);
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
    const passable = step.cell === 'W' || (step.cell === 'hazard' && FALL_HAZARD[theme] === 'hielo');
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
