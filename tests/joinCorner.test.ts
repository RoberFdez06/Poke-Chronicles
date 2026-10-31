import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cornerOpen, cornerRect, joinWalls } from '../src/level/joinCorner.ts';

test('sala 2x2: la esquina central es suelo abierto (sin pilar ni muros sueltos que formen un bloque hueco)', () => {
  const f = { right: true, down: true, rightThenDown: true, downThenRight: true };
  assert.equal(cornerOpen(f), true);
  const jw = joinWalls(f);
  assert.deepEqual(jw, { rightBottom: false, downRight: false, cornerFloor: true });
  assert.equal('pillar' in jw, false);
});
test('sala en L o 2x1: se mantienen los muros que cierran la sala y no se pinta esquina', () => {
  assert.deepEqual(joinWalls({ right: true, down: false, rightThenDown: false, downThenRight: false }), { rightBottom: true, downRight: false, cornerFloor: false });
  assert.deepEqual(joinWalls({ right: true, down: true, rightThenDown: false, downThenRight: true }), { rightBottom: true, downRight: true, cornerFloor: false });
});
test('el suelo de la esquina cubre todo el hueco entre las cuatro casillas', () => {
  assert.deepEqual(cornerRect(880, 560, 1040, 720), { x: 880, y: 560, w: 160, h: 160 });
});
