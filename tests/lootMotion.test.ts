import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  launchLoot, LOOT_MAGNET_BASE, LOOT_SCATTER_MAX, magnetRadius, restingLoot, scatterTarget, stepLoot, type Bounds,
} from '../src/data/lootMotion.ts';

const ROOM: Bounds = { x0: 100, y0: 100, x1: 900, y1: 600 };
const rng = (() => {
  let s = 7;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();

/** Simula `secs` segundos a 60 fps; devuelve cuántas veces tocó el suelo con fuerza (botes). */
function run(b: ReturnType<typeof launchLoot>, secs: number, pull?: Parameters<typeof stepLoot>[2]) {
  let bounces = 0;
  let wasUp = false;
  for (let i = 0; i < secs * 60; i++) {
    stepLoot(b, 1 / 60, pull);
    if (wasUp && b.z === 0) bounces++;
    wasUp = b.z > 0;
  }
  return bounces;
}

test('sale con un salto, rebota y se queda quieto en su destino', () => {
  const b = launchLoot(500, 300, 540, 320, () => 0.5, ROOM);
  stepLoot(b, 1 / 60);
  assert.ok(b.z > 0, 'sube al salir');
  const bounces = run(b, 3);
  assert.ok(bounces >= 2, `rebota (${bounces} botes)`);
  assert.ok(b.resting);
  assert.equal(b.z, 0);
  assert.ok(Math.abs(b.x - 540) < 1 && Math.abs(b.y - 320) < 1);
});

test('nunca sale de la sala, aunque caiga junto a la pared o el destino quede fuera', () => {
  const b = launchLoot(95, 610, -200, 900, rng, ROOM);
  for (let i = 0; i < 240; i++) {
    stepLoot(b, 1 / 60);
    assert.ok(b.x >= ROOM.x0 && b.x <= ROOM.x1 && b.y >= ROOM.y0 && b.y <= ROOM.y1);
  }
  for (let i = 0; i < 50; i++) {
    const t = scatterTarget(ROOM.x0, ROOM.y1, rng, ROOM);
    assert.ok(t.x >= ROOM.x0 && t.y <= ROOM.y1);
  }
  const t = scatterTarget(500, 300, () => 0.99, ROOM);
  assert.ok(Math.hypot(t.x - 500, t.y - 300) <= LOOT_SCATTER_MAX + 1e-9);
});

test('se atrae al jugador si está cerca y lo puede coger; lejos o sin poder cogerlo, no', () => {
  const near = restingLoot(500, 300, ROOM);
  const pull = { x: 540, y: 300, radius: magnetRadius(0), wanted: true };
  assert.ok(stepLoot(near, 1 / 60, pull));
  run(near, 1, pull);
  assert.ok(Math.hypot(near.x - 540, near.y - 300) < 2, 'llega al jugador');

  const far = restingLoot(500, 300, ROOM);
  assert.ok(!stepLoot(far, 1 / 60, { ...pull, x: 500 + LOOT_MAGNET_BASE + 10 }));
  assert.equal(far.x, 500);

  const full = restingLoot(500, 300, ROOM);
  run(full, 1, { ...pull, wanted: false });
  assert.equal(full.x, 500);
});

test('el primer salto siempre se ve: en el aire antes de tocar el suelo no se atrae', () => {
  const b = launchLoot(500, 300, 500, 300, () => 0.5, ROOM);
  assert.ok(!stepLoot(b, 1 / 60, { x: 505, y: 300, radius: 100, wanted: true }));
});

test('el imán (Zahorí) amplía el radio', () => {
  assert.equal(magnetRadius(0), LOOT_MAGNET_BASE);
  assert.ok(magnetRadius(110) > magnetRadius(0));
  assert.equal(magnetRadius(-50), LOOT_MAGNET_BASE);
  const b = restingLoot(500, 300, ROOM);
  const pull = { x: 500 + LOOT_MAGNET_BASE + 40, y: 300, wanted: true };
  assert.ok(!stepLoot(b, 1 / 60, { ...pull, radius: magnetRadius(0) }));
  assert.ok(stepLoot(b, 1 / 60, { ...pull, radius: magnetRadius(110) }));
});
