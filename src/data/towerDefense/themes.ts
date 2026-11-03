// Defensa de torres: niveles temáticos por tipo (como los biomas del modo normal). Cada nivel tiene un TIPO TEMA: el
// primero y el último de cada mapa, el tipo propio del mapa, y los demás van rotando por sus tipos «vecinos». Hay una
// fase (mapa) por cada uno de los 18 tipos. En ese nivel tus torres del tipo tema ganan daño y alcance, y las que son
// súper eficaces contra él un poco de daño. Cada enemigo se sortea con PROBABILIDAD (como el modo normal): el tipo tema
// sale más (~55 %), pero también salen los del bioma y de otros tipos; en las oleadas altas llegan «contra-tipos» que
// resisten el tipo tema, para que potenciarlo no baste. Minijefes (pseudolegendarios y ultraentes) y jefes
// (legendarios y singulares) prefieren el tipo tema. Todo fijo por mapa, nivel y oleada (tirada determinista con la
// semilla del nivel, sin azar de la partida). Lógica pura, sin Phaser.
import type { TdMap } from './maps.ts';
import { tdTypeMul } from './towers.ts';
import { tdTypesOf, type EnemyKind } from './species.ts';
import { typeNameEs } from '../types.ts';
import { BOSS_POOL, MINIBOSS_POOL, chiefIndex, hashStr } from './chiefs.ts';

/** Los 18 tipos (nombres de PokeAPI). */
export const ALL_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;

/**
 * Tipos de cada mapa (por id): el primero es el suyo (nivel 1, último nivel e infinito) y los demás, los que rotan en
 * los niveles intermedios. Los 18 tipos propios son distintos: una fase por tipo (Psíquico y Normal, los dos mapas
 * añadidos al final para no tocar los ids, el orden ni los guardados de los demás).
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
  templo: ['psychic', 'fairy', 'dark'],
  origen: ['normal', 'dragon', 'ghost'],
};

/** Jefe final (último nivel) de los mapas cuyo bioma no tiene un legendario de su tipo; los demás, el del bioma. */
export const MAP_FINAL_BOSS: Readonly<Record<string, number>> = { templo: 150, origen: 493 };

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

/** Pokémon de cada tipo: de tierra, voladores (o que flotan) y grandes. */
export interface ThemeFoes {
  ground: readonly number[];
  air: readonly number[];
  big: readonly number[];
}

export const THEME_FOES: Readonly<Record<string, ThemeFoes>> = {
  normal: { ground: [19, 161, 263, 399], air: [16, 396], big: [20, 217] },
  fire: { ground: [4, 37, 58, 77], air: [662, 663], big: [126, 324] },
  water: { ground: [7, 54, 60, 118], air: [278, 279], big: [8, 61] },
  electric: { ground: [25, 100, 179, 309], air: [81, 587], big: [125, 180] },
  grass: { ground: [1, 43, 152, 191], air: [357], big: [114, 2] },
  ice: { ground: [220, 361, 613, 582], air: [478, 615], big: [473, 131] },
  fighting: { ground: [66, 56, 236, 296], air: [701], big: [67, 297] },
  poison: { ground: [23, 29, 88, 109], air: [41, 42], big: [89, 24] },
  ground: { ground: [27, 50, 104, 328], air: [207], big: [111, 232] },
  flying: { ground: [821, 84, 276], air: [17, 22, 822], big: [85, 823] },
  psychic: { ground: [63, 96, 79, 280], air: [177, 178], big: [97, 80] },
  bug: { ground: [10, 13, 48, 265], air: [12, 15, 193], big: [127, 168] },
  rock: { ground: [74, 95, 246, 524], air: [142, 337], big: [75, 299] },
  ghost: { ground: [92, 353, 355, 425], air: [93, 200, 426], big: [356, 711] },
  dragon: { ground: [147, 371, 443, 610], air: [334, 715], big: [148, 372] },
  dark: { ground: [261, 215, 228, 509], air: [198, 430], big: [262, 229] },
  steel: { ground: [304, 374, 599, 436], air: [227, 81], big: [305, 208] },
  fairy: { ground: [35, 39, 173, 209], air: [176, 682], big: [36, 210] },
};

type Group = 'ground' | 'air' | 'big';
const AIR_KINDS: ReadonlySet<EnemyKind> = new Set(['flying', 'soarer']);
const BIG_KINDS: ReadonlySet<EnemyKind> = new Set(['tank', 'shielded', 'healer', 'saboteur', 'adapter']);
export const groupOf = (kind: EnemyKind): Group => (AIR_KINDS.has(kind) ? 'air' : BIG_KINDS.has(kind) ? 'big' : 'ground');

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

/** Qué sale en cada hueco de la oleada: del tema, del bioma («entorno»), de otro tipo de visita o contra-tipo. */
export type FoeSource = 'tema' | 'entorno' | 'otro' | 'contra';
export const FOE_SOURCES: readonly FoeSource[] = ['tema', 'entorno', 'otro', 'contra'];

/** Vida extra de los contra-tipos (llegan curtidos). */
export const CONTRA_HP = 1.2;

/** ¿Va por la segunda mitad del nivel (o el último cuarto)? En el infinito, desde la oleada 7 (y la 12). */
const lateOf = (wave: number, waves: number) => (Number.isFinite(waves) ? wave > waves / 2 : wave >= 7);
const laterOf = (wave: number, waves: number) => (Number.isFinite(waves) ? wave > (waves * 3) / 4 : wave >= 12);

/**
 * Probabilidad de cada origen según el tramo del nivel. El tipo tema siempre es lo más probable (~55 %); el resto,
 * del bioma y de otros tipos, y en la segunda mitad entran los contra-tipos (más en el último cuarto).
 */
export const FOE_WEIGHTS: Readonly<Record<'early' | 'late' | 'later', Readonly<Record<FoeSource, number>>>> = {
  early: { tema: 0.58, entorno: 0.27, otro: 0.15, contra: 0 },
  late: { tema: 0.52, entorno: 0.18, otro: 0.1, contra: 0.2 },
  later: { tema: 0.46, entorno: 0.14, otro: 0.08, contra: 0.32 },
};
/** Los grandes (robustos, escudados, curanderos, saboteadores y adaptables) son más a menudo contra-tipos al final. */
export const BIG_CONTRA_MUL = 1.8;

/** Probabilidades de un hueco (suman 1). */
export function foeWeights(wave: number, waves: number, kind: EnemyKind = 'normal'): Record<FoeSource, number> {
  const base = laterOf(wave, waves) ? FOE_WEIGHTS.later : lateOf(wave, waves) ? FOE_WEIGHTS.late : FOE_WEIGHTS.early;
  const w = { ...base };
  if (groupOf(kind) === 'big') w.contra *= BIG_CONTRA_MUL;
  const sum = FOE_SOURCES.reduce((a, k) => a + w[k], 0);
  for (const k of FOE_SOURCES) w[k] /= sum;
  return w;
}

/** Número en [0, 1) fijo para un texto (semilla del nivel + hueco): la «tirada» reproducible. */
export function unitRoll(key: string): number {
  let h = hashStr(key);
  // Mezcla final (murmur3) para que semillas parecidas no den tiradas parecidas
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Semilla de un nivel (mapa y nivel; 0 = infinito). */
export const levelSeed = (mapId: string, level: number): string => `${mapId}|${Math.max(0, Math.floor(level))}`;

/**
 * Origen del hueco i de la oleada w (de un total de `waves`, Infinity en el infinito): sorteo ponderado con
 * `foeWeights`, determinista con la semilla del nivel. Minijefes y jefes van aparte.
 */
export function foeSource(i: number, wave: number, waves: number, kind: EnemyKind = 'normal', seed = ''): FoeSource {
  if (kind === 'chief' || kind === 'boss') return 'tema';
  const w = foeWeights(wave, waves, kind);
  let r = unitRoll(`${seed}|${wave}|${i}|origen`);
  for (const k of FOE_SOURCES) {
    r -= w[k];
    if (r < 0) return k;
  }
  return 'tema';
}

/** Tipos «de visita» de un nivel: 2 tipos fijos por nivel que no son el tema ni sus contra-tipos (variedad). */
export function visitorTypes(theme: string, seed: string): string[] {
  const banned = new Set([theme, ...contraTypes(theme)]);
  const pool = ALL_TYPES.filter((t) => !banned.has(t));
  const a = Math.floor(unitRoll(`${seed}|visita`) * pool.length);
  const b = (a + 1 + Math.floor(unitRoll(`${seed}|visita2`) * (pool.length - 1))) % pool.length;
  return [pool[a], pool[b]];
}

/** Contexto de un nivel temático para elegir especies. */
export interface ThemeCtx {
  theme: string;
  seed: string;
  visitors: readonly string[];
}
export const themeCtx = (theme: string, seed: string): ThemeCtx => ({ theme, seed, visitors: visitorTypes(theme, seed) });

/** Especie de un hueco temático (o null si va con la del bioma). Minijefes y jefes: `minibossFor` / `levelBossFor`. */
export function themeSpecies(ctx: ThemeCtx, kind: EnemyKind, i: number, wave: number, waves: number, seq: number): number | null {
  if (kind === 'boss' || kind === 'chief') return null;
  const src = foeSource(i, wave, waves, kind, ctx.seed);
  if (src === 'entorno') return null;
  const g = groupOf(kind);
  let list: readonly number[];
  if (src === 'contra') list = contraFoes(ctx.theme)[g];
  else if (src === 'otro') list = (THEME_FOES[ctx.visitors[seq % ctx.visitors.length]] ?? THEME_FOES.normal)[g];
  else list = (THEME_FOES[ctx.theme] ?? THEME_FOES.normal)[g];
  return list.length ? list[seq % list.length] : null;
}

/** ¿Esta especie resiste el tipo tema? (para darle la vida extra de contra-tipo). */
export const resistsTheme = (theme: string, species: number): boolean => tdTypeMul(theme, tdTypesOf(species)) < 1;

// --- Minijefes y jefes (chiefs.ts) ---

/**
 * Candidatos de un pool para un tipo: los que son de ese tipo («del tema») y, si no hay ninguno, los que le son súper
 * eficaces (sus «rivales», el fallback razonable: p. ej. Normal → los Lucha). Siempre en el mismo orden.
 */
export function bigMonCandidates(pool: readonly number[], theme: string): { match: number[]; rival: number[] } {
  const match = pool.filter((id) => tdTypesOf(id).includes(theme));
  const rival = pool.filter((id) => !match.includes(id) && tdTypesOf(id).some((t) => tdTypeMul(t, [theme]) > 1));
  return { match, rival };
}

/**
 * El k-ésimo de una serie sin repetir seguidos: con 2 o más del tema van rotando; con 1, se alterna con un rival (u
 * otro del pool); sin ninguno, rotan los rivales (o todo el pool). El punto de partida sale de la semilla.
 */
export function bigMonPick(pool: readonly number[], theme: string, seed: string, k: number): number {
  const { match, rival } = bigMonCandidates(pool, theme);
  const off = Math.floor(unitRoll(`${seed}|grande`) * 997);
  const others = (rival.length >= 2 ? rival : pool.filter((id) => !match.includes(id)));
  if (match.length >= 2) return match[(off + k) % match.length];
  if (match.length === 1) return k % 2 === 0 ? match[0] : others[(off + (k >> 1)) % others.length];
  return others[(off + k) % others.length];
}

/** Minijefe (pseudolegendario o ultraente) de la oleada `wave` de un nivel: prefiere el tipo tema; nunca dos iguales seguidos. */
export const minibossFor = (theme: string, seed: string, wave: number): number => bigMonPick(MINIBOSS_POOL, theme, `${seed}|minijefe`, chiefIndex(wave));

/**
 * Jefe legendario de la última oleada de cada nivel (los que no son el último del mapa). Prefiere el tipo tema, no
 * repite el del nivel anterior y nunca es el jefe final del mapa (ese se guarda para el último nivel).
 */
export function levelBossFor(m: Pick<TdMap, 'id' | 'levels'>, level: number, finalBoss: number): number {
  let prev = -1;
  let pick = -1;
  // Cuántas veces ha salido ya cada tipo en el mapa: así los niveles del mismo tipo van rotando de legendario
  const seen = new Map<string, number>();
  for (let l = 1; l <= level; l++) {
    const theme = levelTheme(m, l);
    const n = seen.get(theme) ?? 0;
    seen.set(theme, n + 1);
    const avoid = new Set([prev, finalBoss]);
    pick = -1;
    for (let k = 0; k < 6 && (pick < 0 || avoid.has(pick)); k++) pick = bigMonPick(BOSS_POOL, theme, `${m.id}|jefe`, n + k);
    if (avoid.has(pick)) pick = BOSS_POOL.find((id) => !avoid.has(id)) ?? pick;
    prev = pick;
  }
  return pick;
}

/** Todas las especies que pueden salir en un nivel temático (para cargar sus sprites): tema, contra-tipos y visitas. */
export function themeSpeciesIds(ctx: ThemeCtx | string): number[] {
  const c0 = typeof ctx === 'string' ? themeCtx(ctx, '') : ctx;
  const out: number[] = [];
  for (const t of [c0.theme, ...c0.visitors]) {
    const f = THEME_FOES[t] ?? THEME_FOES.normal;
    out.push(...f.ground, ...f.air, ...f.big);
  }
  const c = contraFoes(c0.theme);
  out.push(...c.ground, ...c.air, ...c.big);
  return [...new Set(out)];
}
