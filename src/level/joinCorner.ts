// Esquina central de una sala grande de 2x2 (cuatro casillas unidas). Lógica pura, sin Phaser.
// En el cuadrado central entre las cuatro casillas va un PILAR macizo: relleno entero de la pared del bioma, con tapa
// en relieve y sombra, y colisión para todos (jugador, enemigos, jefes voladores y sus embestidas/teletransportes).
// Antes era un anillo de muros con el fondo asomando por dentro (parecía que se podía pasar por encima) y después se
// quitó del todo; el pilar debe estar, pero claramente sólido.

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

/** Las cuatro casillas forman un bloque 2x2: en la esquina central va el pilar. */
export const cornerOpen = (f: JoinFlags): boolean => f.right && f.down && f.rightThenDown && f.downThenRight;

/**
 * Qué pinta la unión de esta casilla: en 2x2 no se ponen los muros sueltos que daban a la esquina (salía un anillo
 * hueco) y en su lugar va un único pilar macizo que ocupa todo el cuadrado central.
 */
export function joinWalls(f: JoinFlags): { rightBottom: boolean; downRight: boolean; pillar: boolean } {
  const open = cornerOpen(f);
  return { rightBottom: f.right && !open, downRight: f.down && !open, pillar: open };
}

/** Rectángulo del pilar: el hueco entre el interior de esta casilla (x1, y1) y el de la de la derecha/abajo (x0, y0). */
export function pillarRect(x1: number, y1: number, nextX0: number, nextY0: number): Rect {
  return { x: x1, y: y1, w: Math.max(0, nextX0 - x1), h: Math.max(0, nextY0 - y1) };
}

/**
 * Si un cuerpo de radio `r` en (x, y) se mete en el pilar, el punto más cercano fuera de él (por el lado con menos
 * recorrido). Si no lo toca, devuelve null. Sirve para que nada (ni voladores ni jefes que se teletransportan) quede
 * dibujado dentro.
 */
export function pushOutOfRect(x: number, y: number, r: number, p: Rect): { x: number; y: number } | null {
  const x0 = p.x - r;
  const y0 = p.y - r;
  const x1 = p.x + p.w + r;
  const y1 = p.y + p.h + r;
  if (x <= x0 || x >= x1 || y <= y0 || y >= y1) return null;
  const opts = [
    { d: x - x0, x: x0, y },
    { d: x1 - x, x: x1, y },
    { d: y - y0, x, y: y0 },
    { d: y1 - y, x, y: y1 },
  ];
  opts.sort((a, b) => a.d - b.d);
  return { x: opts[0].x, y: opts[0].y };
}
