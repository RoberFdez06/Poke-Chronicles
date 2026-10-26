// T77: Ataque cargado. Mantener el botón de disparo carga un golpe; a los 0,8 s sale solo un disparo grande (doble de
// daño, atraviesa y cambia según el tipo). Soltar antes dispara el normal. Lógica pura, sin Phaser.
//
// Cada fuente de disparo (teclado, ratón, mando, táctil) lleva su propia carga, para que cualquiera pueda cargar sola.
// El reloj es el del bucle del juego (`game.loop.time`), como la recarga del parry: avanza también en pausa, y al
// pausar o cambiar de sala la carga se cancela y queda bloqueada hasta soltar el botón (así no sale un disparo
// fantasma al volver ni se encadenan dos cargados manteniendo pulsado).

/** Tiempo de carga (ms). */
export const CHARGE_MS = 800;
/** Multiplicador de daño del disparo cargado. */
export const CHARGE_DAMAGE_MUL = 2;
/** Velocidad de movimiento mientras cargas (un 40 % más lento). */
export const CHARGE_MOVE_MUL = 0.6;
/** Por debajo de esto no se cuenta como carga y no frena (un toque rápido es un disparo normal). */
export const CHARGE_MIN_MS = 120;

export type ChargeSource = 'teclado' | 'raton' | 'mando' | 'tactil';
export const CHARGE_SOURCES: readonly ChargeSource[] = ['teclado', 'raton', 'mando', 'tactil'];

export interface ChargeState {
  /** Desde cuándo (reloj del bucle) se mantiene pulsado; null si no se está cargando. */
  heldSince: number | null;
  /** Ya salió un disparo (o se canceló) en esta pulsación: no sale nada más hasta soltar. */
  locked: boolean;
}

export const newCharge = (): ChargeState => ({ heldSince: null, locked: false });

export type ChargeAction = 'nada' | 'normal' | 'cargado';

/**
 * Un paso: `held` es si el botón de esta fuente está pulsado ahora. Devuelve qué disparo sale en este instante.
 * - Al llegar a CHARGE_MS con el botón pulsado sale el cargado (una sola vez por pulsación).
 * - Al soltar antes de tiempo sale el normal.
 */
export function stepCharge(s: ChargeState, held: boolean, loopNow: number): ChargeAction {
  if (!held) {
    const was = s.heldSince;
    const locked = s.locked;
    s.heldSince = null;
    s.locked = false;
    return was !== null && !locked ? 'normal' : 'nada';
  }
  if (s.locked) return 'nada';
  if (s.heldSince === null) s.heldSince = loopNow;
  if (loopNow - s.heldSince >= CHARGE_MS) {
    s.locked = true;
    return 'cargado';
  }
  return 'nada';
}

/** Cancela la carga (pausa, cambio de sala, objeto activo…). No vuelve a cargar hasta soltar el botón. */
export function cancelCharge(s: ChargeState): void {
  s.heldSince = null;
  s.locked = true;
}

/** Progreso de la carga de 0 a 1 (para el brillo). */
export const chargeProgress = (s: ChargeState, loopNow: number): number =>
  s.heldSince === null || s.locked ? 0 : Math.max(0, Math.min(1, (loopNow - s.heldSince) / CHARGE_MS));

/** Si se está cargando de verdad (frena al jugador). */
export const isCharging = (s: ChargeState, loopNow: number): boolean =>
  s.heldSince !== null && !s.locked && loopNow - s.heldSince >= CHARGE_MIN_MS;

/** Daño según la carga: el normal sin completar, el doble con la carga completa. */
export const chargedDamage = (base: number, progress: number): number => (progress >= 1 ? base * CHARGE_DAMAGE_MUL : base);

/** Forma del disparo cargado según el tipo del movimiento. */
export interface ChargedShape {
  /** Multiplica el tamaño del proyectil. */
  sizeMul: number;
  /** Enemigos que atraviesa además de los normales. */
  pierce: number;
  /** Rebotes extra (el eléctrico «salta»). */
  bounces: number;
  /** Multiplica el empujón al golpear (el agua empuja). */
  pushMul: number;
  /** Deja un rastro por donde pasa (el fuego). */
  trail: boolean;
}

const BASE_SHAPE: ChargedShape = { sizeMul: 1.8, pierce: 99, bounces: 0, pushMul: 1, trail: false };

const SHAPES: Partial<Record<string, Partial<ChargedShape>>> = {
  fire: { trail: true },
  water: { pushMul: 3 },
  electric: { bounces: 3 },
  ice: { sizeMul: 2.2 },
  rock: { sizeMul: 2.4, pushMul: 2 },
  fighting: { pushMul: 2.5 },
  ghost: { bounces: 1 },
  steel: { sizeMul: 2, pushMul: 1.5 },
};

export const chargedShapeFor = (type: string): ChargedShape => ({ ...BASE_SHAPE, ...(SHAPES[type] ?? {}) });
