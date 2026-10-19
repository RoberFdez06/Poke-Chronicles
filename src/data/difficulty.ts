// Dificultad (T40): Fácil, Normal y Difícil al elegir modo. Cambia la vida y el daño de los enemigos (y jefes),
// lo que curan bayas, pociones y el Centro, y los tickets que se ganan. Cada dificultad tiene sus récords.
// Lógica pura, sin Phaser, para poder testearla.
import type { FloorDifficulty } from '../level/progression.ts';

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const isDifficulty = (d: unknown): d is Difficulty => typeof d === 'string' && (DIFFICULTIES as readonly string[]).includes(d);

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil' };

export interface DifficultyMods {
  /** Multiplica la vida de enemigos y jefes. */
  enemyHp: number;
  /** Multiplica el daño que hacen. */
  enemyDamage: number;
  /** Multiplica lo que curan bayas, pociones y el Centro Pokémon. */
  heal: number;
  /** Multiplica los tickets ganados. */
  tickets: number;
}

export const DIFFICULTY_MODS: Record<Difficulty, DifficultyMods> = {
  easy: { enemyHp: 0.75, enemyDamage: 0.65, heal: 1.3, tickets: 0.5 },
  normal: { enemyHp: 1, enemyDamage: 1, heal: 1, tickets: 1 },
  hard: { enemyHp: 1.3, enemyDamage: 1.35, heal: 0.8, tickets: 1.5 },
};

export const DIFFICULTY_DESC: Record<Difficulty, string> = {
  easy: 'Enemigos con menos vida y daño, y curas más grandes. Da la mitad de tickets.',
  normal: 'Como está pensado el juego.',
  hard: 'Enemigos más duros y curas más pequeñas. Da 1,5 veces los tickets.',
};

/** La dificultad del piso con los multiplicadores de vida y daño de la dificultad elegida. */
export function applyDifficulty(d: FloorDifficulty, diff: Difficulty): FloorDifficulty {
  const m = DIFFICULTY_MODS[diff];
  return { ...d, hp: d.hp * m.enemyHp, damage: d.damage * m.enemyDamage };
}

/** Curación con la dificultad (entero, al menos 1 si curaba algo). */
export function scaleHeal(amount: number, diff: Difficulty): number {
  if (!(amount > 0)) return 0;
  return Math.max(1, Math.round(amount * DIFFICULTY_MODS[diff].heal));
}

/**
 * Tickets con la dificultad. En Fácil se redondea hacia abajo pero un premio de 1 sigue dando 1 la mitad de las veces:
 * `rng` decide la parte decimal (así, de media, se cumple el multiplicador).
 */
export function scaleTickets(amount: number, diff: Difficulty, rng: () => number = Math.random): number {
  if (!(amount > 0)) return 0;
  const x = amount * DIFFICULTY_MODS[diff].tickets;
  const whole = Math.floor(x);
  return whole + (rng() < x - whole ? 1 : 0);
}

/** Clave de los récords: Normal usa la de siempre (los récords de antes eran todos de Normal). */
export const recordsKeyFor = (base: string, diff: Difficulty): string => (diff === 'normal' ? base : `${base}.${diff}`);

/** Nombre del modo con la dificultad si no es Normal: "Infinito (Difícil)". Para la pausa, los huecos y el cartel. */
export const withDifficulty = (label: string, diff: Difficulty): string => (diff === 'normal' ? label : `${label} (${DIFFICULTY_LABEL[diff]})`);
