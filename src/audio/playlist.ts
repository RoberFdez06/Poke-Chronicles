// Mezcla aleatoria de la música (lógica pura, sin Web Audio): cada situación tiene una lista de pistas y el selector
// elige la siguiente al azar, nunca la misma dos veces seguidas. Cambia al terminar la pista (tras unas vueltas),
// al cambiar de lista (combate, jefe, tienda…) y al entrar en otra sala si la pista ya lleva un rato. Reproducible
// con semilla (tests).
import { rngFrom } from '../data/musicGen.ts';

/** Cada pista suena unos 70 s (vueltas completas) antes de pasar a otra. */
export const TARGET_TRACK_S = 70;
/** Al entrar en otra sala solo se cambia de pista si la actual lleva al menos esto sonando (sin saltos cada puerta). */
export const MIN_DWELL_MS = 25000;

/** Vueltas que da una pista de `steps` corcheas a `bpm` para durar ~`targetS` segundos (al menos 1). */
export function loopsFor(steps: number, bpm: number, targetS = TARGET_TRACK_S): number {
  if (steps <= 0 || bpm <= 0) return 1;
  const secs = steps * (60 / bpm / 2);
  return Math.max(1, Math.round(targetS / secs));
}

/** Índice al azar en [0, count), distinto de `last` si hay más de una pista. */
export function pickNext(count: number, last: number | null, rng: () => number): number {
  if (count <= 1) return 0;
  if (last === null || last < 0 || last >= count) return Math.floor(rng() * count);
  // Sorteo entre las demás: nunca la misma seguida
  const k = Math.floor(rng() * (count - 1));
  return k >= last ? k + 1 : k;
}

export interface Choice {
  key: string;
  index: number;
  /** Ha cambiado la pista (hay que hacer crossfade). */
  changed: boolean;
}

export class MusicShuffle {
  private rng: () => number;
  private lastByKey = new Map<string, number>();
  /** Lista y pista que suenan, y desde cuándo (ms). */
  key: string | null = null;
  index = -1;
  since = 0;

  constructor(seed: number) {
    this.rng = rngFrom(seed);
  }

  /**
   * Pide la lista `key` de `count` pistas. Si ya suena esa lista, no cambia (salvo `force`). Si es otra, sortea una
   * pista distinta de la última que sonó en esa lista.
   */
  choose(key: string, count: number, now: number, force = false): Choice {
    if (!force && key === this.key && this.index >= 0 && this.index < count) return { key, index: this.index, changed: false };
    const last = key === this.key ? this.index : this.lastByKey.get(key) ?? null;
    const index = pickNext(count, last, this.rng);
    const changed = key !== this.key || index !== this.index;
    this.key = key;
    this.index = index;
    this.since = now;
    this.lastByKey.set(key, index);
    return { key, index, changed };
  }

  /** La pista ha terminado: otra de la misma lista. */
  next(count: number, now: number): Choice | null {
    if (this.key === null) return null;
    return this.choose(this.key, count, now, true);
  }

  /** Se entra en otra sala: cambia de pista si la actual ya lleva `MIN_DWELL_MS`. */
  room(count: number, now: number): Choice | null {
    if (this.key === null || now - this.since < MIN_DWELL_MS) return null;
    return this.choose(this.key, count, now, true);
  }
}
