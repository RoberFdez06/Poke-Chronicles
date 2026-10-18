// Ataques de los jefes (con aviso previo) y su segunda fase, y la mezcla de enemigos de cada sala.
// Lógica pura, sin Phaser ni red, para poder testearla.
import type { EnemyBehavior } from './enemies.ts';

/** Ráfaga en círculo, embestida en línea recta y lluvia de proyectiles sobre el suelo. */
export type BossAttack = 'ring' | 'charge' | 'rain';

export const BOSS_ATTACK_LABEL: Record<BossAttack, string> = {
  ring: 'Ráfaga',
  charge: 'Embestida',
  rain: 'Lluvia',
};

/** Tipos "de cuerpo a cuerpo": su jefe embiste; los demás hacen llover proyectiles. Dragón hace las tres. */
const PHYSICAL = new Set(['fighting', 'rock', 'ground', 'steel', 'normal', 'dark', 'bug']);

/** Al menos dos ataques por jefe: siempre la ráfaga, y embestida o lluvia según su tipo. */
export function bossAttacks(types: readonly string[]): BossAttack[] {
  if (types.includes('dragon')) return ['ring', 'charge', 'rain'];
  return ['ring', types.some((t) => PHYSICAL.has(t)) ? 'charge' : 'rain'];
}

/** Por debajo de este porcentaje de vida, el jefe pasa a la fase 2 (más rápido y agresivo). */
export const BOSS_PHASE2_AT = 0.5;
export const bossPhase = (hpRatio: number): 1 | 2 => (hpRatio < BOSS_PHASE2_AT ? 2 : 1);

/** Aviso antes de cada ataque (ms): lo justo para verlo venir y esquivarlo. */
export const TELEGRAPH_MS = 750;
/** Tiempo entre ataques y cosas que cambian en la fase 2. */
export const attackInterval = (phase: 1 | 2): number => (phase === 2 ? 2100 : 3300);
export const ringCount = (phase: 1 | 2): number => (phase === 2 ? 16 : 10);
export const rainCount = (phase: 1 | 2): number => (phase === 2 ? 6 : 4);
export const PHASE2_SPEED = 1.3;

/** Siguiente ataque al azar, sin repetir el último si hay otros. */
export function pickAttack(attacks: readonly BossAttack[], rng: () => number, last?: BossAttack): BossAttack {
  const options = attacks.length > 1 ? attacks.filter((a) => a !== last) : attacks;
  return options[Math.floor(rng() * options.length)];
}

/**
 * En cada sala, al menos uno de cada tres enemigos dispara (sea del tipo que sea), para que siempre haya
 * proyectiles que esquivar. Convierte a los primeros que no disparan.
 */
export function mixBehaviors(list: readonly EnemyBehavior[]): EnemyBehavior[] {
  const out = [...list];
  const need = Math.ceil(out.length / 3);
  let have = out.filter((b) => b === 'shoot').length;
  for (let i = 0; i < out.length && have < need; i++) {
    if (out[i] !== 'shoot') {
      out[i] = 'shoot';
      have++;
    }
  }
  return out;
}
