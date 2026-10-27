// Defensa de torres: habilidades activas del jugador, con enfriamiento largo. Lógica pura, sin Phaser.

export const ABILITIES = ['rayo', 'ventisca', 'curar'] as const;
export type AbilityId = (typeof ABILITIES)[number];

export interface AbilityInfo {
  name: string;
  desc: string;
  /** Enfriamiento en segundos de juego. */
  cooldown: number;
  /** Tecla rápida (1, 2, 3). */
  key: string;
  color: number;
}

export const ABILITY_INFO: Readonly<Record<AbilityId, AbilityInfo>> = {
  rayo: { name: 'Rayo', desc: 'Un trueno golpea a los 6 enemigos más fuertes (también voladores).', cooldown: 50, key: '1', color: 0xffd34d },
  ventisca: { name: 'Ventisca', desc: 'Congela a todos los enemigos 4 s (a los jefes, 1,5 s).', cooldown: 75, key: '2', color: 0x8fe0ff },
  curar: { name: 'Curar base', desc: 'Recupera el 25 % de la vida de la base.', cooldown: 90, key: '3', color: 0x7cf07a },
};

/** Daño del Rayo: crece con la oleada para que siga sirviendo. */
export const lightningDamage = (wave: number): number => Math.round(60 + 22 * Math.max(1, wave));
export const LIGHTNING_TARGETS = 6;
export const FREEZE_TIME = 4;
export const FREEZE_BOSS_TIME = 1.5;
export const HEAL_PART = 0.25;

export type Cooldowns = Record<AbilityId, number>;
/** Todas listas al empezar. */
export const freshCooldowns = (): Cooldowns => ({ rayo: 0, ventisca: 0, curar: 0 });
export const tickCooldowns = (cd: Cooldowns, dt: number): Cooldowns => ({
  rayo: Math.max(0, cd.rayo - dt),
  ventisca: Math.max(0, cd.ventisca - dt),
  curar: Math.max(0, cd.curar - dt),
});
export const cooldownLeft = (cd: Cooldowns, id: AbilityId): number => cd[id];
export const abilityReady = (cd: Cooldowns, id: AbilityId): boolean => cd[id] <= 0;
