// Arceus (pedido de Roberto, 02/11): «el dios de la creación» se adapta a ti. Cambia de tipo (como con Multitipo y
// las tablas) al que peor le sientan tus ataques, usa patrones de jefe de los 18 tipos según el tipo que lleve y solo
// invoca legendarios, singulares y ultraentes. En el piso 100 de la Torre sale en su versión «Arceus Supremo» (mucha
// más vida y daño, 4 fases); en el reto final de Normal sale con dos legendarios típicos de alguna región.
// Lógica pura, sin Phaser, con tests (tests/arceus.test.ts).
import { damageMul } from './typeChart.ts';
import { bossAttacksFor, type BossAttack } from './bossPatterns.ts';
import { blitzAttacksFor } from './bossBlitz.ts';
import { ULTRA_IDS } from './guardians.ts';

export const ARCEUS_ID = 493;
export const isArceus = (id: number | undefined): boolean => id === ARCEUS_ID;

export const ALL_TYPES: readonly string[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

export const TYPE_ES: Readonly<Record<string, string>> = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo',
  fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
};

/** Tabla (placa) de cada tipo, para el aviso: «¡Arceus usa la Tabla Llama!». */
export const PLATE_ES: Readonly<Record<string, string>> = {
  normal: 'Tabla Neutra', fire: 'Tabla Llama', water: 'Tabla Linfa', electric: 'Tabla Trueno', grass: 'Tabla Pradal',
  ice: 'Tabla Helada', fighting: 'Tabla Fuerte', poison: 'Tabla Tóxica', ground: 'Tabla Terrax', flying: 'Tabla Cielo',
  psychic: 'Tabla Mental', bug: 'Tabla Bicho', rock: 'Tabla Pétrea', ghost: 'Tabla Terror', dragon: 'Tabla Draco',
  dark: 'Tabla Oscura', steel: 'Tabla Acero', fairy: 'Tabla Duende',
};

/** Historial de tipos de ataque del jugador: tipo → daño hecho (o golpes). */
export type AttackHistory = Readonly<Record<string, number>>;

/** Suma `amount` al tipo en un historial nuevo (sin tocar el original). Ignora tipos desconocidos. */
export function recordAttack(h: AttackHistory, type: string | undefined, amount = 1): Record<string, number> {
  const out = { ...h };
  if (type && ALL_TYPES.includes(type) && amount > 0) out[type] = (out[type] ?? 0) + amount;
  return out;
}

/** Tipo de ataque dominante (el que más has usado); undefined si aún no hay nada. */
export function dominantAttackType(h: AttackHistory): string | undefined {
  let best: string | undefined;
  let bv = 0;
  for (const t of ALL_TYPES) if ((h[t] ?? 0) > bv) (best = t), (bv = h[t]);
  return best;
}

/** Multiplicador medio que recibiría Arceus con el tipo `def`, ponderado por el historial (1 si está vacío). */
export function adaptScore(h: AttackHistory, def: string): number {
  let sum = 0;
  let w = 0;
  for (const t of ALL_TYPES) {
    const v = h[t] ?? 0;
    if (v <= 0) continue;
    sum += v * damageMul(t, [def]);
    w += v;
  }
  return w > 0 ? sum / w : 1;
}

/**
 * Tipo al que cambia Arceus: el que menos daño medio recibe de tus ataques (resistencia o inmunidad a tu tipo
 * dominante). Si hay empate, prefiere no quedarse en el actual (para que se note el cambio) y elige con `rng`.
 * Sin historial, un tipo al azar distinto del actual.
 */
export function adaptType(h: AttackHistory, current: string | undefined, rng: () => number): string {
  const scores = ALL_TYPES.map((t) => ({ t, s: adaptScore(h, t) }));
  const min = Math.min(...scores.map((x) => x.s));
  let best = scores.filter((x) => x.s <= min + 1e-9).map((x) => x.t);
  if (best.length > 1 && current) best = best.filter((t) => t !== current);
  return best[Math.min(best.length - 1, Math.floor(rng() * best.length))];
}

/** Cada cuánto se adapta (ms): el Supremo, más a menudo; y en cada cambio de fase siempre. */
export const adaptEveryMs = (supreme: boolean): number => (supreme ? 7000 : 10000);
/** Aviso visual antes del cambio (destello del color nuevo); no ataca mientras tanto. */
export const ADAPT_WARN_MS = 650;

/** Ataques de jefe para el tipo actual (patrones de su tipo + los del bioma + ráfagas + frenesí + invocación). */
export function arceusAttacks(type: string, biomeTypes: readonly string[], supreme: boolean): BossAttack[] {
  const list: BossAttack[] = [...bossAttacksFor([type], biomeTypes), ...blitzAttacksFor([type]), 'summon'];
  if (supreme) list.push('cascade', 'feintCombo');
  return [...new Set(list)];
}

/** Ayudantes que puede invocar: legendarios y singulares (lista fija, sin él mismo) y ultraentes. Nada normal. */
export const ARCEUS_LEGEND_HELPERS: readonly number[] = [
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 480, 481, 482,
  483, 484, 485, 487, 488, 491, 492, 638, 639, 640, 641, 642, 643, 644, 645, 646, 716, 717, 718, 785, 786, 787, 788,
  791, 792, 800, 888, 889, 890, 894, 895, 1001, 1002, 1003, 1004, 1007, 1008,
];
export const ARCEUS_HELPER_POOL: readonly number[] = [...new Set([...ARCEUS_LEGEND_HELPERS, ...ULTRA_IDS])].filter((id) => id !== ARCEUS_ID);

/** `n` ayudantes distintos del pool (filtrados por `ok`, p. ej. sin conexión; si no queda ninguno, el pool entero). */
export function arceusHelperIds(rng: () => number, n: number, ok: (id: number) => boolean = () => true): number[] {
  const usable = ARCEUS_HELPER_POOL.filter(ok);
  const pool = [...(usable.length ? usable : ARCEUS_HELPER_POOL)];
  const out: number[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

/** Tope de ayudantes vivos a la vez (además del MAX_HELPERS general). */
export const arceusMaxHelpers = (supreme: boolean): number => (supreme ? 4 : 3);
export const arceusCanSummon = (alive: number, supreme: boolean): number => Math.max(0, Math.min(2, arceusMaxHelpers(supreme) - alive));

/** Acompañantes del reto final de Normal: los legendarios más típicos de cada región. */
export const ARCEUS_COMPANIONS: Readonly<Record<string, readonly number[]>> = {
  kanto: [150, 144, 145, 146],
  johto: [249, 250],
  hoenn: [382, 383, 384],
  sinnoh: [483, 484, 487],
  unova: [643, 644, 646],
  kalos: [716, 717, 718],
  alola: [791, 792, 800],
  galar: [888, 889, 890],
  paldea: [1007, 1008],
};
export const COMPANION_IDS: readonly number[] = [...new Set(Object.values(ARCEUS_COMPANIONS).flat())];

/** Dos acompañantes distintos (de regiones distintas si se puede), deterministas con `rng`. */
export function pickArceusCompanions(rng: () => number, ok: (id: number) => boolean = () => true): [number, number] {
  const regions = Object.values(ARCEUS_COMPANIONS).map((ids) => ids.filter(ok)).filter((ids) => ids.length > 0);
  if (regions.length >= 2) {
    const r = [...regions];
    const a = r.splice(Math.floor(rng() * r.length), 1)[0];
    const b = r[Math.floor(rng() * r.length)];
    return [a[Math.floor(rng() * a.length)], b[Math.floor(rng() * b.length)]];
  }
  const flat = regions.flat();
  const pool = flat.length >= 2 ? flat : [...COMPANION_IDS];
  const i = Math.floor(rng() * pool.length);
  const rest = pool.filter((_, k) => k !== i);
  return [pool[i], rest[Math.floor(rng() * rest.length)]];
}

/**
 * Arceus Supremo (piso 100 de la Torre): sobre las estadísticas de jefe del piso. Vida ×6 (el gigante normal es
 * ×3,5) y daño ×1,5. Va por las 4 fases del reto final (finalePhases.ts) con una barra por fase.
 */
export const ARCEUS_SUPREME = { hpMul: 6, damageMul: 1.5, speedMul: 0.85, size: 250, bonusTickets: 250 } as const;
/** Arceus normal (cualquier otro modo, o en el trío de Normal). */
export const ARCEUS_NORMAL = { hpMul: 1.15, damageMul: 1.1 } as const;

export const arceusHp = (bossHp: number, supreme: boolean): number => Math.round(bossHp * (supreme ? ARCEUS_SUPREME.hpMul : ARCEUS_NORMAL.hpMul));
export const arceusDamage = (bossDmg: number, supreme: boolean): number => Math.round(bossDmg * (supreme ? ARCEUS_SUPREME.damageMul : ARCEUS_NORMAL.damageMul));

/**
 * Segundos estimados para vencerlo con un daño por segundo dado, contando que la adaptación le hace resistir tu tipo
 * dominante (~×0,7 de media si llevas un solo tipo; ~×0,85 si variaste).
 */
export function killSeconds(hp: number, dps: number, varied: boolean): number {
  return hp / Math.max(1e-6, dps * (varied ? 0.85 : 0.7));
}

/** Fase (1-4) por vida restante, para la barra segmentada: cada fase es un 25 %. */
export const supremePhaseBar = (ratio: number): { phase: number; inPhase: number } => {
  const r = Math.max(0, Math.min(1, ratio));
  const phase = r >= 1 ? 1 : 4 - Math.floor(r * 4);
  const inPhase = (r - (4 - phase) * 0.25) / 0.25;
  return { phase, inPhase: Math.max(0, Math.min(1, inPhase)) };
};

export const adaptText = (type: string): string => `¡Arceus usa la ${PLATE_ES[type] ?? 'Tabla'}! Ahora es de tipo ${TYPE_ES[type] ?? type}`;
