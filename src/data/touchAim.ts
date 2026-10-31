// Auto-apuntado de los poderes en táctil: al tocar la ranura de un poder sale hacia el enemigo más cercano (los
// jefes cuentan como uno más). Si no hay nadie, hacia donde empuja el joystick de apuntar y, si tampoco, en la
// última dirección de disparo. Lógica pura (sin Phaser) para poder probarla con node --test.

export interface AimPoint {
  x: number;
  y: number;
}

/** Enemigo candidato: posición y si se puede apuntar (vivo, no capturándose, no escondido…). */
export interface AimTarget extends AimPoint {
  ok?: boolean;
}

/** Largo mínimo del joystick de apuntar para tenerlo en cuenta (al cuadrado). */
export const AIM_STICK_MIN_SQ = 0.04;

/** El objetivo más cercano a `from` (null si no hay ninguno válido). `maxDist` limita el alcance (por defecto, sin límite). */
export function pickAimTarget<T extends AimTarget>(from: AimPoint, targets: readonly T[], maxDist = Infinity): T | null {
  let best: T | null = null;
  let bestD = maxDist * maxDist;
  for (const t of targets) {
    if (t.ok === false || !Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
    const d = (t.x - from.x) ** 2 + (t.y - from.y) ** 2;
    if (d < bestD || (best === null && d <= bestD)) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

const unit = (v: AimPoint): AimPoint | null => {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-6 ? { x: v.x / l, y: v.y / l } : null;
};

/**
 * Dirección (unitaria) con la que sale un poder tocado en móvil: al enemigo más cercano; si no hay, la del
 * joystick de apuntar (si se está empujando); si no, la última de disparo; y si todo falla, hacia abajo.
 */
export function touchAimDir(from: AimPoint, targets: readonly AimTarget[], stick: AimPoint | null, lastAim: AimPoint): AimPoint {
  const t = pickAimTarget(from, targets);
  if (t) {
    const d = unit({ x: t.x - from.x, y: t.y - from.y });
    if (d) return d;
  }
  if (stick && stick.x * stick.x + stick.y * stick.y > AIM_STICK_MIN_SQ) {
    const d = unit(stick);
    if (d) return d;
  }
  return unit(lastAim) ?? { x: 0, y: 1 };
}
