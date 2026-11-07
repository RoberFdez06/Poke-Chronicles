// Economía (rama economia, 06/11): premios por rendimiento, primera victoria del día con racha y caramelos que caen
// de los enemigos. Lógica pura, sin Phaser; el guardado de la primera victoria está en save.ts (FIRST_WIN_KEY).
// Las cuentas de «cuántas partidas hacen falta» están en balance.ts (economyReport).
import type { GameMode } from './modes.ts';

// --- Premio por rendimiento al acabar la partida (piso alcanzado) ---

/** Tickets extra al acabar según los hitos superados (en Normal, pisos completados). Índice = hitos. */
export const DEPTH_BONUS: readonly number[] = [0, 0, 4, 10, 18, 28];
/** A partir del último hito de la tabla (Infinito, Torre…), cada hito más suma esto, con tope. */
export const DEPTH_BONUS_STEP = 6;
export const DEPTH_BONUS_MAX = 60;

/** Tickets del premio por llegar lejos con `cleared` hitos superados. */
export function depthBonus(cleared: number): number {
  const c = Math.max(0, Math.floor(cleared));
  if (c < DEPTH_BONUS.length) return DEPTH_BONUS[c];
  return Math.min(DEPTH_BONUS_MAX, DEPTH_BONUS[DEPTH_BONUS.length - 1] + (c - DEPTH_BONUS.length + 1) * DEPTH_BONUS_STEP);
}

/**
 * Hitos superados en cada modo: pisos en Normal e Infinito, cada 5 rondas en Oleadas, cada 2 jefes en el Rush y cada
 * 10 pisos en la Torre (lo que dura más o menos un piso de Normal). `progress` = pisos, rondas o jefes superados.
 */
export function runMilestones(mode: GameMode, progress: number): number {
  const p = Math.max(0, Math.floor(progress));
  switch (mode) {
    case 'waves':
      return Math.floor(p / 5);
    case 'bossrush':
      return Math.floor(p / 2);
    case 'tower':
      return Math.floor(p / 10);
    case 'towerdef':
      return 0;
    default:
      return p;
  }
}

/** Premio por rendimiento de la partida (antes de la dificultad). */
export const performanceBonus = (mode: GameMode, progress: number): number => depthBonus(runMilestones(mode, progress));

// --- Primera victoria del día (vencer al primer jefe del día o superar un nivel de la Defensa de torres) ---

export const FIRST_WIN = {
  /** Tickets de la primera victoria de cada día. */
  tickets: 15,
  /** Más por cada día seguido con victoria (desde el segundo)… */
  perStreakDay: 3,
  /** …hasta este número de días extra (como mucho 15 + 3 × 5 = 30). */
  maxStreakDays: 5,
} as const;

export interface FirstWinState {
  /** Último día (dayNumber) con la primera victoria cobrada; −1 = nunca. */
  lastDay: number;
  /** Días seguidos con victoria. */
  streak: number;
  best: number;
}

export const emptyFirstWin = (): FirstWinState => ({ lastDay: -1, streak: 0, best: 0 });

const nat = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

export function parseFirstWin(raw: string | null): FirstWinState {
  if (!raw) return emptyFirstWin();
  try {
    const d = JSON.parse(raw) as Partial<FirstWinState>;
    if (!d || typeof d !== 'object') return emptyFirstWin();
    const lastDay = typeof d.lastDay === 'number' && Number.isInteger(d.lastDay) ? d.lastDay : -1;
    const streak = nat(d.streak) ? d.streak : 0;
    return { lastDay, streak, best: Math.max(streak, nat(d.best) ? d.best : 0) };
  } catch {
    return emptyFirstWin();
  }
}

/** Tickets de la primera victoria con `streak` días seguidos (contando hoy). */
export const firstWinTickets = (streak: number): number =>
  FIRST_WIN.tickets + FIRST_WIN.perStreakDay * Math.min(FIRST_WIN.maxStreakDays, Math.max(0, Math.floor(streak) - 1));

/** ¿Queda por cobrar la primera victoria de `day`? */
export const firstWinPending = (s: FirstWinState, day: number): boolean => s.lastDay !== day;

/**
 * Cobra la primera victoria de `day`. Si ya se cobró hoy, 0 tickets y el estado igual. La racha sigue si la anterior
 * fue ayer; si no, vuelve a 1.
 */
export function claimFirstWinState(s: FirstWinState, day: number): { state: FirstWinState; tickets: number; streak: number } {
  if (!firstWinPending(s, day)) return { state: s, tickets: 0, streak: s.streak };
  const streak = s.lastDay === day - 1 ? s.streak + 1 : 1;
  return { state: { lastDay: day, streak, best: Math.max(s.best, streak) }, tickets: firstWinTickets(streak), streak };
}

// --- Caramelos que caen de los enemigos (se cobran al momento: no se quedan en el suelo ni van en el guardado) ---

export const CANDY_DROP = {
  /** Probabilidad de que un enemigo normal suelte caramelos… */
  chance: 0.12,
  /** …y cuántos: 1 o 2 (más en pisos hondos, ver candyDrop). */
  min: 1,
  max: 2,
  /** Minijefe: siempre, 3 + piso. */
  miniBase: 3,
  /** Jefe: siempre, 6 + 2 × piso. */
  bossBase: 6,
  /** Extra de un shiny y de un oscuro. */
  shiny: 5,
  dark: 3,
} as const;

export interface CandyFoe {
  boss?: boolean;
  mini?: boolean;
  shiny?: boolean;
  dark?: boolean;
}

/** Caramelos que suelta un enemigo al caer en el piso (o nivel) `level` (antes de la dificultad). */
export function candyDrop(rng: () => number, level: number, foe: CandyFoe = {}): number {
  const f = Math.max(1, Math.floor(level));
  let n = 0;
  if (foe.boss) n += CANDY_DROP.bossBase + 2 * Math.min(f, 10);
  else if (foe.mini) n += CANDY_DROP.miniBase + Math.min(f, 10);
  else if (rng() < CANDY_DROP.chance) {
    n += CANDY_DROP.min + Math.floor(rng() * (CANDY_DROP.max - CANDY_DROP.min + 1)) + Math.floor(Math.min(f, 10) / 4);
  }
  if (foe.shiny) n += CANDY_DROP.shiny;
  if (foe.dark) n += CANDY_DROP.dark;
  return n;
}

/** Media de caramelos de un enemigo normal en el piso `level` (para balance.ts). */
export const avgFoeCandies = (level: number): number =>
  CANDY_DROP.chance * ((CANDY_DROP.min + CANDY_DROP.max) / 2 + Math.floor(Math.min(Math.max(1, Math.floor(level)), 10) / 4));
