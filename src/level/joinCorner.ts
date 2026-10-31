// Esquina central de una sala grande de 2x2 (cuatro casillas unidas). Lógica pura, sin Phaser.
// Historia: primero era un anillo de muros con el fondo asomando por dentro (bloque hueco), luego un pilar macizo y,
// a petición del jugador, ahora NO hay nada: la esquina central es suelo abierto, sin muros interiores hacia ella y
// con su propio trozo de suelo pintado (si no se pinta, asoma el fondo, que era el bug del bloque hueco).

export interface JoinFlags {
  /** La casilla se une con la de su derecha. */
  right: boolean;
  /** La casilla se une con la de abajo. */
  down: boolean;
  /** La casilla de la derecha se une con la de debajo de ella. */
  rightThenDown: boolean;
  /** La casilla de abajo se une con la de su derecha. */
  downThenRight: boolean;
}

export interface Rect { x: number; y: number; w: number; h: number }

/** Las cuatro casillas forman un bloque 2x2: la esquina central es suelo abierto. */
export const cornerOpen = (f: JoinFlags): boolean => f.right && f.down && f.rightThenDown && f.downThenRight;

/**
 * Qué pinta la unión de esta casilla: en 2x2 no hay muros hacia la esquina central y se pinta suelo en ella
 * (`cornerFloor`); en L o 2x1 se mantienen los muros que cierran la sala.
 */
export function joinWalls(f: JoinFlags): { rightBottom: boolean; downRight: boolean; cornerFloor: boolean } {
  const open = cornerOpen(f);
  return { rightBottom: f.right && !open, downRight: f.down && !open, cornerFloor: open };
}

/** Cuadrado de la esquina central: el hueco entre el interior de esta casilla (x1, y1) y el de la de la derecha/abajo (x0, y0). */
export function cornerRect(x1: number, y1: number, nextX0: number, nextY0: number): Rect {
  return { x: x1, y: y1, w: Math.max(0, nextX0 - x1), h: Math.max(0, nextY0 - y1) };
}
