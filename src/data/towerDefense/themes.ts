// Defensa de torres: niveles temáticos por tipo (como los biomas del modo normal). Cada nivel tiene un TIPO TEMA: el
// primero y el último de cada mapa, el tipo propio del mapa, y los demás van rotando por sus tipos «vecinos». Entre
// los 16 mapas salen los 18 tipos. En ese nivel tus torres del tipo tema ganan daño y alcance, y las que son súper
// eficaces contra él un poco de daño; los enemigos son sobre todo de ese tipo (y del bioma), el jefe de cada 5 oleadas
// encaja con el tema y en las oleadas altas llegan «contra-tipos» que resisten el tipo tema, para que potenciarlo no
// baste. Todo fijo por mapa y nivel (sin azar de la partida). Lógica pura, sin Phaser.
import type { TdMap } from './maps.ts';
import { tdTypeMul } from './towers.ts';
import { tdTypesOf, type EnemyKind } from './species.ts';
import { typeNameEs } from '../types.ts';

/** Los 18 tipos (nombres de PokeAPI). */
export const ALL_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;

/**
 * Tipos de cada mapa (por id): el primero es el suyo (nivel 1, último nivel e infinito) y los demás, los que rotan en
 * los niveles intermedios. Los 16 tipos propios son distintos; Normal y Psíquico salen como tipos vecinos.
 */
export const MAP_THEMES: Readonly<Record<string, readonly string[]>> = {
  pradera: ['grass', 'normal', 'bug'],
  gruta: ['ground', 'rock'],
  arboleda: ['bug', 'flying', 'grass'],
  costa: ['water', 'flying', 'normal'],
  cantera: ['fighting', 'rock', 'ground'],
  nevada: ['ice', 'fighting'],
  ciudad: ['electric', 'normal', 'steel'],
  cienaga: ['poison', 'grass', 'water'],
  glaciar: ['flying', 'ice', 'psychic'],
  volcan: ['rock', 'fire', 'ground'],
  arrecife: ['fairy', 'water', 'psychic'],
  torre: ['ghost', 'psychic', 'dark'],
  fundicion: ['steel', 'electric', 'fire'],
  lodazal: ['dark', 'poison', 'ghost'],
  caldera: ['fire', 'dragon', 'rock'],
  cumbre: ['dragon', 'flying', 'fairy'],
};

export const themesOf = (m: Pick<TdMap, 'id'>): readonly string[] => MAP_THEMES[m.id] ?? ['normal'];

/** Tipo tema de un nivel (0 = infinito): el propio del mapa en el 1, el último y el infinito; los demás rotan. */
export function levelTheme(m: Pick<TdMap, 'id' | 'levels'>, level: number): string {
  const pool = themesOf(m);
  const lv = Math.floor(level);
  if (lv <= 1 || lv >= m.levels) return pool[0];
  return pool[(lv - 1) % pool.length];
}

// --- Potenciación ---

/** Torres del tipo tema: daño y alcance. */
export const THEME_DAMAGE = 1.3;
export const THEME_RANGE = 1.15;
/** Torres súper eficaces contra el tipo tema (Ventaja): daño. */
export const COUNTER_DAMAGE = 1.15;

/** Tipos súper eficaces contra el tipo tema. */
export const counterTypes = (theme: string): string[] => ALL_TYPES.filter((t) => tdTypeMul(t, [theme]) > 1);

/** Tipos que resisten el tipo tema (o le son inmunes). */
export const resistTypes = (theme: string): string[] => ALL_TYPES.filter((t) => tdTypeMul(theme, [t]) < 1);

/** Contra-tipos que llegan en las oleadas altas: hasta 3 tipos (otros que el tema) que lo resisten, los inmunes primero. */
export function contraTypes(theme: string): string[] {
  return resistTypes(theme)
    .filter((t) => t !== theme)
    .sort((a, b) => tdTypeMul(theme, [a]) - tdTypeMul(theme, [b]) || ALL_TYPES.indexOf(a as never) - ALL_TYPES.indexOf(b as never))
    .slice(0, 3);
}

export interface ThemeBoost {
  kind: 'tema' | 'ventaja' | null;
  damage: number;
  range: number;
}

/** Bonus de una torre en un nivel con este tipo tema (el del tema manda si tiene los dos). */
export function themeBoost(theme: string | null | undefined, towerTypes: readonly string[]): ThemeBoost {
  if (!theme) return { kind: null, damage: 1, range: 1 };
  if (towerTypes.includes(theme)) return { kind: 'tema', damage: THEME_DAMAGE, range: THEME_RANGE };
  if (towerTypes.some((t) => tdTypeMul(t, [theme]) > 1)) return { kind: 'ventaja', damage: COUNTER_DAMAGE, range: 1 };
  return { kind: null, damage: 1, range: 1 };
}

const pct = (m: number) => `+${Math.round((m - 1) * 100)} %`;
const list = (ts: readonly string[]) => (ts.length <= 1 ? ts.map(typeNameEs).join('') : `${ts.slice(0, -1).map(typeNameEs).join(', ')} y ${typeNameEs(ts[ts.length - 1])}`);

/** Aviso al empezar: «Nivel Fantasma: tus torres Fantasma +30 % de daño y +15 % de alcance». */
export function themeBanner(theme: string): string {
  return `Nivel ${typeNameEs(theme)}: tus torres ${typeNameEs(theme)} ${pct(THEME_DAMAGE)} de daño y ${pct(THEME_RANGE)} de alcance`;
}

/** Segunda línea del aviso: la Ventaja y el contra-tipo que llega al final. */
export function themeHint(theme: string): string {
  const res = contraTypes(theme);
  return `Ventaja ${pct(COUNTER_DAMAGE)}: ${list(counterTypes(theme))}. En las últimas oleadas llegan ${list(res)}, que lo resisten.`;
}

/** Texto corto para el menú de niveles. */
export function themeSummary(theme: string): string {
  return `Tipo ${typeNameEs(theme)}: torres ${typeNameEs(theme)} ${pct(THEME_DAMAGE)} daño y ${pct(THEME_RANGE)} alcance; ${list(counterTypes(theme))} ${pct(COUNTER_DAMAGE)}`;
}

// --- Enemigos ---

/** Pokémon de cada tipo: de tierra, voladores (o que flotan), grandes y los 2 jefes de oleada (se alternan). */
export interface ThemeFoes {
  ground: readonly number[];
  air: readonly number[];
  big: readonly number[];
  chiefs: readonly [number, number];
}

export const THEME_FOES: Readonly<Record<string, ThemeFoes>> = {
  normal: { ground: [19, 161, 263, 399], air: [16, 396], big: [20, 217], chiefs: [128, 289] },
  fire: { ground: [4, 37, 58, 77], air: [662, 663], big: [126, 324], chiefs: [59, 6] },
  water: { ground: [7, 54, 60, 118], air: [278, 279], big: [8, 61], chiefs: [130, 134] },
  electric: { ground: [25, 100, 179, 309], air: [81, 587], big: [125, 180], chiefs: [466, 135] },
  grass: { ground: [1, 43, 152, 191], air: [357], big: [114, 2], chiefs: [3, 465] },
  ice: { ground: [220, 361, 613, 582], air: [478, 615], big: [473, 131], chiefs: [460, 471] },
  fighting: { ground: [66, 56, 236, 296], air: [701], big: [67, 297], chiefs: [68, 448] },
  poison: { ground: [23, 29, 88, 109], air: [41, 42], big: [89, 24], chiefs: [454, 110] },
  ground: { ground: [27, 50, 104, 328], air: [207], big: [111, 232], chiefs: [105, 112] },
  flying: { ground: [821, 84, 276], air: [17, 22, 822], big: [85, 823], chiefs: [18, 398] },
  psychic: { ground: [63, 96, 79, 280], air: [177, 178], big: [97, 80], chiefs: [65, 196] },
  bug: { ground: [10, 13, 48, 265], air: [12, 15, 193], big: [127, 168], chiefs: [212, 214] },
  rock: { ground: [74, 95, 246, 524], air: [142, 337], big: [75, 299], chiefs: [76, 248] },
  ghost: { ground: [92, 353, 355, 425], air: [93, 200, 426], big: [356, 711], chiefs: [94, 477] },
  dragon: { ground: [147, 371, 443, 610], air: [334, 715], big: [148, 372], chiefs: [149, 373] },
  dark: { ground: [261, 215, 228, 509], air: [198, 430], big: [262, 229], chiefs: [197, 359] },
  steel: { ground: [304, 374, 599, 436], air: [227, 81], big: [305, 208], chiefs: [306, 376] },
  fairy: { ground: [35, 39, 173, 209], air: [176, 682], big: [36, 210], chiefs: [700, 282] },
};

type Group = 'ground' | 'air' | 'big';
const AIR_KINDS: ReadonlySet<EnemyKind> = new Set(['flying', 'soarer']);
const BIG_KINDS: ReadonlySet<EnemyKind> = new Set(['tank', 'shielded', 'healer', 'saboteur', 'adapter']);
export const groupOf = (kind: EnemyKind): Group => (AIR_KINDS.has(kind) ? 'air' : BIG_KINDS.has(kind) ? 'big' : 'ground');

/** Jefe de oleada de un nivel temático (se alternan los 2 del tipo). */
export function themeChief(theme: string, wave: number): number {
  const c = (THEME_FOES[theme] ?? THEME_FOES.normal).chiefs;
  return c[Math.max(0, Math.floor(wave / 5) - 1) % 2];
}

const contraCache = new Map<string, Record<Group, number[]>>();
/** Contra-tipos del tema: Pokémon de los otros tipos que resisten el tipo tema (por grupo, siempre en el mismo orden). */
export function contraFoes(theme: string): Record<Group, number[]> {
  let c = contraCache.get(theme);
  if (!c) {
    const out: Record<Group, number[]> = { ground: [], air: [], big: [] };
    for (const t of contraTypes(theme)) {
      const f = THEME_FOES[t];
      for (const g of ['ground', 'air', 'big'] as const) {
        for (const id of f[g]) if (tdTypeMul(theme, tdTypesOf(id)) < 1 && !out[g].includes(id)) out[g].push(id);
      }
    }
    // Sin voladores o grandes que resistan: los de tierra
    if (!out.air.length) out.air = [...out.ground];
    if (!out.big.length) out.big = [...out.ground];
    c = out;
    contraCache.set(theme, c);
  }
  return c;
}

/** Qué sale en cada hueco de la oleada: del tema, del bioma («entorno») o contra-tipo. */
export type FoeSource = 'tema' | 'entorno' | 'contra';

/** Vida extra de los contra-tipos (llegan curtidos). */
export const CONTRA_HP = 1.25;

/** ¿Va por la segunda mitad del nivel (o el último cuarto)? En el infinito, desde la oleada 7 (y la 12). */
const lateOf = (wave: number, waves: number) => (Number.isFinite(waves) ? wave > waves / 2 : wave >= 7);
const laterOf = (wave: number, waves: number) => (Number.isFinite(waves) ? wave > (waves * 3) / 4 : wave >= 12);

/**
 * Hueco i de la oleada w (de un total de `waves`, Infinity en el infinito): 1 de cada 4 es del bioma; en la segunda
 * mitad del nivel otro de cada 4 es contra-tipo, igual que los grandes (robustos, escudados, curanderos, saboteadores
 * y adaptables), y en el último cuarto, dos de cada 4.
 */
export function foeSource(i: number, wave: number, waves: number, kind: EnemyKind = 'normal'): FoeSource {
  if (kind === 'chief' || kind === 'boss') return 'tema';
  const late = lateOf(wave, waves);
  if (late && groupOf(kind) === 'big') return 'contra';
  const slot = i % 4;
  if (slot === 2) return 'entorno';
  if (late && slot === 3) return 'contra';
  if (laterOf(wave, waves) && slot === 1) return 'contra';
  return 'tema';
}

/** Especie de un hueco temático (o null si va con la del bioma). */
export function themeSpecies(theme: string, kind: EnemyKind, i: number, wave: number, waves: number, seq: number): number | null {
  if (kind === 'boss') return null;
  if (kind === 'chief') return themeChief(theme, wave);
  const src = foeSource(i, wave, waves, kind);
  if (src === 'entorno') return null;
  const g = groupOf(kind);
  const list = src === 'contra' ? contraFoes(theme)[g] : (THEME_FOES[theme] ?? THEME_FOES.normal)[g];
  return list.length ? list[seq % list.length] : null;
}

/** ¿Esta especie resiste el tipo tema? (para darle la vida extra de contra-tipo). */
export const resistsTheme = (theme: string, species: number): boolean => tdTypeMul(theme, tdTypesOf(species)) < 1;

/** Todas las especies que pueden salir en un nivel temático (para cargar sus sprites). */
export function themeSpeciesIds(theme: string): number[] {
  const f = THEME_FOES[theme] ?? THEME_FOES.normal;
  const c = contraFoes(theme);
  return [...new Set([...f.ground, ...f.air, ...f.big, ...f.chiefs, ...c.ground, ...c.air, ...c.big])];
}
