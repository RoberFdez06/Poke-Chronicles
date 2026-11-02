import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STALE_MS, shouldRelease, stepPointer, touchHitR, type HeldPointer } from '../src/data/touchPointers.ts';

const free: HeldPointer = { id: null, last: 0 };
test('down, move y up normales', () => {
  let s = stepPointer(free, { type: 'down', id: 1, t: 100 });
  assert.equal(s.id, 1);
  assert.ok(s.took);
  s = stepPointer(s, { type: 'move', id: 1, t: 200 });
  assert.equal(s.last, 200);
  s = stepPointer(s, { type: 'up', id: 1 });
  assert.equal(s.id, null);
});
test('otro dedo no roba el stick mientras el primero da señales', () => {
  const s = stepPointer({ id: 1, last: 1000 }, { type: 'down', id: 2, t: 1000 + STALE_MS - 1 });
  assert.equal(s.id, 1);
  assert.equal(s.took, false);
});
test('un dedo sin «up» (perdido) lo suelta el siguiente toque', () => {
  const s = stepPointer({ id: 1, last: 1000 }, { type: 'down', id: 2, t: 1000 + STALE_MS });
  assert.equal(s.id, 2);
  assert.ok(s.took);
});
test('cancel y blur sueltan; up de otro dedo no', () => {
  assert.equal(stepPointer({ id: 1, last: 0 }, { type: 'cancel', id: 1 }).id, null);
  assert.equal(stepPointer({ id: 1, last: 0 }, { type: 'blur' }).id, null);
  assert.equal(stepPointer({ id: 1, last: 0 }, { type: 'up', id: 3 }).id, 1);
  assert.equal(stepPointer({ id: 1, last: 0 }, { type: 'move', id: 3, t: 50 }).last, 0);
});
test('shouldRelease: solo si el sistema ya no lo tiene pulsado', () => {
  assert.equal(shouldRelease({ id: 1, last: 0 }, () => true), false);
  assert.equal(shouldRelease({ id: 1, last: 0 }, () => false), true);
  assert.equal(shouldRelease({ id: 1, last: 0 }, () => undefined), true);
  assert.equal(shouldRelease(free, () => false), false);
});
test('touchHitR: zona de toque ≥ 56 px de diámetro y mayor que el dibujo', () => {
  for (const s of [20, 38, 49, 84]) {
    assert.ok(touchHitR(s) * 2 >= 56);
    assert.ok(touchHitR(s) > s / 2);
  }
});
