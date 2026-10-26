// T75: medidor de poder para Dinamax/Gigamax, Teracristal y Cristal Z. Es distinto de la adrenalina (T55), que sigue
// siendo lo de la megaevolución: se llena con el daño que haces y con los parrys, y baja poco a poco si no peleas.
// Lógica pura, sin Phaser. Como la adrenalina, cuenta con pasos de tiempo recortados para que la pausa no lo vacíe.

export const POWER_METER_MAX = 100;
/** Cuánto sube por punto de daño hecho, y lo máximo por golpe (un golpe enorme no llena la barra de una vez). */
export const POWER_METER_PER_DAMAGE = 0.12;
export const POWER_METER_MAX_PER_HIT = 6;
/** Un parry acertado da un buen trozo: premia jugar bien, no solo pegar. */
export const POWER_METER_PARRY = 15;
/** Sin pelear este rato (ms) empieza a bajar, y luego baja tanto por segundo. */
export const POWER_METER_IDLE_MS = 5000;
export const POWER_METER_DECAY_PER_S = 2;
/** Paso más largo que se cuenta (ms), como en powerForm.ts. */
export const POWER_METER_MAX_STEP_MS = 100;

export interface PowerMeterState {
  value: number;
  /** Tiempo sin pelear (ms). */
  idleMs: number;
}

export const newPowerMeter = (value = 0): PowerMeterState => ({ value: clamp(value), idleMs: 0 });
const clamp = (v: number) => Math.max(0, Math.min(POWER_METER_MAX, Number.isFinite(v) ? v : 0));

/** Daño hecho a un enemigo. */
export function meterOnDamage(s: PowerMeterState, dmg: number): void {
  if (!(dmg > 0)) return;
  s.value = clamp(s.value + Math.min(POWER_METER_MAX_PER_HIT, dmg * POWER_METER_PER_DAMAGE));
  s.idleMs = 0;
}

/** Parry acertado. */
export function meterOnParry(s: PowerMeterState): void {
  s.value = clamp(s.value + POWER_METER_PARRY);
  s.idleMs = 0;
}

/** Avanza el tiempo: tras un rato sin pelear, baja poco a poco. */
export function tickPowerMeter(s: PowerMeterState, dtMs: number): void {
  const dt = Math.max(0, Math.min(dtMs, POWER_METER_MAX_STEP_MS));
  const before = s.idleMs;
  s.idleMs += dt;
  const decayMs = Math.max(0, s.idleMs - Math.max(before, POWER_METER_IDLE_MS));
  if (decayMs > 0) s.value = clamp(s.value - (POWER_METER_DECAY_PER_S * decayMs) / 1000);
}

/** Gasta `cost` si hay; devuelve si se ha podido. */
export function spendPowerMeter(s: PowerMeterState, cost: number): boolean {
  if (s.value < cost) return false;
  s.value = clamp(s.value - cost);
  return true;
}

export const powerMeterFill = (s: PowerMeterState): number => s.value / POWER_METER_MAX;
