import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cornerOpen, joinWalls, pillarRect, pushOutOfRect } from '../src/level/joinCorner.ts';

test('sala 2x2: en la esquina central va un pilar macizo y no los muros sueltos (anillo hueco)', () => {
  const f = { right: true, down: true, rightThenDown: true, downThenRight: true };
  assert.equal(cornerOpen(f), true);
  assert.deepEqual(joinWalls(f), { rightBottom: false, downRight: false, pillar: true });
});
test('sala en L o 2x1: se mantienen los muros que cierran la sala y no hay pilar', () => {
  assert.deepEqual(joinWalls({ right: true, down: false, rightThenDown: false, downThenRight: false }), { rightBottom: true, downRight: false, pillar: false });
  assert.deepEqual(joinWalls({ right: true, down: true, rightThenDown: false, downThenRight: true }), { rightBottom: true, downRight: true, pillar: false });
});
test('el pilar ocupa todo el hueco entre las cuatro casillas', () => {
  assert.deepEqual(pillarRect(880, 560, 1040, 720), { x: 880, y: 560, w: 160, h: 160 });
});
test('nada queda dentro del pilar: se empuja fuera por el lado más cercano', () => {
  const p = { x: 100, y: 100, w: 160, h: 160 };
  assert.equal(pushOutOfRect(50, 50, 20, p), null);
  assert.deepEqual(pushOutOfRect(110, 180, 20, p), { x: 80, y: 180 });
  assert.deepEqual(pushOutOfRect(180, 255, 20, p), { x: 180, y: 280 });
  const c = pushOutOfRect(180, 180, 30, p)!;
  assert.ok(c.x <= 70 || c.x >= 290 || c.y <= 70 || c.y >= 290);
});
