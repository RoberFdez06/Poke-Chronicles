import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cornerOpen, joinWalls } from '../src/level/joinCorner.ts';

test('sala 2x2: la esquina central es suelo y no lleva muros', () => {
  const f = { right: true, down: true, rightThenDown: true, downThenRight: true };
  assert.equal(cornerOpen(f), true);
  assert.deepEqual(joinWalls(f), { rightBottom: false, downRight: false, cornerFloor: true });
});
test('sala en L o 2x1: se mantienen los muros que cierran la sala', () => {
  assert.deepEqual(joinWalls({ right: true, down: false, rightThenDown: false, downThenRight: false }), { rightBottom: true, downRight: false, cornerFloor: false });
  assert.deepEqual(joinWalls({ right: true, down: true, rightThenDown: false, downThenRight: true }), { rightBottom: true, downRight: true, cornerFloor: false });
});
