// T77: Ataque cargado. Es una entrada propia (tecla, botón del ratón, gatillo del mando): se mantiene pulsada para cargar y
// al soltarla con la carga completa (0,8 s) sale un disparo grande (doble de daño, atraviesa y cambia según el tipo). Soltar
// antes no dispara nada. El disparo básico no pasa por aquí: mantener el botón de disparar sigue siendo ráfaga automática.
// Lógica pura, sin Phaser.
//
// Cada fuente de carga (teclado, ratón, mando) lleva la suya, para que cualquiera pueda cargar sola. El reloj es el del
// bucle del juego (`game.loop.time`), como la recarga del parry: avanza también en pausa, y al pausar o cambiar de sala la
// carga se cancela y queda bloqueada hasta soltar el botón (así no sale un disparo fantasma al volver).

/** Tiempo de carga (ms). */
export const CHARGE_MS = 800;
/** Multiplicador de daño del disparo cargado. */
export const CHARGE_DAMAGE_MUL = 2;
/** Velocidad de movimiento mientras cargas (un 40 % más lento). */
export const CHARGE_MOVE_MUL = 0.6;
/** Por debajo de esto no se cuenta como carga y no frena (un toque rápido no estorba). */
export const CHARGE_MIN_MS = 120;

export type ChargeSource = 'teclado' | 'raton' | 'mando';
export const CHARGE_SOURCES: readonly ChargeSource[] = ['teclado', 'raton', 'mando'];

export interface ChargeState {
  /** Desde cuándo (reloj del bucle) se mantiene pulsado; null si no se está cargando. */
  heldSince: number | null;
  /** Se canceló en esta pulsación (pausa, sala, activo): no carga ni dispara hasta soltar. */
  locked: boolean;
}

export const newCharge = (): ChargeState => ({ heldSince: null, locked: false });

export type ChargeAction = 'nada' | 'cargado';

/**
 * Un paso: `held` es si el botón de carga de esta fuente está pulsado ahora. Devuelve qué sale en este instante.
 * - Mantener solo carga (nunca dispara mientras está pulsado).
 * - Al soltar con la carga completa (CHARGE_MS) sale el cargado, una vez. Al soltar antes, nada.
 */
export function stepCharge(s: ChargeState, held: boolean, loopNow: number): ChargeAction {
  if (!held) {
    const was = s.heldSince;
    const locked = s.locked;
    s.heldSince = null;
    s.locked = false;
    return was !== null && !locked && loopNow - was >= CHARGE_MS ? 'cargado' : 'nada';
  }
  if (!s.locked && s.heldSince === null) s.heldSince = loopNow;
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
