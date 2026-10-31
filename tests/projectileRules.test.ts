import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACK_KINDS, PASSES_OVER, bounceOffRects, clipSegmentToRects, passesOverStructures, segmentBlocked } from '../src/data/projectileRules.ts';

test('cada ataque está clasificado explícitamente', () => {
  for (const k of ATTACK_KINDS) assert.equal(typeof PASSES_OVER[k], 'boolean', k);
  assert.equal(Object.keys(PASSES_OVER).length, ATTACK_KINDS.length);
});
test('disparos, rayos, láseres, orbes y ondas lineales chocan; lo que vuela y cae pasa por encima', () => {
  for (const k of ['shot', 'stream', 'beam', 'chain', 'wall', 'playerShot', 'foeShot', 'laser', 'megaBlast', 'gridBeams', 'crossMines', 'wallGap', 'bounce', 'spiral', 'helix', 'shockwave'] as const) {
    assert.equal(passesOverStructures(k), false, k);
  }
  for (const k of ['lob', 'rain', 'bossRain', 'meteor', 'quake', 'eruption', 'mine', 'hazard', 'miasma', 'judgment'] as const) {
    assert.equal(passesOverStructures(k), true, k);
  }
});
test('un rayo se corta en la primera roca', () => {
  const rocks = [{ x: 200, y: -40, w: 80, h: 80 }, { x: 100, y: -40, w: 40, h: 80 }];
  assert.equal(clipSegmentToRects(0, 0, 0, 500, rocks), 100);
  assert.equal(clipSegmentToRects(0, 0, Math.PI, 500, rocks), 500);
  assert.equal(clipSegmentToRects(0, 0, Math.PI / 2, 500, rocks), 500);
  // En diagonal pasa por encima de la esquina
  assert.equal(clipSegmentToRects(0, 0, -Math.PI / 4, 500, rocks), 500);
  // Más corto que la distancia a la roca: entero
  assert.equal(clipSegmentToRects(0, 0, 0, 60, rocks), 60);
  // Origen dentro de una caja: se ignora esa caja
  assert.equal(clipSegmentToRects(120, 0, 0, 500, rocks), 80);
});
test('con relleno, el haz ancho roza antes', () => {
  assert.equal(clipSegmentToRects(0, 0, 0, 500, [{ x: 100, y: 20, w: 40, h: 40 }]), 500);
  assert.equal(clipSegmentToRects(0, 0, 0, 500, [{ x: 100, y: 20, w: 40, h: 40 }], 30), 70);
});
test('segmentBlocked: una roca en medio tapa', () => {
  const r = [{ x: 90, y: -10, w: 20, h: 20 }];
  assert.equal(segmentBlocked(0, 0, 200, 0, r), true);
  assert.equal(segmentBlocked(0, 0, 200, 100, r), false);
  assert.equal(segmentBlocked(0, 0, 80, 0, r), false);
});
test('el orbe rebota en la roca y gasta un rebote', () => {
  const o = bounceOffRects({ x: 95, y: 50, vx: 200, vy: 0, left: 2 }, 10, [{ x: 100, y: 0, w: 100, h: 100 }]);
  assert.deepEqual(o, { x: 90, y: 50, vx: -200, vy: 0, left: 1 });
  const free = { x: 0, y: 0, vx: 1, vy: 1, left: 2 };
  assert.equal(bounceOffRects(free, 10, [{ x: 100, y: 0, w: 100, h: 100 }]), free);
});
