// Escudo de jefe (pedido de Roberto, 02/11: «a todos los jefes cuando le queda un 33 % de vida se le añade un escudo con
// esa vida también para que aguanten más»). Una sola vez por jefe, al bajar a ≤ 33 % de su vida máxima gana un escudo
// igual a ese 33 % (una segunda barra que se come el daño antes que la vida). Se concede después de los sucesos de vida
// pendientes por encima (la caída de arena al 34 %), así nunca se pelea con el tope de umbral. Lógica pura, con tests.
import type { Difficulty } from './difficulty.ts';
import { absorbShieldHit } from './enemies.ts';

/** Fracción de vida a la que sale el escudo, y fracción de la vida máxima que vale. */
export const BOSS_SHIELD_AT = 0.33;
export const BOSS_SHIELD_FRAC = 0.33;

/** Multiplicador del escudo según la dificultad. */
export const BOSS_SHIELD_DIFF_MUL: Record<Difficulty, number> = { easy: 0.7, normal: 1, hard: 1.3 };

/** Cantidad de escudo que gana un jefe de `maxHp` PS (al menos 1). */
export function bossShieldAmount(maxHp: number, diff: Difficulty = 'normal'): number {
  return Math.max(1, Math.round(maxHp * BOSS_SHIELD_FRAC * BOSS_SHIELD_DIFF_MUL[diff]));
}

/**
 * ¿Toca concederlo ya? Vivo, aún sin escudo de jefe, vida ≤ 33 % y ningún suceso pendiente por encima del 33 %
 * (la caída de arena del 34 % sale antes). `pending` = umbrales pendientes (bossThreshold.pendingThresholds).
 */
export function shouldGrantBossShield(hp: number, maxHp: number, granted: boolean, pending: readonly number[] = []): boolean {
  if (granted || hp <= 0 || maxHp <= 0) return false;
  if (hp / maxHp > BOSS_SHIELD_AT) return false;
  return !pending.some((t) => t > BOSS_SHIELD_AT);
}

/** Suma el escudo nuevo al que ya tuviera (p. ej. el jefe Escudado) y a su máximo para la barra. */
export function grantBossShield(shield: number | undefined, shieldMax: number | undefined, amount: number): { shield: number; shieldMax: number } {
  const s = Math.max(0, shield ?? 0);
  return { shield: s + amount, shieldMax: Math.max(shieldMax ?? 0, s) + amount };
}

/** Daño que llega a la vida tras el escudo (todo el daño a un jefe pasa por aquí primero). */
export const bossShieldAbsorb = absorbShieldHit;
