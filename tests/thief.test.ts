import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coinsAfterTheft, thiefCanAppear, thiefEscapeDoor, thiefEscaped, thiefRefund, thiefSteal } from '../src/level/thief.ts';
import { ROOM_EVENTS, ROOM_EVENT_LABEL } from '../src/level/roomEvents.ts';

test('cuánto roba: un 35 % con mínimo de 3', () => {
  assert.equal(thiefSteal(100), 35);
  assert.equal(thiefSteal(20), 7);
  assert.equal(thiefSteal(8), 3);
});

test('tope: nunca más de la mitad ni deja la cuenta en negativo', () => {
  for (let c = 0; c <= 300; c++) {
    const s = thiefSteal(c);
    assert.ok(s <= Math.max(1, Math.floor(c / 2)) || c === 0, `${c}`);
    assert.ok(s <= c);
    assert.ok(coinsAfterTheft(c, s) >= 0);
  }
  assert.equal(thiefSteal(4), 2);
  assert.equal(thiefSteal(1), 1);
  assert.equal(coinsAfterTheft(2, 5), 0);
});

test('devolución: lo robado más un extra', () => {
  assert.equal(thiefRefund(10), 15);
  assert.equal(thiefRefund(1), 3);
  for (let s = 0; s < 60; s++) assert.ok(thiefRefund(s) > s);
});

test('sin monedas el evento no sale', () => {
  assert.equal(thiefCanAppear(0), false);
  assert.equal(thiefCanAppear(-3), false);
  assert.equal(thiefCanAppear(1), true);
  assert.equal(thiefSteal(0), 0);
});

test('huye a la puerta más lejana y escapa al llegar', () => {
  const doors = [{ x: 0, y: 0, d: 'a' }, { x: 500, y: 0, d: 'b' }];
  assert.equal(thiefEscapeDoor(doors, { x: 10, y: 0 })?.d, 'b');
  assert.equal(thiefEscapeDoor([], { x: 0, y: 0 }), null);
  assert.ok(thiefEscaped({ x: 490, y: 10 }, doors[1]));
  assert.ok(!thiefEscaped({ x: 300, y: 0 }, doors[1]));
});

test('el ladrón es un evento de sala con etiqueta', () => {
  assert.ok(ROOM_EVENTS.includes('thief'));
  assert.ok(ROOM_EVENT_LABEL.thief);
});
