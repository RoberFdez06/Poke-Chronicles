// Defensa de torres: decisiones en plena oleada. Trampas en el camino (minas y telarañas), barricadas que cierran una
// ruta pagando, mover torres (con coste y, durante la oleada, un rato aturdidas) y vender más barato en plena
// oleada. Solo números y reglas; el motor (engine.ts) los usa. Lógica pura, sin Phaser.
import { spentFor } from './towers.ts';
import type { TdMon } from './species.ts';

export type TrapKind = 'mina' | 'red';
export const TRAP_KINDS: readonly TrapKind[] = ['mina', 'red'];

export interface TrapInfo {
  name: string;
  desc: string;
  color: number;
  /** Usos antes de romperse. */
  uses: number;
}

export const TRAP_INFO: Readonly<Record<TrapKind, TrapInfo>> = {
  mina: { name: 'Mina', desc: 'Explota al pisarla: daño en área', color: 0xff7a3a, uses: 1 },
  red: { name: 'Telaraña', desc: 'Frena mucho a los 4 primeros que pasan', color: 0xe8ecf4, uses: 4 },
};

/** Trampas a la vez en el mapa. */
export const MAX_TRAPS = 4;
export const MINE_RADIUS = 1.25;
export const WEB_SLOW = 0.4;
export const WEB_TIME = 2.6;

export const trapCost = (kind: TrapKind, wave: number): number => (kind === 'mina' ? 55 : 40) + Math.max(0, wave) * (kind === 'mina' ? 4 : 2);
export const mineDamage = (wave: number): number => Math.round(70 + 24 * Math.max(1, wave));

/** Barricada: cierra una ruta durante esta oleada y la siguiente (o las dos próximas si se pone en la preparación). */
export const BARRICADE_WAVES = 2;
export const barricadeCost = (wave: number): number => 60 + 6 * Math.max(0, wave);

/** Vender en plena oleada devuelve menos (en la preparación, lo de siempre). */
export const SELL_WAVE_PART = 0.5;
export const sellInWave = (mon: Pick<TdMon, 'rarity'>, level: number): number => Math.floor(spentFor(mon, level) * SELL_WAVE_PART);

/** Mover una torre: un 8 % de lo gastado en la preparación y un 20 % en plena oleada (mín. 10), y queda aturdida. */
export const MOVE_STUN = 2;
export function moveCost(mon: Pick<TdMon, 'rarity'>, level: number, inWave: boolean): number {
  return Math.max(10, Math.round((spentFor(mon, level) * (inWave ? 0.2 : 0.08)) / 5) * 5);
}
