// T57: «Una más». Al caer, una única segunda oportunidad por partida: pagando caramelos o tickets (lo elige el
// jugador; nunca las monedas de la partida, que son solo para la tienda) vuelves con media vida en la misma sala y
// 2 s de inmunidad. Lógica pura, sin Phaser: el saldo y el gasto real los lleva save.ts (los invitados gastan en
// memoria, así que pueden usarla pero no se guarda nada).
import { CANDY_PER_TICKET } from './save.ts';

export type ReviveCurrency = 'candies' | 'tickets';
export const REVIVE_CURRENCIES: readonly ReviveCurrency[] = ['candies', 'tickets'];

/** Vida con la que vuelves (fracción de los PS máximos) e inmunidad al volver (ms). */
export const REVIVE_HP_FRAC = 0.5;
export const REVIVE_IMMUNE_MS = 2000;

/** Tickets que cuesta: más cuanto más hondo has llegado (vale más volver en el piso 5 que en el 1), con tope. */
export const REVIVE_TICKETS_BASE = 10;
export const REVIVE_TICKETS_PER_FLOOR = 2;
export const REVIVE_TICKETS_MAX = 30;

/** Precio en cada moneda. Los caramelos al cambio de siempre (CANDY_PER_TICKET por ticket). */
export function reviveCost(currency: ReviveCurrency, floorNum: number): number {
  const tickets = Math.min(REVIVE_TICKETS_MAX, REVIVE_TICKETS_BASE + REVIVE_TICKETS_PER_FLOOR * (Math.max(1, Math.floor(floorNum)) - 1));
  return currency === 'tickets' ? tickets : tickets * CANDY_PER_TICKET;
}

export type Balances = Record<ReviveCurrency, number>;

/** ¿Se ofrece? Solo si no se ha usado en la partida y se puede pagar con alguna de las dos. */
export const canOfferRevive = (used: boolean, balances: Balances, floorNum: number): boolean =>
  !used && REVIVE_CURRENCIES.some((c) => balances[c] >= reviveCost(c, floorNum));

export type ReviveResult = { ok: true; cost: number } | { ok: false; reason: 'used' | 'funds' };

/** Intento de pagar con `currency`: dice cuánto cobrar o por qué no se puede (ya usada o sin saldo). */
export function reviveCharge(used: boolean, currency: ReviveCurrency, balance: number, floorNum: number): ReviveResult {
  if (used) return { ok: false, reason: 'used' };
  const cost = reviveCost(currency, floorNum);
  if (balance < cost) return { ok: false, reason: 'funds' };
  return { ok: true, cost };
}

/** PS al volver. */
export const revivedHp = (maxHp: number): number => Math.max(1, Math.round(maxHp * REVIVE_HP_FRAC));
