// Ejecutar con `npm test`. Reto final (supervisor).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINAL_FLOOR, GIANTS, isFinalFloor, isFinaleGate, pickFinale, TRIOS } from '../src/data/finale.ts';
import { FLOOR_COUNT } from '../src/level/progression.ts';

test('el reto final es el piso siguiente al último, solo en Normal', () => {
  assert.equal(FINAL_FLOOR, FLOOR_COUNT + 1);
  assert.ok(isFinalFloor('normal', FINAL_FLOOR));
  assert.ok(!isFinalFloor('endless', FINAL_FLOOR));
  assert.ok(isFinaleGate('normal', FLOOR_COUNT));
  assert.ok(!isFinaleGate('normal', FLOOR_COUNT - 1));
});

test('sale trío o gigante, y los dos a menudo', () => {
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const kinds = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const f = pickFinale(rng);
    kinds.add(f.kind);
    assert.equal(f.ids.length, f.kind === 'trio' ? 3 : 1);
  }
  assert.deepEqual([...kinds].sort(), ['giant', 'trio']);
});

test('sin conexión solo usa los que hay', () => {
  const have = new Set([144, 145, 146]);
  const f = pickFinale(() => 0.9, (id) => have.has(id));
  assert.deepEqual(f.ids, [144, 145, 146]);
  const g = pickFinale(() => 0.1, (id) => id === 150);
  assert.deepEqual(g.ids, [150]);
  assert.ok(TRIOS.every((t) => t.ids.length === 3) && GIANTS.length > 10);
});
