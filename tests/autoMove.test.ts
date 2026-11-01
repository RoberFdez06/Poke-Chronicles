import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoMoveDir, inHazard, MELEE_KEEP } from '../src/data/autoMove.ts';

const P = { x: 500, y: 500 };
const speed = 260;

test('sin nada alrededor se queda quieto', () => {
  assert.deepEqual(autoMoveDir({ player: P, speed }), { x: 0, y: 0 });
});

test('esquiva un proyectil que viene de frente (se aparta de su línea)', () => {
  const d = autoMoveDir({ player: P, speed, shots: [{ x: 300, y: 500, vx: 500, vy: 0, r: 10 }] });
  assert.ok(Math.abs(d.y) > 0.3, `debería apartarse de la línea: ${JSON.stringify(d)}`);
});

test('se aleja de un enemigo cuerpo a cuerpo', () => {
  const d = autoMoveDir({ player: P, speed, foes: [{ x: 560, y: 500, melee: true }] });
  assert.ok(d.x < -0.5, JSON.stringify(d));
});

test('a un tirador lejano no le huye', () => {
  const d = autoMoveDir({ player: P, speed, foes: [{ x: 500 + MELEE_KEEP + 200, y: 500, melee: false }] });
  assert.deepEqual(d, { x: 0, y: 0 });
});

test('sale de una línea de peligro (aviso de jefe)', () => {
  const d = autoMoveDir({ player: P, speed, hazards: [{ kind: 'seg', x1: 0, y1: 500, x2: 1000, y2: 500, w: 60 }] });
  assert.ok(Math.abs(d.y) > 0.8, JSON.stringify(d));
});

test('sale de un círculo de golpe', () => {
  const d = autoMoveDir({ player: P, speed, hazards: [{ kind: 'circle', x: 520, y: 500, r: 120 }] });
  assert.ok(d.x < 0, JSON.stringify(d));
});

test('anillo: el hueco es seguro', () => {
  const ring = { kind: 'ring' as const, cx: 0, cy: 0, rMin: 90, rMax: 110, gapAng: 0, gapW: 1 };
  assert.equal(inHazard(ring, 100, 0), false);
  assert.equal(inHazard(ring, -100, 0), true);
  assert.equal(inHazard(ring, 0, 0), false);
});

test('no se mete en la pared', () => {
  // Enemigo a la derecha y pared a la izquierda: huye en vertical, no contra la pared
  const d = autoMoveDir({ player: P, speed, foes: [{ x: 560, y: 500, melee: true }], walkable: (x) => x > 470 });
  assert.ok(Math.abs(d.y) > 0.5, JSON.stringify(d));
  assert.ok(d.x > -0.3, JSON.stringify(d));
});

test('va a por una moneda cercana y no a una lejana', () => {
  const d = autoMoveDir({ player: P, speed, pickups: [{ x: 500, y: 650 }] });
  assert.ok(d.y > 0.8, JSON.stringify(d));
  assert.deepEqual(autoMoveDir({ player: P, speed, pickups: [{ x: 500, y: 1500 }] }), { x: 0, y: 0 });
});

test('esquivar pesa más que la moneda', () => {
  const d = autoMoveDir({ player: P, speed, pickups: [{ x: 700, y: 500 }], hazards: [{ kind: 'circle', x: 650, y: 500, r: 160 }] });
  assert.ok(d.x <= 0.3, JSON.stringify(d));
});
