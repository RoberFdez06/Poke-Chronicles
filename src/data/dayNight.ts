// Día y noche (T67): el ciclo alterna día y noche cada DAY_NIGHT_MINUTES minutos de partida.
// Cuenta el tiempo JUGADO (`counters.seconds`, que no avanza en pausa y ya se guarda con la partida),
// así que continuar una partida mantiene la fase sin añadir nada a RunSave: la fase es una función pura del tiempo.
// Lógica pura, sin Phaser, para poder testearla.

/** Minutos de partida que dura cada fase. Cámbialo aquí (entre 5 y 10). */
export const DAY_NIGHT_MINUTES = 6;
export const PHASE_MS = DAY_NIGHT_MINUTES * 60_000;

export type Phase = 'day' | 'night';

export const PHASE_LABEL: Record<Phase, string> = { day: 'Día', night: 'Noche' };
/** Aviso al cambiar de fase (va fuera del centro, ver GameScene.notify). */
export const PHASE_NOTICE: Record<Phase, string> = { day: 'Amanece', night: 'Se hace de noche' };
export const PHASE_DESC: Record<Phase, string> = {
  day: 'Más Planta, Fuego y Normal',
  night: 'Más Fantasma, Siniestro y Psíquico',
};

/** Tipos favorecidos en cada fase. */
export const PHASE_TYPES: Readonly<Record<Phase, readonly string[]>> = {
  day: ['grass', 'fire', 'normal'],
  night: ['ghost', 'dark', 'psychic'],
};

/** Peso de aparición de un tipo favorecido (el resto pesa 1: nunca se oculta nada) y daño extra de sus ataques. */
export const FAVORED_SPAWN_WEIGHT = 1.8;
export const FAVORED_DAMAGE_MUL = 1.15;

/** Fase según los milisegundos jugados. Empieza de día. */
export function phaseAt(playedMs: number): Phase {
  const ms = Number.isFinite(playedMs) ? Math.max(0, playedMs) : 0;
  return Math.floor(ms / PHASE_MS) % 2 === 0 ? 'day' : 'night';
}

/** Fase según los segundos jugados (`counters.seconds`). */
export const phaseAtSeconds = (seconds: number): Phase => phaseAt(seconds * 1000);

/** Milisegundos que faltan para el próximo cambio. */
export function msToNextPhase(playedMs: number): number {
  const ms = Math.max(0, playedMs);
  return PHASE_MS - (ms % PHASE_MS);
}

/** ¿Este tipo (o alguno de los suyos) está favorecido en la fase? */
export function isFavored(phase: Phase, types: readonly string[]): boolean {
  return types.some((t) => PHASE_TYPES[phase].includes(t));
}

/** Peso para elegir enemigo: algo mayor si su tipo está favorecido. */
export const spawnWeight = (phase: Phase, types: readonly string[]): number => (isFavored(phase, types) ? FAVORED_SPAWN_WEIGHT : 1);

/** Multiplicador del daño de un ataque de tipo `type` en esta fase. */
export function phasePowerMul(phase: Phase, type: string | undefined): number {
  return type && PHASE_TYPES[phase].includes(type) ? FAVORED_DAMAGE_MUL : 1;
}

/** Elige uno de `items` con peso según la fase (rng en [0,1)). Devuelve undefined si no hay nada. */
export function pickByPhase<T>(items: readonly T[], phase: Phase, typesOf: (x: T) => readonly string[], rng: () => number): T | undefined {
  if (items.length === 0) return undefined;
  const weights = items.map((x) => spawnWeight(phase, typesOf(x)));
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * ¿Hay cambio de fase entre dos instantes de juego? Devuelve la nueva fase o null.
 * Si se salta más de una fase de golpe, solo importa en cuál se acaba.
 */
export function phaseChange(prevMs: number, nowMs: number): Phase | null {
  const a = phaseAt(prevMs);
  const b = phaseAt(nowMs);
  return a === b ? null : b;
}
