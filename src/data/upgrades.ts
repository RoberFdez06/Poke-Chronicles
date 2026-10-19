// Mejoras permanentes por Pokémon (como en PokéSurvivor): daño, PS, velocidad y cadencia. Se compran con
// caramelos y solo se aplican jugando con ese Pokémon. Lógica pura; el guardado está en save.ts.
import type { PlayerStats } from './items.ts';

export const UPGRADE_KINDS = ['damage', 'hp', 'speed', 'rate'] as const;
export type UpgradeKind = (typeof UPGRADE_KINDS)[number];

export const UPGRADE_LABEL: Record<UpgradeKind, string> = {
  damage: 'Daño',
  hp: 'PS',
  speed: 'Velocidad',
  rate: 'Cadencia',
};

/** Lo que da cada nivel, para mostrarlo en la pantalla de Mejoras. */
export const UPGRADE_DESC: Record<UpgradeKind, string> = {
  damage: '+8 % de daño por nivel',
  hp: '+10 PS máximos por nivel',
  speed: '+4 % de velocidad por nivel',
  rate: 'Disparas un 6 % más rápido por nivel',
};

export const MAX_UPGRADE_LEVEL = 5;

/** Niveles de las 4 mejoras de un Pokémon (0 = sin mejorar). */
export type UpgradeLevels = Record<UpgradeKind, number>;

export const noUpgrades = (): UpgradeLevels => ({ damage: 0, hp: 0, speed: 0, rate: 0 });

/** Caramelos que cuesta subir del nivel `level` al siguiente (null si ya está al máximo). */
export function upgradeCost(level: number): number | null {
  if (level >= MAX_UPGRADE_LEVEL) return null;
  return 15 * (Math.max(0, Math.floor(level)) + 1);
}

/** Estadísticas del Pokémon con sus mejoras encima (antes de los objetos pasivos de la partida). */
export function applyUpgrades(base: Readonly<PlayerStats>, lv: Readonly<UpgradeLevels>): PlayerStats {
  return {
    ...base,
    damage: base.damage * (1 + 0.08 * lv.damage),
    maxHp: base.maxHp + 10 * lv.hp,
    speed: base.speed * (1 + 0.04 * lv.speed),
    fireDelay: base.fireDelay * Math.pow(0.94, lv.rate),
  };
}

/** Todas las mejoras guardadas: por id de Pokémon. */
export type UpgradeBook = Record<number, UpgradeLevels>;

const level = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) ? Math.min(MAX_UPGRADE_LEVEL, Math.max(0, v)) : 0;

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
      out[id] = { damage: level(o.damage), hp: level(o.hp), speed: level(o.speed), rate: level(o.rate) };
    }
  } catch {
    // corrupto: sin mejoras
  }
  return out;
}

export const levelsFor = (book: UpgradeBook, id: number): UpgradeLevels => ({ ...noUpgrades(), ...book[id] });
