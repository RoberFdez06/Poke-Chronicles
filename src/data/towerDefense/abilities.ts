// Defensa de torres: habilidades activas del jugador, con enfriamiento largo. Lógica pura, sin Phaser.
// Tormenta, Bomba y Refuerzo se lanzan sobre una zona (el cursor del mapa); la Congelación es global.

export const ABILITIES = ['rayo', 'ventisca', 'bomba', 'refuerzo'] as const;
export type AbilityId = (typeof ABILITIES)[number];

export interface AbilityInfo {
  name: string;
  desc: string;
  /** Enfriamiento en segundos de juego. */
  cooldown: number;
  color: number;
  /** Radio de la zona (en casillas) o 0 si es global. */
  radius: number;
}

export const ABILITY_INFO: Readonly<Record<AbilityId, AbilityInfo>> = {
  rayo: { name: 'Tormenta', desc: 'Rayos sobre todos los enemigos de la zona (también voladores).', cooldown: 50, color: 0xffd34d, radius: 2.4 },
  ventisca: { name: 'Congelación', desc: 'Congela a todos los enemigos 4 s (a los jefes, 1,5 s).', cooldown: 75, color: 0x8fe0ff, radius: 0 },
  bomba: { name: 'Bomba', desc: 'Explosión fuerte en una zona pequeña.', cooldown: 45, color: 0xff7a3a, radius: 1.5 },
  refuerzo: { name: 'Refuerzo', desc: 'Las torres de la zona: +50 % de daño y +30 % de cadencia 10 s; quita el aturdimiento.', cooldown: 60, color: 0x7cf07a, radius: 2.2 },
};

/** Se apunta con el cursor (si no, es global). */
export const isZoneAbility = (id: AbilityId): boolean => ABILITY_INFO[id].radius > 0;

/** Daño de la Tormenta: crece con la oleada para que siga sirviendo. */
export const lightningDamage = (wave: number): number => Math.round(60 + 22 * Math.max(1, wave));
/** Sin zona (el bot de pruebas): los más fuertes del mapa. */
export const LIGHTNING_TARGETS = 6;
/** Como mucho, enemigos alcanzados por la Tormenta en su zona. */
export const STORM_MAX = 10;
export const bombDamage = (wave: number): number => Math.round(110 + 34 * Math.max(1, wave));
export const FREEZE_TIME = 4;
export const FREEZE_BOSS_TIME = 1.5;
export const BOOST_TIME = 10;
export const BOOST_DAMAGE = 1.5;
export const BOOST_RATE = 1.3;

export type Cooldowns = Record<AbilityId, number>;
/** Todas listas al empezar. */
export const freshCooldowns = (): Cooldowns => ({ rayo: 0, ventisca: 0, bomba: 0, refuerzo: 0 });
export const tickCooldowns = (cd: Cooldowns, dt: number): Cooldowns => ({
  rayo: Math.max(0, cd.rayo - dt),
  ventisca: Math.max(0, cd.ventisca - dt),
  bomba: Math.max(0, cd.bomba - dt),
  refuerzo: Math.max(0, cd.refuerzo - dt),
});
export const cooldownLeft = (cd: Cooldowns, id: AbilityId): number => cd[id];
export const abilityReady = (cd: Cooldowns, id: AbilityId): boolean => cd[id] <= 0;

/** Punto con más cosas alrededor (para apuntar sin cursor: el bot, y los jefes al aturdir torres). */
export function densestPoint(pts: readonly { x: number; y: number }[], radius: number): { x: number; y: number; n: number } | null {
  let best: { x: number; y: number; n: number } | null = null;
  for (const p of pts) {
    const n = pts.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) <= radius).length;
    if (!best || n > best.n) best = { x: p.x, y: p.y, n };
  }
  return best;
}
