// Desafío diario (T34): una partida de Normal igual para todos ese día (pisos, inicial, jefes y objetos salen de
// la semilla del día). La primera partida del día cuenta para el récord diario y la racha; las demás no.
// Lógica pura, sin Phaser, para poder testearla. El número de día es el de gacha.ts (`dayNumber`, hora local).
import { mulberry32 } from '../level/floorGen.ts';

/** Iniciales posibles del desafío: los tres de cada región (forma básica). */
export const DAILY_STARTERS: readonly number[] = [
  1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912,
];

/** Mezcla un número (hash de 32 bits) para que días seguidos den semillas sin parecido. */
function mix(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Semilla del día (entero positivo de 31 bits). */
export const dailySeed = (day: number): number => mix(Math.floor(day)) & 0x7fffffff;

/** Inicial del día: el mismo para todos, y nunca el mismo dos días seguidos. */
export function dailyStarter(day: number): number {
  const n = DAILY_STARTERS.length;
  const pick = (d: number) => dailySeed(d) % n;
  let i = pick(day);
  if (i === pick(day - 1)) i = (i + 1) % n;
  return DAILY_STARTERS[i];
}

/** Semilla del piso `floor` del desafío de ese día. */
export const dailyFloorSeed = (day: number, floor: number): number => mix(dailySeed(day) + Math.floor(floor) * 7919) & 0x7fffffff;

/**
 * Azar del piso del desafío (número de salas, jefe, tesoro, cofres, tienda y objetos que caen): mismo orden de
 * tiradas, mismos resultados. `stream` separa cosas que no deben depender unas de otras.
 */
export const dailyRng = (day: number, floor: number, stream = 0): (() => number) =>
  mulberry32(dailyFloorSeed(day, floor) ^ mix(stream + 1));

// --- Récord diario y racha ---

export interface DailyState {
  /** Último día en el que se jugó una partida que cuenta (-1 = nunca). */
  lastDay: number;
  /** Pisos completados en la partida que contó ese día (0 si cayó en el primero). */
  todayBest: number;
  /** Días seguidos jugando el desafío (hasta lastDay). */
  streak: number;
  /** Mejor racha. */
  bestStreak: number;
  /** Mejor resultado de cualquier día. */
  best: number;
}

export const emptyDaily = (): DailyState => ({ lastDay: -1, todayBest: 0, streak: 0, bestStreak: 0, best: 0 });

const isNat = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;

export function parseDaily(raw: string | null): DailyState {
  if (!raw) return emptyDaily();
  try {
    const d = JSON.parse(raw) as Partial<DailyState>;
    if (!d || typeof d !== 'object') return emptyDaily();
    const out = emptyDaily();
    if (Number.isInteger(d.lastDay)) out.lastDay = d.lastDay as number;
    for (const k of ['todayBest', 'streak', 'bestStreak', 'best'] as const) if (isNat(d[k])) out[k] = d[k] as number;
    return out;
  } catch {
    return emptyDaily();
  }
}

/** ¿Ya se ha jugado hoy la partida que cuenta? */
export const playedToday = (s: DailyState, day: number): boolean => s.lastDay === day;

/** Racha que se ve hoy: si ayer no se jugó (ni hoy), se ha roto. */
export const currentStreak = (s: DailyState, day: number): number => (s.lastDay >= day - 1 ? s.streak : 0);

/**
 * Al empezar una partida del desafío de `day`: si es la primera del día, cuenta (sube la racha y el resultado de
 * hoy empieza en 0, así salir a mitad y repetir no sirve para mejorarlo). Si ya se jugó, `counts: false`.
 */
export function startDaily(s: DailyState, day: number): { state: DailyState; counts: boolean } {
  if (playedToday(s, day) || day < s.lastDay) return { state: s, counts: false };
  const streak = s.lastDay === day - 1 ? s.streak + 1 : 1;
  return { state: { ...s, lastDay: day, todayBest: 0, streak, bestStreak: Math.max(s.bestStreak, streak) }, counts: true };
}

/** Pisos completados en la partida que cuenta de `day` (solo sube). Llamar solo si la partida contaba. Devuelve si es el mejor de siempre. */
export function withDailyResult(s: DailyState, day: number, floors: number): { state: DailyState; newBest: boolean } {
  const v = isNat(floors) ? floors : 0;
  if (s.lastDay !== day || v <= s.todayBest) return { state: s, newBest: false };
  return { state: { ...s, todayBest: v, best: Math.max(s.best, v) }, newBest: v > s.best };
}

/** Tickets extra al completar el desafío de hoy cuando la racha llega a estos días (premio de racha, T58). */
export const STREAK_TICKETS: Readonly<Record<number, number>> = { 3: 10, 7: 25, 14: 50, 30: 100 };

/** Tickets de premio por la racha de hoy (0 si no es un día de premio). Solo se da una vez: la racha de hoy sube una sola vez. */
export const streakReward = (streak: number): number => STREAK_TICKETS[streak] ?? 0;

/** Texto del panel del modo: récord de hoy o si aún se puede jugar, y la racha. */
export function dailyText(s: DailyState, day: number, floorCount: number): string {
  const streak = currentStreak(s, day);
  const today = playedToday(s, day)
    ? `Hoy: ${s.todayBest >= floorCount ? '¡completado!' : `${s.todayBest}/${floorCount} pisos`} (ya cuenta; puedes repetir sin récord)`
    : 'Hoy: aún sin jugar (la primera partida cuenta)';
  return `${today}\nRacha: ${streak} ${streak === 1 ? 'día' : 'días'} · Mejor: ${s.bestStreak}`;
}
