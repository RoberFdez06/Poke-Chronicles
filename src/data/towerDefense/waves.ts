// Defensa de torres: cada mapa tiene de 10 a 15 niveles (TdMap.levels, crecen con el mapa) (partidas cortas con oleadas
// fijas). Cada nivel acaba con un jefe legendario (el del último nivel, el del mapa y a plena vida) y trae minijefes
// (pseudolegendarios y ultraentes) cada 5 oleadas. En el modo infinito las oleadas siguen creciendo (jefe cada 10,
// minijefe en las de 5) hasta que caes. Pokémon oscuros desde media partida. Estadísticas de los enemigos por papel.
// Lógica pura, sin Phaser.
import { shieldPoolFor } from '../enemies.ts';
import type { TdMap } from './maps.ts';
import { MAP_FOES, TRICK_KINDS, tdTypesOf, type EnemyKind, type MapFoes } from './species.ts';
import { waveTheme } from './tricks.ts';
import { CHIEF_EVERY } from './chiefs.ts';
import { CONTRA_HP, MAP_FINAL_BOSS, foeSource, levelBossFor, levelSeed, levelTheme, minibossFor, themeCtx, themeSpecies, unitRoll } from './themes.ts';

/** Escala de referencia del equilibrio: los niveles de cada mapa se reparten sobre 12 «niveles de dificultad». */
export const REF_LEVELS = 12;
/**
 * Oleadas de un nivel (1..levels del mapa): de 6 en el primero a 11 en el último, sea cual sea el número de niveles
 * del mapa (con más niveles la subida es más gradual).
 */
export const wavesInLevel = (level: number, levels = REF_LEVELS): number => {
  const n = Math.max(1, levels);
  return 5 + Math.ceil((Math.max(1, Math.min(n, level)) * 6) / n);
};
/** En el infinito, jefe cada 10 oleadas. */
export const BOSS_EVERY = 10;

/** Partida concreta: un nivel (1..levels) de un mapa, o su infinito (level = 0). */
export interface Stage {
  tier: number;
  level: number;
  /** Niveles del mapa (el último trae el jefe). */
  levels: number;
}
export const isEndless = (s: Stage): boolean => s.level <= 0;

/** Jefe (legendario): la última oleada de cada nivel; en el infinito, cada 10. */
export function isBossWave(s: Stage, wave: number): boolean {
  if (isEndless(s)) return wave > 0 && wave % BOSS_EVERY === 0;
  return wave === wavesInLevel(s.level, s.levels);
}

/** ¿Es el jefe final del mapa (último nivel, a plena vida)? */
export const isFinalBoss = (s: Stage, wave: number): boolean => !isEndless(s) && s.level >= s.levels && isBossWave(s, wave);

/**
 * Vida del jefe de un nivel que no es el último (parte de la del jefe final): de 0,4 en el primer nivel a 0,75 en el
 * penúltimo, para que acabar cada nivel con un legendario no rompa los niveles fáciles.
 */
export const levelBossHp = (s: Stage): number => (isEndless(s) || s.level >= s.levels ? 1 : 0.22 + (0.38 * (refLevel(s) - 1)) / (REF_LEVELS - 1));

/** Minijefe (pseudolegendario o ultraente): cada 5 oleadas, salvo si ya toca el jefe. */
export const isChiefWave = (s: Stage, wave: number): boolean => wave > 0 && wave % CHIEF_EVERY === 0 && !isBossWave(s, wave);

/** Nivel equivalente en la escala de 12 (1..12; el infinito, 12): así la dificultad no depende de cuántos niveles tenga el mapa. */
export const refLevel = (s: Stage): number => (isEndless(s) ? REF_LEVELS : 1 + ((Math.max(1, Math.min(s.levels, s.level)) - 1) * (REF_LEVELS - 1)) / Math.max(1, s.levels - 1));

/** Dificultad de una partida: el mapa manda y cada nivel suma un poco. El infinito empieza como el último nivel. */
export const stagePower = (s: Stage): number => s.tier + (refLevel(s) - 1) * 0.11;

export interface KindStats {
  hp: number;
  speed: number;
  bounty: number;
  /** Vida de la base que quita al llegar. */
  leak: number;
}

/** Multiplicadores de cada papel respecto a un salvaje normal. */
export const KIND_STATS: Readonly<Record<EnemyKind, KindStats>> = {
  normal: { hp: 1, speed: 1, bounty: 6, leak: 1 },
  fast: { hp: 0.55, speed: 1.75, bounty: 5, leak: 1 },
  tank: { hp: 2.8, speed: 0.6, bounty: 14, leak: 2 },
  // Voladores: siguen el camino (más largo que la línea recta de antes), así que van algo más rápido
  flying: { hp: 0.8, speed: 1.3, bounty: 8, leak: 1 },
  healer: { hp: 1.2, speed: 0.85, bounty: 11, leak: 1 },
  shielded: { hp: 1, speed: 0.85, bounty: 12, leak: 1 },
  hastener: { hp: 1, speed: 1.05, bounty: 10, leak: 1 },
  // Con truco (tricks.ts)
  dodger: { hp: 0.75, speed: 1.45, bounty: 8, leak: 1 },
  // Planeador: va recto a la base (recorrido mucho más corto), así que va despacio
  soarer: { hp: 1, speed: 0.55, bounty: 10, leak: 1 },
  saboteur: { hp: 1.3, speed: 0.8, bounty: 13, leak: 1 },
  splitter: { hp: 1.3, speed: 0.85, bounty: 9, leak: 2 },
  adapter: { hp: 1.4, speed: 0.9, bounty: 12, leak: 1 },
  brood: { hp: 0.3, speed: 1.45, bounty: 2, leak: 1 },
  // Jefe de oleada (cada 5): mucha vida y sus habilidades (chiefs.ts)
  chief: { hp: 13, speed: 0.5, bounty: 0, leak: 5 },
  boss: { hp: 34, speed: 0.42, bounty: 160, leak: 10 },
};

/** Velocidad de un salvaje normal (casillas por segundo). */
export const BASE_SPEED = 1.35;

/** PS de un salvaje normal en esa oleada con esa dificultad. Pasada la 12 (solo infinito) crece un 12 % por oleada. */
export function baseHp(wave: number, power: number): number {
  const w = Math.max(1, wave);
  const e = Math.min(w, 12) - 1;
  const early = 22 * (1 + 0.16 * e + 0.01 * e * e);
  const late = w > 12 ? Math.pow(1.12, w - 12) : 1;
  return Math.round(early * late * (1 + 0.21 * power));
}

export interface EnemyDef {
  kind: EnemyKind;
  species: number;
  types: readonly string[];
  maxHp: number;
  shield: number;
  speed: number;
  bounty: number;
  leak: number;
  air: boolean;
  /** Adaptable: tipo que resiste (lo pone el motor al aparecer). */
  resist?: string | null;
}

export function enemyDef(kind: EnemyKind, species: number, wave: number, power: number): EnemyDef {
  const k = KIND_STATS[kind];
  const hp = Math.round(baseHp(wave, power) * k.hp);
  return {
    kind,
    species,
    types: tdTypesOf(species),
    maxHp: hp,
    // Escudados: barra extra como en el juego normal (enemies.ts)
    shield: kind === 'shielded' ? shieldPoolFor(hp) : kind === 'boss' ? Math.round(hp * 0.25) : 0,
    speed: BASE_SPEED * k.speed * (1 + Math.min(0.3, 0.01 * wave + 0.012 * power)),
    bounty: Math.round(k.bounty * (1 + 0.03 * (wave - 1))),
    leak: k.leak,
    air: kind === 'flying' || kind === 'soarer',
  };
}

export interface Spawn {
  /** Segundos desde el comienzo de la oleada. */
  at: number;
  kind: EnemyKind;
  species: number;
  /** Por qué entrada sale. */
  path: number;
  /** Multiplicador de vida (oleada doble, contra-tipo). */
  hpMul?: number;
  /** Contra-tipo del nivel temático (resiste el tipo tema). */
  contra?: boolean;
  /** Pokémon oscuro (darkMon.ts): sale con ojos rojos, más vida y velocidad. */
  dark?: boolean;
}

/** Desde qué «rango» aparece cada papel (rango = 3 por mapa + nivel + oleada/3): los mapas difíciles los traen antes. */
const FIRST_RANK: Record<Exclude<EnemyKind, 'normal' | 'boss' | 'chief' | 'brood'>, number> = {
  fast: 2, flying: 3.3, tank: 5, shielded: 7, healer: 10, hastener: 14,
  dodger: 3.5, soarer: 5.5, splitter: 7.5, saboteur: 9, adapter: 11,
};

export const stageRank = (s: Stage, wave: number): number => s.tier * 3 + refLevel(s) + wave / 3;

export const kindUnlocked = (kind: EnemyKind, s: Stage, wave: number): boolean =>
  kind === 'normal' || kind === 'boss' || kind === 'chief' || kind === 'brood' || stageRank(s, wave) >= FIRST_RANK[kind];

/** Especies de un papel en un bioma (las crías salen de los divisores). */
export const foeList = (foes: MapFoes, kind: EnemyKind): readonly number[] =>
  (foes as unknown as Record<string, readonly number[]>)[kind === 'brood' ? 'splitter' : kind] ?? foes.normal;

/** Composición de una oleada: lista ordenada de apariciones. Siempre la misma para un mapa, nivel y oleada. */
export function waveSpawns(map: TdMap, level: number, wave: number): Spawn[] {
  const foes = MAP_FOES[map.biome] ?? MAP_FOES.bosque;
  const stage: Stage = { tier: map.tier, level, levels: map.levels };
  const w = Math.max(1, Math.floor(wave));
  const out: Spawn[] = [];
  const nPaths = map.paths.length;
  let t = 0;
  let seq = 0;
  // Nivel temático (themes.ts): cada hueco se sortea (tirada fija con la semilla del nivel): el tipo tema es lo más
  // probable, pero salen también del bioma y de otros tipos; en las oleadas altas, contra-tipos que lo resisten
  const typeTheme = levelTheme(map, level);
  const seed = levelSeed(map.id, level);
  const ctx = themeCtx(typeTheme, seed);
  const total = isEndless(stage) ? Infinity : wavesInLevel(stage.level, stage.levels);
  const add = (kind: EnemyKind, gap: number, slot = seq, hpMul = 1) => {
    const species =
      kind === 'boss'
        ? bossSpecies(map, level, w)
        : kind === 'chief'
          ? minibossFor(typeTheme, seed, w)
          : themeSpecies(ctx, kind, slot, w, total, seq) ?? foeList(foes, kind)[seq % foeList(foes, kind).length];
    const contra = kind !== 'boss' && kind !== 'chief' && foeSource(slot, w, total, kind, seed) === 'contra';
    const mul = hpMul * (contra ? CONTRA_HP : 1);
    out.push({ at: Math.round(t * 100) / 100, kind, species, path: seq % nPaths, ...(mul !== 1 ? { hpMul: mul } : {}), ...(contra ? { contra: true } : {}) });
    seq++;
    t += gap;
  };
  const lvl = Math.round(refLevel(stage));
  const count = Math.min(46, 5 + w + Math.floor(lvl / 3) + Math.floor(map.tier / 2) + (w > 12 ? Math.floor((w - 12) / 2) : 0));
  const gap = Math.max(0.35, 1.05 - w * 0.03 - map.tier * 0.015);
  const special: EnemyKind[] = (['fast', 'flying', 'tank', 'shielded', 'healer', 'hastener', ...TRICK_KINDS] as const).filter((k) => kindUnlocked(k, stage, w));
  const theme = waveThemeOf(map, level, w);
  for (let i = 0; i < count; i++) {
    let kind: EnemyKind = 'normal';
    if (special.length && i % 3 === 2) kind = special[(i + w) % special.length];
    // Oleadas temáticas: rápidos en grupo o voladores en bandada
    if (w % 5 === 3 && kindUnlocked('fast', stage, w) && i % 2 === 0) kind = 'fast';
    if (w % 4 === 2 && kindUnlocked('flying', stage, w) && i % 2 === 1) kind = 'flying';
    // Truco protagonista de la oleada: uno de cada cuatro (mezclado con lo demás)
    if (theme && i % 4 === 1) kind = theme;
    add(kind, kind === 'tank' ? gap * 1.6 : kind === 'fast' || kind === 'dodger' ? gap * 0.6 : gap, i);
  }
  if (isBossWave(stage, w)) {
    t += 2;
    const final = isFinalBoss(stage, w) || isEndless(stage);
    add('boss', 1.5, seq, levelBossHp(stage));
    // El jefe final trae 4 escoltas; el de un nivel cualquiera, 2
    for (let i = 0; i < (final ? 4 : 2); i++) add(i % 2 ? 'healer' : 'shielded', gap);
  } else if (isChiefWave(stage, w)) {
    t += 1.5;
    add('chief', 1.2);
    for (let i = 0; i < 2; i++) add(kindUnlocked('shielded', stage, w) ? 'shielded' : 'normal', gap);
  }
  markDarks(out, map, stage, w, typeTheme);
  return out;
}

/**
 * Jefe legendario de una oleada: en el infinito, los dos del bioma alternos; en el último nivel, el del mapa
 * (MAP_FINAL_BOSS o el del bioma); en los demás, un legendario o singular del tipo tema (themes.ts).
 */
export function bossSpecies(map: TdMap, level: number, wave: number): number {
  const foes = MAP_FOES[map.biome] ?? MAP_FOES.bosque;
  const stage: Stage = { tier: map.tier, level, levels: map.levels };
  if (isEndless(stage)) return foes.bosses[Math.floor(wave / BOSS_EVERY) % 2 === 1 ? 0 : 1];
  const final = MAP_FINAL_BOSS[map.id] ?? foes.bosses[1];
  if (stage.level >= stage.levels) return final;
  return levelBossFor(map, level, final);
}

// --- Pokémon oscuros (darkMon.ts): ojos rojos, más vida y velocidad ---

/**
 * Probabilidad de que un enemigo salga oscuro. Nada en la primera mitad del nivel (ni antes de la oleada 4; en el
 * infinito, antes de la 5); luego sube con la oleada y con la dificultad del mapa. Minijefes y jefes, algo más. En
 * los niveles de tipo Siniestro, ×1,5 (es su fase).
 */
export const TD_DARK = { minStart: 4, startFrac: 0.5, enemy: [0.03, 0.08, 0.04], miniboss: [0.12, 0.1, 0.1], boss: [0.08, 0.06, 0.14], darkTheme: 1.5, max: 0.35 } as const;

export function darkChance(s: Stage, wave: number, who: 'enemy' | 'miniboss' | 'boss', theme = ''): number {
  const total = isEndless(s) ? Infinity : wavesInLevel(s.level, s.levels);
  const start = Number.isFinite(total) ? Math.max(TD_DARK.minStart, Math.ceil(total * TD_DARK.startFrac)) : 5;
  if (wave < start) return 0;
  const p = Number.isFinite(total) ? (wave - start) / Math.max(1, total - start) : Math.min(1, (wave - start) / 15);
  const hard = ((refLevel(s) - 1) / (REF_LEVELS - 1)) * 0.6 + Math.min(1, s.tier / 17) * 0.4;
  const [base, perWave, perHard] = TD_DARK[who];
  const c = base + perWave * p + perHard * hard;
  return Math.min(TD_DARK.max, c * (theme === 'dark' ? TD_DARK.darkTheme : 1));
}

/** Máximo de enemigos normales oscuros por oleada: 1, y más en los mapas y niveles difíciles (hasta 4). */
export const darkWaveCap = (s: Stage): number => Math.min(4, 1 + Math.floor((s.tier * 3 + refLevel(s)) / 16));

/** Marca qué apariciones salen oscuras (tirada fija con la semilla del nivel). Las crías nunca. */
function markDarks(out: Spawn[], map: TdMap, s: Stage, wave: number, theme: string) {
  const cap = darkWaveCap(s);
  let n = 0;
  out.forEach((sp, i) => {
    if (sp.kind === 'brood') return;
    const who = sp.kind === 'boss' ? 'boss' : sp.kind === 'chief' ? 'miniboss' : 'enemy';
    if (who === 'enemy' && n >= cap) return;
    if (unitRoll(`${levelSeed(map.id, s.level)}|${wave}|${i}|oscuro`) < darkChance(s, wave, who, theme)) {
      sp.dark = true;
      if (who === 'enemy') n++;
    }
  });
}

/** Truco protagonista de una oleada (o null). */
export function waveThemeOf(map: TdMap, level: number, wave: number) {
  const stage: Stage = { tier: map.tier, level, levels: map.levels };
  if (isBossWave(stage, wave)) return null;
  return waveTheme(map.id, level, wave, TRICK_KINDS.filter((k) => kindUnlocked(k, stage, wave)));
}

/** Segundos de preparación antes de cada oleada (si no la llamas antes). */
export const prepTime = (wave: number): number => (wave <= 1 ? 25 : 12);

/** Dinero por oleada superada (el doble de extra si no se escapa nadie). */
export function waveBonus(wave: number, perfect: boolean): number {
  const base = 25 + 6 * Math.min(wave, 40);
  return perfect ? Math.round(base * 1.5) : base;
}

/** Dinero por llamar antes la oleada: 1 por cada segundo que queda. */
export const earlyCallBonus = (secondsLeft: number): number => Math.max(0, Math.floor(secondsLeft));

/** Todas las especies que salen en un nivel (para cargar sus sprites antes de empezar). El infinito, sus 40 primeras oleadas. */
export function levelSpeciesIds(map: TdMap, level: number): number[] {
  const stage: Stage = { tier: map.tier, level, levels: map.levels };
  const n = isEndless(stage) ? 40 : wavesInLevel(level, map.levels);
  const ids = new Set<number>();
  for (let w = 1; w <= n; w++) for (const s of waveSpawns(map, level, w)) ids.add(s.species);
  return [...ids];
}
