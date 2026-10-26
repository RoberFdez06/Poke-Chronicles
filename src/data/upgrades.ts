// Mejoras permanentes por Pokémon (como en PokéSurvivor): daño, PS, velocidad y cadencia. Se compran con
// caramelos y solo se aplican jugando con ese Pokémon. Lógica pura; el guardado está en save.ts.
import type { PlayerStats } from './items.ts';

// T71: las 7 mejoras de siempre más los nodos nuevos del árbol (upgradeTree.ts). Las antiguas conservan su id para que
// el guardado viejo se lea tal cual: cada mejora comprada pasa a ser un nodo sin perder niveles ni caramelos.
export const UPGRADE_KINDS = [
  'damage', 'hp', 'speed', 'rate', 'range', 'crit', 'armor',
  'critPower', 'regen', 'bulwark', 'magnet', 'coins', 'fortune', 'dodge',
] as const;
export type UpgradeKind = (typeof UPGRADE_KINDS)[number];

export const UPGRADE_LABEL: Record<UpgradeKind, string> = {
  damage: 'Daño',
  hp: 'PS',
  speed: 'Velocidad',
  rate: 'Cadencia',
  range: 'Alcance',
  crit: 'Crítico',
  armor: 'Defensa',
  critPower: 'Golpe certero',
  regen: 'Respiro',
  bulwark: 'Baluarte',
  magnet: 'Imán',
  coins: 'Bolsa',
  fortune: 'Fortuna',
  dodge: 'Reflejos',
};

/** Lo que da cada nivel, para mostrarlo en la pantalla de Mejoras. */
export const UPGRADE_DESC: Record<UpgradeKind, string> = {
  damage: '+8 % de daño por nivel',
  hp: '+10 PS máximos por nivel',
  speed: '+4 % de velocidad por nivel',
  rate: 'Disparas un 6 % más rápido por nivel',
  range: 'Tus disparos llegan un 6 % más lejos por nivel',
  crit: '+2 % de probabilidad de golpe crítico por nivel',
  armor: 'Recibes un 3 % menos de daño por nivel',
  critPower: 'Los críticos hacen +25 % de daño por nivel',
  regen: 'Recuperas 1 PS al limpiar una sala por nivel',
  bulwark: 'Un escudo que para 1 golpe en cada sala',
  magnet: 'El botín vuela hacia ti desde 20 px más lejos por nivel',
  coins: '+5 % de monedas por nivel',
  fortune: '+25 % de monedas',
  dodge: '+3 % de probabilidad de esquivar por nivel',
};

export const MAX_UPGRADE_LEVEL = 5;

/** Niveles máximos de cada nodo (los nodos finales tienen pocos niveles pero caros). */
export const UPGRADE_MAX: Record<UpgradeKind, number> = {
  damage: 5, hp: 5, speed: 5, rate: 5, range: 5, crit: 5, armor: 5,
  critPower: 3, regen: 3, bulwark: 1, magnet: 5, coins: 5, fortune: 1, dodge: 3,
};

/** Coste fijo por nivel de los nodos nuevos; los 7 de siempre siguen con `15 × (nivel + 1)`. */
const NODE_COSTS: Partial<Record<UpgradeKind, readonly number[]>> = {
  critPower: [80, 160, 240],
  regen: [60, 120, 180],
  bulwark: [400],
  magnet: [10, 20, 30, 40, 50],
  coins: [20, 40, 60, 80, 100],
  fortune: [400],
  dodge: [80, 160, 240],
};

/** Niveles de las mejoras de un Pokémon (0 = sin mejorar). */
export type UpgradeLevels = Record<UpgradeKind, number>;

export const noUpgrades = (): UpgradeLevels =>
  Object.fromEntries(UPGRADE_KINDS.map((k) => [k, 0])) as UpgradeLevels;

/** Caramelos que cuesta subir del nivel `level` al siguiente (null si ya está al máximo). */
export function upgradeCost(level: number, kind: UpgradeKind = 'damage'): number | null {
  const lv = Math.max(0, Math.floor(level));
  if (lv >= UPGRADE_MAX[kind]) return null;
  const table = NODE_COSTS[kind];
  return table ? table[lv] : 15 * (lv + 1);
}

/** Estadísticas del Pokémon con sus mejoras encima (antes de los objetos pasivos de la partida). */
export function applyUpgrades(base: Readonly<PlayerStats>, lv: Readonly<UpgradeLevels>): PlayerStats {
  return {
    ...base,
    damage: base.damage * (1 + 0.08 * lv.damage),
    maxHp: base.maxHp + 10 * lv.hp,
    speed: base.speed * (1 + 0.04 * lv.speed),
    fireDelay: base.fireDelay * Math.pow(0.94, lv.rate),
    range: base.range * Math.pow(1.06, lv.range),
    critChance: Math.min(1, base.critChance + 0.02 * lv.crit),
    damageTaken: base.damageTaken * Math.pow(0.97, lv.armor),
    // Nodos del árbol (T71); `?? 0` por si llega un objeto de niveles antiguo sin estas claves
    critMul: base.critMul + 0.25 * (lv.critPower ?? 0),
    healOnClear: base.healOnClear + (lv.regen ?? 0),
    shieldPerRoom: base.shieldPerRoom + (lv.bulwark ?? 0),
    lootMagnet: base.lootMagnet + 20 * (lv.magnet ?? 0),
    coinMul: base.coinMul * (1 + 0.05 * (lv.coins ?? 0)) * (1 + 0.25 * (lv.fortune ?? 0)),
    dodge: Math.min(0.75, base.dodge + 0.03 * (lv.dodge ?? 0)),
  };
}

/** Todas las mejoras guardadas: por id de Pokémon. */
export type UpgradeBook = Record<number, UpgradeLevels>;

const level = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isInteger(v) ? Math.min(max, Math.max(0, v)) : 0;

export function parseUpgrades(raw: string | null): UpgradeBook {
  const out: UpgradeBook = {};
  if (!raw) return out;
  try {
    const d: unknown = JSON.parse(raw);
    if (!d || typeof d !== 'object' || Array.isArray(d)) return out;
    for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
      const id = Number(k);
      if (!Number.isInteger(id) || id <= 0 || !v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      // Guardado viejo (solo las 7 mejoras) o nuevo: las claves que falten quedan a 0. Esta es la migración al árbol.
      out[id] = Object.fromEntries(UPGRADE_KINDS.map((k) => [k, level(o[k], UPGRADE_MAX[k])])) as UpgradeLevels;
    }
  } catch {
    // corrupto: sin mejoras
  }
  return out;
}

export const levelsFor = (book: UpgradeBook, id: number): UpgradeLevels => ({ ...noUpgrades(), ...book[id] });
