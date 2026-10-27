import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampDash, clampToBounds, clampVelocity, outOfBounds } from '../src/level/bounds.ts';

const B = { x0: 100, y0: 50, x1: 900, y1: 650 };

test('clampToBounds deja los puntos dentro con margen', () => {
  assert.deepEqual(clampToBounds(500, 300, B, 20), { x: 500, y: 300 });
  assert.deepEqual(clampToBounds(-50, 2000, B, 20), { x: 120, y: 630 });
  assert.deepEqual(clampToBounds(950, 0, B), { x: 900, y: 50 });
  // Margen mayor que la arena: al centro
  assert.deepEqual(clampToBounds(0, 0, { x0: 0, y0: 0, x1: 10, y1: 10 }, 40), { x: 5, y: 5 });
});

test('outOfBounds con tolerancia', () => {
  assert.equal(outOfBounds(500, 300, B), false);
  assert.equal(outOfBounds(905, 300, B), true);
  assert.equal(outOfBounds(905, 300, B, 10), false);
  assert.equal(outOfBounds(100, 49, B), true);
});

test('clampDash para en el borde en la misma dirección', () => {
  const p = clampDash(500, 300, 1500, 300, B, 30);
  assert.deepEqual(p, { x: 870, y: 300 });
  const d = clampDash(500, 300, 1300, 1100, B, 0);
  assert.ok(Math.abs(d.y - 650) < 1e-9 && Math.abs(d.x - 850) < 1e-9);
  assert.deepEqual(clampDash(500, 300, 600, 320, B, 10), { x: 600, y: 320 });
  // Desde fuera: primero se mete dentro
  const o = clampDash(-100, 300, -500, 300, B, 10);
  assert.ok(!outOfBounds(o.x, o.y, B));
});

test('clampVelocity no empuja hacia fuera', () => {
  assert.deepEqual(clampVelocity(100, 300, -50, 10, B), { vx: 0, vy: 10 });
  assert.deepEqual(clampVelocity(500, 650, 5, 80, B), { vx: 5, vy: 0 });
  assert.deepEqual(clampVelocity(500, 300, -50, 80, B), { vx: -50, vy: 80 });
});

test('cualquier punto al azar queda dentro tras el clamp', () => {
  for (let k = 0; k < 500; k++) {
    const x = Math.random() * 4000 - 2000;
    const y = Math.random() * 4000 - 2000;
    const p = clampToBounds(x, y, B, 25);
    assert.ok(!outOfBounds(p.x, p.y, B));
    const q = clampDash(Math.random() * 800 + 100, Math.random() * 600 + 50, x, y, B, 25);
    assert.ok(!outOfBounds(q.x, q.y, B));
  }
});

test('clipBeamToBounds corta el haz en el borde de la arena', async () => {
  const { clipBeamToBounds } = await import('../src/level/bounds.ts');
  // Hacia la derecha desde (500,300): borde en x=900 -> 400
  assert.equal(clipBeamToBounds(500, 300, 0, 2000, B), 400);
  // Hacia arriba: borde y=50 -> 250
  assert.ok(Math.abs(clipBeamToBounds(500, 300, -Math.PI / 2, 2000, B) - 250) < 1e-6);
  // Si cabe, no se toca
  assert.equal(clipBeamToBounds(500, 300, 0, 100, B), 100);
  // Diagonal: el primer borde que toque
  const d = clipBeamToBounds(500, 300, Math.PI / 4, 5000, B);
  assert.ok(Math.abs(d - 350 * Math.SQRT2) < 1e-6);
  // Con margen
  assert.equal(clipBeamToBounds(500, 300, 0, 2000, B, 20), 380);
  // Pegado al borde hacia fuera: longitud 0
  assert.equal(clipBeamToBounds(900, 300, 0, 500, B), 0);
  // Origen fuera: se acota al borde y no sale
  assert.equal(clipBeamToBounds(1000, 300, Math.PI, 5000, B), 800);
});
