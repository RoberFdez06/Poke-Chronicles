// Defensa de torres: cada mapa tiene de 10 a 15 niveles (TdMap.levels, crecen con el mapa) (partidas cortas con oleadas fijas) y el último trae un
// jefe legendario. En el modo infinito las oleadas siguen creciendo (jefe cada 10) hasta que caes. Estadísticas de
// los enemigos por papel. Lógica pura, sin Phaser.
import { shieldPoolFor } from '../enemies.ts';
import type { TdMap } from './maps.ts';
import { MAP_FOES, tdTypesOf, type EnemyKind } from './species.ts';

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

export function isBossWave(s: Stage, wave: number): boolean {
  if (isEndless(s)) return wave > 0 && wave % BOSS_EVERY === 0;
  return s.level >= s.levels && wave === wavesInLevel(s.level, s.levels);
}

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
    air: kind === 'flying',
  };
}

export interface Spawn {
  /** Segundos desde el comienzo de la oleada. */
  at: number;
  kind: EnemyKind;
  species: number;
  /** Por qué entrada sale. */
  path: number;
}

/** Desde qué «rango» aparece cada papel (rango = 3 por mapa + nivel + oleada/3): los mapas difíciles los traen antes. */
const FIRST_RANK: Record<Exclude<EnemyKind, 'normal' | 'boss'>, number> = {
  fast: 2, flying: 3.3, tank: 5, shielded: 7, healer: 10, hastener: 14,
};

export const stageRank = (s: Stage, wave: number): number => s.tier * 3 + refLevel(s) + wave / 3;

export const kindUnlocked = (kind: EnemyKind, s: Stage, wave: number): boolean =>
  kind === 'normal' || kind === 'boss' || stageRank(s, wave) >= FIRST_RANK[kind];

/** Composición de una oleada: lista ordenada de apariciones. Siempre la misma para un mapa, nivel y oleada. */
export function waveSpawns(map: TdMap, level: number, wave: number): Spawn[] {
  const foes = MAP_FOES[map.biome] ?? MAP_FOES.bosque;
  const stage: Stage = { tier: map.tier, level, levels: map.levels };
  const w = Math.max(1, Math.floor(wave));
  const out: Spawn[] = [];
  const nPaths = map.paths.length;
  let t = 0;
  let seq = 0;
  const add = (kind: EnemyKind, gap: number) => {
    const pool = kind === 'boss' ? [] : foes[kind];
    const species = kind === 'boss' ? foes.bosses[isEndless(stage) && Math.floor(w / BOSS_EVERY) % 2 === 1 ? 0 : 1] : pool[seq % pool.length];
    out.push({ at: Math.round(t * 100) / 100, kind, species, path: seq % nPaths });
    seq++;
    t += gap;
  };
  const lvl = Math.round(refLevel(stage));
  const count = Math.min(46, 5 + w + Math.floor(lvl / 3) + Math.floor(map.tier / 2) + (w > 12 ? Math.floor((w - 12) / 2) : 0));
  const gap = Math.max(0.35, 1.05 - w * 0.03 - map.tier * 0.015);
  const special: EnemyKind[] = (['fast', 'flying', 'tank', 'shielded', 'healer', 'hastener'] as const).filter((k) => kindUnlocked(k, stage, w));
  for (let i = 0; i < count; i++) {
    let kind: EnemyKind = 'normal';
    if (special.length && i % 3 === 2) kind = special[(i + w) % special.length];
    // Oleadas temáticas: rápidos en grupo o voladores en bandada
    if (w % 5 === 3 && kindUnlocked('fast', stage, w) && i % 2 === 0) kind = 'fast';
    if (w % 4 === 2 && kindUnlocked('flying', stage, w) && i % 2 === 1) kind = 'flying';
    add(kind, kind === 'tank' ? gap * 1.6 : kind === 'fast' ? gap * 0.6 : gap);
  }
  if (isBossWave(stage, w)) {
    t += 2;
    add('boss', 1.5);
    for (let i = 0; i < 4; i++) add(i % 2 ? 'healer' : 'shielded', gap);
  }
  return out;
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
