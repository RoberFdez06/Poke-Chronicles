// Temperamento de cada enemigo: aunque sean de la misma especie, unos atacan más rápido y otros más lento.
// Afecta al tiempo entre ataques, a la velocidad de sus proyectiles y a su alcance. Lógica pura, sin Phaser.
// Equilibrado: el ágil ataca más a menudo pero con menos alcance; el pesado, al revés. El daño medio apenas cambia.

export type TemperamentId = 'agil' | 'normal' | 'pesado';

export interface Temperament {
  id: TemperamentId;
  /** Peso en el sorteo. */
  weight: number;
  /** Multiplica el tiempo de recuperación entre ataques (<1 = ataca más a menudo). */
  cooldownMul: number;
  /** Multiplica la velocidad de sus proyectiles. */
  shotSpeedMul: number;
  /** Multiplica el alcance de sus proyectiles (distancia recorrida). */
  rangeMul: number;
  /** Señal visual sutil: tamaño del sprite. */
  sizeMul: number;
}

export const TEMPERAMENTS: Readonly<Record<TemperamentId, Temperament>> = {
  agil: { id: 'agil', weight: 0.25, cooldownMul: 0.8, shotSpeedMul: 1.2, rangeMul: 0.85, sizeMul: 0.93 },
  normal: { id: 'normal', weight: 0.5, cooldownMul: 1, shotSpeedMul: 1, rangeMul: 1, sizeMul: 1 },
  pesado: { id: 'pesado', weight: 0.25, cooldownMul: 1.25, shotSpeedMul: 0.85, rangeMul: 1.15, sizeMul: 1.07 },
};

/** Límites de los multiplicadores (los tests comprueban que la tabla los respeta). */
export const TEMPERAMENT_BOUNDS = { min: 0.75, max: 1.3 } as const;

/** Sortea el temperamento con el rng del enemigo. */
export function rollTemperament(rng: () => number): Temperament {
  const list = Object.values(TEMPERAMENTS);
  const total = list.reduce((s, t) => s + t.weight, 0);
  let r = Math.max(0, Math.min(0.999999, rng())) * total;
  for (const t of list) {
    if (r < t.weight) return t;
    r -= t.weight;
  }
  return TEMPERAMENTS.normal;
}

/** Recuperación entre ataques ya ajustada. */
export const tempoCooldown = (t: Temperament | undefined, ms: number): number => Math.round(ms * (t?.cooldownMul ?? 1));

/** Velocidad (px/s) y vida (ms) del proyectil: la vida se ajusta para que el alcance sea rangeMul. */
export function tempoShot(t: Temperament | undefined, speed: number, lifeMs: number): { speed: number; life: number } {
  if (!t) return { speed, life: lifeMs };
  return { speed: speed * t.shotSpeedMul, life: Math.round((lifeMs * t.rangeMul) / t.shotSpeedMul) };
}

/** Ritmo de ataque medio (1 = igual que sin temperamento): para comprobar el equilibrio. */
export function expectedAttackRate(): number {
  const list = Object.values(TEMPERAMENTS);
  const total = list.reduce((s, t) => s + t.weight, 0);
  return list.reduce((s, t) => s + (t.weight / total) / t.cooldownMul, 0);
}
