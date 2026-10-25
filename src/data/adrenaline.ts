// T55: Adrenalina. Una barra que sube al encadenar bajas, esquivas y parrys, y baja sola si dejas de pelear. Al
// llenarse se activa unos segundos (más velocidad y daño) y luego se vacía. Lógica pura, sin Phaser.
//
// Todo el estado es relativo (milisegundos que quedan, no momentos del reloj) y el tiempo solo avanza con
// `tickAdrenaline`, que la escena llama desde su update. Así la pausa no la toca: con la escena en pausa no hay update,
// y el primer fotograma al volver trae un delta enorme que aquí se recorta (`ADRENALINE_MAX_STEP_MS`).

/** Valor máximo de la barra. */
export const ADRENALINE_MAX = 100;
/** Lo que suma cada cosa: un parry vale más porque pide más reflejos. */
export const ADRENALINE_GAIN = { kill: 8, dodge: 10, parry: 20 } as const;
export type AdrenalineSource = keyof typeof ADRENALINE_GAIN;
/** Tiempo sin sumar antes de que empiece a bajar (ms) y cuánto baja luego (por segundo). */
export const ADRENALINE_IDLE_MS = 2500;
export const ADRENALINE_DECAY_PER_S = 14;
/** Duración del subidón (ms) y lo que da: velocidad y daño extra. */
export const ADRENALINE_ACTIVE_MS = 6000;
export const ADRENALINE_SPEED_MUL = 1.2;
export const ADRENALINE_DAMAGE_MUL = 1.3;
/** Paso más largo que se cuenta de una vez (ms): el fotograma de después de una pausa no la vacía. */
export const ADRENALINE_MAX_STEP_MS = 100;

export interface AdrenalineState {
  value: number;
  /** Tiempo desde lo último que sumó (ms). */
  idleMs: number;
  /** Lo que queda del subidón (ms); 0 = no está activa. */
  activeLeft: number;
  /** Veces que se ha activado (para el resumen). */
  activations: number;
}

export const newAdrenaline = (): AdrenalineState => ({ value: 0, idleMs: 0, activeLeft: 0, activations: 0 });

export const adrenalineActive = (s: AdrenalineState): boolean => s.activeLeft > 0;

/** Suma por una baja, esquiva o parry. Devuelve true si con esto se llena y se activa. */
export function gainAdrenaline(s: AdrenalineState, source: AdrenalineSource): boolean {
  // Mientras está activa no se carga la siguiente: así no se encadena un subidón con otro sin parar
  if (adrenalineActive(s)) return false;
  s.value = Math.min(ADRENALINE_MAX, s.value + ADRENALINE_GAIN[source]);
  s.idleMs = 0;
  if (s.value < ADRENALINE_MAX) return false;
  s.activeLeft = ADRENALINE_ACTIVE_MS;
  s.activations++;
  return true;
}

/** Avanza `dtMs`. Devuelve true si en este paso se acaba el subidón. */
export function tickAdrenaline(s: AdrenalineState, dtMs: number): boolean {
  const dt = Math.max(0, Math.min(dtMs, ADRENALINE_MAX_STEP_MS));
  if (adrenalineActive(s)) {
    s.activeLeft = Math.max(0, s.activeLeft - dt);
    if (s.activeLeft > 0) return false;
    // Se acaba: la barra queda vacía
    s.value = 0;
    s.idleMs = 0;
    return true;
  }
  s.idleMs += dt;
  if (s.idleMs > ADRENALINE_IDLE_MS) s.value = Math.max(0, s.value - (ADRENALINE_DECAY_PER_S * dt) / 1000);
  return false;
}

/** Cuánto se ve lleno (0-1): mientras está activa, lo que queda del subidón. */
export const adrenalineFill = (s: AdrenalineState): number =>
  adrenalineActive(s) ? s.activeLeft / ADRENALINE_ACTIVE_MS : s.value / ADRENALINE_MAX;

export const adrenalineSpeedMul = (s: AdrenalineState): number => (adrenalineActive(s) ? ADRENALINE_SPEED_MUL : 1);
export const adrenalineDamageMul = (s: AdrenalineState): number => (adrenalineActive(s) ? ADRENALINE_DAMAGE_MUL : 1);
