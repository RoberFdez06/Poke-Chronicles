// Esquina central de una sala grande de 2x2 (cuatro casillas unidas). Lógica pura, sin Phaser.
// Antes, la unión derecha y la de abajo dibujaban cada una su muro en el lado que daba a la esquina y nadie ponía
// suelo en el cuadrado central: salía un bloque de ladrillo con el fondo asomando en mitad de la sala (con colisión
// para el jugador y no para los voladores, que lo atravesaban).

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

/** La esquina entre las cuatro casillas queda abierta (suelo, sin muros) solo si las cuatro forman un bloque 2x2. */
export const cornerOpen = (f: JoinFlags): boolean => f.right && f.down && f.rightThenDown && f.downThenRight;

/** Qué muros pinta la unión de esta casilla: los que dan a la esquina se quitan si la esquina está abierta. */
export function joinWalls(f: JoinFlags): { rightBottom: boolean; downRight: boolean; cornerFloor: boolean } {
  const open = cornerOpen(f);
  return { rightBottom: f.right && !open, downRight: f.down && !open, cornerFloor: open };
}
