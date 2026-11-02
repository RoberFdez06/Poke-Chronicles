// Tope de umbral de los jefes (pedido de Roberto, 02/11: «a los jefes no se les pueda hacer instakill»). Un golpe
// enorme (o una bomba, una reacción, un estado…) no puede saltarse un suceso de vida del jefe que aún no ha salido:
// la vida se queda justo por debajo del umbral pendiente, el daño que sobra se pierde y el jefe hace su pausa
// (arena al 67 %, megaevolución/fase 2 al 50 %, caída al 34 %; en el reto final gigante, 75/50/25 %). Al acabar,
// vuelve a recibir daño normal hasta el siguiente. Seguro: si el suceso no llega a salir, el tope se suelta a los
// CAP_RELEASE_MS de estar retenido y ese umbral se da por consumido (nunca un jefe inmortal). Lógica pura, con tests.
import { ARENA_AT } from '../level/arenaPhase.ts';
import { MEGA_AT } from './megaBoss.ts';
import { BOSS_PHASE2_AT } from './bossPatterns.ts';
import { FINALE_PHASE_AT, type FinalePhase } from './finalePhases.ts';

/** Tiempo máximo que el tope retiene la vida esperando a que salga el suceso, ms. */
export const CAP_RELEASE_MS = 3000;

export interface BossThresholdState {
  /** Puede cambiar la arena (jefe en una sala con cuadrícula) y fase de arena ya empezada. */
  arena: boolean;
  arenaDone: 0 | 1 | 2;
  /** Puede megaevolucionar y si ya lo ha hecho. */
  mega: boolean;
  megaDone: boolean;
  /** Aún en la fase 1 de ataques (la fase 2 sale al 50 %). */
  phase1: boolean;
  /** Reto final gigante: su fase actual (sus umbrales van aparte). */
  finalePhase?: FinalePhase;
  /** Umbrales dados por consumidos por el seguro. */
  skipped?: readonly number[];
}

/** Umbrales pendientes, de mayor a menor (sin repetir y sin los consumidos). */
export function pendingThresholds(s: BossThresholdState): number[] {
  const out: number[] = [];
  if (s.finalePhase !== undefined) {
    for (let i = s.finalePhase - 1; i < FINALE_PHASE_AT.length; i++) out.push(FINALE_PHASE_AT[i]);
  } else {
    if (s.arena && s.arenaDone < 1) out.push(ARENA_AT[0]);
    if (s.mega && !s.megaDone) out.push(MEGA_AT);
    if (s.phase1) out.push(BOSS_PHASE2_AT);
    if (s.arena && s.arenaDone < 2) out.push(ARENA_AT[1]);
  }
  const skip = new Set(s.skipped ?? []);
  return [...new Set(out)].filter((t) => !skip.has(t)).sort((a, b) => b - a);
}

/** Siguiente umbral pendiente (el más alto), o undefined si no queda ninguno. */
export const nextThreshold = (s: BossThresholdState): number | undefined => pendingThresholds(s)[0];

/** Vida justo por debajo del umbral (proporción < t, nunca 0). */
export const thresholdCap = (maxHp: number, t: number): number => Math.max(1, Math.ceil(maxHp * t) - 1);

export interface ClampResult {
  hp: number;
  /** El tope ha cortado daño. */
  clamped: boolean;
  /** Umbral que ha frenado el golpe. */
  threshold?: number;
}

/**
 * Vida tras recibir `dmg` sin cruzar el primer umbral pendiente: no baja de `min(hpBefore, tope)`. Sin umbrales
 * pendientes, daño normal (puede morir).
 */
export function clampBossHp(hpBefore: number, dmg: number, maxHp: number, pending: readonly number[]): ClampResult {
  const raw = hpBefore - dmg;
  const t = pending[0];
  if (t === undefined || dmg <= 0) return { hp: raw, clamped: false };
  const floor = Math.min(hpBefore, thresholdCap(maxHp, t));
  if (raw >= floor) return { hp: raw, clamped: false };
  return { hp: floor, clamped: true, threshold: t };
}

export interface CapHold {
  t: number;
  since: number;
}

/**
 * Seguimiento del seguro: devuelve la retención nueva y si hay que consumir el umbral (lleva CAP_RELEASE_MS
 * retenido). `waiting` = hay un suceso del jefe en marcha (la cuenta no avanza, pero ese suceso tiene su propio tope).
 */
export function trackHold(hold: CapHold | undefined, t: number, now: number, waiting = false): { hold: CapHold; release: boolean } {
  if (!hold || hold.t !== t || waiting) return { hold: { t, since: waiting && hold?.t === t ? Math.max(hold.since, now - CAP_RELEASE_MS / 2) : now }, release: false };
  return { hold, release: now - hold.since >= CAP_RELEASE_MS };
}

// Trío del reto final (pedido de Roberto, 02/11: «le hice instakill a Arceus y sus aliados»). Los tres comparten UNA
// barra (la suma de sus vidas) y sus fases salen al 75/50/25 % de esa suma. Un golpe a un miembro no puede llevar la
// suma por debajo del umbral pendiente, y mientras quede algún umbral ningún miembro cae de un golpe (se queda a 1 PS).
// En la fase 4 (sin umbrales) el daño es normal. El seguro de CAP_RELEASE_MS sigue valiendo (umbrales consumidos).

/** Umbrales pendientes del reto final en su fase `phase` (sin los consumidos por el seguro). */
export const finalePending = (phase: FinalePhase, skipped: readonly number[] = []): number[] =>
  pendingThresholds({ arena: false, arenaDone: 2, mega: false, megaDone: true, phase1: false, finalePhase: phase, skipped });

export interface SharedClampResult extends ClampResult {
  /** El golpe lo ha frenado la barra compartida (cuenta para el seguro); si solo es el mínimo de 1 PS, no. */
  shared: boolean;
}

/**
 * Vida de un miembro del trío tras `dmg`. `sum` = suma actual de las vidas de los vivos (incluido este miembro),
 * `maxSum` = vida total de la barra. La suma no baja del tope del primer umbral pendiente y el miembro no baja de 1
 * mientras quede alguno (nunca sube por esto: si ya estaba por debajo se queda igual).
 */
export function clampSharedHp(hpBefore: number, dmg: number, sum: number, maxSum: number, pending: readonly number[]): SharedClampResult {
  const raw = hpBefore - dmg;
  const t = pending[0];
  if (t === undefined || dmg <= 0) return { hp: raw, clamped: false, shared: false };
  const room = Math.max(0, sum - thresholdCap(maxSum, t)); // daño que aún admite la barra
  const sharedFloor = hpBefore - room;
  const floor = Math.min(hpBefore, Math.max(sharedFloor, 1));
  if (raw >= floor) return { hp: raw, clamped: false, shared: false };
  const shared = sharedFloor >= 1;
  return { hp: floor, clamped: true, threshold: shared ? t : undefined, shared };
}
