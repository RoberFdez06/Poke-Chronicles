/**
 * Confirmación de compra («¿Seguro que quieres comprar X por N monedas?», Sí / No). Lógica pura, sin Phaser:
 * la pantalla (ConfirmScene) solo lee las pulsaciones y pinta este estado.
 * El foco empieza siempre en «No» para que una pulsación de más no gaste monedas.
 */

export type ConfirmChoice = 'yes' | 'no';

export interface ConfirmState {
  /** Opción resaltada. */
  focus: ConfirmChoice;
  /** `null` mientras está abierta; `true` si se ha comprado y `false` si se ha cancelado. */
  result: boolean | null;
}

/** Orden en pantalla, de izquierda a derecha. */
export const CONFIRM_ORDER: readonly ConfirmChoice[] = ['yes', 'no'];

export const CONFIRM_LABEL: Readonly<Record<ConfirmChoice, string>> = { yes: 'Sí', no: 'No' };

export function newConfirm(): ConfirmState {
  return { focus: 'no', result: null };
}

/** Mueve el foco: `dx` negativo hacia «Sí» (izquierda), positivo hacia «No» (derecha). No da la vuelta. */
export function moveFocus(s: ConfirmState, dx: number): ConfirmState {
  if (s.result !== null || dx === 0) return s;
  const i = CONFIRM_ORDER.indexOf(s.focus) + Math.sign(dx);
  const focus = CONFIRM_ORDER[Math.max(0, Math.min(CONFIRM_ORDER.length - 1, i))];
  return focus === s.focus ? s : { ...s, focus };
}

/** Enter / Espacio / A: confirma la opción resaltada (con el foco en «No», cancela). */
export function accept(s: ConfirmState): ConfirmState {
  return s.result !== null ? s : { ...s, result: s.focus === 'yes' };
}

/** Esc / B / clic fuera: cancela siempre. */
export function cancel(s: ConfirmState): ConfirmState {
  return s.result !== null ? s : { ...s, result: false };
}

/** Clic en una de las dos opciones. */
export function choose(s: ConfirmState, c: ConfirmChoice): ConfirmState {
  return s.result !== null ? s : { focus: c, result: c === 'yes' };
}

/** Lo que se paga: monedas de la partida, tickets o caramelos. */
export type PriceUnit = 'monedas' | 'tickets' | 'caramelos';

const SINGULAR: Readonly<Record<PriceUnit, string>> = { monedas: 'moneda', tickets: 'ticket', caramelos: 'caramelo' };

/** «1 moneda», «30 monedas». */
export function priceLabel(price: number, unit: PriceUnit): string {
  return `${price} ${price === 1 ? SINGULAR[unit] : unit}`;
}

/** Pregunta de la confirmación, con el nombre y el precio del artículo. */
export function confirmText(name: string, price: number, unit: PriceUnit = 'monedas'): string {
  return `¿Seguro que quieres comprar ${name} por ${priceLabel(price, unit)}?`;
}
