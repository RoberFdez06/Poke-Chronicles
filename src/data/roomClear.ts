// Vigilante de la limpieza de salas: lógica pura, sin Phaser.
// La sala se daba por limpia solo cuando caía un enemigo (killEnemy → checkClear). Si el último se iba de otra forma
// (atascado fuera, metido en una estructura, desaparecido sin pasar por killEnemy…) o la sala quedaba limpia con las
// puertas aún cerradas, te quedabas encerrado. Esto se mira cada poco y decide qué hacer.

/** Tiempo seguido sin enemigos hostiles antes de dar la sala por limpia (ms): evita adelantarse a un spawn. */
export const CLEAR_CONFIRM_MS = 600;
/** Tiempo que un enemigo puede pasar fuera de la sala o dentro de un obstáculo antes de recolocarlo (ms). */
export const FOE_STUCK_MS = 2500;

export interface RoomWatchState {
  /** La sala (o su sala grande) ya está en `cleared`. */
  cleared: boolean;
  /** Alguna puerta de la sala está cerrada ahora mismo. */
  doorsLocked: boolean;
  /** Enemigos hostiles vivos y activos en la sala. */
  hostile: number;
  now: number;
  /** Hasta cuándo no se decide nada (oleada o spawn en camino). */
  holdUntil: number;
  /** Desde cuándo no queda ningún hostil (undefined: sí quedan). */
  zeroSince: number | undefined;
}

export type RoomWatchAction = 'none' | 'clear' | 'unlock';

/** Qué hacer ahora y desde cuándo está vacía (para la próxima llamada). */
export function roomWatch(s: RoomWatchState): { action: RoomWatchAction; zeroSince: number | undefined } {
  const zeroSince = s.hostile > 0 ? undefined : (s.zeroSince ?? s.now);
  // Limpia pero con puertas cerradas: se abren (nunca te quedas encerrado en una sala ya limpia)
  if (s.cleared) return { action: s.doorsLocked && s.hostile === 0 ? 'unlock' : 'none', zeroSince };
  // Solo una sala cerrada por combate se da por limpia (las de eventos sin pelea se resuelven por su cuenta)
  if (!s.doorsLocked || s.hostile > 0 || s.now < s.holdUntil) return { action: 'none', zeroSince };
  return { action: s.now - (zeroSince ?? s.now) >= CLEAR_CONFIRM_MS ? 'clear' : 'none', zeroSince };
}

/** ¿Lleva un enemigo demasiado tiempo atascado? Devuelve el nuevo `since` y si hay que recolocarlo. */
export function stuckFoe(stuck: boolean, since: number | undefined, now: number): { since: number | undefined; relocate: boolean } {
  if (!stuck) return { since: undefined, relocate: false };
  const s = since ?? now;
  return now - s >= FOE_STUCK_MS ? { since: undefined, relocate: true } : { since: s, relocate: false };
}
