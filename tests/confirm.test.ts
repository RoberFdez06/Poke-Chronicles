import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accept, cancel, choose, confirmText, moveFocus, newConfirm, priceLabel } from '../src/data/confirm.ts';

test('al abrir, el foco está en «No» y sigue abierta', () => {
  assert.deepEqual(newConfirm(), { focus: 'no', result: null });
});

test('Enter con el foco por defecto cancela: una pulsación de más no compra', () => {
  assert.equal(accept(newConfirm()).result, false);
});

test('izquierda lleva a «Sí» y Enter compra; derecha vuelve a «No»', () => {
  let s = moveFocus(newConfirm(), -1);
  assert.equal(s.focus, 'yes');
  assert.equal(moveFocus(s, -1).focus, 'yes'); // no da la vuelta
  s = moveFocus(s, 1);
  assert.equal(s.focus, 'no');
  assert.equal(accept(moveFocus(s, -1)).result, true);
});

test('Esc / B / clic fuera cancelan aunque el foco esté en «Sí»', () => {
  assert.equal(cancel(moveFocus(newConfirm(), -1)).result, false);
});

test('clic en Sí compra y clic en No cancela, sin importar el foco', () => {
  assert.equal(choose(newConfirm(), 'yes').result, true);
  assert.equal(choose(moveFocus(newConfirm(), -1), 'no').result, false);
});

test('una vez resuelta, ya no cambia (doble pulsación)', () => {
  const done = accept(moveFocus(newConfirm(), -1));
  assert.equal(done.result, true);
  assert.equal(cancel(done), done);
  assert.equal(moveFocus(done, 1), done);
  assert.equal(choose(done, 'no'), done);
  assert.equal(accept(done), done);
});

test('moverse sin dirección no cambia nada', () => {
  const s = newConfirm();
  assert.equal(moveFocus(s, 0), s);
});

test('textos: nombre, precio y plural', () => {
  assert.equal(confirmText('Superpoción', 30), '¿Seguro que quieres comprar Superpoción por 30 monedas?');
  assert.equal(priceLabel(1, 'monedas'), '1 moneda');
  assert.equal(priceLabel(1, 'tickets'), '1 ticket');
  assert.equal(confirmText('Fuerza', 12, 'caramelos'), '¿Seguro que quieres comprar Fuerza por 12 caramelos?');
});
