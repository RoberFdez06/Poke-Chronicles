// Fases del reto final (pedido de Roberto, 27/10: «es difícil, pero no se siente épico»). El jefe final pasa por 4
// fases (100-75-50-25-0 % de vida) y cada una cambia sus ataques y trae algo nuevo y legible:
// - Fase 1: sus ataques de siempre (sin invocar).
// - Fase 2: «Cruz del juicio», franjas marcadas en el suelo con aviso largo que estallan a la vez (siempre con huecos).
// - Fase 3: la arena se agrieta (como la fase 1 de arena de los jefes normales), llegan refuerzos e invoca.
// - Fase 4 (desesperada): «Nova desesperada», ondas seguidas con el hueco girando poco a poco, y al acabar el jefe queda
//   agotado unos segundos (ventana de castigo). Ataca más rápido.
// Entre fase y fase hay una pausa breve en la que nadie recibe daño. La vida no puede saltarse fases de golpe: mientras
// no ha empezado la siguiente fase, el jefe no baja del umbral de la que viene detrás. Lógica pura, con tests.
import type { BossAttack } from './bossPatterns.ts';

export type FinalePhase = 1 | 2 | 3 | 4;
/** Umbrales de vida (proporción) por debajo de los que empieza la fase 2, 3 y 4. */
export const FINALE_PHASE_AT: readonly [number, number, number] = [0.75, 0.5, 0.25];

/** Fase que «toca» con esta vida (sin tener en cuenta la anterior). */
export function finalePhaseFor(ratio: number): FinalePhase {
  if (ratio < FINALE_PHASE_AT[2]) return 4;
  if (ratio < FINALE_PHASE_AT[1]) return 3;
  if (ratio < FINALE_PHASE_AT[0]) return 2;
  return 1;
}

/** Siguiente fase si toca cambiar (de una en una, nunca se salta ninguna); si no, undefined. */
export function nextFinalePhase(current: FinalePhase, ratio: number): FinalePhase | undefined {
  if (current >= 4) return undefined;
  return finalePhaseFor(ratio) > current ? ((current + 1) as FinalePhase) : undefined;
}

/**
 * Vida mínima del jefe (de `maxHp`) mientras está en `phase`: puede bajar lo justo para entrar en la siguiente, pero
 * no saltarse otra con un golpe grande. Solo en la fase 4 puede caer.
 */
export function finaleHpFloor(phase: FinalePhase, maxHp: number): number {
  if (phase >= 4) return 0;
  if (phase === 3) return 1;
  return Math.max(1, Math.ceil(maxHp * FINALE_PHASE_AT[phase as 1 | 2]));
}

/** Vida tras recibir daño en esa fase (nunca por debajo de su mínimo). */
export const clampFinaleHp = (hp: number, phase: FinalePhase, maxHp: number): number => Math.max(hp, finaleHpFloor(phase, maxHp));

/** Pausa del cambio de fase (como la de la arena): nadie se mueve ni recibe daño. */
export const FINALE_BEAT_MS = 600;
/** Margen tras la pausa antes del primer ataque de la fase nueva. */
export const FINALE_AFTER_BEAT_MS = 700;

export type FinaleAttack = BossAttack | 'judgment' | 'nova';

export const FINALE_ATTACK_LABEL: Record<'judgment' | 'nova', string> = {
  judgment: 'Cruz del juicio',
  nova: 'Nova desesperada',
};

/** Ataques de cada fase a partir de los del jefe (los de su tipo y su bioma). */
export function finaleAttacks(phase: FinalePhase, base: readonly BossAttack[]): FinaleAttack[] {
  const own = base.filter((a) => a !== 'summon');
  if (phase === 1) return own.length ? [...own] : ['ring'];
  if (phase === 2) return [...own, 'judgment'];
  if (phase === 3) return [...new Set<FinaleAttack>([...own, 'judgment', 'summon', 'laser'])];
  // Desesperada: lo más vistoso y legible (nada de invocar: ya está solo contra ti)
  return [...new Set<FinaleAttack>(['nova', 'judgment', 'ring', ...own.filter((a) => a === 'laser' || a === 'shockwave' || a === 'spiral')])];
}

/** Siguiente ataque al azar sin repetir el último. En la fase 4 la nova sale como mínimo cada tres ataques. */
export function pickFinaleAttack(list: readonly FinaleAttack[], rng: () => number, last?: FinaleAttack, sinceNova = 0): FinaleAttack {
  if (list.includes('nova') && last !== 'nova' && sinceNova >= 2) return 'nova';
  const options = list.length > 1 ? list.filter((a) => a !== last) : list;
  return options[Math.floor(rng() * options.length)];
}

/** Multiplicador del tiempo entre ataques: cada fase aprieta un poco más. */
export const finaleIntervalMul = (phase: FinalePhase): number => [1, 0.95, 0.85, 0.7][phase - 1];

/** Aviso en pantalla al empezar cada fase (2-4). */
export function finalePhaseText(phase: FinalePhase, name: string): string {
  if (phase === 2) return `¡Fase 2! ${name} prepara la Cruz del juicio`;
  if (phase === 3) return '¡Fase 3! La arena se rompe y llegan refuerzos';
  if (phase === 4) return `¡Fase final! ${name} lo da todo: busca los huecos`;
  return `¡Reto final: ${name}!`;
}

// --- Cruz del juicio: franjas (columnas y filas) marcadas en el suelo que estallan a la vez ---

export const JUDGMENT_BAND = 72;
/** El aviso nunca baja de esto (es el ataque «de aviso largo»). */
export const JUDGMENT_MIN_WARN = 1100;

export interface JudgmentSpec {
  cols: number;
  rows: number;
  warnMs: number;
}
export function judgmentSpec(phase: FinalePhase): JudgmentSpec {
  if (phase <= 2) return { cols: 2, rows: 1, warnMs: 1500 };
  if (phase === 3) return { cols: 2, rows: 2, warnMs: 1350 };
  return { cols: 3, rows: 2, warnMs: Math.max(JUDGMENT_MIN_WARN, 1200) };
}

/**
 * Elige `n` franjas de entre `slots` sin que haya dos pegadas (siempre queda al menos una libre al lado de cada una),
 * así desde cualquier punto hay un sitio seguro a menos de una franja y media.
 */
export function pickBands(slots: number, n: number, rng: () => number): number[] {
  const want = Math.max(0, Math.min(n, Math.floor(slots / 2)));
  const out: number[] = [];
  let tries = 0;
  while (out.length < want && tries++ < 200) {
    const s = Math.floor(rng() * slots);
    if (out.some((o) => Math.abs(o - s) <= 1)) continue;
    out.push(s);
  }
  return out.sort((a, b) => a - b);
}

export interface JudgmentPlan {
  /** Franjas verticales (índice de columna) y horizontales (índice de fila), de JUDGMENT_BAND px. */
  cols: number[];
  rows: number[];
}
export function judgmentPlan(width: number, height: number, spec: JudgmentSpec, rng: () => number): JudgmentPlan {
  return {
    cols: pickBands(Math.floor(width / JUDGMENT_BAND), spec.cols, rng),
    rows: pickBands(Math.floor(height / JUDGMENT_BAND), spec.rows, rng),
  };
}

/** ¿El punto (relativo a la esquina de la sala) cae en alguna franja? */
export function judgmentHits(plan: JudgmentPlan, x: number, y: number, margin = 10): boolean {
  const inBand = (v: number, idx: number[]) => idx.some((i) => v > i * JUDGMENT_BAND - margin && v < (i + 1) * JUDGMENT_BAND + margin);
  return inBand(x, plan.cols) || inBand(y, plan.rows);
}

// --- Nova desesperada: ondas seguidas cuyo hueco gira poco a poco (hay que ir siguiéndolo) ---

export interface NovaSpec {
  waves: number;
  /** Hueco de cada onda (rad, nunca menos de 60°) y lo que gira de una a otra (rad, nunca más de 45°). */
  gap: number;
  turn: number;
  speed: number;
  everyMs: number;
  warnMs: number;
  maxRadius: number;
  /** Ventana de castigo: el jefe se queda agotado y quieto (ms). */
  punishMs: number;
}
export const NOVA_MIN_GAP = (60 * Math.PI) / 180;
export const NOVA_MAX_TURN = (45 * Math.PI) / 180;
export const NOVA: NovaSpec = {
  waves: 4,
  gap: (70 * Math.PI) / 180,
  turn: (35 * Math.PI) / 180,
  speed: 270,
  everyMs: 650,
  warnMs: 1200,
  maxRadius: 640,
  punishMs: 2400,
};
/** Ángulo del hueco de cada onda. */
export const novaGapAt = (spec: NovaSpec, start: number, wave: number, dir: 1 | -1): number => start + dir * wave * spec.turn;
/** Duración total desde que acaba el aviso hasta que la última onda sale de la sala (sin el castigo). */
export const novaDurationMs = (spec: NovaSpec): number => (spec.waves - 1) * spec.everyMs + (spec.maxRadius / spec.speed) * 1000;

/**
 * Para que el hueco se pueda seguir: entre una onda y la siguiente el jugador (a `playerSpeed` px/s) tiene que poder
 * moverse lo que gira el hueco a la distancia `r` del jefe.
 */
export function novaFollowable(spec: NovaSpec, playerSpeed: number, r = 200): boolean {
  return spec.turn * r <= playerSpeed * (spec.everyMs / 1000) && spec.gap >= NOVA_MIN_GAP && spec.turn <= NOVA_MAX_TURN;
}
