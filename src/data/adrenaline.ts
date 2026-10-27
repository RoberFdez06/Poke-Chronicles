// T55: Adrenalina. Una barra que sube al encadenar bajas, esquivas y parrys, y baja sola si dejas de pelear. Al
// llenarse se activa unos segundos (más velocidad y daño) y luego se vacía. Lógica pura, sin Phaser.
//
// Todo el estado es relativo (milisegundos que quedan, no momentos del reloj) y el tiempo solo avanza con
// `tickAdrenaline`, que la escena llama desde su update. Así la pausa no la toca: con la escena en pausa no hay update,
// y el primer fotograma al volver trae un delta enorme que aquí se recorta (`ADRENALINE_MAX_STEP_MS`).

/** Valor máximo de la barra. */
export const ADRENALINE_MAX = 100;
/**
 * Lo que suma cada cosa: un parry vale más porque pide más reflejos. Rebalanceo: antes solo sumaban bajas (8),
 * esquivas (10) y parrys (20) y bajaba rápido, así que casi nunca se llenaba. Ahora cada golpe dado suma un poco
 * (`hit`) y la barra aguanta más: en una sala normal (≈5 bajas y ≈25 golpes) se llena una vez.
 */
export const ADRENALINE_GAIN = { hit: 1.5, kill: 12, dodge: 12, parry: 25 } as const;
export type AdrenalineSource = keyof typeof ADRENALINE_GAIN;
/** Tiempo sin sumar antes de que empiece a bajar (ms) y cuánto baja luego (por segundo). */
export const ADRENALINE_IDLE_MS = 7000;
export const ADRENALINE_DECAY_PER_S = 6;
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

/** T85: la Baya Aslac del huerto llena la barra de golpe y activa el subidón. Devuelve false si ya estaba activa. */
export function fillAdrenaline(s: AdrenalineState): boolean {
  if (adrenalineActive(s)) return false;
  s.value = ADRENALINE_MAX;
  s.idleMs = 0;
  s.activeLeft = ADRENALINE_ACTIVE_MS;
  s.activations++;
  return true;
}

/** Avanza `dtMs`. Devuelve true si en este paso se acaba el subidón. */
export function tickAdrenaline(s: AdrenalineState, dtMs: number, hold = false): boolean {
  const dt = Math.max(0, Math.min(dtMs, ADRENALINE_MAX_STEP_MS));
  if (adrenalineActive(s)) {
    s.activeLeft = Math.max(0, s.activeLeft - dt);
    if (s.activeLeft > 0) return false;
    // Se acaba: la barra queda vacía
    s.value = 0;
    s.idleMs = 0;
    return true;
  }
  // Con la sala despejada la barra se queda como está: no baja hasta que entras en otra y pasas un rato sin hacer daño
  if (hold) return false;
  s.idleMs += dt;
  if (s.idleMs > ADRENALINE_IDLE_MS) s.value = Math.max(0, s.value - (ADRENALINE_DECAY_PER_S * dt) / 1000);
  return false;
}

/** Hacer daño (o entrar en una sala nueva) reinicia la espera antes de que la barra empiece a bajar. */
export function touchAdrenaline(s: AdrenalineState) {
  s.idleMs = 0;
}

/** Cuánto se ve lleno (0-1): mientras está activa, lo que queda del subidón. */
export const adrenalineFill = (s: AdrenalineState): number =>
  adrenalineActive(s) ? s.activeLeft / ADRENALINE_ACTIVE_MS : s.value / ADRENALINE_MAX;

export const adrenalineSpeedMul = (s: AdrenalineState): number => (adrenalineActive(s) ? ADRENALINE_SPEED_MUL : 1);
export const adrenalineDamageMul = (s: AdrenalineState): number => (adrenalineActive(s) ? ADRENALINE_DAMAGE_MUL : 1);

/**
 * T74: la barra está llena. Al llenarse se activa sola, así que «llena» es también mientras dura el subidón (la
 * barra sigue al máximo hasta que se acaba): ese es el momento para megaevolucionar.
 */
export const adrenalineFull = (s: AdrenalineState): boolean => s.value >= ADRENALINE_MAX;

/** T74: gasta la barra entera (la megaevolución la consume): se vacía y se corta el subidón si lo había. */
export function spendAdrenaline(s: AdrenalineState) {
  s.value = 0;
  s.idleMs = 0;
  s.activeLeft = 0;
}
