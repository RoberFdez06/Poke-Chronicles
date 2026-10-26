// Reto final (supervisor, pedido por Roberto el 19/10): al vencer al jefe del último piso de Normal aparece una
// trampilla dorada; al pisarla se pregunta si entras al reto final o te rindes (y ganas igual). Abajo, en una arena,
// espera al azar un trío legendario (los tres a la vez; si cae uno, los demás se enfurecen) o un legendario gigante
// con mucha vida y una última fase de furia. Lógica pura, con tests.
import { FLOOR_COUNT } from '../level/progression.ts';
import type { GameMode } from './modes.ts';

export const FINAL_FLOOR = FLOOR_COUNT + 1;
export const isFinalFloor = (mode: GameMode, n: number) => mode === 'normal' && n === FINAL_FLOOR;
/** Tras vencer al jefe de este piso sale la trampilla dorada del reto final. */
export const isFinaleGate = (mode: GameMode, n: number) => mode === 'normal' && n === FLOOR_COUNT;

export interface Trio {
  name: string;
  ids: number[];
}
export const TRIOS: readonly Trio[] = [
  { name: 'Aves legendarias', ids: [144, 145, 146] },
  { name: 'Bestias legendarias', ids: [243, 244, 245] },
  { name: 'Golems legendarios', ids: [377, 378, 379] },
  { name: 'Guardianes de los lagos', ids: [480, 481, 482] },
  { name: 'Espadachines místicos', ids: [638, 639, 640] },
  { name: 'Fuerzas de la naturaleza', ids: [641, 642, 645] },
  { name: 'Tapus', ids: [785, 786, 787] },
  { name: 'Tesoros de la ruina', ids: [1001, 1002, 1003] },
];
/** Legendarios de portada: los gigantes. */
export const GIANTS: readonly number[] = [150, 249, 250, 382, 383, 384, 483, 484, 487, 643, 644, 646, 716, 717, 718, 791, 792, 800, 888, 889, 890, 898, 1007, 1008, 1024];

export type Finale = { kind: 'trio'; name: string; ids: number[] } | { kind: 'giant'; name: string; ids: number[] };

/** Vida de cada miembro del trío y del gigante respecto a un jefe normal de ese piso. */
export const TRIO_HP_MUL = 1.3;
export const GIANT_HP_MUL = 3.5;
/** El gigante se enfurece por debajo de esta parte de su vida. */
export const GIANT_RAGE_AT = 0.25;
export const GIANT_SIZE = 200;
/** Tickets extra por superar el reto final. */
export const FINALE_BONUS = 60;

/**
 * Elige el reto: trío o gigante al 50 %. `ok` dice qué Pokémon se pueden usar (sin conexión, solo los guardados);
 * si ningún trío está entero, gigante; si tampoco, el primero de la lista.
 */
export function pickFinale(rng: () => number, ok: (id: number) => boolean = () => true): Finale {
  const trios = TRIOS.filter((t) => t.ids.every(ok));
  const giants = GIANTS.filter(ok);
  const wantTrio = rng() < 0.5;
  if ((wantTrio || giants.length === 0) && trios.length > 0) {
    const t = trios[Math.floor(rng() * trios.length)];
    return { kind: 'trio', name: t.name, ids: [...t.ids] };
  }
  const id = giants.length > 0 ? giants[Math.floor(rng() * giants.length)] : GIANTS[0];
  return { kind: 'giant', name: '', ids: [id] };
}
