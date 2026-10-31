// Defensa de torres: lógica pura de la pantalla «Elige tu equipo» (filtro, orden, paginación, saltos de página y
// cursor de la rejilla y del panel del equipo). Sin Phaser, para poder probarla con node --test.
import { AIR_TYPES, STYLE_LABEL, towerCost, towerStyle, type TowerStyle } from './towers.ts';
import { typeNameEs } from '../types.ts';
import type { TdMon } from './species.ts';

export interface PickLike {
  id: number;
  name: string;
  types: string[];
  rarity: TdMon['rarity'];
  bst: number;
}

/** Orden de las clases en la leyenda y en el filtro. */
export const CLASS_ORDER: readonly TowerStyle[] = ['sniper', 'rapid', 'splash', 'chain', 'slow', 'single', 'support', 'farm'];

/** Color de cada clase (mismo en la casilla, la ficha y el filtro). */
export const CLASS_COLOR: Readonly<Record<TowerStyle, number>> = {
  sniper: 0x4fc3f7,
  rapid: 0xffb74d,
  splash: 0xef5350,
  chain: 0xffee58,
  slow: 0x80deea,
  single: 0xb0bec5,
  support: 0xf48fb1,
  farm: 0x9ccc65,
};
/** Color del distintivo «Aéreo» (alcanza a los voladores). */
export const AIR_COLOR = 0xb39ddb;

export const canHitAir = (p: Pick<PickLike, 'types'>): boolean => p.types.some((t) => AIR_TYPES.has(t));

// --- Orden ---

export type SortKey = 'poder' | 'coste' | 'nombre' | 'clase';
export const SORT_KEYS: readonly SortKey[] = ['poder', 'coste', 'nombre', 'clase'];
export const SORT_LABEL: Readonly<Record<SortKey, string>> = { poder: 'Poder', coste: 'Coste', nombre: 'Nombre', clase: 'Clase' };

/** Ordena sin tocar la lista original; el desempate siempre es el poder y luego el número, para que sea estable. */
export function sortPicks<T extends PickLike>(list: readonly T[], key: SortKey): T[] {
  const tie = (a: T, b: T) => b.bst - a.bst || a.id - b.id;
  const cmp: Record<SortKey, (a: T, b: T) => number> = {
    poder: tie,
    coste: (a, b) => towerCost(a) - towerCost(b) || tie(a, b),
    nombre: (a, b) => a.name.localeCompare(b.name, 'es') || tie(a, b),
    clase: (a, b) => CLASS_ORDER.indexOf(towerStyle(a)) - CLASS_ORDER.indexOf(towerStyle(b)) || tie(a, b),
  };
  return [...list].sort(cmp[key]);
}

// --- Filtro ---

export type FilterKey = 'todos' | 'equipo' | 'aereo' | `clase:${TowerStyle}` | `tipo:${string}`;

export function matchesFilter(p: PickLike, f: FilterKey, teamIds: ReadonlySet<number>): boolean {
  if (f === 'todos') return true;
  if (f === 'equipo') return teamIds.has(p.id);
  if (f === 'aereo') return canHitAir(p);
  if (f.startsWith('clase:')) return towerStyle(p) === f.slice(6);
  if (f.startsWith('tipo:')) return p.types.includes(f.slice(5));
  return true;
}

export function filterPicks<T extends PickLike>(list: readonly T[], f: FilterKey, teamIds: ReadonlySet<number>): T[] {
  return list.filter((p) => matchesFilter(p, f, teamIds));
}

/** Filtros que tienen algún Pokémon («Todos» y «Mi equipo» siempre), en orden: clases, aéreo y tipos. */
export function filterOptions(list: readonly PickLike[]): FilterKey[] {
  const out: FilterKey[] = ['todos', 'equipo'];
  for (const c of CLASS_ORDER) if (list.some((p) => towerStyle(p) === c)) out.push(`clase:${c}`);
  if (list.some(canHitAir)) out.push('aereo');
  const types = new Set<string>();
  list.forEach((p) => p.types.forEach((t) => types.add(t)));
  [...types].sort((a, b) => typeNameEs(a).localeCompare(typeNameEs(b), 'es')).forEach((t) => out.push(`tipo:${t}`));
  return out;
}

export function filterLabel(f: FilterKey): string {
  if (f === 'todos') return 'Todos';
  if (f === 'equipo') return 'Mi equipo';
  if (f === 'aereo') return 'Aéreo';
  if (f.startsWith('clase:')) return STYLE_LABEL[f.slice(6) as TowerStyle] ?? f;
  return `Tipo ${typeNameEs(f.slice(5))}`;
}

/** Siguiente opción de una lista circular (si la actual ya no está, vuelve a la primera). */
export function cycle<T>(opts: readonly T[], cur: T, d: number): T {
  if (!opts.length) return cur;
  const i = opts.indexOf(cur);
  if (i < 0) return opts[0];
  return opts[(((i + d) % opts.length) + opts.length) % opts.length];
}

// --- Páginas y cursor ---

export interface GridShape {
  cols: number;
  rows: number;
}

export const perPage = (g: GridShape): number => g.cols * g.rows;
export const pageCount = (total: number, g: GridShape): number => Math.max(1, Math.ceil(total / perPage(g)));
/** Casillas que hay en una página (la última puede ir incompleta). */
export const itemsOnPage = (total: number, page: number, g: GridShape): number =>
  Math.max(0, Math.min(perPage(g), total - page * perPage(g)));

export interface GridCursor {
  page: number;
  idx: number;
}

/** Deja el cursor siempre en una casilla que existe (o en 0/0 si no hay ninguna). */
export function clampCursor(c: GridCursor, total: number, g: GridShape): GridCursor {
  const pages = pageCount(total, g);
  const page = Math.max(0, Math.min(pages - 1, Math.floor(c.page) || 0));
  const n = itemsOnPage(total, page, g);
  return { page, idx: n ? Math.max(0, Math.min(n - 1, Math.floor(c.idx) || 0)) : 0 };
}

/** Pone el cursor en una fila/columna de una página, cayendo en la última casilla si esa no existe. */
function place(page: number, row: number, col: number, total: number, g: GridShape): GridCursor {
  return clampCursor({ page, idx: row * g.cols + col }, total, g);
}

/** Salta d páginas (LB/RB ±1, LT/RT ±5): no da la vuelta, se queda en la primera/última y conserva la casilla. */
export function jumpPage(c: GridCursor, d: number, total: number, g: GridShape): GridCursor {
  const pages = pageCount(total, g);
  return clampCursor({ page: Math.max(0, Math.min(pages - 1, c.page + d)), idx: c.idx }, total, g);
}

/** Con LB/RB de una en una sí se da la vuelta (de la última a la primera). */
export function turnPage(c: GridCursor, d: number, total: number, g: GridShape): GridCursor {
  const pages = pageCount(total, g);
  return clampCursor({ page: (((c.page + d) % pages) + pages) % pages, idx: c.idx }, total, g);
}

/** Adónde sale el cursor al pasarse de la rejilla. */
export type GridExit = 'none' | 'up' | 'right';

/**
 * Mueve el cursor de la rejilla. Por los lados pasa a la página anterior/siguiente conservando la fila; por la
 * derecha de la última página sale al panel del equipo; por arriba de la primera fila sale a la barra de filtro.
 */
export function moveCursor(c: GridCursor, dx: number, dy: number, total: number, g: GridShape): { cur: GridCursor; exit: GridExit } {
  const cur = clampCursor(c, total, g);
  if (!total) return { cur, exit: dx > 0 ? 'right' : dy < 0 ? 'up' : 'none' };
  const pages = pageCount(total, g);
  const n = itemsOnPage(total, cur.page, g);
  const row = Math.floor(cur.idx / g.cols);
  const col = cur.idx % g.cols;
  if (dx) {
    const nc = col + Math.sign(dx);
    const lastRowItem = Math.min(n - 1, row * g.cols + g.cols - 1);
    if (dx < 0 && nc < 0) {
      if (cur.page === 0) return { cur, exit: 'none' };
      return { cur: place(cur.page - 1, row, g.cols - 1, total, g), exit: 'none' };
    }
    if (dx > 0 && (nc >= g.cols || row * g.cols + nc > lastRowItem)) {
      if (cur.page >= pages - 1) return { cur, exit: 'right' };
      return { cur: place(cur.page + 1, row, 0, total, g), exit: 'none' };
    }
    return { cur: { page: cur.page, idx: row * g.cols + nc }, exit: 'none' };
  }
  if (dy) {
    const nr = row + Math.sign(dy);
    if (nr < 0) return { cur, exit: 'up' };
    if (nr * g.cols >= n) return { cur, exit: 'none' };
    return { cur: place(cur.page, nr, col, total, g), exit: 'none' };
  }
  return { cur, exit: 'none' };
}

/** Página y casilla donde está el Pokémon número i de la lista. */
export const cursorOf = (i: number, g: GridShape): GridCursor => ({ page: Math.floor(i / perPage(g)), idx: i % perPage(g) });
export const indexOf = (c: GridCursor, g: GridShape): number => c.page * perPage(g) + c.idx;

// --- Panel del equipo (2 columnas × 3 filas de huecos y debajo «¡A jugar!» y el botón de prueba) ---

export const SLOT_COLS = 2;
export const START_FOCUS = 6;
export const TRIAL_FOCUS = 7;

/**
 * Mueve el foco del panel: 0-5 huecos, 6 «¡A jugar!», 7 equipo de prueba. Los huecos vacíos se saltan.
 * Devuelve -1 si sale por la izquierda (vuelve a la rejilla).
 */
export function movePanel(focus: number, dx: number, dy: number, teamLen: number, slots = 6): number {
  const has = (k: number) => k < Math.min(teamLen, slots);
  if (focus >= START_FOCUS) {
    if (dx < 0) return -1;
    if (dy < 0) {
      if (focus === TRIAL_FOCUS) return START_FOCUS;
      const n = Math.min(teamLen, slots);
      return n ? n - 1 : focus;
    }
    if (dy > 0) return TRIAL_FOCUS;
    return focus;
  }
  if (!has(focus)) return teamLen ? Math.min(teamLen, slots) - 1 : START_FOCUS;
  const col = focus % SLOT_COLS;
  if (dx < 0) return col === 0 ? -1 : focus - 1;
  if (dx > 0) return col === SLOT_COLS - 1 || !has(focus + 1) ? focus : focus + 1;
  if (dy < 0) return focus - SLOT_COLS >= 0 ? focus - SLOT_COLS : focus;
  if (dy > 0) {
    const nf = focus + SLOT_COLS;
    if (has(nf)) return nf;
    // Fila de abajo a medias: a la casilla que haya; si no, a «¡A jugar!»
    if (has(nf - col)) return Math.min(teamLen, slots) - 1;
    return START_FOCUS;
  }
  return focus;
}

/** Tras quitar a alguien, el foco del panel se queda en un hueco que exista (o en «¡A jugar!»). */
export const clampPanel = (focus: number, teamLen: number, slots = 6): number =>
  focus >= START_FOCUS || focus < 0 ? focus : teamLen ? Math.min(focus, Math.min(teamLen, slots) - 1) : START_FOCUS;

/** Ficha corta de cada clase (de los multiplicadores de towerStats): alcance, daño y qué hace. */
export const CLASS_TRAITS: Readonly<Record<TowerStyle, { range: string; damage: string; note: string }>> = {
  sniper: { range: 'muy largo', damage: 'muy alto', note: 'Lento pero certero, con más críticos.' },
  rapid: { range: 'corto', damage: 'bajo por golpe', note: 'Dispara muy rápido.' },
  splash: { range: 'medio', damage: 'medio', note: 'Daña a todos los de alrededor del blanco.' },
  chain: { range: 'medio', damage: 'medio', note: 'El rayo salta a 2 enemigos más.' },
  slow: { range: 'medio', damage: 'medio', note: 'Frena a los enemigos un rato.' },
  single: { range: 'medio', damage: 'medio', note: 'Disparo equilibrado a un blanco.' },
  support: { range: 'medio', damage: 'bajo', note: 'Refuerza el daño de las torres cercanas.' },
  farm: { range: 'medio', damage: 'muy bajo', note: 'Da dinero extra en cada oleada.' },
};
