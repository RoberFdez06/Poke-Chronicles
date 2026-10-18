// Ejecutar con `npm test` (usa el runner de Node, sin dependencias extra).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFloor, OPPOSITE, DIR_DELTA, type Dir, type Floor } from '../src/level/floorGen.ts';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);

function reachable(floor: Floor): Set<number> {
  const seen = new Set([floor.startId]);
  const stack = [floor.startId];
  while (stack.length) {
    const r = floor.rooms[stack.pop()!];
    for (const n of Object.values(r.doors)) {
      if (n !== undefined && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen;
}

test('la misma semilla genera el mismo piso', () => {
  assert.deepEqual(generateFloor({ seed: 42 }), generateFloor({ seed: 42 }));
});

test('semillas distintas generan pisos distintos', () => {
  const layouts = new Set(SEEDS.slice(0, 50).map((seed) => JSON.stringify(generateFloor({ seed }).rooms)));
  assert.ok(layouts.size > 40);
});

for (const roomCount of [6, 10, 14]) {
  test(`pisos válidos con ${roomCount} salas`, () => {
    for (const seed of SEEDS) {
      const f = generateFloor({ seed, roomCount });
      const kinds = f.rooms.map((r) => r.kind);

      assert.equal(f.rooms.length, roomCount);
      assert.equal(kinds.filter((k) => k === 'start').length, 1);
      assert.equal(kinds.filter((k) => k === 'item').length, 1);
      assert.equal(kinds.filter((k) => k === 'boss').length, 1);
      assert.equal(reachable(f).size, roomCount, 'todas las salas son alcanzables');

      const boss = f.rooms[f.bossId];
      assert.equal(Object.keys(boss.doors).length, 1, 'el jefe es una sala sin salida');
      assert.ok(boss.depth >= 2, 'el jefe no está junto a la sala inicial');
      assert.equal(Object.keys(f.rooms[f.itemId].doors).length, 1, 'el objeto es una sala sin salida');

      const cells = new Set<string>();
      for (const r of f.rooms) {
        assert.ok(r.gx >= 0 && r.gy >= 0 && r.gx < f.cols && r.gy < f.rows);
        cells.add(`${r.gx},${r.gy}`);
        for (const [d, n] of Object.entries(r.doors) as [Dir, number][]) {
          const other = f.rooms[n];
          assert.equal(other.gx, r.gx + DIR_DELTA[d].dx);
          assert.equal(other.gy, r.gy + DIR_DELTA[d].dy);
          assert.equal(other.doors[OPPOSITE[d]], r.id, 'las puertas son simétricas');
        }
      }
      assert.equal(cells.size, roomCount, 'no hay salas solapadas');
    }
  });
}
